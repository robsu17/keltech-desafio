import {
  Controller,
  MaxFileSizeValidator,
  ParseFilePipe,
  Post,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Roles } from '../authentication/decorators/roles.decorator';
import { MimeTypeValidator } from './validators/mime-type.validator';
import { DocumentService } from './document.service';

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
}
