export const DOCUMENT_EXTRACTION_QUEUE = 'document-extraction';

export type DocumentExtractionJobPayload = {
  documentId: string;
  originalName: string;
  filePath: string;
  mimeType: string;
};
