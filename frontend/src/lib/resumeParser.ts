/**
 * Browser-side document parser for extracting plain text from resumes.
 * Handles PDF (.pdf), Word (.docx), Markdown (.md), and plain text (.txt)
 * completely inside the browser with zero external services or AI agents needed.
 * Heavy parser dependencies (pdfjs-dist, mammoth) are lazy-loaded dynamically
 * on demand to keep initial bundle size lean and page load under 1-2 seconds.
 */

export async function extractTextFromPDF(file: File): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist");

  if (typeof window !== "undefined" && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
  }

  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  let fullText = "";

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const pageText = (textContent.items as any[])
      .map((item: any) => (item && typeof item.str === "string" ? item.str : ""))
      .join(" ");
    fullText += pageText + "\n";
  }

  return fullText.trim();
}

export async function extractTextFromDocx(file: File): Promise<string> {
  const mammothModule = await import("mammoth");
  const mammoth = (mammothModule as any).default || mammothModule;
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return (result.value || "").trim();
}

export async function extractTextFromFile(file: File): Promise<string> {
  const name = file.name.toLowerCase();

  if (name.endsWith(".txt") || name.endsWith(".md")) {
    return (await file.text()).trim();
  }

  if (name.endsWith(".pdf")) {
    return await extractTextFromPDF(file);
  }

  if (name.endsWith(".docx")) {
    return await extractTextFromDocx(file);
  }

  throw new Error("Unsupported format. Please upload .txt, .md, .pdf, or .docx.");
}
