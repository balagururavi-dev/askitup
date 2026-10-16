
import type { DocumentChunk } from "./chunk-text";

export type OverlapCheck = {
  previousChunkId: string;
  nextChunkId: string;
  pageNumber: number;
  expectedOverlap: number;
  actualOverlap: number;
  passed: boolean;
};

function getOverlapLength(previous: string, next: string): number {
  const maxLength = Math.min(previous.length, next.length);

  for (let length = maxLength; length > 0; length--) {
    if (previous.slice(-length) === next.slice(0, length)) {
      return length;
    }
  }

  return 0;
}

export function verifyChunkOverlap(
  chunks: DocumentChunk[],
  expectedOverlap = 300,
  allowedDifference = 10,
): OverlapCheck[] {
  const checks: OverlapCheck[] = [];

  for (let i = 1; i < chunks.length; i++) {
    const previous = chunks[i - 1];
    const next = chunks[i];

    // Only compare consecutive chunks from the same page.
    if (previous.pageNumber !== next.pageNumber) continue;

    const actualOverlap = getOverlapLength(
      previous.text,
      next.text,
    );

    // Tolerance must not create a negative floor; zero overlap never passes a positive expectation.
    const threshold = Math.max(0, expectedOverlap - allowedDifference);
    const passed =
      expectedOverlap <= 0
        ? actualOverlap === 0
        : actualOverlap >= Math.max(threshold, 1);

    checks.push({
      previousChunkId: previous.id,
      nextChunkId: next.id,
      pageNumber: next.pageNumber,
      expectedOverlap,
      actualOverlap,
      passed,
    });
  }

  return checks;
}