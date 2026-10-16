import { LIMITS, formatBytes } from "@/lib/config/limits";
import { AppError } from "@/lib/errors/app-error";
import { toAppErrorFromUnknown } from "@/lib/errors/supabase";
import { getClientIp, hashIdentifier, jsonError, jsonOk } from "@/lib/api/http";
import { createAndProcessDocument } from "@/lib/documents/process";
import { validatePdfUpload } from "@/lib/documents/validate-pdf";
import { enforceRateLimit } from "@/lib/usage/budget";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const clientKey = await hashIdentifier(`upload:${getClientIp(request)}`);
    await enforceRateLimit({ clientKey, action: "upload" });

    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.includes("multipart/form-data")) {
      throw new AppError(
        "VALIDATION",
        "Upload must be multipart form data with a PDF file.",
      );
    }

    const formData = await request.formData();
    const validated = await validatePdfUpload(formData.get("file"));

    const document = await createAndProcessDocument({
      filename: validated.filename,
      buffer: validated.buffer,
    });

    return jsonOk({
      success: true,
      document,
      limits: {
        maxPdfBytes: LIMITS.maxPdfBytes,
        maxPdfLabel: formatBytes(LIMITS.maxPdfBytes),
        maxPages: LIMITS.maxPages,
        maxChunksPerDocument: LIMITS.maxChunksPerDocument,
      },
    });
  } catch (error) {
    const appError = toAppErrorFromUnknown(error);

    console.error("PDF upload failed:", {
      code: appError.code,
      message: appError.message,
    });

    return jsonError(appError);
  }
}
