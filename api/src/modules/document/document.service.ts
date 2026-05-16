import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  PDF_EXTRACTION_QUEUE,
  PdfExtractionJobPayload,
} from './queues/pdf-extraction.constants';

@Injectable()
export class DocumentService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(PDF_EXTRACTION_QUEUE)
    private readonly pdfQueue: Queue<PdfExtractionJobPayload>,
  ) {}

  async processUploads(files: Express.Multer.File[]) {
    const documents = await this.prisma.$transaction(
      files.map((file) =>
        this.prisma.document.create({
          data: {
            originalName: file.originalname,
            mimeType: file.mimetype,
            fileSize: file.size,
            filePath: file.path,
          },
          select: { id: true, filePath: true, originalName: true, mimeType: true },
        }),
      ),
    );

    for (const doc of documents) {
      if (doc.mimeType === 'application/pdf') {
        await this.pdfQueue.add('extract', {
          documentId: doc.id,
          originalName: doc.originalName,
          filePath: doc.filePath,
        });
      }
    }

    return documents.map(({ id, filePath }) => ({ id, filePath }));
  }
}
