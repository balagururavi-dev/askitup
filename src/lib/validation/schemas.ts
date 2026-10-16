import { z } from "zod";
import { LIMITS } from "@/lib/config/limits";

export const documentIdSchema = z.string().uuid();

export const askRequestSchema = z.object({
  documentId: documentIdSchema,
  question: z
    .string()
    .trim()
    .min(1, "Question cannot be empty.")
    .max(
      LIMITS.maxQuestionLength,
      `Question must be at most ${LIMITS.maxQuestionLength} characters.`,
    ),
});

export const answerSchema = z.object({
  answer: z.string().min(1),
  citationChunkKeys: z.array(z.string()),
});
