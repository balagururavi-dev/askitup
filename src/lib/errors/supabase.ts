import { AppError } from "@/lib/errors/app-error";

type SupabaseLikeError = {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
};

function isSupabaseLikeError(error: unknown): error is SupabaseLikeError {
  if (error == null || typeof error !== "object" || error instanceof AppError) {
    return false;
  }
  return "message" in error || "code" in error;
}

/**
 * Convert PostgREST / Supabase client errors into safe AppErrors.
 * Missing lifecycle columns → clear migration guidance.
 */
export function toAppErrorFromUnknown(error: unknown): AppError {
  if (error instanceof AppError) return error;

  if (isSupabaseLikeError(error)) {
    const message = error.message ?? "Database request failed.";
    const code = error.code ?? "";
    const combined = `${message} ${error.details ?? ""} ${error.hint ?? ""}`;

    if (
      code === "PGRST204" ||
      code === "42703" ||
      /column .* does not exist/i.test(combined) ||
      /Could not find the .* column/i.test(combined) ||
      /pending_chunks|chunk_count|completed_chunks|status|stage/i.test(combined)
    ) {
      return new AppError(
        "CONFIGURATION",
        "The database schema is missing required AskItUp columns. Apply supabase/migrations/001_askitup_schema.sql (or 002_upgrade_existing.sql) in the Supabase SQL editor, then retry.",
        { retryable: false, cause: error },
      );
    }

    if (code === "PGRST202" || /function .* does not exist/i.test(combined)) {
      return new AppError(
        "CONFIGURATION",
        "A required database function is missing. Apply the RPC section of supabase/migrations/001_askitup_schema.sql, then retry.",
        { retryable: false, cause: error },
      );
    }

    return new AppError(
      "TEMPORARY_UNAVAILABLE",
      "Document storage failed. Please try again shortly.",
      { retryable: true, cause: error },
    );
  }

  if (error instanceof Error) {
    return new AppError(
      "TEMPORARY_UNAVAILABLE",
      "Document processing failed unexpectedly. Please try again.",
      { retryable: true, cause: error },
    );
  }

  return new AppError(
    "INTERNAL",
    "Something went wrong while processing this PDF.",
    { retryable: true, cause: error },
  );
}
