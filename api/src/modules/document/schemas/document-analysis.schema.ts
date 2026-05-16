import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type DocumentAnalysisDocument = HydratedDocument<DocumentAnalysis>;

export type AnalysisStatus = 'pending' | 'processed' | 'error';

@Schema({ timestamps: { createdAt: 'createdAt', updatedAt: false } })
export class DocumentAnalysis {
  @Prop({ required: true })
  documentId!: string;

  @Prop({ required: true })
  originalName!: string;

  @Prop({ required: true, enum: ['pending', 'processed', 'error'] })
  status!: AnalysisStatus;

  @Prop()
  extractedText?: string;

  @Prop({ type: Object })
  patterns?: {
    dates: string[];
    monetaryValues: string[];
    cpfs: string[];
    cnpjs: string[];
  };

  @Prop()
  errorMessage?: string;

  @Prop()
  processedAt?: Date;
}

export const DocumentAnalysisSchema =
  SchemaFactory.createForClass(DocumentAnalysis);
