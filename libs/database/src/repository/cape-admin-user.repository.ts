/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable } from '@nestjs/common';
import { capeLearnerProfiles, CapeUser, Prisma } from 'src/generated/client';
import { PrismaService } from '../prisma.service';
import { CapeUserWithRoles } from '@app/shared';

type PrismaTx = Prisma.TransactionClient;

@Injectable()
export class CapeUserRepository {
  constructor(private readonly prisma: PrismaService) {}

  findUserByEmail(email: string): Promise<CapeUser | null> {
    const user = this.prisma.capeUser.findUnique({ where: { email } });
    return user;
  }

  findUserByEmailAndRole(email: string): Promise<CapeUserWithRoles | null> {
    return this.prisma.capeUser.findFirst({
      where: {
        email,
        deletedAt: null,
      },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });
  }

  findUserByUserId(userId: string): Promise<CapeUser | null> {
    return this.prisma.capeUser.findUnique({ where: { userId } });
  }

  findUserByUserIdWithProfile(
    userId: string,
  ): Promise<(CapeUser & { profile: capeLearnerProfiles | null }) | null> {
    return this.prisma.capeUser.findUnique({
      where: { userId },
      include: { profile: true },
    });
  }

  findUserByEmailWithProfile(
    email: string,
  ): Promise<(CapeUser & { profile: capeLearnerProfiles | null }) | null> {
    return this.prisma.capeUser.findFirst({
      where: {
        email,
        isActive: true,
        isAdmin: false,
        deletedAt: null,
      },
      include: {
        profile: true,
      },
    });
  }

  createNewUser(
    data: Prisma.CapeUserCreateArgs,
    tx?: PrismaTx,
  ): Promise<CapeUser> {
    const client = tx ?? this.prisma;
    return client.capeUser.create(data);
  }

  findUserByUserIdWithProfileAndRoles(userId: string) {
    return this.prisma.capeUser.findUnique({
      where: { userId },
      include: {
        profile: true,
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });
  }

  updateUserFromLearnWorlds(
    email: string,
    payload: {
      firstName?: string;
      lastName?: string;
      userName?: string;
      roleId: string;
      updatedBy: string;
    },
    tx?: PrismaTx,
  ): Promise<CapeUser> {
    const client = tx ?? this.prisma;

    return client.capeUser.update({
      where: { email },
      data: {
        firstName: payload.firstName ?? undefined,
        lastName: payload.lastName ?? undefined,
        userName: payload.userName ?? undefined,
        // roleId: payload.roleId,
        updatedAt: new Date(),
        updatedBy: payload.updatedBy,
      },
    });
  }

  updateUserPasswordAndActivate(
    email: string,
    payload: {
      passwordHash: string;
      updatedBy: string; // put email here
    },
    tx?: PrismaTx,
  ): Promise<CapeUser> {
    const client = tx ?? this.prisma;

    return client.capeUser.update({
      where: { email },
      data: {
        passwordHash: payload.passwordHash,
        isActive: true,
        updatedAt: new Date(),
        updatedBy: payload.updatedBy,
      },
    });
  }

  updateOnboardingComplete(email: string, isCompleted: boolean) {
    return this.prisma.capeUser.update({
      where: { email },
      data: {
        isFirstTimeLogin: isCompleted,
      },
    });
  }

  updateUserData(
    email: string,
    payload: {
      firstName?: string;
      lastName?: string;
      company?: string;
    },
    tx?: PrismaTx,
  ) {
    const client = tx ?? this.prisma;

    const data: any = {};

    // Parent table updates (only if present)
    if (payload.firstName) {
      data.firstName = payload.firstName;
    }

    if (payload.lastName) {
      data.lastName = payload.lastName;
    }

    if (payload.company) {
      data.profile = {
        update: { cfCompany: payload.company },
      };
    }

    return client.capeUser.update({
      where: { email },
      data,
      include: {
        profile: true,
      },
    });
  }

  getUserProfileData(email: string) {
    return this.prisma.capeUser.findFirst({
      where: { email },
      include: { profile: true, userProfile: true },
    });
  }
}
