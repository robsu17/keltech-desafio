import {
  Controller,
  Get,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  Post,
  Query,
  Res,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { memoryStorage } from 'multer';
import { Roles } from '../authentication/decorators/roles.decorator';
import { DocumentService } from './document.service';
import { ListDocumentsDto } from './dto/list-documents.dto';
import { MimeTypeValidator } from './validators/mime-type.validator';

const MB = 1024 * 1024;

@Controller('document')
export class DocumentController {
  constructor(private readonly documentService: DocumentService) {}

  @Post('upload')
  @Roles('OPERATOR')
  @UseInterceptors(FilesInterceptor('files'))
  async uploadDocuments(
    @UploadedFiles(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({
            maxSize: 25 * MB,
            message: 'O arquivo excede o tamanho máximo de 25 MB',
          }),
          new MimeTypeValidator({
            allowedMimeTypes: ['application/pdf', 'image/png'],
            message: 'Tipo de arquivo inválido. Envie apenas PDF ou PNG',
          }),
        ],
      }),
    )
    files: Express.Multer.File[],
  ) {
    return this.documentService.processUploads(files);
  }

  @Get('stats')
  @Roles('MANAGER', 'ADMIN')
  getStats() {
    return this.documentService.getStats();
  }

  @Get('report')
  @Roles('MANAGER', 'ADMIN')
  async exportCsv(
    @Query() filters: ListDocumentsDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const csv = await this.documentService.exportCsv(filters);
    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="documents-${Date.now()}.csv"`,
    });
    return csv;
  }

  @Get()
  @Roles('OPERATOR', 'MANAGER', 'ADMIN')
  listDocuments(@Query() filters: ListDocumentsDto) {
    return this.documentService.listDocuments(filters);
  }

  @Post(':id/xml')
  @Roles('OPERATOR')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  async uploadXml(
    @Param('id') documentId: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({
            maxSize: 1 * MB,
            message: 'O XML deve ter no máximo 1 MB',
          }),
          new MimeTypeValidator({
            allowedMimeTypes: ['text/xml', 'application/xml'],
            message: 'Tipo de arquivo inválido. Envie um arquivo XML',
          }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    return this.documentService.fillXML(
      documentId,
      file.buffer.toString('utf-8'),
    );
  }
}
