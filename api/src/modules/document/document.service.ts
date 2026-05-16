import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  DOCUMENT_EXTRACTION_QUEUE,
  DocumentExtractionJobPayload,
} from './queues/pdf-extraction.constants';

const EXTRACTABLE_MIME_TYPES = ['application/pdf', 'image/png'];

@Injectable()
export class DocumentService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(DOCUMENT_EXTRACTION_QUEUE)
    private readonly extractionQueue: Queue<DocumentExtractionJobPayload>,
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
      if (EXTRACTABLE_MIME_TYPES.includes(doc.mimeType)) {
        await this.extractionQueue.add('extract', {
          documentId: doc.id,
          originalName: doc.originalName,
          filePath: doc.filePath,
          mimeType: doc.mimeType,
        });
      }
    }

    return documents.map(({ id, filePath }) => ({ id, filePath }));
  }
}
