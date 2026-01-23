export type AuthUser = {
  id: string; // userId
  firstName?: string;
  lastName?: string;
  name: string;
  email: string;
  isFirstTimeLogin: boolean;
  roleId: string;
  roleName: string;
  role?: string;
  company?: string;
};

export type MeResult = {
  user: AuthUser;
};

export type RefreshResult = {
  user: AuthUser;
  accessToken: string;
  // optional: if you want refresh rotation later
  // refreshToken?: { rawToken: string; expiresAt: Date };
};

export type LogoutResult = {
  ok: true;
};
