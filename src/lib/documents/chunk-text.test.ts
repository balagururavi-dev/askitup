
import { describe, expect, it } from "vitest";
import { chunkPdfPages } from "./chunk-text";

describe("chunkPdfPages", () => {
  it("preserves page numbers and skips empty pages", () => {
    const chunks = chunkPdfPages([
      { pageNumber: 1, text: "First page content." },
      { pageNumber: 2, text: "   " },
      { pageNumber: 3, text: "Third page content." },
    ]);

    expect(chunks).toHaveLength(2);
    expect(chunks[0].pageNumber).toBe(1);
    expect(chunks[1].pageNumber).toBe(3);
  });

  it("splits long text into overlapping chunks", () => {
    const text = "A".repeat(1000);

    const chunks = chunkPdfPages(
      [{ pageNumber: 1, text }],
      { maxCharacters: 300, overlapCharacters: 50 },
    );

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].text.length).toBeLessThanOrEqual(300);
    expect(chunks[1].text.length).toBeLessThanOrEqual(300);
    expect(chunks[0].text.slice(-50)).toBe(chunks[1].text.slice(0, 50));
  });

  it("rejects invalid chunk settings", () => {
    expect(() =>
      chunkPdfPages([], {
        maxCharacters: 100,
        overlapCharacters: 100,
      }),
    ).toThrow();
  });
});