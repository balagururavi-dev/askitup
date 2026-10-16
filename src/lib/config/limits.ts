/**
 * Centralized MVP limits for AskItUp.
 * Tuned for gemini-embedding-001 on a shared free-tier deployment.
 */

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export const LIMITS = {
  /** Maximum uploaded PDF size in bytes (default 5 MB). */
  maxPdfBytes: envInt("ASKITUP_MAX_PDF_BYTES", 5 * 1024 * 1024),

  /** Maximum extractable pages per PDF. */
  maxPages: envInt("ASKITUP_MAX_PAGES", 100),

  /**
   * Maximum chunks produced from a single document.
   * Sized for ~100-page text PDFs with the default chunking strategy.
   */
  maxChunksPerDocument: envInt("ASKITUP_MAX_CHUNKS_PER_DOCUMENT", 300),

  /**
   * Shared application-wide cap on stored chunks across all documents.
   * Enforced atomically in Postgres before embedding work proceeds.
   */
  maxStoredChunksGlobal: envInt("ASKITUP_MAX_STORED_CHUNKS", 1000),

  /** Chunking defaults — larger chunks = fewer embeddings, coarser retrieval. */
  chunkMaxCharacters: envInt("ASKITUP_CHUNK_MAX_CHARS", 2000),
  chunkOverlapCharacters: envInt("ASKITUP_CHUNK_OVERLAP_CHARS", 300),

  /** Embedding / insert batch size for resumable processing. */
  embeddingBatchSize: envInt("ASKITUP_EMBEDDING_BATCH_SIZE", 10),

  /** Required embedding dimensionality for gemini-embedding-001. */
  embeddingDimensions: 3072,

  /** Maximum question length accepted by /api/documents/ask. */
  maxQuestionLength: envInt("ASKITUP_MAX_QUESTION_LENGTH", 1000),

  /** Retrieval knobs. */
  retrievalMatchCount: envInt("ASKITUP_RETRIEVAL_MATCH_COUNT", 5),
  /** Minimum similarity (0–1) for a chunk to count as supporting evidence. */
  retrievalMinSimilarity: Number.parseFloat(
    process.env.ASKITUP_RETRIEVAL_MIN_SIMILARITY ?? "0.25",
  ),

  /** Per-client rate limits (keyed by IP hash). */
  rateLimitUploadsPerHour: envInt("ASKITUP_RATE_LIMIT_UPLOADS_PER_HOUR", 5),
  rateLimitQuestionsPerHour: envInt(
    "ASKITUP_RATE_LIMIT_QUESTIONS_PER_HOUR",
    30,
  ),

  /**
   * Conservative daily Gemini request budget across the shared deployment
   * (embedding batches + generation calls).
   */
  dailyGeminiRequestBudget: envInt(
    "ASKITUP_DAILY_GEMINI_REQUEST_BUDGET",
    400,
  ),
} as const;

export const EMBEDDING_MODEL = "gemini-embedding-001";

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes % (1024 * 1024) === 0 ? 0 : 1)} MB`;
}
