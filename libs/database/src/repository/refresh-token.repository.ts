import { IRefreshToken } from '@app/shared/interfaces/IRefreshToken';
import { Injectable } from '@nestjs/common';
import { RefreshToken } from 'src/generated/client';
import { PrismaService } from '../prisma.service';

@Injectable()
export class RefreshTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createRefreshToken(data: IRefreshToken): Promise<RefreshToken> {
    return await this.prisma.refreshToken.create({
      data: {
        userId: data.userId,
        tokenHash: data.tokenHash,
        userAgent: data.userAgent ?? null,
        ipAddress: data.ipAddress ?? null,
        expiresAt: data.expiresAt,
        selectedRoleId: data.selectedRoleId,
        selectedRoleCode: data.selectedRoleCode,
        authScope: data.authScope,
      },
    });
  }

  // ✅ Used by /auth/refresh
  async findValidByHash(tokenHash: string): Promise<RefreshToken | null> {
    return this.prisma.refreshToken.findFirst({
      where: {
        tokenHash,
        isRevoked: false,
        expiresAt: { gt: new Date() },
      },
    });
  }

  // ✅ Used by /auth/logout and refresh-rotation (optional)
  async revokeById(id: string): Promise<void> {
    await this.prisma.refreshToken.update({
      where: { id },
      data: { isRevoked: true },
    });
  }

  // ✅ Optional enterprise feature: revoke all sessions for a user (logout everywhere)
  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, isRevoked: false },
      data: { isRevoked: true },
    });
  }
}
