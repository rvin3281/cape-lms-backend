export interface LoginResult {
  user: {
    id: string;
    email: string;
    role?: string;
    roleName: string;
    roleId: string;
    isFirstTimeLogin: boolean;
  };
  accessToken: string;
  refreshToken: {
    rawToken: string; // set as httpOnly cookie
    expiresAt: Date;
  };
}
