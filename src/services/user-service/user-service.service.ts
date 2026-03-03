/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { CapeUserProfileV2Repository, CapeUserRepository } from '@app/database';
import { LearnWorldsUserEnrollmentProgramRepo } from '@app/database/repository/learnworlds-user-enrollment-program.repo';
import {
  IGetUserOnBoardingProfile,
  IUpdateAccountProfile,
  IUpdateCareerProfile,
} from '@app/shared';
import { HttpService } from '@nestjs/axios';
import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { Prisma } from 'src/generated/client';
import { errorResponseBuilder } from 'utils/errorResponseBuilder';
import { handleServiceCatchError } from 'utils/handleServiceCatchError';

@Injectable()
export class UserServiceService {
  private readonly logger = new Logger(UserServiceService.name);

  constructor(
    private readonly capeUserRepo: CapeUserRepository,
    private readonly capeUserProfileRepo: CapeUserProfileV2Repository,
    private readonly enrollmentRepo: LearnWorldsUserEnrollmentProgramRepo,
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  async getAllProgramByUser(email: string) {
    try {
      const normalizedEmail = email?.trim().toLowerCase();

      if (
        !normalizedEmail ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
      ) {
        throw new BadRequestException('INVALID_EMAIL');
      }

      const user = await this.capeUserRepo.findUserByEmail(normalizedEmail);

      if (!user || user.deletedAt) {
        throw new NotFoundException('USER_NOT_FOUND');
      }

      if (!user.isActive) {
        throw new BadRequestException('USER_INACTIVE');
      }

      const enrollments = await this.enrollmentRepo.findProgramsByUserId({
        userId: user.userId,
      });

      // Shape for frontend (ProgramCard-ready)
      const programs = enrollments.map((e) => ({
        enrollment: {
          id: e.id,
          enrolledAt: e.enrolledAt,
          status: e.status ?? 'active',
          progress: e.progress ?? 0,
        },
        program: {
          productId: e.program.productId,
          title: e.program.productTitle ?? '',
          type: e.program.productType ?? '',
          currency: e.program.productCurrency ?? null,
          description: e.program.productDescription ?? '',
          price: e.program.productPrice ?? null,
          url: e.program.productUrl ?? null,
        },
      }));

      return {
        success: true,
        data: {
          total: programs.length,
          programs,
        },
      };
    } catch (error) {
      handleServiceCatchError(error, this.logger); // keep your style
    }
  }
  catch(error) {
    handleServiceCatchError(error, this.logger);
  }

  async generateSsoUrl(email?: string, redirectUrl?: string) {
    const lwConfig = this.config.get<any>('learnworls');
    const ssoPath = lwConfig.learnworld_sso_path;
    const bearerToken = lwConfig.learnworld_bearer_token;
    const clientId = lwConfig.learnworld_lw_client_id;

    const res = await firstValueFrom(
      this.http.post(
        ssoPath,
        { email, redirectUrl },
        {
          headers: {
            Authorization: `Bearer ${bearerToken}`,
            'Lw-Client': clientId,
            Accept: 'application/json',
          },
        },
      ),
    );

    if (res.status !== 200 || !res.data?.success) {
      throw new BadGatewayException('LEARNWORLDS_SSO_FAILED');
    }

    if (!res.data?.url) {
      throw new ForbiddenException('LEARNWORLDS_SSO_URL_MISSING');
    }

    return {
      userId: res.data.user_id,
      ssoUrl: res.data.url,
    };
  }

  async getUserProfileData(email: string) {
    try {
      // Get User
      const user = await this.capeUserRepo.getUserProfileData(email);

      if (!user || user === null || !user.userProfile || !user.profile) {
        throw new NotFoundException(
          errorResponseBuilder('GET_USER_ONBOARDING_PROFILE_NOTFOUND'),
        );
      }

      const userData: IGetUserOnBoardingProfile = {
        userId: user.userId,
        learnworldId: user.learnworldId ?? '',
        email: user?.email,
        firstName: user?.firstName,
        lastName: user?.lastName,
        userName: user?.userName,
        profile: {
          organization: user.profile.cfCompany ?? '',
          phoneNumber: user.userProfile?.phoneNumber,
          jobTitle: user.userProfile?.jobTitle,
          currentRole: user.userProfile?.currentRole,
          targetRole: user.userProfile?.targetRole,
          industry: user.userProfile?.industry,
          careerGoals: user.userProfile?.careerGoals,
          skills: (() => {
            try {
              return user.userProfile.skillsJson
                ? JSON.parse(user.userProfile.skillsJson)
                : [];
            } catch {
              return [];
            }
          })(),
        },
      };

      return { userData };
    } catch (error) {
      handleServiceCatchError(error, this.logger);
    }
  }

  async updateUserProfileCareerData(email: string, dto: IUpdateCareerProfile) {
    try {
      // Find User exist or not an get user id
      const user = await this.capeUserRepo.getUserProfileData(email);

      // UPDATE USER ACCOUNT PROILE
      // if (type === 'ACCOUNT') {

      // }

      // get userId
      const userId =
        user?.userId ?? user?.profile?.userId ?? user?.userProfile?.userId;

      // If not exist throw error
      if (!user || !userId) {
        throw new NotFoundException(errorResponseBuilder('USER_NOT_FOUND'));
      }

      // Ensure profile row exists if your system requires it
      // If profile might not exist, consider upsert instead of update.
      const profileExists = !!user?.profile || !!user?.userProfile; // adapt to your return structure

      if (!profileExists) {
        throw new NotFoundException(
          errorResponseBuilder('USER_PROFILE_NOT_FOUND'),
        );
      }

      // Map DTO to Prisma update input
      const updateData: Prisma.CapeUserProfilesUpdateInput = {};

      if (dto.currentRole !== undefined)
        updateData.currentRole = dto.currentRole;
      if (dto.targetRole !== undefined) updateData.targetRole = dto.targetRole;
      if (dto.industry !== undefined) updateData.industry = dto.industry;
      if (dto.careerGoals !== undefined)
        updateData.careerGoals = dto.careerGoals;
      if (dto.skills !== undefined) {
        updateData.skillsJson = JSON.stringify(dto.skills);
      }

      // If client sends nothing return success
      if (Object.keys(updateData).length === 0) {
        return {
          code: 'UPDATE_USER_PROFILE_DATA',
          message: 'success',
          data: user,
        };
      }

      // Update user career profile
      const updateProfile = await this.capeUserRepo['prisma'].$transaction(
        async (tx: Prisma.TransactionClient) => {
          return this.capeUserProfileRepo.updateUserProfile(
            {
              where: { userId },
              data: updateData,
            },
            tx,
          );
        },
      );

      return {
        code: 'UPDATE_USER_PROFILE_DATA',
        message: 'success',
        data: updateProfile,
      };
    } catch (error) {
      handleServiceCatchError(error, this.logger);
    }
  }

  async updateUserProfileAccountData(
    email: string,
    dto: IUpdateAccountProfile,
  ) {
    try {
      // Find User exist or not an get user id
      const user = await this.capeUserRepo.getUserProfileData(email);

      // get userId
      const userId =
        user?.userId ?? user?.profile?.userId ?? user?.userProfile?.userId;

      if (!user || !userId) {
        throw new NotFoundException(errorResponseBuilder('USER_NOT_FOUND'));
      }

      // Ensure profile row exists if your system requires it
      // If profile might not exist, consider upsert instead of update.
      const profileExists = !!user?.profile || !!user?.userProfile; // adapt to your return structure

      if (!profileExists) {
        throw new NotFoundException(
          errorResponseBuilder('USER_PROFILE_NOT_FOUND'),
        );
      }

      // Map DTO to Prisma update input
      const updateAccountData: Prisma.CapeUserUpdateInput = {};
      const updateCareerData: Prisma.CapeUserProfilesUpdateInput = {};

      if (dto.firstName !== undefined)
        updateAccountData.firstName = dto.firstName;
      if (dto.lastName !== undefined) updateAccountData.lastName = dto.lastName;
      if (dto.jobTitle !== undefined) updateCareerData.jobTitle = dto.jobTitle;
      if (dto.phoneNumber !== undefined)
        updateCareerData.phoneNumber = dto.phoneNumber;

      // If client sends nothing return success
      if (
        Object.keys(updateAccountData).length === 0 &&
        Object.keys(updateCareerData).length === 0
      ) {
        return {
          code: 'UPDATE_USER_PROFILE_DATA',
          message: 'success',
          data: user,
        };
      }

      await this.capeUserRepo['prisma'].$transaction(
        async (tx: Prisma.TransactionClient) => {
          if (Object.keys(updateAccountData).length > 0) {
            await this.capeUserRepo.updateUserData(
              email,
              {
                firstName: dto.firstName,
                lastName: dto.lastName,
              },
              tx,
            );
          }

          if (Object.keys(updateCareerData).length > 0) {
            await this.capeUserProfileRepo.updateUserProfile(
              {
                where: { userId: userId ?? undefined },
                data: updateCareerData,
              },
              tx,
            );
          }
        },
      );

      const userUpdateData = await this.capeUserRepo.getUserProfileData(email);

      // Transaction to update both user and profile data atomically

      return {
        code: 'UPDATE_USER_PROFILE_DATA',
        message: 'success',
        data: userUpdateData,
      };
    } catch (error) {
      handleServiceCatchError(error, this.logger);
    }
  }
}
