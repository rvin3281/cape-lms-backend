import * as crypto from 'crypto';

export function createRawToken(bytes = 32): string {
  // 32 bytes => 64 hex chars (strong enough)
  return crypto.randomBytes(bytes).toString('hex');
}

export function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}
