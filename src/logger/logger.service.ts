import { Injectable } from '@nestjs/common';

@Injectable()
export class LoggerService {
  log(message: string, context?: string) {
    console.log(`${new Date().toISOString()} [${context || 'App'}] ${message}`);
  }

  error(message: string, trace?: string, context?: string) {
    console.error(`${new Date().toISOString()} [${context || 'App'}] ERROR: ${message}`);
    if (trace) console.error(trace);
  }

  warn(message: string, context?: string) {
    console.warn(`${new Date().toISOString()} [${context || 'App'}] WARN: ${message}`);
  }
}

