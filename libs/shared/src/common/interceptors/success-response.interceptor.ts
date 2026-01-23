/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  API_SUCCESS_KEY,
  ApiSuccessOptions,
} from '@app/shared/decorator/api-success.decorator';
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { map } from 'rxjs/operators';

@Injectable()
export class SuccessResponseInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    const httpCtx = context.switchToHttp();
    const request = httpCtx.getRequest<any>();

    // Read @ApiSuccess(...) options from the current controller method
    const options: ApiSuccessOptions =
      this.reflector.get<ApiSuccessOptions>(
        API_SUCCESS_KEY,
        context.getHandler(),
      ) ?? {};

    // Defaults
    const code = options.code ?? 'SUCCESS';
    const message = options.message ?? 'Request successful';
    const includeData = options.includeData ?? true;

    return next.handle().pipe(
      map((result) => {
        // meta can be object or function(result) => object
        const meta =
          typeof options.meta === 'function'
            ? options.meta(result)
            : options.meta;

        // If dataKey is set, extract that field as the data payload
        // Example: result = { items, page, total } and dataKey = 'items'
        // finalData becomes result.items (array)
        const finalData =
          options.dataKey && result && typeof result === 'object'
            ? result[options.dataKey]
            : result;

        return {
          success: true,
          code,
          message,
          timestamp: new Date().toISOString(),
          path: request.originalUrl ?? request.url,

          ...(includeData && finalData !== undefined
            ? { data: finalData }
            : {}),
          ...(meta !== undefined ? { meta } : {}),
        };
      }),
    );
  }
}
