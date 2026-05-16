import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { DocumentModule } from './modules/document/document.module';
import { AuthenticationModule } from './modules/authentication/authentication.module';
import { ConfigModule } from '@nestjs/config';
import { envSchema } from './config/env';

@Module({
  imports: [
    PrismaModule,
    DocumentModule,
    AuthenticationModule,
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (config) => envSchema.parse(config),
    }),
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
