/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { CapeUserRepository } from '@app/database';
import { LearnWorldsUserEnrollmentProgramRepo } from '@app/database/repository/learnworlds-user-enrollment-program.repo';
import { IGetUserOnBoardingProfile } from '@app/shared';
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
import { errorResponseBuilder } from 'utils/errorResponseBuilder';
import { handleServiceCatchError } from 'utils/handleServiceCatchError';

@Injectable()
export class UserServiceService {
  private readonly logger = new Logger(UserServiceService.name);

  constructor(
    private readonly capeUserRepo: CapeUserRepository,
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
}
