import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

type ExceptionResponse = string | { code?: unknown; message?: unknown; details?: unknown };

@Injectable()
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    const response = context.getResponse<Response>();
    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const rawResponse = exception instanceof HttpException ? exception.getResponse() : undefined;
    const exceptionResponse = this.toExceptionResponse(rawResponse);
    const requestId = String(
      response.locals.requestId ?? response.getHeader('x-request-id') ?? 'unknown',
    );
    const responseMessage =
      typeof exceptionResponse === 'string' ? exceptionResponse : exceptionResponse?.message;
    const responseCode =
      typeof exceptionResponse === 'string' ? undefined : exceptionResponse?.code;
    const responseDetails =
      typeof exceptionResponse === 'string' ? undefined : exceptionResponse?.details;
    const message = this.toMessage(responseMessage, exception, status);
    const code = this.toCode(responseCode, status);
    const details = this.toDetails(responseDetails ?? responseMessage);

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url} failed`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    response.status(status).json({
      statusCode: status,
      code,
      message,
      requestId,
      details,
    });
  }

  private toExceptionResponse(value: unknown): ExceptionResponse | undefined {
    if (typeof value === 'string') return value;
    if (value && typeof value === 'object') return value as ExceptionResponse;
    return undefined;
  }

  private toMessage(value: unknown, exception: unknown, status: number): string {
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) return 'Request validation failed';
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) return 'Unexpected server error';
    return exception instanceof Error ? exception.message : 'Unexpected server error';
  }

  private toDetails(value: unknown): unknown {
    if (Array.isArray(value)) return value.slice(0, 20);
    if (value && typeof value === 'object') return value;
    return {};
  }

  private toCode(value: unknown, status: number): string {
    if (typeof value === 'string' && value.length > 0) return value;
    return `HTTP_${status}`;
  }
}
