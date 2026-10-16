import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/errors/app-error";
import { validatePdfUpload } from "./validate-pdf";

function makeFile(options: {
  name?: string;
  type?: string;
  bytes: Uint8Array;
}): File {
  const copy = new Uint8Array(options.bytes);
  return new File([copy.buffer], options.name ?? "sample.pdf", {
    type: options.type ?? "application/pdf",
  });
}

describe("validatePdfUpload", () => {
  it("accepts a small PDF with magic bytes", async () => {
    const bytes = new TextEncoder().encode("%PDF-1.4\n%âãÏÓ\ntrailer");
    const result = await validatePdfUpload(
      makeFile({ bytes: new Uint8Array(bytes) }),
    );
    expect(result.filename).toMatch(/\.pdf$/i);
    expect(result.size).toBeGreaterThan(0);
  });

  it("rejects non-PDF content", async () => {
    const bytes = new TextEncoder().encode("hello world");
    await expect(
      validatePdfUpload(makeFile({ name: "x.pdf", bytes: new Uint8Array(bytes) })),
    ).rejects.toBeInstanceOf(AppError);
  });

  it("rejects oversized files", async () => {
    const huge = new Uint8Array(6 * 1024 * 1024);
    huge.set(new TextEncoder().encode("%PDF-1.4"), 0);
    await expect(
      validatePdfUpload(makeFile({ bytes: huge })),
    ).rejects.toMatchObject({ code: "PAYLOAD_TOO_LARGE" });
  });
});
