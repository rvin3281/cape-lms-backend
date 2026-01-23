import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

// type NestValidationPayload = {
//   statusCode?: number;
//   message?: string[] | string;
//   error?: string;
// };

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttpException = exception instanceof HttpException;

    const status = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse = isHttpException
      ? exception.getResponse()
      : { message: 'Internal server error' };

    const message =
      exception instanceof Error ? exception.message : String(exception);

    const stack = exception instanceof Error ? exception.stack : undefined;

    this.logger.error({
      message,
      trace: stack,
      context: {
        method: request.method,
        url: request.url,
        body: request.body as Record<string, any>,
      },
    });

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      ...(typeof exceptionResponse === 'object'
        ? exceptionResponse
        : { message: exceptionResponse }),
    });
  }
}
