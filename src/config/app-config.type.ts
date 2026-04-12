export type RedisConfig = {
  host: string;
  port: number;
  password?: string;
  db: number;
  tls: boolean;
};
