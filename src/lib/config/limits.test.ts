import { describe, expect, it } from "vitest";
import { LIMITS, formatBytes } from "./limits";

describe("LIMITS", () => {
  it("exposes conservative MVP defaults", () => {
    expect(LIMITS.maxPdfBytes).toBe(5 * 1024 * 1024);
    expect(LIMITS.maxPages).toBe(100);
    expect(LIMITS.maxChunksPerDocument).toBe(300);
    expect(LIMITS.maxStoredChunksGlobal).toBe(1000);
    expect(LIMITS.embeddingDimensions).toBe(3072);
  });

  it("formats bytes for UI copy", () => {
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5 MB");
  });
});
