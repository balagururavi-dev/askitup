
import { cleanPdfText } from "./clean-text";

export type DocumentChunk = {
  id: string;
  pageNumber: number;
  text: string;
};

export type ChunkingOptions = {
  maxCharacters?: number;
  overlapCharacters?: number;
};

export function chunkPdfPages(
  pages: { pageNumber: number; text: string }[],
  options: ChunkingOptions = {},
): DocumentChunk[] {
  const maxCharacters = options.maxCharacters ?? 2000;
  const overlapCharacters = options.overlapCharacters ?? 300;

  if (maxCharacters <= 0) {
    throw new Error("maxCharacters must be greater than zero.");
  }

  if (overlapCharacters < 0 || overlapCharacters >= maxCharacters) {
    throw new Error(
      "overlapCharacters must be non-negative and smaller than maxCharacters.",
    );
  }

  const chunks: DocumentChunk[] = [];

  for (const page of pages) {
    const text = cleanPdfText(page.text);

    if (!text) continue;

    let start = 0;

    while (start < text.length) {
      let end = Math.min(start + maxCharacters, text.length);

      // Prefer ending at a paragraph or sentence boundary.
      if (end < text.length) {
        const minimumEnd = start + Math.floor(maxCharacters * 0.7);
        const boundary = Math.max(
          text.lastIndexOf("\n\n", end),
          text.lastIndexOf(". ", end),
          text.lastIndexOf("? ", end),
          text.lastIndexOf("! ", end),
        );

        if (boundary >= minimumEnd) {
          end = boundary + 1;
        }
      }

      const chunkText = text.slice(start, end).trim();

      if (chunkText) {
        chunks.push({
          id: `page-${page.pageNumber}-chunk-${chunks.length + 1}`,
          pageNumber: page.pageNumber,
          text: chunkText,
        });
      }

      if (end >= text.length) break;

      start = Math.max(end - overlapCharacters, start + 1);
    }
  }

  return chunks;
}