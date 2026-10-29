import {
  type CallHandler,
  type ExecutionContext,
  HttpStatus,
  Injectable,
  type NestInterceptor,
  PayloadTooLargeException,
} from '@nestjs/common';
import { catchError, throwError } from 'rxjs';
import { ApiException } from '../http/api.exception.js';

/**
 * Gives multer's file-size rejection our stable code. Must wrap the
 * `FileInterceptor`, which only ever answers 413 for `limits.fileSize`.
 */
@Injectable()
export class FileTooLargeInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler) {
    return next
      .handle()
      .pipe(
        catchError((error: unknown) =>
          throwError(() =>
            error instanceof PayloadTooLargeException
              ? new ApiException(
                  HttpStatus.PAYLOAD_TOO_LARGE,
                  'file_too_large',
                  'The file is larger than allowed',
                )
              : error,
          ),
        ),
      );
  }
}
