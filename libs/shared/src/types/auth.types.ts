export type AuthUser = {
  id: string; // userId
  firstName?: string;
  lastName?: string;
  name: string;
  email: string;
  isFirstTimeLogin: boolean;
  roleId: string;
  roleName: string;
  roleCode: string;
  company?: string;
  authScope: 'admin' | 'learner';
};

export type AuthSession = {
  user: AuthUser;
};

export type RefreshResult = AuthSession & {
  accessToken: string;
};

export type LoginResult = AuthSession & {
  accessToken: string;
  refreshToken: {
    rawToken: string;
    expiresAt: Date;
  };
};

export type LogoutResult = {
  ok: true;
};
