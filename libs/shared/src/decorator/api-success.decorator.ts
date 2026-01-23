import { SetMetadata } from '@nestjs/common';

export const API_SUCCESS_KEY = 'api_success';

export type ApiSuccessOptions = {
  code?: string;
  message?: string;

  // default = true (handled in interceptor)
  includeData?: boolean;

  // If set, interceptor will return data = result[dataKey]
  // Example: dataKey: 'items' makes data be only the array
  dataKey?: string;

  // meta can be a static object OR a function that receives controller return value
  meta?: Record<string, any> | ((result: any) => Record<string, any>);
};

export const ApiSuccess = (options?: ApiSuccessOptions) =>
  SetMetadata(API_SUCCESS_KEY, options ?? {});
