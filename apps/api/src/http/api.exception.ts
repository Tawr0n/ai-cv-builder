import type { ValidationIssue } from '@ai-cv-builder/shared';
import { HttpException } from '@nestjs/common';

/** An error with a stable `code`, rendered as the API error envelope. */
export class ApiException extends HttpException {
  constructor(
    status: number,
    readonly code: string,
    message: string,
    readonly issues?: ValidationIssue[],
  ) {
    super(message, status);
  }
}
