export interface IApiSuccessResponse<TData, TMeta> {
  success: boolean;
  code: string;
  message: string;
  timestamp: string;
  path: string;
  data?: TData;
  meta?: TMeta;
}
