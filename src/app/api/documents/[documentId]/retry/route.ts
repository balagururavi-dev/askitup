import { AppError } from "@/lib/errors/app-error";
import { getClientIp, hashIdentifier, jsonError, jsonOk } from "@/lib/api/http";
import { retryDocumentProcessing } from "@/lib/documents/process";
import { enforceRateLimit } from "@/lib/usage/budget";
import { parseDocumentId } from "@/lib/validation/uuid";

export const maxDuration = 60;

type RouteContext = {
  params: Promise<{ documentId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const clientKey = await hashIdentifier(`upload:${getClientIp(request)}`);
    await enforceRateLimit({ clientKey, action: "upload" });

    const { documentId: rawId } = await context.params;
    const documentId = parseDocumentId(rawId);

    if (!documentId) {
      throw new AppError(
        "VALIDATION",
        "Provide a valid document ID (UUID).",
      );
    }

    const document = await retryDocumentProcessing(documentId);
    return jsonOk({ success: true, document });
  } catch (error) {
    console.error(
      "Document retry failed:",
      error instanceof AppError ? error.code : "INTERNAL",
    );
    return jsonError(error);
  }
}
