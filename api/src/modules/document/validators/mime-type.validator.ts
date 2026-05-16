import { FileValidator } from '@nestjs/common';

interface MimeTypeValidatorOptions {
  allowedMimeTypes: string[];
  message?: string;
}

export class MimeTypeValidator extends FileValidator<MimeTypeValidatorOptions> {
  isValid(file: Express.Multer.File): boolean {
    return this.validationOptions.allowedMimeTypes.includes(file.mimetype);
  }

  buildErrorMessage(): string {
    return (
      this.validationOptions.message ??
      `Tipo de arquivo inválido. Apenas ${this.validationOptions.allowedMimeTypes.join(' e ')} são permitidos`
    );
  }
}
