import type { ApiError } from '@ai-cv-builder/shared';
import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { ApiException } from './api.exception.js';

/** Turns every error into the one envelope `{ error: { code, message, issues? } }`. */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  constructor(private readonly adapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const { status, body } = this.toEnvelope(exception);
    if (status >= 500) {
      this.logger.error(exception);
    }
    this.adapterHost.httpAdapter.reply(
      host.switchToHttp().getResponse(),
      body,
      status,
    );
  }

  private toEnvelope(exception: unknown): { status: number; body: ApiError } {
    if (exception instanceof ApiException) {
      const { code, message, issues, extra } = exception;
      return {
        status: exception.getStatus(),
        body: {
          error: { code, message, ...(issues && { issues }), ...extra },
        },
      };
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      return {
        status,
        body: { error: { code: codeFor(status), message: exception.message } },
      };
    }
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: {
        error: { code: 'internal_error', message: 'Internal server error' },
      },
    };
  }
}

/** `404` → `not_found`, `413` → `payload_too_large`, ... */
function codeFor(status: number): string {
  const name = HttpStatus[status] as string | undefined;
  return name ? name.toLowerCase() : 'http_error';
}
