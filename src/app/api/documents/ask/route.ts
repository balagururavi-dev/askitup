import { LIMITS } from "@/lib/config/limits";
import { AppError } from "@/lib/errors/app-error";
import { getClientIp, hashIdentifier, jsonError, jsonOk } from "@/lib/api/http";
import { embedQuery } from "@/lib/ai/embeddings";
import { generateGroundedAnswer } from "@/lib/ai/generate-answer";
import { loadPublicDocument } from "@/lib/documents/process";
import { enforceRateLimit, reserveGeminiBudget } from "@/lib/usage/budget";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { askRequestSchema } from "@/lib/validation/schemas";

export const maxDuration = 60;

type RetrievedChunk = {
  chunk_key: string;
  page_number: number;
  content: string;
  similarity: number;
};

export async function POST(request: Request) {
  try {
    const clientKey = await hashIdentifier(`ask:${getClientIp(request)}`);
    await enforceRateLimit({ clientKey, action: "ask" });

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new AppError("VALIDATION", "Request body must be valid JSON.");
    }

    const parsed = askRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError(
        "VALIDATION",
        "Provide a valid document ID and question.",
      );
    }

    const { documentId, question } = parsed.data;
    const document = await loadPublicDocument(documentId);

    if (document.status !== "ready") {
      throw new AppError(
        "CONFLICT",
        document.status === "processing"
          ? "This document is still processing."
          : "This document is not ready for questions yet.",
        { retryable: document.retryable },
      );
    }

    // Query embed + answer generation.
    await reserveGeminiBudget(2);

    const queryEmbedding = await embedQuery(question);

    const { data: chunks, error: retrievalError } = await supabaseAdmin.rpc(
      "match_document_chunks",
      {
        query_embedding: queryEmbedding.values,
        target_document_id: documentId,
        match_count: LIMITS.retrievalMatchCount,
      },
    );

    if (retrievalError) throw retrievalError;

    const retrieved = (chunks ?? []) as RetrievedChunk[];
    const evidence = retrieved.filter(
      (chunk) =>
        typeof chunk.similarity !== "number" ||
        chunk.similarity >= LIMITS.retrievalMinSimilarity,
    );

    if (!evidence.length) {
      return jsonOk({
        answer:
          "I couldn't find enough information in this document to answer that.",
        citations: [],
        document: {
          id: document.id,
          filename: document.filename,
        },
      });
    }

    const generated = await generateGroundedAnswer({
      question,
      evidence: evidence.map((chunk) => ({
        chunkKey: chunk.chunk_key,
        pageNumber: chunk.page_number,
        content: chunk.content,
        similarity: chunk.similarity,
      })),
    });

    const allowedKeys = new Set(evidence.map((chunk) => chunk.chunk_key));
    const citationKeys = [...new Set(generated.citationChunkKeys)].filter(
      (key) => allowedKeys.has(key),
    );

    const citations = citationKeys.map((key) => {
      const chunk = evidence.find((item) => item.chunk_key === key)!;
      return {
        chunkKey: chunk.chunk_key,
        pageNumber: chunk.page_number,
        excerpt: chunk.content,
      };
    });

    return jsonOk({
      answer: generated.answer,
      citations,
      document: {
        id: document.id,
        filename: document.filename,
      },
    });
  } catch (error) {
    console.error(
      "Question answering failed:",
      error instanceof AppError ? error.code : "INTERNAL",
    );
    return jsonError(error);
  }
}
