import { IApiSuccessResponse } from '@app/shared/interfaces/ISuccessResponse';

export const APISuccessResponse = <TData = any, TMeta = any>(
  code: string,
  message: string,
  timestamp: string,
  path: string,
  data?: TData,
  meta?: TMeta,
): IApiSuccessResponse<TData, TMeta> => {
  return {
    success: true,
    code,
    message,
    timestamp,
    path,
    ...(data !== undefined && { data }), // only include if data is provided
    ...(meta !== undefined && { meta }), // only include if meta is provided
  };
};
