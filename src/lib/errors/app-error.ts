export type AppErrorCode =
  | "VALIDATION"
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "CONFLICT"
  | "PAYLOAD_TOO_LARGE"
  | "UNSUPPORTED_MEDIA"
  | "UNPROCESSABLE"
  | "RATE_LIMITED"
  | "QUOTA_EXHAUSTED"
  | "TEMPORARY_UNAVAILABLE"
  | "CONFIGURATION"
  | "INTERNAL";

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status: number;
  readonly retryable: boolean;
  readonly details?: Record<string, unknown>;

  constructor(
    code: AppErrorCode,
    message: string,
    options?: {
      status?: number;
      retryable?: boolean;
      details?: Record<string, unknown>;
      cause?: unknown;
    },
  ) {
    super(message, options?.cause ? { cause: options.cause } : undefined);
    this.name = "AppError";
    this.code = code;
    this.status = options?.status ?? statusForCode(code);
    this.retryable = options?.retryable ?? false;
    this.details = options?.details;
  }
}

function statusForCode(code: AppErrorCode): number {
  switch (code) {
    case "VALIDATION":
      return 400;
    case "FORBIDDEN":
      return 403;
    case "NOT_FOUND":
      return 404;
    case "CONFLICT":
      return 409;
    case "PAYLOAD_TOO_LARGE":
      return 413;
    case "UNSUPPORTED_MEDIA":
      return 415;
    case "UNPROCESSABLE":
      return 422;
    case "RATE_LIMITED":
    case "QUOTA_EXHAUSTED":
      return 429;
    case "TEMPORARY_UNAVAILABLE":
      return 503;
    case "CONFIGURATION":
      return 500;
    default:
      return 500;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export function toPublicError(error: unknown): {
  status: number;
  body: {
    error: string;
    code: AppErrorCode;
    retryable: boolean;
    document?: unknown;
  };
} {
  if (isAppError(error)) {
    return {
      status: error.status,
      body: {
        error: error.message,
        code: error.code,
        retryable: error.retryable,
        ...(error.details?.document
          ? { document: error.details.document }
          : {}),
      },
    };
  }

  return {
    status: 500,
    body: {
      error: "Something went wrong. Please try again later.",
      code: "INTERNAL",
      retryable: true,
    },
  };
}
