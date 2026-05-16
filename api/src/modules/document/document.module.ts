import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { DocumentController } from './document.controller';
import { DocumentService } from './document.service';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import type { Env } from 'src/config/env';
import { DocumentAnalysis, DocumentAnalysisSchema } from './schemas/document-analysis.schema';
import { PdfExtractionService } from './services/pdf-extraction.service';

@Module({
  imports: [
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<Env>) => ({
        uri: configService.get<string>('MONGODB_URI'),
      }),
    }),
    MongooseModule.forFeature([
      { name: DocumentAnalysis.name, schema: DocumentAnalysisSchema },
    ]),
    MulterModule.register({
      storage: diskStorage({
        destination: './uploads',
        filename: (_req, file, callback) => {
          const ext = extname(file.originalname);
          const name = file.originalname
            .slice(0, -ext.length)
            .toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-_]/g, '');
          callback(null, `${name}-${randomUUID()}${ext}`);
        },
      }),
    }),
  ],
  controllers: [DocumentController],
  providers: [DocumentService, PdfExtractionService],
})
export class DocumentModule {}
