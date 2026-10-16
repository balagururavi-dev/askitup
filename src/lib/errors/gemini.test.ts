import { describe, expect, it } from "vitest";
import { classifyGeminiError, geminiErrorToAppError } from "./gemini";

describe("classifyGeminiError", () => {
  it("classifies daily quota exhaustion as non-retryable", () => {
    const classified = classifyGeminiError({
      status: 429,
      message: "RESOURCE_EXHAUSTED: Daily quota exceeded",
    });
    expect(classified.kind).toBe("quota");
    expect(classified.retryable).toBe(false);
    expect(
      geminiErrorToAppError({
        status: 429,
        message: "RESOURCE_EXHAUSTED: Daily quota exceeded",
      }).code,
    ).toBe("QUOTA_EXHAUSTED");
  });

  it("classifies temporary 5xx as retryable", () => {
    const classified = classifyGeminiError({
      status: 503,
      message: "UNAVAILABLE",
    });
    expect(classified.kind).toBe("temporary");
    expect(classified.retryable).toBe(true);
  });

  it("classifies invalid API keys", () => {
    const classified = classifyGeminiError({
      status: 403,
      message: "API key not valid",
    });
    expect(classified.kind).toBe("auth");
    expect(classified.retryable).toBe(false);
  });
});
