/** Safe-to-expose product limits for UI copy (mirrors server defaults). */
export const PUBLIC_LIMITS = {
  maxPdfBytes: 5 * 1024 * 1024,
  maxPdfLabel: "5 MB",
  maxPages: 100,
  maxChunksPerDocument: 300,
  maxStoredChunksGlobal: 1000,
  maxQuestionLength: 1000,
} as const;

export const SITE_NAME = "AskItUp";
export const SITE_TAGLINE = "Ask your documents. Find the answers.";
export const SITE_DESCRIPTION =
  "Upload a PDF, get a persistent document ID, and ask natural-language questions with page-level citations.";
