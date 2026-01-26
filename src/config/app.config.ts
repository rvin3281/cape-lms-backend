// src/config/app.config.ts
export default () => ({
  env: process.env.NODE_ENV || 'development',

  /** App Port (not database port) */
  port: parseInt(process.env.PORT ?? '3000', 10),

  /** Logging level */
  logLevel: process.env.LOG_LEVEL ?? 'info',

  /** Optional: Prisma uses DATABASE_URL only for CLI (migrate, generate) */
  databaseUrl: process.env.DATABASE_URL,

  /** MSSQL connection settings for PrismaService */
  database: {
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '1433', 10),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    name: process.env.DB_NAME,
  },

  /** Redis (BullMQ) */
  redis: {
    host: process.env.REDIS_HOST ?? '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    db: process.env.REDIS_DB ? parseInt(process.env.REDIS_DB, 10) : 0,
  },

  jwt_access_secret: process.env.JWT_ACCESS_SECRET,
  access_token_ttl_seconds: process.env.ACCESS_TOKEN_TTL_SECONDS,
  refresh_token_ttl_days: process.env.REFRESH_TOKEN_TTL_DAYS,
  cookie_secure: process.env.COOKIE_SECURE,
  cookie_samesite: process.env.COOKIE_SAMESITE,
  cookie_domain: process.env.COOKIE_DOMAIN,

  learnworls: {
    learnworld_api_base_url: process.env.LEARNWORLD_API_BASE_URL,
    learnworld_lw_client_id: process.env.LEARNWORLD_LW_CLIENT_ID,
    learnworld_bearer_token: process.env.LEARNWORLD_BEARER_TOKEN,
    learnworld_sso_path: process.env.LEARNWORLDS_SSO_PATH,
    learnworlds_enable: process.env.LEARNWORLDS_ENABLE === 'true',
  },
});
