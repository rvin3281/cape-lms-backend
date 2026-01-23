import * as crypto from 'crypto';

/**
 * Why use crypto
 * => Fast
 * => Deterministic (same input → same output)
 * => Designed for integrity + randomness
 */

const pepper = process.env.REFRESH_TOKEN_PEPPER ?? '';

export function createRawRefreshToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function hashRefreshToken(rawToken: string): string {
  return crypto
    .createHash('sha256')
    .update(rawToken + pepper)
    .digest('hex');
}
