export const PDF_EXTRACTION_QUEUE = 'pdf-extraction';

export type PdfExtractionJobPayload = {
  documentId: string;
  originalName: string;
  filePath: string;
};
