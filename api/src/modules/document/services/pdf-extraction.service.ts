import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { readFile } from 'node:fs/promises';
import { PDFParse } from 'pdf-parse';
import {
  DocumentAnalysis,
  DocumentAnalysisDocument,
} from '../schemas/document-analysis.schema';

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

@Injectable()
export class PdfExtractionService {
  private readonly logger = new Logger(PdfExtractionService.name);

  constructor(
    @InjectModel(DocumentAnalysis.name)
    private readonly analysisModel: Model<DocumentAnalysisDocument>,
  ) {}

  async extract(documentId: string, originalName: string, filePath: string) {
    const record = await this.analysisModel.create({
      documentId,
      originalName,
      status: 'pending',
    });

    try {
      const buffer = await readFile(filePath);
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      const { text: rawText } = await parser.getText();
      await parser.destroy();

      const extractedText = this.normalizeText(rawText);
      const patterns = this.extractPatterns(extractedText);

      await record.updateOne({
        status: 'processed',
        extractedText,
        patterns,
        processedAt: new Date(),
      });
    } catch (err) {
      this.logger.error(`Falha ao processar ${originalName}: ${err.message}`);
      await record.updateOne({
        status: 'error',
        errorMessage: err.message,
        processedAt: new Date(),
      });
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
    const match = (pattern: RegExp) =>
      [...new Set(text.match(pattern) ?? [])];

    return {
      dates: match(PATTERNS.dates),
      monetaryValues: match(PATTERNS.monetaryValues),
      cpfs: match(PATTERNS.cpfs),
      cnpjs: match(PATTERNS.cnpjs),
    };
  }
}
