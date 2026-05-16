import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, NotFoundException } from '@nestjs/common';
import { Queue } from 'bullmq';
import { Prisma } from '../../../generated/prisma/client';
import type { DocumentWhereInput } from '../../../generated/prisma/models/Document';
import { PrismaService } from 'src/prisma/prisma.service';
import { parseAndValidateXml } from './validators/xml-metadata.validator';
import {
  DOCUMENT_EXTRACTION_QUEUE,
  DocumentExtractionJobPayload,
} from './queues/pdf-extraction.constants';
import { ListDocumentsDto } from './dto/list-documents.dto';

const EXTRACTABLE_MIME_TYPES = ['application/pdf', 'image/png'];

const REPORT_SELECT = {
  id: true,
  originalName: true,
  mimeType: true,
  fileSize: true,
  status: true,
  metadata: true,
  processedAt: true,
  createdAt: true,
} as const;

@Injectable()
export class DocumentService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(DOCUMENT_EXTRACTION_QUEUE)
    private readonly extractionQueue: Queue<DocumentExtractionJobPayload>,
  ) {}

  async processUploads(files: Express.Multer.File[], userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, name: true, email: true },
    });

    const documents = await this.prisma.$transaction(
      files.map((file) =>
        this.prisma.document.create({
          data: {
            originalName: file.originalname,
            mimeType: file.mimetype,
            fileSize: file.size,
            filePath: file.path,
            uploadedById: user.id,
          },
          select: {
            id: true,
            filePath: true,
            originalName: true,
            mimeType: true,
          },
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
          userEmail: user.email,
          userName: user.name,
        });
      }
    }

    return documents.map(({ id, filePath }) => ({ id, filePath }));
  }

  async fillXML(documentId: string, xmlContent: string) {
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      throw new NotFoundException(`Documento ${documentId} não encontrado`);
    }

    const metadata = parseAndValidateXml(xmlContent);

    await this.prisma.document.update({
      where: { id: documentId },
      data: { metadata },
    });

    return { documentId, metadata };
  }

  async getStats() {
    const now = new Date();

    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [total, byStatus, today, thisWeek, thisMonth] = await Promise.all([
      this.prisma.document.count(),
      this.prisma.document.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      this.prisma.document.count({ where: { createdAt: { gte: startOfDay } } }),
      this.prisma.document.count({ where: { createdAt: { gte: startOfWeek } } }),
      this.prisma.document.count({ where: { createdAt: { gte: startOfMonth } } }),
    ]);

    return {
      total,
      byStatus: Object.fromEntries(
        byStatus.map(({ status, _count }) => [status, _count._all]),
      ),
      byPeriod: { today, thisWeek, thisMonth },
    };
  }

  async listDocuments(filters: ListDocumentsDto) {
    const { page = 1, limit = 20, ...rest } = filters;
    const where = this.buildWhere(rest);

    const [documents, total] = await Promise.all([
      this.prisma.document.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: REPORT_SELECT,
      }),
      this.prisma.document.count({ where }),
    ]);

    return {
      data: documents,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async exportCsv(filters: Omit<ListDocumentsDto, 'page' | 'limit'>) {
    const where = this.buildWhere(filters);

    const documents = await this.prisma.document.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: REPORT_SELECT,
    });

    const headers = [
      'ID',
      'Nome Original',
      'Tipo MIME',
      'Tamanho (bytes)',
      'Status',
      'XML Enriquecido',
      'Processado em',
      'Criado em',
    ];

    const rows = documents.map((doc) =>
      csvRow([
        doc.id,
        doc.originalName,
        doc.mimeType,
        doc.fileSize,
        doc.status,
        doc.metadata ? 'Sim' : 'Não',
        doc.processedAt?.toISOString() ?? '',
        doc.createdAt.toISOString(),
      ]),
    );

    return [csvRow(headers), ...rows].join('\n');
  }

  private buildWhere({
    status,
    from,
    to,
    hasMetadata,
  }: Pick<ListDocumentsDto, 'status' | 'from' | 'to' | 'hasMetadata'>): DocumentWhereInput {
    const where: DocumentWhereInput = {};

    if (status) where.status = status;

    if (from || to) {
      where.createdAt = {
        ...(from && { gte: new Date(from) }),
        ...(to && { lte: new Date(`${to}T23:59:59.999Z`) }),
      };
    }

    if (hasMetadata !== undefined) {
      where.metadata = hasMetadata
        ? { not: Prisma.DbNull }
        : { equals: Prisma.DbNull };
    }

    return where;
  }
}

function csvRow(values: (string | number | boolean | null | undefined)[]): string {
  return values
    .map((v) => {
      const str = v === null || v === undefined ? '' : String(v);
      return str.includes(',') || str.includes('"') || str.includes('\n')
        ? `"${str.replace(/"/g, '""')}"`
        : str;
    })
    .join(',');
}
