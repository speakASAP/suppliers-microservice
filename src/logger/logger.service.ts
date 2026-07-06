import { Injectable } from '@nestjs/common';
import axios from 'axios';

type LogLevel = 'log' | 'warn' | 'error';

type LogMetadata = Record<string, unknown>;

interface CentralLogPayload {
  level: LogLevel;
  message: string;
  service: string;
  timestamp: string;
  duration_ms?: number;
  correlation_id?: string;
  metadata?: LogMetadata;
}

const DEFAULT_CONTEXT = 'App';
const DEFAULT_SERVICE_NAME = 'suppliers-microservice';
const DEFAULT_LOGGING_API_PATH = '/api/logs';
const SECRET_KEY_PATTERN = /(secret|password|token|api[_-]?key|authorization|cookie|credential)/i;
const SECRET_TEXT_PATTERNS: Array<[RegExp, string]> = [
  [/\b(Bearer\s+)[A-Za-z0-9._~+/=-]+/gi, '$1[REDACTED]'],
  [/\b(password|secret|token|api[_-]?key)=([^&\s]+)/gi, '$1=[REDACTED]'],
];

@Injectable()
export class LoggerService {
  log(message: string, contextOrMetadata?: string | LogMetadata, metadata?: LogMetadata) {
    const timestamp = new Date().toISOString();
    const { context, metadata: logMetadata } = this.resolveContextAndMetadata(contextOrMetadata, metadata);

    console.log(`${timestamp} [${context}] ${message}`);
    this.sendCentralLog('log', message, timestamp, logMetadata);
  }

  error(
    message: string,
    traceOrMetadata?: string | LogMetadata,
    contextOrMetadata?: string | LogMetadata,
    metadata?: LogMetadata,
  ) {
    const timestamp = new Date().toISOString();
    const trace = typeof traceOrMetadata === 'string' ? traceOrMetadata : undefined;
    const { context, metadata: logMetadata } = this.resolveErrorContextAndMetadata(
      traceOrMetadata,
      contextOrMetadata,
      metadata,
    );

    console.error(`${timestamp} [${context}] ERROR: ${message}`);
    if (trace) console.error(trace);
    this.sendCentralLog('error', message, timestamp, logMetadata);
  }

  warn(message: string, contextOrMetadata?: string | LogMetadata, metadata?: LogMetadata) {
    const timestamp = new Date().toISOString();
    const { context, metadata: logMetadata } = this.resolveContextAndMetadata(contextOrMetadata, metadata);

    console.warn(`${timestamp} [${context}] WARN: ${message}`);
    this.sendCentralLog('warn', message, timestamp, logMetadata);
  }

  private sendCentralLog(level: LogLevel, message: string, timestamp: string, metadata?: LogMetadata) {
    const loggingUrl = this.getLoggingUrl();
    if (!loggingUrl) return;

    const sanitizedMetadata = this.sanitizeMetadata(metadata);
    const payload: CentralLogPayload = {
      level,
      message: this.redactSensitiveText(message),
      service: process.env.SERVICE_NAME || DEFAULT_SERVICE_NAME,
      timestamp,
    };

    const durationMs = this.getDurationMs(metadata);
    if (durationMs !== undefined) payload.duration_ms = durationMs;

    const correlationId = this.getCorrelationId(metadata);
    if (correlationId) payload.correlation_id = correlationId;

    if (sanitizedMetadata && Object.keys(sanitizedMetadata).length > 0) {
      payload.metadata = sanitizedMetadata;
    }

    void axios.post(loggingUrl, payload, { timeout: 2000 }).catch(() => undefined);
  }

  private getLoggingUrl(): string | undefined {
    const baseUrl = process.env.LOGGING_SERVICE_URL;
    if (!baseUrl) return undefined;

    const apiPath = process.env.LOGGING_SERVICE_API_PATH || DEFAULT_LOGGING_API_PATH;
    return `${baseUrl.replace(/\/+$/, '')}/${apiPath.replace(/^\/+/, '')}`;
  }

  private resolveContextAndMetadata(contextOrMetadata?: string | LogMetadata, metadata?: LogMetadata) {
    if (typeof contextOrMetadata === 'string') {
      return { context: contextOrMetadata || DEFAULT_CONTEXT, metadata };
    }

    return { context: DEFAULT_CONTEXT, metadata: contextOrMetadata };
  }

  private resolveErrorContextAndMetadata(
    traceOrMetadata?: string | LogMetadata,
    contextOrMetadata?: string | LogMetadata,
    metadata?: LogMetadata,
  ) {
    if (typeof traceOrMetadata !== 'string') {
      const resolved = this.resolveContextAndMetadata(contextOrMetadata, metadata);
      return { context: resolved.context, metadata: { ...traceOrMetadata, ...resolved.metadata } };
    }

    return this.resolveContextAndMetadata(contextOrMetadata, metadata);
  }

  private getDurationMs(metadata?: LogMetadata): number | undefined {
    const value = metadata?.duration_ms ?? metadata?.durationMs;
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
  }

  private getCorrelationId(metadata?: LogMetadata): string | undefined {
    const value = metadata?.correlation_id ?? metadata?.correlationId;
    return typeof value === 'string' && value.trim() ? value : undefined;
  }

  private sanitizeMetadata(value: unknown, depth = 0): LogMetadata | undefined {
    if (!value || typeof value !== 'object' || Array.isArray(value) || depth > 4) return undefined;

    const sanitized = Object.entries(value as LogMetadata).reduce<LogMetadata>((result, [key, entry]) => {
      if (SECRET_KEY_PATTERN.test(key)) return result;

      const cleanEntry = this.sanitizeValue(entry, depth + 1);
      if (cleanEntry !== undefined) result[key] = cleanEntry;

      return result;
    }, {});

    return sanitized;
  }

  private sanitizeValue(value: unknown, depth: number): unknown {
    if (typeof value === 'string') return this.redactSensitiveText(value);
    if (value === null || ['number', 'boolean'].includes(typeof value)) return value;
    if (value instanceof Date) return value.toISOString();
    if (Array.isArray(value)) return value.map((entry) => this.sanitizeValue(entry, depth + 1));
    if (typeof value === 'object' && depth <= 4) return this.sanitizeMetadata(value, depth);

    return undefined;
  }

  private redactSensitiveText(value: string): string {
    return SECRET_TEXT_PATTERNS.reduce((redacted, [pattern, replacement]) => {
      return redacted.replace(pattern, replacement);
    }, value);
  }
}
