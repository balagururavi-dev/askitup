import { describe, expect, it } from "vitest";

function filterCitations(
  citationChunkKeys: string[],
  allowedKeys: Set<string>,
) {
  return [...new Set(citationChunkKeys)].filter((key) => allowedKeys.has(key));
}

describe("citation filtering", () => {
  it("drops invented citation keys", () => {
    const allowed = new Set(["page-1-chunk-1", "page-2-chunk-2"]);
    expect(
      filterCitations(
        ["page-1-chunk-1", "page-99-chunk-1", "page-1-chunk-1"],
        allowed,
      ),
    ).toEqual(["page-1-chunk-1"]);
  });
});
