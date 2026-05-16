import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class DocumentService {
  constructor(private readonly prisma: PrismaService) {}

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
          select: { id: true, filePath: true },
        }),
      ),
    );

    return documents;
  }
}
