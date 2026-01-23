import { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import { map, Observable } from 'rxjs';

export class TestInterceptors implements NestInterceptor {
  intercept(
    context: ExecutionContext,
    next: CallHandler<any>,
  ): Observable<any> | Promise<Observable<any>> {
    console.log('🔥 Interceptor called');

    return next.handle().pipe(
      map((data) => {
        console.log('inteceptor data', data);
        return data;
      }),
    );
  }
}
