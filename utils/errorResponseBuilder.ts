import { AppErrorPayLoad } from '@app/shared/types/error.response.types';

export const errorResponseBuilder = (
  code: string,
  items?: { code?: string; meta?: Record<string, any> }[],
  message?: string,
  data?: any,
): AppErrorPayLoad => {
  return {
    code,
    items,
    message,
    data,
  };
};
