import { AppError } from "./app-error";

export type GeminiFailureKind =
  | "quota"
  | "rate_limit"
  | "temporary"
  | "auth"
  | "invalid_model"
  | "invalid_output"
  | "unknown";

export type ClassifiedGeminiError = {
  kind: GeminiFailureKind;
  retryable: boolean;
  retryAfterMs?: number;
  message: string;
};

function readStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  const candidate = error as {
    status?: number;
    statusCode?: number;
    code?: number | string;
    error?: { code?: number | string; status?: string };
  };
  if (typeof candidate.status === "number") return candidate.status;
  if (typeof candidate.statusCode === "number") return candidate.statusCode;
  if (typeof candidate.code === "number") return candidate.code;
  if (typeof candidate.error?.code === "number") return candidate.error.code;
  return undefined;
}

function readMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return String(error);
}

function parseRetryAfterMs(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  const headers = (error as { headers?: Record<string, string> }).headers;
  const raw =
    headers?.["retry-after"] ??
    headers?.["Retry-After"] ??
    (error as { retryAfter?: string | number }).retryAfter;
  if (raw == null) return undefined;
  const asNumber = Number(raw);
  if (Number.isFinite(asNumber)) {
    // Retry-After may be seconds
    return asNumber < 1000 ? asNumber * 1000 : asNumber;
  }
  const asDate = Date.parse(String(raw));
  if (Number.isFinite(asDate)) {
    return Math.max(0, asDate - Date.now());
  }
  return undefined;
}

export function classifyGeminiError(error: unknown): ClassifiedGeminiError {
  const status = readStatus(error);
  const message = readMessage(error);
  const upper = message.toUpperCase();
  const retryAfterMs = parseRetryAfterMs(error);

  if (
    status === 429 ||
    upper.includes("RESOURCE_EXHAUSTED") ||
    upper.includes("QUOTA")
  ) {
    const daily =
      upper.includes("DAILY") ||
      upper.includes("PER_DAY") ||
      upper.includes("LIMIT: 0");
    return {
      kind: daily ? "quota" : "rate_limit",
      retryable: !daily,
      retryAfterMs,
      message,
    };
  }

  if (
    status === 401 ||
    status === 403 ||
    upper.includes("API KEY") ||
    upper.includes("PERMISSION_DENIED") ||
    upper.includes("UNAUTHENTICATED")
  ) {
    return {
      kind: "auth",
      retryable: false,
      message,
    };
  }

  if (
    status === 404 ||
    upper.includes("NOT_FOUND") ||
    upper.includes("UNSUPPORTED") ||
    upper.includes("INVALID MODEL")
  ) {
    return {
      kind: "invalid_model",
      retryable: false,
      message,
    };
  }

  if (
    (status != null && status >= 500) ||
    upper.includes("UNAVAILABLE") ||
    upper.includes("TIMEOUT") ||
    upper.includes("ECONNRESET") ||
    upper.includes("FETCH FAILED")
  ) {
    return {
      kind: "temporary",
      retryable: true,
      retryAfterMs,
      message,
    };
  }

  if (
    upper.includes("EMPTY") ||
    upper.includes("INVALID EMBEDDING") ||
    upper.includes("INVALID ANSWER")
  ) {
    return {
      kind: "invalid_output",
      retryable: true,
      message,
    };
  }

  return {
    kind: "unknown",
    retryable: true,
    retryAfterMs,
    message,
  };
}

export function geminiErrorToAppError(error: unknown): AppError {
  const classified = classifyGeminiError(error);

  switch (classified.kind) {
    case "quota":
      return new AppError(
        "QUOTA_EXHAUSTED",
        "AI processing is temporarily unavailable because the service has reached its usage limit. Your progress is saved; try again later.",
        {
          retryable: false,
          details: { retryAfterMs: classified.retryAfterMs },
          cause: error,
        },
      );
    case "rate_limit":
      return new AppError(
        "RATE_LIMITED",
        "The AI service is busy right now. Please wait a moment and try again.",
        {
          retryable: true,
          details: { retryAfterMs: classified.retryAfterMs },
          cause: error,
        },
      );
    case "auth":
      return new AppError(
        "CONFIGURATION",
        "AI service configuration is invalid. Please contact the site operator.",
        { retryable: false, cause: error },
      );
    case "invalid_model":
      return new AppError(
        "CONFIGURATION",
        "The configured AI model is not available. Please contact the site operator.",
        { retryable: false, cause: error },
      );
    case "temporary":
      return new AppError(
        "TEMPORARY_UNAVAILABLE",
        "AI processing is temporarily unavailable. Your progress is saved; try again shortly.",
        {
          retryable: true,
          details: { retryAfterMs: classified.retryAfterMs },
          cause: error,
        },
      );
    case "invalid_output":
      return new AppError(
        "TEMPORARY_UNAVAILABLE",
        "The AI service returned an incomplete response. Please try again.",
        { retryable: true, cause: error },
      );
    default:
      return new AppError(
        "TEMPORARY_UNAVAILABLE",
        "AI processing failed unexpectedly. Please try again later.",
        { retryable: true, cause: error },
      );
  }
}

export async function withGeminiRetry<T>(
  operation: () => Promise<T>,
  options?: {
    maxAttempts?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
  },
): Promise<T> {
  const maxAttempts = options?.maxAttempts ?? 3;
  const baseDelayMs = options?.baseDelayMs ?? 400;
  const maxDelayMs = options?.maxDelayMs ?? 4000;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const classified = classifyGeminiError(error);

      if (!classified.retryable || attempt === maxAttempts) {
        throw geminiErrorToAppError(error);
      }

      // Do not burn retries on hard daily quota exhaustion.
      if (classified.kind === "quota" || classified.kind === "auth") {
        throw geminiErrorToAppError(error);
      }

      const jitter = Math.floor(Math.random() * 200);
      const exponential = Math.min(
        maxDelayMs,
        baseDelayMs * 2 ** (attempt - 1) + jitter,
      );
      const delay = classified.retryAfterMs ?? exponential;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw geminiErrorToAppError(lastError);
}
