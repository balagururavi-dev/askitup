import { describe, expect, it } from "vitest";
import { isUuid, parseDocumentId } from "./uuid";

describe("uuid validation", () => {
  it("accepts canonical UUIDs", () => {
    expect(isUuid("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
    expect(parseDocumentId(" 550e8400-e29b-41d4-a716-446655440000 ")).toBe(
      "550e8400-e29b-41d4-a716-446655440000",
    );
  });

  it("rejects invalid identifiers", () => {
    expect(parseDocumentId("not-a-uuid")).toBeNull();
    expect(parseDocumentId("")).toBeNull();
    expect(isUuid("550e8400-e29b-41d4-a716-44665544000")).toBe(false);
  });
});
