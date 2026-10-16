
import "pdf-parse/worker";
import { PDFParse } from "pdf-parse";

export type ExtractedPage = {
  pageNumber: number;
  text: string;
};

export type ExtractedPdf = {
  totalPages: number;
  pages: ExtractedPage[];
  fullText: string;
};

export async function extractPdfText(
  file: Buffer,
): Promise<ExtractedPdf> {
  const parser = new PDFParse({ data: new Uint8Array(file) });

  try {
    const result = await parser.getText();

    const pages: ExtractedPage[] = result.pages.map((page) => ({
      pageNumber: page.num,
      text: page.text.trim(),
    }));

    const fullText = pages
      .map((page) => page.text)
      .filter(Boolean)
      .join("\n\n");

    if (!fullText.trim()) {
      throw new Error(
        "No extractable text found. This PDF may contain scanned pages and require OCR.",
      );
    }

    return {
      totalPages: result.total,
      pages,
      fullText,
    };
  } finally {
    await parser.destroy();
  }
}