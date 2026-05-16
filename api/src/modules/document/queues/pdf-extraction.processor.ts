import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Job } from 'bullmq';
import { Model } from 'mongoose';
import { readFile } from 'node:fs/promises';
import { PDFParse } from 'pdf-parse';
import { createWorker } from 'tesseract.js';
import { PrismaService } from 'src/prisma/prisma.service';
import { EmailService } from 'src/modules/email/email.service';
import {
  DocumentAnalysis,
  DocumentAnalysisDocument,
} from '../schemas/document-analysis.schema';
import {
  DOCUMENT_EXTRACTION_QUEUE,
  DocumentExtractionJobPayload,
} from './pdf-extraction.constants';

/**
 * Padrões identificados:
 * - Datas: dd/mm/aaaa (ex: 25/12/2024)
 * - Valores monetários: R$ com separadores brasileiros (ex: R$ 1.500,00)
 * - CPF: XXX.XXX.XXX-XX
 * - CNPJ: XX.XXX.XXX/XXXX-XX
 */
const PATTERNS = {
  dates: /\b\d{2}\/\d{2}\/\d{4}\b/g,
  monetaryValues: /R\$\s?\d{1,3}(?:\.\d{3})*(?:,\d{2})?/g,
  cpfs: /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g,
  cnpjs: /\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/g,
};

@Processor(DOCUMENT_EXTRACTION_QUEUE)
export class PdfExtractionProcessor extends WorkerHost {
  private readonly logger = new Logger(PdfExtractionProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    @InjectModel(DocumentAnalysis.name)
    private readonly analysisModel: Model<DocumentAnalysisDocument>,
  ) {
    super();
  }

  async process(job: Job<DocumentExtractionJobPayload>): Promise<void> {
    const { documentId, originalName, filePath, mimeType, userEmail, userName } = job.data;
    const processedAt = new Date();

    try {
      const rawText =
        mimeType === 'application/pdf'
          ? await this.extractFromPdf(filePath)
          : await this.extractFromImage(filePath);

      const extractedText = this.normalizeText(rawText);
      const patterns = this.extractPatterns(extractedText);

      await Promise.all([
        this.prisma.document.update({
          where: { id: documentId },
          data: { status: 'PROCESSED', processedAt },
        }),
        this.analysisModel.create({
          documentId,
          originalName,
          extractedText,
          patterns,
        }),
        this.email.sendProcessingComplete(userEmail, userName, originalName),
      ]);

      this.logger.log(`Documento processado: ${originalName}`);
    } catch (err) {
      await Promise.all([
        this.prisma.document.update({
          where: { id: documentId },
          data: { status: 'ERROR', errorMessage: err.message, processedAt },
        }),
        this.email.sendProcessingError(userEmail, userName, originalName, err.message),
      ]);
      this.logger.error(`Falha ao processar ${originalName}: ${err.message}`);
      throw err;
    }
  }

  private async extractFromPdf(filePath: string): Promise<string> {
    const buffer = await readFile(filePath);
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    const { text } = await parser.getText();
    await parser.destroy();
    return text;
  }

  private async extractFromImage(filePath: string): Promise<string> {
    const worker = await createWorker('por+eng');
    try {
      const { data } = await worker.recognize(filePath);
      return data.text;
    } finally {
      await worker.terminate();
    }
  }

  private normalizeText(text: string): string {
    return text
      .replace(/\r\n|\r/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  private extractPatterns(text: string) {
    const match = (pattern: RegExp) => [...new Set(text.match(pattern) ?? [])];

    return {
      dates: match(PATTERNS.dates),
      monetaryValues: match(PATTERNS.monetaryValues),
      cpfs: match(PATTERNS.cpfs),
      cnpjs: match(PATTERNS.cnpjs),
    };
  }
}
