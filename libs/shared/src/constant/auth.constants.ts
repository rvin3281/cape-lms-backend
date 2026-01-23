export const AUTH_COOKIES = {
  access: 'access_token',
  refresh: 'refresh_token',
} as const;

export const DEFAULTS = {
  accessTtlSeconds: 15 * 60, // 900
  refreshTtlDays: 7,
} as const;
