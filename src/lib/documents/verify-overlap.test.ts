
import { describe, expect, it } from "vitest";
import { chunkPdfPages } from "./chunk-text";
import { verifyChunkOverlap } from "./verify-overlap";

describe("verifyChunkOverlap", () => {
  it("confirms overlap between generated chunks", () => {
    const source = Array.from(
      { length: 5000 },
      (_, i) => String.fromCharCode(65 + (i % 26)),
    ).join("");

    const chunks = chunkPdfPages(
      [{ pageNumber: 1, text: source }],
      {
        maxCharacters: 500,
        overlapCharacters: 100,
      },
    );

    const results = verifyChunkOverlap(chunks, 100);

    expect(results.length).toBeGreaterThan(0);
    expect(results.every((result) => result.passed)).toBe(true);
  });

  it("reports when overlap is missing", () => {
    const results = verifyChunkOverlap(
      [
        { id: "a", pageNumber: 1, text: "ABCDEFGHIJ" },
        { id: "b", pageNumber: 1, text: "1234567890" },
      ],
      5,
    );

    expect(results[0].actualOverlap).toBe(0);
    expect(results[0].passed).toBe(false);
  });
});