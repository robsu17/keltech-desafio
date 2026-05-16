import {
  Controller,
  Post,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Roles } from '../authentication/decorators/roles.decorator';

@Controller('document')
export class DocumentController {
  @Post('upload')
  @Roles('OPERATOR')
  @UseInterceptors(FilesInterceptor('files'))
  async uploadDocuments(
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return files.map((file) => ({
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      path: file.path,
    }));
  }
}
