import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/roles.decorator';

@Controller()
export class HealthController {
  private readonly startTime = Date.now();

  @Public()
  @Get('health')
  getHealth() {
    return {
      status: 'healthy',
      service: process.env.SERVICE_NAME || 'suppliers-microservice',
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      timestamp: new Date().toISOString(),
    };
  }
}

