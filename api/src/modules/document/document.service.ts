import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { PdfExtractionService } from './services/pdf-extraction.service';

@Injectable()
export class DocumentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pdfExtraction: PdfExtractionService,
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
        this.pdfExtraction.extract(doc.id, doc.originalName, doc.filePath);
      }
    }

    return documents.map(({ id, filePath }) => ({ id, filePath }));
  }
}
