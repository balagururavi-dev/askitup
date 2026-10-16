import { describe, expect, it } from "vitest";
import { answerSchema, askRequestSchema } from "./schemas";

describe("askRequestSchema", () => {
  it("requires uuid and non-empty question", () => {
    const ok = askRequestSchema.safeParse({
      documentId: "550e8400-e29b-41d4-a716-446655440000",
      question: "What is this about?",
    });
    expect(ok.success).toBe(true);

    const bad = askRequestSchema.safeParse({
      documentId: "nope",
      question: " ",
    });
    expect(bad.success).toBe(false);
  });
});

describe("answerSchema", () => {
  it("accepts grounded answers and citation keys", () => {
    const parsed = answerSchema.safeParse({
      answer: "The document discusses testing.",
      citationChunkKeys: ["page-1-chunk-1"],
    });
    expect(parsed.success).toBe(true);
  });
});
