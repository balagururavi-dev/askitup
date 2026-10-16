import "server-only";

import { LIMITS } from "@/lib/config/limits";
import { AppError } from "@/lib/errors/app-error";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type BudgetReservation = {
  reservationId: string;
  remaining: number;
};

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Atomically reserve Gemini request budget for the shared deployment.
 * Uses a Postgres RPC that increments under a row lock.
 */
export async function reserveGeminiBudget(
  units: number,
): Promise<BudgetReservation> {
  if (units <= 0) {
    throw new AppError("INTERNAL", "Budget reservation must be positive.");
  }

  const { data, error } = await supabaseAdmin.rpc("reserve_gemini_budget", {
    p_day: todayUtc(),
    p_units: units,
    p_max_units: LIMITS.dailyGeminiRequestBudget,
  });

  if (error) {
    // Fallback path when migration has not been applied yet.
    if (error.code === "PGRST202" || error.message?.includes("reserve_gemini_budget")) {
      console.warn(
        "reserve_gemini_budget RPC missing; falling back to soft daily check.",
      );
      return softReserveGeminiBudget(units);
    }
    throw error;
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.allowed) {
    throw new AppError(
      "QUOTA_EXHAUSTED",
      "AI processing is temporarily unavailable because the shared daily usage budget is exhausted. Try again tomorrow.",
      { retryable: false },
    );
  }

  return {
    reservationId: String(row.reservation_id ?? crypto.randomUUID()),
    remaining: Number(row.remaining ?? 0),
  };
}

async function softReserveGeminiBudget(units: number): Promise<BudgetReservation> {
  const day = todayUtc();
  const { data, error } = await supabaseAdmin
    .from("usage_daily")
    .select("units_used")
    .eq("day", day)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    // Table may not exist yet in older deployments.
    console.warn("usage_daily unavailable; skipping budget reservation.");
    return { reservationId: crypto.randomUUID(), remaining: -1 };
  }

  const used = data?.units_used ?? 0;
  if (used + units > LIMITS.dailyGeminiRequestBudget) {
    throw new AppError(
      "QUOTA_EXHAUSTED",
      "AI processing is temporarily unavailable because the shared daily usage budget is exhausted. Try again tomorrow.",
      { retryable: false },
    );
  }

  if (data) {
    const { error: updateError } = await supabaseAdmin
      .from("usage_daily")
      .update({ units_used: used + units })
      .eq("day", day)
      .eq("units_used", used);
    if (updateError) throw updateError;
  } else {
    const { error: insertError } = await supabaseAdmin.from("usage_daily").insert({
      day,
      units_used: units,
    });
    if (insertError) throw insertError;
  }

  return {
    reservationId: crypto.randomUUID(),
    remaining: LIMITS.dailyGeminiRequestBudget - used - units,
  };
}

export async function countStoredChunks(): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from("document_chunks")
    .select("id", { count: "exact", head: true });

  if (error) throw error;
  return count ?? 0;
}

/**
 * Atomically reserve global chunk capacity before embedding.
 * Returns false / throws when the shared cap would be exceeded.
 */
export async function reserveChunkCapacity(needed: number): Promise<void> {
  if (needed <= 0) {
    throw new AppError("VALIDATION", "Document produced no usable chunks.");
  }

  const { data, error } = await supabaseAdmin.rpc("reserve_chunk_capacity", {
    p_needed: needed,
    p_max_chunks: LIMITS.maxStoredChunksGlobal,
  });

  if (error) {
    if (error.code === "PGRST202" || error.message?.includes("reserve_chunk_capacity")) {
      const current = await countStoredChunks();
      if (current + needed > LIMITS.maxStoredChunksGlobal) {
        throw new AppError(
          "PAYLOAD_TOO_LARGE",
          "This document would exceed the application's storage capacity.",
        );
      }
      return;
    }
    throw error;
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.allowed) {
    throw new AppError(
      "PAYLOAD_TOO_LARGE",
      "This document would exceed the application's storage capacity.",
      {
        details: {
          current: row?.current_count,
          needed,
          max: LIMITS.maxStoredChunksGlobal,
        },
      },
    );
  }
}

export async function enforceRateLimit(options: {
  clientKey: string;
  action: "upload" | "ask";
}): Promise<void> {
  const limit =
    options.action === "upload"
      ? LIMITS.rateLimitUploadsPerHour
      : LIMITS.rateLimitQuestionsPerHour;

  const { data, error } = await supabaseAdmin.rpc("check_rate_limit", {
    p_client_key: options.clientKey,
    p_action: options.action,
    p_limit: limit,
    p_window_seconds: 3600,
  });

  if (error) {
    if (error.code === "PGRST202" || error.message?.includes("check_rate_limit")) {
      console.warn("check_rate_limit RPC missing; skipping rate limit.");
      return;
    }
    throw error;
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.allowed) {
    throw new AppError(
      "RATE_LIMITED",
      options.action === "upload"
        ? "Upload rate limit reached for this network. Please try again later."
        : "Question rate limit reached for this network. Please try again later.",
      { retryable: true },
    );
  }
}
