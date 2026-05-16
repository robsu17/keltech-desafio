import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { DocumentModule } from './modules/document/document.module';
import { AuthenticationModule } from './modules/authentication/authentication.module';
import { ConfigModule } from '@nestjs/config';
import { envSchema } from './config/env';
import { AppController } from './app.controller';
import { MulterModule } from '@nestjs/platform-express';

@Module({
  imports: [
    PrismaModule,
    DocumentModule,
    AuthenticationModule,
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (config) => envSchema.parse(config),
    }),
    MulterModule.register({
      dest: './uploads',
      limits: {
        fileSize: 25 * 1024 * 1024,
      },
      fileFilter(_req, file, callback) {
        const allowedMimes = ['application/pdf', 'image/png'];
        if (allowedMimes.includes(file.mimetype)) {
          callback(null, true);
        } else {
          callback(new Error('Only PDF and PNG files are allowed'), false);
        }
      },
    }),
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
