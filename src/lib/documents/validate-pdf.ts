import { LIMITS, formatBytes } from "@/lib/config/limits";
import { AppError } from "@/lib/errors/app-error";

const PDF_MAGIC = Buffer.from("%PDF-", "utf8");

export type ValidatedPdfUpload = {
  filename: string;
  size: number;
  buffer: Buffer;
};

function sanitizeFilename(name: string): string {
  const base = name.split(/[/\\]/).pop()?.trim() || "document.pdf";
  const cleaned = base.replace(/[^\w.\- ()[\]]+/g, "_").slice(0, 180);
  return cleaned.toLowerCase().endsWith(".pdf") ? cleaned : `${cleaned}.pdf`;
}

export async function validatePdfUpload(
  file: unknown,
): Promise<ValidatedPdfUpload> {
  if (!(file instanceof File)) {
    throw new AppError("VALIDATION", "Please select a PDF file.");
  }

  const filename = sanitizeFilename(file.name || "document.pdf");

  if (!filename.toLowerCase().endsWith(".pdf")) {
    throw new AppError(
      "UNSUPPORTED_MEDIA",
      "Only PDF files are supported.",
    );
  }

  if (file.type && file.type !== "application/pdf") {
    throw new AppError(
      "UNSUPPORTED_MEDIA",
      "Only PDF files are supported.",
    );
  }

  if (file.size <= 0) {
    throw new AppError("VALIDATION", "The uploaded PDF is empty.");
  }

  if (file.size > LIMITS.maxPdfBytes) {
    throw new AppError(
      "PAYLOAD_TOO_LARGE",
      `The document is larger than the current upload limit (${formatBytes(LIMITS.maxPdfBytes)}).`,
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  if (buffer.byteLength === 0) {
    throw new AppError("VALIDATION", "The uploaded PDF is empty.");
  }

  if (buffer.byteLength > LIMITS.maxPdfBytes) {
    throw new AppError(
      "PAYLOAD_TOO_LARGE",
      `The document is larger than the current upload limit (${formatBytes(LIMITS.maxPdfBytes)}).`,
    );
  }

  if (
    buffer.length < PDF_MAGIC.length ||
    !buffer.subarray(0, PDF_MAGIC.length).equals(PDF_MAGIC)
  ) {
    throw new AppError(
      "UNSUPPORTED_MEDIA",
      "The file does not look like a valid PDF.",
    );
  }

  return { filename, size: buffer.byteLength, buffer };
}
