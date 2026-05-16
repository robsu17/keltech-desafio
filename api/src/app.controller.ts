import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Public } from './modules/authentication/decorators/public.decorator';
import type { Env } from './config/env';

@Controller()
export class AppController {
  constructor(private readonly configService: ConfigService<Env>) {}

  @Public()
  @Get('health')
  health(): string {
    return `API is running. Environment: ${this.configService.get('NODE_ENV')}`;
  }
}
