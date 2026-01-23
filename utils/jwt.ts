import { JWTPayload, jwtVerify, SignJWT } from 'jose';

export interface AccessTokenPayload extends JWTPayload {
  email: string;
  role: string;
}

export async function signAccessToken(params: {
  payload: Omit<AccessTokenPayload, 'iat' | 'exp'>;
  subject: string;
  secret: string;
  expiresInSeconds: number;
}): Promise<string> {
  const { payload, subject, secret, expiresInSeconds } = params;

  const now = Math.floor(Date.now() / 1000); // This used to know when the JWT is issued
  const secretKey = new TextEncoder().encode(secret);

  // iat means: “When was this token created?”
  return new SignJWT({
    email: payload.email,
    roleId: payload.roleId,
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(subject)
    .setIssuedAt(now)
    .setExpirationTime(now + expiresInSeconds)
    .sign(secretKey);
}

export async function verifyAccessToken(params: {
  token: string;
  secret: string;
}): Promise<{ sub: string; email: string; roleId: string } | null> {
  try {
    const secretKey = new TextEncoder().encode(params.secret);
    const { payload } = await jwtVerify(params.token, secretKey);

    const sub = typeof payload.sub === 'string' ? payload.sub : null;
    const email = typeof payload.email === 'string' ? payload.email : null;
    const roleId = typeof payload.roleId === 'string' ? payload.roleId : null;

    if (!sub || !email || !roleId) return null;
    return { sub, email, roleId };
  } catch {
    return null;
  }
}
