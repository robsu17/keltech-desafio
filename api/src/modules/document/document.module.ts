import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Env } from 'src/config/env';
import { DocumentController } from './document.controller';
import { DocumentService } from './document.service';
import {
  DocumentAnalysis,
  DocumentAnalysisSchema,
} from './schemas/document-analysis.schema';
import { PDF_EXTRACTION_QUEUE } from './queues/pdf-extraction.constants';
import { PdfExtractionProcessor } from './queues/pdf-extraction.processor';

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
    BullModule.registerQueue({ name: PDF_EXTRACTION_QUEUE }),
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
  providers: [DocumentService, PdfExtractionProcessor],
})
export class DocumentModule {}
