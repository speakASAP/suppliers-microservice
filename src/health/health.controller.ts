import { Controller, Get } from '@nestjs/common';

@Controller()
export class HealthController {
  private readonly startTime = Date.now();

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

