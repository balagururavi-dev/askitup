
export function cleanPdfText(text: string): string {
    return text
      // Normalize Windows and old Mac line endings.
      .replace(/\r\n?/g, "\n")
      // Replace non-breaking spaces with regular spaces.
      .replace(/\u00A0/g, " ")
      // Remove trailing spaces from each line.
      .replace(/[ \t]+$/gm, "")
      // Collapse excessive blank lines without flattening paragraphs.
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }