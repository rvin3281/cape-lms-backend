/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { HttpExceptionFilter, SuccessResponseInterceptor } from '@app/shared';

import {
  BadRequestException,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationError } from 'class-validator';
import * as cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.set('trust proxy', 1);

  const configService = app.get(ConfigService);

  // ✅ COOKIE PARSER — MUST BE EARLY
  app.use(cookieParser());

  // Global prefix: /api/v1/...
  app.setGlobalPrefix('api');

  // API versioning via URI: /api/v1/users
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // Security headers
  app.use(helmet());

  // CORS (production-safe)
  const allowedOrigins =
    configService
      .get<string>('CORS_ORIGINS')
      ?.split(',')
      .map((s) => s.trim()) ?? [];

  // CORS
  // app.enableCors({
  //   origin: configService.get<string>('CORS_ORIGIN')?.split(',') ?? '*',
  //   credentials: true,
  // });

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      // allow server-to-server, postman, curl (no origin)
      if (!origin) {
        callback(null, true);
        return;
      }

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS blocked for origin: ${origin}`), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Global validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      exceptionFactory: (errors: ValidationError[]) => {
        // flatten field + messages
        const items = flattenValidationErrors(errors);

        return new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'Please check the highlighted fields and try again.',
          items, // ✅ includes field names
        });
      },
    }),
  );

  // (Optional) Global interceptors / filters / loggers
  // app.useGlobalFilters(new AllExceptionsFilter());
  // app.useGlobalInterceptors(new LoggingInterceptor());

  // ⭐ GLOBAL SUCCESS RESPONSE INTERCEPTOR
  const reflector = app.get(Reflector);
  app.useGlobalInterceptors(new SuccessResponseInterceptor(reflector));

  // ⭐ GLOBAL EXCEPTION FILTER — place it here
  app.useGlobalFilters(new HttpExceptionFilter());

  const port = configService.get<number>('port') ?? 4000;
  await app.listen(port, '0.0.0.0');
}

// helper
function flattenValidationErrors(errors: ValidationError[]) {
  const result: Array<{ field: string; messages: string[] }> = [];

  const walk = (errs: ValidationError[], parentPath = '') => {
    for (const err of errs) {
      const field = parentPath ? `${parentPath}.${err.property}` : err.property;

      const messages = err.constraints ? Object.values(err.constraints) : [];

      if (messages.length > 0) {
        result.push({ field, messages });
      }

      if (err.children?.length) {
        walk(err.children, field);
      }
    }
  };

  walk(errors);
  return result;
}

bootstrap();
