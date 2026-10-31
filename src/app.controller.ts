import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service.js';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  /** Sonde liveness — publique, sans auth (Coolify / Docker HEALTHCHECK). */
  @Get('health')
  getHealth(): { status: 'ok' } {
    return this.appService.getHealth();
  }
}
