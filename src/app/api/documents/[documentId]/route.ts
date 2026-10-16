import { AppError } from "@/lib/errors/app-error";
import { jsonError, jsonOk } from "@/lib/api/http";
import { loadPublicDocument } from "@/lib/documents/process";
import { parseDocumentId } from "@/lib/validation/uuid";

type RouteContext = {
  params: Promise<{ documentId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { documentId: rawId } = await context.params;
    const documentId = parseDocumentId(rawId);

    if (!documentId) {
      throw new AppError(
        "VALIDATION",
        "Provide a valid document ID (UUID).",
      );
    }

    const document = await loadPublicDocument(documentId);
    return jsonOk({ document });
  } catch (error) {
    return jsonError(error);
  }
}
