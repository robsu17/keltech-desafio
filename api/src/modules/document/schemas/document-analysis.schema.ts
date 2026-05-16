import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type DocumentAnalysisDocument = HydratedDocument<DocumentAnalysis>;

@Schema({ timestamps: { createdAt: 'createdAt', updatedAt: false } })
export class DocumentAnalysis {
  @Prop({ required: true })
  documentId!: string;

  @Prop({ required: true })
  originalName!: string;

  @Prop({ required: true })
  extractedText!: string;

  @Prop({ type: Object, required: true })
  patterns!: {
    dates: string[];
    monetaryValues: string[];
    cpfs: string[];
    cnpjs: string[];
  };
}

export const DocumentAnalysisSchema =
  SchemaFactory.createForClass(DocumentAnalysis);
