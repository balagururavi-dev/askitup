import "server-only";

import { GoogleGenAI } from "@google/genai";
import { EMBEDDING_MODEL, LIMITS } from "@/lib/config/limits";
import { AppError } from "@/lib/errors/app-error";
import { geminiErrorToAppError, withGeminiRetry } from "@/lib/errors/gemini";

const configuredModel =
  process.env.GEMINI_EMBEDDING_MODEL ?? EMBEDDING_MODEL;
const model = EMBEDDING_MODEL;

let ai: GoogleGenAI | null = null;

function getAi(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new AppError(
      "CONFIGURATION",
      "AI service is not configured.",
      { retryable: false },
    );
  }

  if (configuredModel !== EMBEDDING_MODEL) {
    console.warn(
      `GEMINI_EMBEDDING_MODEL is "${configuredModel}"; AskItUp requires "${EMBEDDING_MODEL}" for vector compatibility.`,
    );
  }

  if (!ai) {
    ai = new GoogleGenAI({ apiKey });
  }
  return ai;
}

export type TextEmbedding = {
  values: number[];
  dimensions: number;
};

type EmbeddingTaskType = "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY";

function toTextEmbedding(values: number[] | undefined): TextEmbedding {
  if (!values?.length || values.some((value) => !Number.isFinite(value))) {
    throw new AppError(
      "TEMPORARY_UNAVAILABLE",
      "The AI service returned an incomplete response. Please try again.",
      { retryable: true },
    );
  }

  if (values.length !== LIMITS.embeddingDimensions) {
    throw new AppError(
      "CONFIGURATION",
      `Embedding dimensions must be ${LIMITS.embeddingDimensions} for ${EMBEDDING_MODEL}. Received ${values.length}. Existing stored embeddings may be incompatible if the model changed.`,
      { retryable: false },
    );
  }

  return {
    values,
    dimensions: values.length,
  };
}

async function embedWithTaskType(
  text: string,
  taskType: EmbeddingTaskType,
): Promise<TextEmbedding> {
  if (!text.trim()) {
    throw new AppError(
      "VALIDATION",
      "Cannot generate an embedding for empty text.",
    );
  }

  try {
    return await withGeminiRetry(async () => {
      const response = await getAi().models.embedContent({
        model,
        contents: text,
        config: {
          taskType,
          outputDimensionality: LIMITS.embeddingDimensions,
        },
      });

      return toTextEmbedding(response.embeddings?.[0]?.values);
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw geminiErrorToAppError(error);
  }
}

export async function embedQuery(text: string): Promise<TextEmbedding> {
  return embedWithTaskType(text, "RETRIEVAL_QUERY");
}

export async function embedTexts(texts: string[]): Promise<TextEmbedding[]> {
  if (texts.length === 0) return [];

  if (texts.some((text) => !text.trim())) {
    throw new AppError(
      "VALIDATION",
      "Cannot generate embeddings for empty text.",
    );
  }

  try {
    return await withGeminiRetry(async () => {
      const response = await getAi().models.embedContent({
        model,
        contents: texts,
        config: {
          taskType: "RETRIEVAL_DOCUMENT",
          outputDimensionality: LIMITS.embeddingDimensions,
        },
      });

      const embeddings = response.embeddings;

      if (!embeddings || embeddings.length !== texts.length) {
        throw new AppError(
          "TEMPORARY_UNAVAILABLE",
          "The AI service returned an incomplete response. Please try again.",
          { retryable: true },
        );
      }

      return embeddings.map((embedding) => toTextEmbedding(embedding.values));
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw geminiErrorToAppError(error);
  }
}
