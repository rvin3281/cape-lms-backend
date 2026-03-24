export type AppErrorPayLoad = {
  code: string;
  items?: {
    code?: string;
    meta?: Record<string, any>;
  }[];
  message?: string;
  data?: any;
};
