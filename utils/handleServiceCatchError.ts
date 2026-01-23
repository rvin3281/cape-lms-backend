import {
  ForbiddenException,
  HttpException,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AxiosError } from 'axios';
import { errorResponseBuilder } from './errorResponseBuilder';

export function handleServiceCatchError(error: unknown, logger: any): never {
  if (error instanceof AxiosError) {
    const status = error.response?.status;

    // ✅ Any LearnWorlds rejection becomes ONE business error
    if (status === 400 || status === 404 || status === 401 || status === 403) {
      throw new ForbiddenException(
        errorResponseBuilder(
          'LW_ERROR',
          [
            {
              code: 'LW_CONNECTION_ISSUE',
              meta: { provider: 'learnworlds' },
            },
          ],
          'Learnworlds authentication issue',
        ),
      );
    }

    // LearnWorlds down / 5xx
    if (status && status >= 500) {
      throw new ServiceUnavailableException(errorResponseBuilder('LW_ERROR'));
    }
  }

  if (error instanceof HttpException) throw error;

  const message = error instanceof Error ? error.message : 'Unknown error';
  logger?.error(message, error instanceof Error ? error.stack : undefined);

  throw new InternalServerErrorException(
    errorResponseBuilder('BACKEND_SERVER_ERROR'),
  );
}
