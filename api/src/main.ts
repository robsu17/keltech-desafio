import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import type { Env } from './config/env';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
  );
  const configService = app.get(ConfigService<Env, true>);
  const port = configService.get('PORT', { infer: true });
  await app.listen(port);
  Logger.log(`🚀 API running on http://localhost:${port}`, 'Bootstrap');
}
bootstrap();
