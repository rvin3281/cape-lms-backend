export interface IRefreshToken {
  userId: string;
  tokenHash: string;
  userAgent?: string | null;
  ipAddress?: string | null;
  expiresAt: Date;
}
