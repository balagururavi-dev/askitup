export type DocumentStatus = "queued" | "processing" | "ready" | "failed";

export type DocumentProcessingStage =
  | "queued"
  | "extracting"
  | "chunking"
  | "embedding"
  | "storing"
  | "ready"
  | "failed";

export type DocumentRecord = {
  id: string;
  filename: string;
  total_pages: number;
  status: DocumentStatus;
  stage: DocumentProcessingStage;
  chunk_count: number;
  completed_chunks: number;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

export type PublicDocument = {
  id: string;
  filename: string;
  totalPages: number;
  status: DocumentStatus;
  stage: DocumentProcessingStage;
  chunkCount: number;
  completedChunks: number;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  retryable: boolean;
};

export function toPublicDocument(row: DocumentRecord): PublicDocument {
  return {
    id: row.id,
    filename: row.filename,
    totalPages: row.total_pages,
    status: row.status,
    stage: row.stage,
    chunkCount: row.chunk_count,
    completedChunks: row.completed_chunks,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    retryable: row.status === "failed" || row.status === "processing",
  };
}

export function stageLabel(stage: DocumentProcessingStage): string {
  switch (stage) {
    case "queued":
      return "Queued";
    case "extracting":
      return "Extracting PDF text";
    case "chunking":
      return "Chunking text";
    case "embedding":
      return "Generating embeddings";
    case "storing":
      return "Storing chunks";
    case "ready":
      return "Ready";
    case "failed":
      return "Failed";
    default:
      return stage;
  }
}
