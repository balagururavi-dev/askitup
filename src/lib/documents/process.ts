import "server-only";

import { LIMITS } from "@/lib/config/limits";
import { AppError, isAppError } from "@/lib/errors/app-error";
import { toAppErrorFromUnknown } from "@/lib/errors/supabase";
import { embedTexts } from "@/lib/ai/embeddings";
import { chunkPdfPages, type DocumentChunk } from "@/lib/documents/chunk-text";
import { extractPdfText } from "@/lib/documents/extract-text";
import {
  toPublicDocument,
  type DocumentRecord,
  type PublicDocument,
} from "@/lib/documents/types";
import { reserveChunkCapacity, reserveGeminiBudget } from "@/lib/usage/budget";
import { supabaseAdmin } from "@/lib/supabase/admin";

const DOCUMENT_SELECT =
  "id, filename, total_pages, status, stage, chunk_count, completed_chunks, pending_chunks, error_code, error_message, created_at, updated_at";

const DOCUMENT_SELECT_MINIMAL = "id, filename, total_pages, created_at";

type PendingChunk = {
  id: string;
  pageNumber: number;
  text: string;
};

type DocumentRow = DocumentRecord & {
  pending_chunks: PendingChunk[] | null;
};

function isMissingColumnError(error: {
  code?: string;
  message?: string;
} | null): boolean {
  if (!error) return false;
  const message = error.message ?? "";
  return (
    error.code === "42703" ||
    error.code === "PGRST204" ||
    /column .* does not exist/i.test(message) ||
    /Could not find the .* column/i.test(message) ||
    /pending_chunks|chunk_count|completed_chunks|status|stage|error_code|error_message|updated_at/i.test(
      message,
    )
  );
}

function asLegacyReadyRow(row: {
  id: string;
  filename: string;
  total_pages: number;
  created_at?: string | null;
}): DocumentRow {
  const createdAt = row.created_at ?? new Date().toISOString();
  return {
    id: row.id,
    filename: row.filename,
    total_pages: row.total_pages,
    status: "ready",
    stage: "ready",
    chunk_count: 0,
    completed_chunks: 0,
    pending_chunks: null,
    error_code: null,
    error_message: null,
    created_at: createdAt,
    updated_at: createdAt,
  };
}

async function getDocument(documentId: string): Promise<DocumentRow | null> {
  const { data, error } = await supabaseAdmin
    .from("documents")
    .select(DOCUMENT_SELECT)
    .eq("id", documentId)
    .maybeSingle();

  if (error) {
    if (isMissingColumnError(error)) {
      const fallback = await supabaseAdmin
        .from("documents")
        .select(DOCUMENT_SELECT_MINIMAL)
        .eq("id", documentId)
        .maybeSingle();
      if (fallback.error) throw fallback.error;
      if (!fallback.data) return null;
      return asLegacyReadyRow(fallback.data);
    }
    throw error;
  }

  return data as DocumentRow | null;
}

async function updateDocument(
  documentId: string,
  patch: Record<string, unknown>,
): Promise<DocumentRow> {
  const { data, error } = await supabaseAdmin
    .from("documents")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", documentId)
    .select(DOCUMENT_SELECT)
    .single();

  if (error) {
    if (isMissingColumnError(error)) {
      const fallback = await supabaseAdmin
        .from("documents")
        .select(DOCUMENT_SELECT_MINIMAL)
        .eq("id", documentId)
        .maybeSingle();
      if (fallback.error) throw fallback.error;
      if (!fallback.data) {
        throw new AppError(
          "NOT_FOUND",
          "This document could not be found or you do not have access.",
        );
      }
      return asLegacyReadyRow(fallback.data);
    }
    throw error;
  }

  return data as DocumentRow;
}

async function insertDocument(options: {
  filename: string;
  totalPages: number;
  chunkCount: number;
  pending: PendingChunk[];
}): Promise<DocumentRow> {
  const fullInsert = await supabaseAdmin
    .from("documents")
    .insert({
      filename: options.filename,
      total_pages: options.totalPages,
      status: "processing",
      stage: "chunking",
      chunk_count: options.chunkCount,
      completed_chunks: 0,
      pending_chunks: options.pending,
    })
    .select(DOCUMENT_SELECT)
    .single();

  if (!fullInsert.error && fullInsert.data) {
    return fullInsert.data as DocumentRow;
  }

  if (!isMissingColumnError(fullInsert.error)) {
    throw fullInsert.error;
  }

  // Legacy schema: filename + total_pages only. Resume metadata won't persist.
  console.warn(
    "documents lifecycle columns missing; inserting with legacy schema. Apply supabase migrations for resumable processing.",
  );

  const legacyInsert = await supabaseAdmin
    .from("documents")
    .insert({
      filename: options.filename,
      total_pages: options.totalPages,
    })
    .select(DOCUMENT_SELECT_MINIMAL)
    .single();

  if (legacyInsert.error) throw legacyInsert.error;
  return asLegacyReadyRow(legacyInsert.data);
}

async function markFailed(
  documentId: string,
  error: unknown,
): Promise<DocumentRow> {
  const appError = isAppError(error)
    ? error
    : toAppErrorFromUnknown(error);

  try {
    return await updateDocument(documentId, {
      status: "failed",
      stage: "failed",
      error_code: appError.code,
      error_message: appError.message,
    });
  } catch {
    const existing = await getDocument(documentId);
    if (existing) {
      return {
        ...existing,
        status: "failed",
        stage: "failed",
        error_code: appError.code,
        error_message: appError.message,
      };
    }
    throw appError;
  }
}

async function listExistingChunkKeys(documentId: string): Promise<Set<string>> {
  const { data, error } = await supabaseAdmin
    .from("document_chunks")
    .select("chunk_key")
    .eq("document_id", documentId);

  if (error) throw error;
  return new Set((data ?? []).map((row) => row.chunk_key as string));
}

function toPending(chunks: DocumentChunk[]): PendingChunk[] {
  return chunks.map((chunk) => ({
    id: chunk.id,
    pageNumber: chunk.pageNumber,
    text: chunk.text,
  }));
}

async function embedAndStoreMissingChunks(options: {
  documentId: string;
  chunks: PendingChunk[];
  existingKeys: Set<string>;
}): Promise<number> {
  const missing = options.chunks.filter(
    (chunk) => !options.existingKeys.has(chunk.id),
  );

  let completed = options.chunks.length - missing.length;

  for (
    let offset = 0;
    offset < missing.length;
    offset += LIMITS.embeddingBatchSize
  ) {
    const batch = missing.slice(offset, offset + LIMITS.embeddingBatchSize);

    await updateDocument(options.documentId, {
      status: "processing",
      stage: "embedding",
      completed_chunks: completed,
      error_code: null,
      error_message: null,
    });

    await reserveGeminiBudget(1);
    const embeddings = await embedTexts(batch.map((chunk) => chunk.text));

    await updateDocument(options.documentId, {
      stage: "storing",
    });

    const rows = batch.map((chunk, index) => ({
      document_id: options.documentId,
      chunk_key: chunk.id,
      page_number: chunk.pageNumber,
      content: chunk.text,
      embedding: embeddings[index].values,
    }));

    const { error: insertError } = await supabaseAdmin
      .from("document_chunks")
      .upsert(rows, { onConflict: "document_id,chunk_key" });

    if (insertError) {
      // Unique constraint may be missing on legacy DBs — fall back to insert.
      if (
        /onConflict|unique|constraint/i.test(insertError.message ?? "") ||
        insertError.code === "42P10"
      ) {
        const { error: plainInsertError } = await supabaseAdmin
          .from("document_chunks")
          .insert(rows);
        if (plainInsertError) throw plainInsertError;
      } else {
        throw insertError;
      }
    }

    completed += batch.length;
    await updateDocument(options.documentId, {
      completed_chunks: completed,
    });
  }

  return completed;
}

export async function createAndProcessDocument(options: {
  filename: string;
  buffer: Buffer;
}): Promise<PublicDocument> {
  let documentId: string | undefined;

  try {
    let extracted;
    try {
      extracted = await extractPdfText(options.buffer);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "PDF extraction failed.";
      if (/scanned|OCR|No extractable text/i.test(message)) {
        throw new AppError(
          "UNPROCESSABLE",
          "We couldn't extract readable text from this PDF. Image-only or scanned PDFs are not supported.",
          { cause: error },
        );
      }
      if (/password|encrypt/i.test(message)) {
        throw new AppError(
          "UNPROCESSABLE",
          "This PDF appears to be encrypted or password-protected. Please upload an unlocked PDF.",
          { cause: error },
        );
      }
      throw new AppError(
        "UNPROCESSABLE",
        "We couldn't read this PDF. It may be malformed or unsupported.",
        { cause: error },
      );
    }

    if (extracted.totalPages > LIMITS.maxPages) {
      throw new AppError(
        "PAYLOAD_TOO_LARGE",
        `This PDF has ${extracted.totalPages} pages. The current limit is ${LIMITS.maxPages} pages.`,
      );
    }

    const chunks = chunkPdfPages(extracted.pages, {
      maxCharacters: LIMITS.chunkMaxCharacters,
      overlapCharacters: LIMITS.chunkOverlapCharacters,
    });

    if (chunks.length === 0) {
      throw new AppError(
        "UNPROCESSABLE",
        "We couldn't extract readable text from this PDF.",
      );
    }

    if (chunks.length > LIMITS.maxChunksPerDocument) {
      throw new AppError(
        "PAYLOAD_TOO_LARGE",
        `This document produces ${chunks.length} chunks, which exceeds the per-document limit of ${LIMITS.maxChunksPerDocument}.`,
      );
    }

    await reserveChunkCapacity(chunks.length);

    const pending = toPending(chunks);
    const document = await insertDocument({
      filename: options.filename,
      totalPages: extracted.totalPages,
      chunkCount: chunks.length,
      pending,
    });

    documentId = document.id;

    await embedAndStoreMissingChunks({
      documentId: document.id,
      chunks: pending,
      existingKeys: new Set(),
    });

    const ready = await updateDocument(document.id, {
      status: "ready",
      stage: "ready",
      completed_chunks: chunks.length,
      pending_chunks: null,
      error_code: null,
      error_message: null,
    });

    return toPublicDocument({
      ...ready,
      status: "ready",
      stage: "ready",
      chunk_count: chunks.length,
      completed_chunks: chunks.length,
    });
  } catch (error) {
    const appError = toAppErrorFromUnknown(error);

    if (documentId) {
      const failed = await markFailed(documentId, appError);
      throw new AppError(appError.code, appError.message, {
        status: appError.status,
        retryable: appError.retryable,
        details: { document: toPublicDocument(failed) },
        cause: error,
      });
    }

    throw appError;
  }
}

export async function retryDocumentProcessing(
  documentId: string,
): Promise<PublicDocument> {
  const document = await getDocument(documentId);
  if (!document) {
    throw new AppError(
      "NOT_FOUND",
      "This document could not be found or you do not have access.",
    );
  }

  if (document.status === "ready") {
    return toPublicDocument(document);
  }

  const pending = Array.isArray(document.pending_chunks)
    ? document.pending_chunks
    : null;

  if (!pending?.length) {
    const existingKeys = await listExistingChunkKeys(documentId);
    if (
      document.chunk_count > 0 &&
      existingKeys.size >= document.chunk_count
    ) {
      const ready = await updateDocument(documentId, {
        status: "ready",
        stage: "ready",
        completed_chunks: existingKeys.size,
        pending_chunks: null,
        error_code: null,
        error_message: null,
      });
      return toPublicDocument(ready);
    }

    throw new AppError(
      "UNPROCESSABLE",
      "This document cannot be resumed automatically. Please upload the PDF again.",
      { retryable: false },
    );
  }

  const existingKeys = await listExistingChunkKeys(documentId);
  const missingCount = pending.length - existingKeys.size;
  if (missingCount > 0) {
    await reserveChunkCapacity(missingCount);
  }

  try {
    await updateDocument(documentId, {
      status: "processing",
      stage: "embedding",
      chunk_count: pending.length,
      error_code: null,
      error_message: null,
    });

    await embedAndStoreMissingChunks({
      documentId,
      chunks: pending,
      existingKeys,
    });

    const ready = await updateDocument(documentId, {
      status: "ready",
      stage: "ready",
      completed_chunks: pending.length,
      pending_chunks: null,
      error_code: null,
      error_message: null,
    });

    return toPublicDocument(ready);
  } catch (error) {
    const appError = toAppErrorFromUnknown(error);
    const failed = await markFailed(documentId, appError);
    throw new AppError(appError.code, appError.message, {
      status: appError.status,
      retryable: true,
      details: { document: toPublicDocument(failed) },
      cause: error,
    });
  }
}

export async function loadPublicDocument(
  documentId: string,
): Promise<PublicDocument> {
  const document = await getDocument(documentId);
  if (!document) {
    throw new AppError(
      "NOT_FOUND",
      "This document could not be found or you do not have access.",
    );
  }
  return toPublicDocument(document);
}
