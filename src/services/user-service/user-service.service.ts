/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  CapeUserProfileV2Repository,
  CapeUserRepository,
  PrismaService,
} from '@app/database';
import { LearnWorldsUserEnrollmentProgramRepo } from '@app/database/repository/learnworlds-user-enrollment-program.repo';
import {
  IGetUserOnBoardingProfile,
  IUpdateAccountProfile,
  IUpdateCareerProfile,
  LW_USER,
  PaginationQueryDto,
  ProgramSourceEnum,
  UnenrollProgramItemDto,
  UnenrollUserProgramsDto,
  UpdateCapeUserDto,
  UpdateCapeUserLearnworldsDto,
} from '@app/shared';
import { HttpService } from '@nestjs/axios';
import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { CapeUser, Prisma } from 'src/generated/client';
import { errorResponseBuilder } from 'utils/errorResponseBuilder';
import { handleServiceCatchError } from 'utils/handleServiceCatchError';

type PrismaTx = Prisma.TransactionClient;

type UserForUpdate = Prisma.CapeUserGetPayload<{
  include: {
    userRoles: {
      include: {
        role: true;
      };
    };
    profile: true;
    userProfile: true;
  };
}>;

@Injectable()
export class UserServiceService {
  private readonly logger = new Logger(UserServiceService.name);

  constructor(
    private readonly capeUserRepo: CapeUserRepository,
    private readonly capeUserProfileRepo: CapeUserProfileV2Repository,
    private readonly enrollmentRepo: LearnWorldsUserEnrollmentProgramRepo,
    private readonly http: HttpService,
    private readonly config: ConfigService,
    private readonly prismaService: PrismaService,
  ) {}

  async getAllClassroomProgramByUser(userId: string): Promise<any> {
    try {
      const normalizedUserId = userId?.trim();

      if (!normalizedUserId) {
        throw new BadRequestException(
          errorResponseBuilder(
            'INVALID_USER_ID',
            undefined,
            'User id is required.',
          ),
        );
      }

      const userPrograms =
        await this.prismaService.programCapeUserEnrollment.findMany({
          where: {
            userId: normalizedUserId,
            deletedAt: null,
            status: 'ACTIVE',
            user: {
              deletedAt: null,
              isAdmin: false,
            },
            program: {
              deletedAt: null,
            },
          },
          select: {
            enrollmentId: true,
            status: true,
            isReviewFeedbackCompleted: true,
            createdAt: true,
            updatedAt: true,

            user: {
              select: {
                userId: true,
                email: true,
                firstName: true,
                lastName: true,
                userName: true,
              },
            },

            program: {
              select: {
                programId: true,
                programName: true,
                programDate: true,
                programCohort: true,
                createdAt: true,
                updatedAt: true,
                deletedAt: true,

                programUserFacilitators: {
                  where: {
                    userId: normalizedUserId,
                    deletedAt: null,
                    facilitator: {
                      deletedAt: null,
                    },
                  },
                  select: {
                    facilitator: {
                      select: {
                        facilitatorId: true,
                        facilitatorName: true,
                      },
                    },
                  },
                },
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        });

      const data = userPrograms.map((item) => ({
        enrollmentId: item.enrollmentId,
        status: item.status,
        isReviewFeedbackCompleted: item.isReviewFeedbackCompleted,

        user: {
          userId: item.user.userId,
          email: item.user.email,
          firstName: item.user.firstName,
          lastName: item.user.lastName,
          userName: item.user.userName,
        },

        program: {
          programId: item.program.programId,
          programName: item.program.programName,
          programDate: item.program.programDate,
          programCohort: item.program.programCohort,
        },

        facilitators: item.program.programUserFacilitators.map((x) => ({
          facilitatorId: x.facilitator.facilitatorId,
          facilitatorName: x.facilitator.facilitatorName,
        })),
      }));

      return {
        items: data,
      };
    } catch (error) {
      handleServiceCatchError(error, this.logger); // keep your style
    }
  }

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

  async getCaperUserData(query: PaginationQueryDto): Promise<any> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;

    const skip = (page - 1) * pageSize;
    const take = pageSize;

    const where = {
      isAdmin: false,
      deletedAt: null,
      createdBy: {
        not: 'seed',
      },
    };

    const [items, total] = await this.prismaService.$transaction([
      this.prismaService.capeUser.findMany({
        where,
        skip,
        take,
        orderBy: {
          createdAt: 'desc',
        },
        select: {
          userId: true,
          learnworldId: true,
          email: true,
          firstName: true,
          lastName: true,
          userName: true,
          isActive: true,
          isAdmin: true,
          isFirstTimeLogin: true,
          createdAt: true,
          updatedAt: true,
          createdBy: true,
          updatedBy: true,

          userProfile: {
            select: {
              userId: true,
              phoneNumber: true,
              jobTitle: true,
              currentRole: true,
              targetRole: true,
              industry: true,
              careerGoals: true,
              skillsJson: true,
            },
          },
          userRoles: {
            select: {
              userRoleId: true,
              assignedAt: true,
              assignedBy: true,
              role: {
                select: {
                  roleId: true,
                  roleName: true,
                  roleCode: true,
                },
              },
            },
          },
          profile: {
            select: {
              cfCompany: true,
              cfCohort: true,
            },
          },
        },
      }),
      this.prismaService.capeUser.count({
        where,
      }),
    ]);

    const totalPages = Math.ceil(total / pageSize);

    return {
      items,
      meta: {
        page,
        pageSize,
        total,
        totalPages,
      },
    };
  }

  async updateCapeUser(userId: string, dto: UpdateCapeUserDto): Promise<any> {
    let lwUpdated = false;
    let shouldSyncToLearnWorlds = false;
    let previousLwPayload: {
      first_name: string;
      last_name: string;
      username: string;
      fields: {
        cf_organization: string;
      };
    } | null = null;
    let currentUserEmail = '';

    try {
      const normalizedDto = this.normalizeUpdateCapeUserDto(dto);

      const updatedUser = await this.prismaService.$transaction(async (tx) => {
        const existingUser = await this.findUserForUpdate(userId, tx);

        currentUserEmail = existingUser.email;

        await this.ensureUsernameUnique(normalizedDto.userName, userId, tx);

        shouldSyncToLearnWorlds =
          this.shouldUpdateLearnWorldsForUser(existingUser);

        if (shouldSyncToLearnWorlds) {
          previousLwPayload =
            this.buildLearnWorldsPayloadFromCurrentState(existingUser);
        }

        await tx.capeUser.update({
          where: { userId },
          data: {
            firstName: normalizedDto.firstName,
            lastName: normalizedDto.lastName,
            userName: normalizedDto.userName,
            updatedAt: new Date(),
          },
        });

        await tx.capeLearnerProfiles.upsert({
          where: { userId },
          create: {
            userId,
            cfCompany: normalizedDto.cfCompany,
          },
          update: {
            cfCompany: normalizedDto.cfCompany,
          },
        });

        if (shouldSyncToLearnWorlds) {
          this.logger.log(
            'Updating LearnWorlds user due to account changes for userId: ' +
              userId,
          );
          await this.updateLearnWorldsUser(existingUser.email, {
            first_name: normalizedDto.firstName,
            last_name: normalizedDto.lastName,
            username: normalizedDto.userName,
            fields: {
              cf_organization: normalizedDto.cfCompany,
            },
          });

          lwUpdated = true;
        }

        const latestUser = await tx.capeUser.findUnique({
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

        return latestUser;
      });

      return {
        userId: updatedUser?.userId,
        learnworldId: updatedUser?.learnworldId ?? null,
        email: updatedUser?.email,
        firstName: updatedUser?.firstName,
        lastName: updatedUser?.lastName,
        userName: updatedUser?.userName,
        isActive: updatedUser?.isActive,
        isAdmin: updatedUser?.isAdmin,
        isFirstTimeLogin: updatedUser?.isFirstTimeLogin,
        createdAt: updatedUser?.createdAt,
        updatedAt: updatedUser?.updatedAt,
        createdBy: updatedUser?.createdBy,
        updatedBy: updatedUser?.updatedBy,
        profile: updatedUser?.profile
          ? {
              cfCompany: updatedUser.profile.cfCompany,
              cfCohort: updatedUser.profile.cfCohort,
            }
          : null,
        userRoles:
          updatedUser?.userRoles?.map((userRole) => ({
            userRoleId: userRole.userRoleId,
            assignedAt: userRole.assignedAt,
            assignedBy: userRole.assignedBy,
            role: {
              roleId: userRole.role.roleId,
              roleName: userRole.role.roleName,
              roleCode: userRole.role.roleCode,
            },
          })) ?? [],
      };
    } catch (error: any) {
      /**
       * Compensation only applies if LearnWorlds was actually updated.
       */
      if (
        shouldSyncToLearnWorlds &&
        lwUpdated &&
        previousLwPayload &&
        currentUserEmail
      ) {
        try {
          await this.updateLearnWorldsUser(currentUserEmail, previousLwPayload);
          this.logger.warn(
            `Compensation succeeded for LearnWorlds user: ${currentUserEmail}`,
          );
        } catch (compensationError: any) {
          this.logger.error(
            `Compensation failed for LearnWorlds user: ${currentUserEmail}`,
            compensationError?.stack || compensationError,
          );
        }
      }

      handleServiceCatchError(error, this.logger);
    }
  }

  async deleteCapeUser(id: string): Promise<any> {
    try {
      const result = await this.prismaService.$transaction(async (tx) => {
        const existingUser = await tx.capeUser.findFirst({
          where: {
            userId: id,
            deletedAt: null,
            isAdmin: false,
            createdBy: {
              not: 'seed',
            },
          },
          select: {
            userId: true,
            learnworldId: true,
            userRoles: {
              select: {
                role: {
                  select: {
                    roleCode: true,
                  },
                },
              },
            },
          },
        });

        if (!existingUser) {
          throw new NotFoundException(
            errorResponseBuilder(
              'CAPE_USER_NOT_FOUND',
              undefined,
              `User with id ${id} not found or cannot be deleted.`,
            ),
          );
        }

        const roleCodes = existingUser.userRoles.map((x) => x.role.roleCode);
        const roleCodeSet = new Set(roleCodes);

        const isHybridLearner = roleCodeSet.has('HYBRID_LEARNER');
        const isClassroomLearner = roleCodeSet.has('CLASSROOM_LEARNER');

        let enrolledProductIds: string[] = [];

        if (isHybridLearner) {
          const hybridEnrollments =
            await tx.learnWorldsUserEnrollmentProgram.findMany({
              where: {
                userId: existingUser.userId,
              },
              select: {
                productId: true,
              },
            });

          enrolledProductIds = [
            ...new Set(
              hybridEnrollments
                .map((x) => x.productId)
                .filter((x): x is string => Boolean(x)),
            ),
          ];
        }

        /**
         *Delete child/dependent rows first
         */
        const [
          deleteProgramCapeUserFacilitatorResult,
          deleteProgramCapeUserEnrollmentResult,
          deleteLearnworldsEnrollmentResult,
          deleteRefreshTokensResult,
          deleteCapeLearnerProfileResult,
          deleteCapeUserProfileResult,
          deleteCapeUserRolesResult,
        ] = await Promise.all([
          isClassroomLearner
            ? tx.programCapeUserFacilitator.deleteMany({
                where: {
                  userId: existingUser.userId,
                },
              })
            : Promise.resolve({ count: 0 }),

          isClassroomLearner
            ? tx.programCapeUserEnrollment.deleteMany({
                where: {
                  userId: existingUser.userId,
                },
              })
            : Promise.resolve({ count: 0 }),

          isHybridLearner
            ? tx.learnWorldsUserEnrollmentProgram.deleteMany({
                where: {
                  userId: existingUser.userId,
                },
              })
            : Promise.resolve({ count: 0 }),

          tx.refreshToken.deleteMany({
            where: {
              userId: existingUser.userId,
            },
          }),

          tx.capeLearnerProfiles.deleteMany({
            where: {
              userId: existingUser.userId,
            },
          }),

          tx.capeUserProfiles.deleteMany({
            where: {
              userId: existingUser.userId,
            },
          }),

          tx.capeUserRole.deleteMany({
            where: {
              userId: existingUser.userId,
            },
          }),
        ]);

        let deleteOrphanLearnworldsProgramsResult = { count: 0 };

        if (isHybridLearner && enrolledProductIds.length > 0) {
          deleteOrphanLearnworldsProgramsResult =
            await tx.learnWorldsProgram.deleteMany({
              where: {
                productId: {
                  in: enrolledProductIds,
                },
                enrollments: {
                  none: {},
                },
              },
            });
        }

        const deleteCapeUserResult = await tx.capeUser.delete({
          where: {
            userId: existingUser.userId,
          },
          select: {
            userId: true,
          },
        });

        return {
          userId: deleteCapeUserResult.userId,
          deletedRoleCodes: roleCodes,
          deletedCounts: {
            learnworldsUserEnrollmentProgram:
              deleteLearnworldsEnrollmentResult.count,
            orphanLearnworldsPrograms:
              deleteOrphanLearnworldsProgramsResult.count,
            programCapeUserEnrollment:
              deleteProgramCapeUserEnrollmentResult.count,
            programCapeUserFacilitator:
              deleteProgramCapeUserFacilitatorResult.count,
            capeRefreshTokens: deleteRefreshTokensResult.count,
            capeUserRoles: deleteCapeUserRolesResult.count,
            capeLearnerProfiles: deleteCapeLearnerProfileResult.count,
            capeUserProfiles: deleteCapeUserProfileResult.count,
            capeUsers: 1,
          },
        };
      });

      return {
        ok: true,
        message: 'CAPE user and related records deleted successfully.',
        data: result,
      };
    } catch (error: any) {
      handleServiceCatchError(error, this.logger);
    }
  }

  async updateCapeUserData(
    userId: string,
    dto: UpdateCapeUserLearnworldsDto,
  ): Promise<any> {
    try {
      return this.prismaService.$transaction(async (tx) => {
        // Get user by id
        const user = await this.findUserForUpdate(userId, tx);

        await this.validateUpdateRequest(user, dto, tx);

        await this.updateBaseUserData(user.userId, dto, tx);

        if (dto.unenroll) {
          await this.handleSpecificUnenrollment(user, dto, tx);
        }
        return this.getUpdatedUserResponse(user.userId, tx);
      });
    } catch (error: any) {
      handleServiceCatchError(error, this.logger);
    }
  }

  async getAllProgramOfUser(userId: string): Promise<any> {
    try {
      const user = await this.prismaService.capeUser.findFirst({
        where: {
          userId,
          deletedAt: null,
        },
        select: {
          userId: true,
        },
      });

      if (!user) {
        throw new NotFoundException(
          errorResponseBuilder(
            'USER_NOT_FOUND',
            undefined,
            'User with given id not found',
          ),
        );
      }

      const [classroomPrograms, hybridPrograms] = await Promise.all([
        this.prismaService.programCapeUserEnrollment.findMany({
          where: {
            userId,
            deletedAt: null,
            status: 'ACTIVE',
            program: {
              deletedAt: null,
            },
          },
          select: {
            enrollmentId: true,
            status: true,
            isReviewFeedbackCompleted: true,
            createdAt: true,
            program: {
              select: {
                programId: true,
                programName: true,
                programDate: true,
                programCohort: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        }),

        this.prismaService.learnWorldsUserEnrollmentProgram.findMany({
          where: {
            userId,
          },
          select: {
            productId: true,
            status: true,
            enrolledAt: true,
            program: {
              select: {
                productId: true,
                productTitle: true,
                productType: true,
              },
            },
          },
          orderBy: {
            enrolledAt: 'desc',
          },
        }),
      ]);

      const classroomItems = classroomPrograms.map((item) => ({
        programId: item.program.programId,
        programName: item.program.programName,
        displayName: `${item.program.programName} (Classroom)`,
        source: 'CLASSROOM',
        status: item.status,
        enrollmentId: item.enrollmentId,
        programDate: item.program.programDate,
        programCohort: item.program.programCohort,
        isReviewFeedbackCompleted: item.isReviewFeedbackCompleted,
        enrolledAt: item.createdAt,
      }));

      const hybridItems = hybridPrograms.map((item) => ({
        programId: item.program.productId ?? item.productId,
        programName:
          item.program.productTitle ?? 'Untitled LearnWorlds Program',
        displayName: `${item.program.productTitle ?? 'Untitled LearnWorlds Program'} (Hybrid)`,
        source: 'HYBRID',
        status: item.status ?? null,
        enrollmentId: null,
        programDate: null,
        programCohort: null,
        isReviewFeedbackCompleted: null,
        enrolledAt: item.enrolledAt ?? null,
      }));

      const items = [...classroomItems, ...hybridItems].sort((a, b) => {
        const aTime = a.enrolledAt ? new Date(a.enrolledAt).getTime() : 0;
        const bTime = b.enrolledAt ? new Date(b.enrolledAt).getTime() : 0;
        return bTime - aTime;
      });

      return { items };
    } catch (error) {
      handleServiceCatchError(error, this.logger);
    }
  }

  async unenrollUserFromPrograms(dto: UnenrollUserProgramsDto): Promise<any> {
    try {
      const { userId, programs } = dto;

      const user = await this.prismaService.capeUser.findFirst({
        where: {
          userId,
          deletedAt: null,
        },
        select: {
          userId: true,
          email: true,
          learnworldId: true,
          firstName: true,
          lastName: true,
          userName: true,
        },
      });

      if (!user) {
        throw new NotFoundException(
          errorResponseBuilder(
            'USER_NOT_FOUND',
            undefined,
            'User with given id not found',
          ),
        );
      }

      const uniquePrograms = this.getUniquePrograms(programs);
      const warnings: string[] = [];

      const processedItems: any[] = [];

      const result = await this.prismaService.$transaction(async (tx) => {
        const processedItems: any[] = [];

        for (const program of uniquePrograms) {
          if (program.source === ProgramSourceEnum.CLASSROOM) {
            const classroomResult = await this.unenrollFromClassroomProgram(
              tx,
              user.userId,
              program,
            );

            processedItems.push({
              source: ProgramSourceEnum.CLASSROOM,
              programId: program.programId,
              enrollmentId: classroomResult.enrollmentId,
              status: 'UNENROLLED',
            });

            continue;
          }

          if (program.source === ProgramSourceEnum.HYBRID) {
            const hybridResult = await this.unenrollFromHybridProgram(
              tx,
              user,
              program,
              warnings,
            );

            processedItems.push({
              source: ProgramSourceEnum.HYBRID,
              programId: program.programId,
              enrollmentId: null,
              status: 'UNENROLLED',
              learnworldsUserId: hybridResult.learnworldsUserId,
              learnworldsUnenrolled: hybridResult.learnworldsUnenrolled,
            });

            continue;
          }

          throw new BadRequestException(
            errorResponseBuilder(
              'INVALID_PROGRAM_SOURCE',
              undefined,
              `Unsupported program source '${program.source}'`,
            ),
          );
        }

        return {
          userId: user.userId,
          totalUnenrolled: processedItems.length,
          items: processedItems,
          warnings,
        };
      });

      return result;
    } catch (error) {
      handleServiceCatchError(error, this.logger);
    }
  }

  private getUniquePrograms(
    programs: UnenrollProgramItemDto[],
  ): UnenrollProgramItemDto[] {
    const map = new Map<string, UnenrollProgramItemDto>();

    for (const item of programs) {
      const key = `${item.source}::${item.programId}`;
      if (!map.has(key)) {
        map.set(key, item);
      }
    }

    return [...map.values()];
  }

  private async unenrollFromClassroomProgram(
    tx: any,
    userId: string,
    program: UnenrollProgramItemDto,
  ): Promise<{ enrollmentId: string }> {
    const enrollment = await tx.programCapeUserEnrollment.findFirst({
      where: {
        programId: program.programId,
        userId,
        deletedAt: null,
      },
      select: {
        enrollmentId: true,
        programId: true,
        userId: true,
      },
    });

    if (!enrollment) {
      throw new NotFoundException(
        errorResponseBuilder(
          'CLASSROOM_ENROLLMENT_NOT_FOUND',
          undefined,
          `Classroom enrollment not found for program '${program.programId}' and user '${userId}'`,
        ),
      );
    }

    await tx.programCapeUserFacilitator.deleteMany({
      where: {
        programId: program.programId,
        userId,
      },
    });

    await tx.programCapeUserEnrollment.delete({
      where: {
        enrollmentId: enrollment.enrollmentId,
      },
    });

    return {
      enrollmentId: enrollment.enrollmentId,
    };
  }

  private async unenrollFromHybridProgram(
    tx: any,
    user: {
      userId: string;
      email: string;
      learnworldId: string | null;
      userName?: string;
    },
    program: UnenrollProgramItemDto,
    warnings: string[],
  ): Promise<{
    learnworldsUserId: string | null;
    learnworldsUnenrolled: boolean;
  }> {
    const hybridEnrollment =
      await tx.learnWorldsUserEnrollmentProgram.findFirst({
        where: {
          userId: user.userId,
          productId: program.programId,
        },
        select: {
          id: true,
          userId: true,
          productId: true,
          program: {
            select: {
              productId: true,
              productTitle: true,
            },
          },
        },
      });

    if (!hybridEnrollment) {
      throw new NotFoundException(
        errorResponseBuilder(
          'HYBRID_ENROLLMENT_NOT_FOUND',
          undefined,
          `Hybrid enrollment not found for product '${program.programId}' and user '${user.userId}'`,
        ),
      );
    }

    let learnworldsUnenrolled = false;

    if (!user.learnworldId) {
      warnings.push(
        `Skipped LearnWorlds unenrollment for internal user ${user.userName} because learnworldId is missing.`,
      );
    } else {
      learnworldsUnenrolled = await this.safeUnenrollUserFromLearnWorlds(
        user.learnworldId,
        {
          productId: hybridEnrollment.productId,
          productType: 'bundle',
        },
      );

      if (!learnworldsUnenrolled) {
        warnings.push(
          `This learner has been unenrolled successfully in CAPE LMS. However, we were unable to sync the unenrollment to LearnWorlds due to a technical issue. Please manually unenroll ${user.userName} in LearnWorlds for this program.`,
        );
      }
    }

    await tx.learnWorldsUserEnrollmentProgram.delete({
      where: {
        userId_productId: {
          userId: user.userId,
          productId: hybridEnrollment.productId,
        },
      },
    });

    return {
      learnworldsUserId: user.learnworldId,
      learnworldsUnenrolled,
    };
  }

  private async safeUnenrollUserFromLearnWorlds(
    learnworldUserId: string,
    payload: {
      productId: string;
      productType: 'course' | 'bundle' | 'subscription';
    },
  ): Promise<boolean> {
    try {
      await this.unenrollUserFromLearnWorlds(learnworldUserId, payload);
      return true;
    } catch (error: any) {
      this.logger.warn(
        `Best-effort LearnWorlds unenroll failed. userId=${learnworldUserId}, productId=${payload.productId}`,
        error?.stack || error,
      );
      return false;
    }
  }

  private async unenrollUserFromLearnWorlds(
    learnworldUserId: string,
    payload: {
      productId: string;
      productType: 'course' | 'bundle' | 'subscription';
    },
  ): Promise<void> {
    const encodedUserId = encodeURIComponent(learnworldUserId);
    const url = `${LW_USER}/${encodedUserId}/enrollment`;

    const lwConfig = this.config.get<any>('learnworls');
    const appEnv = this.config.get<string>('appEnv');

    if (
      !lwConfig?.learnworld_api_base_url ||
      !lwConfig?.learnworld_bearer_token ||
      !lwConfig?.learnworld_lw_client_id
    ) {
      this.logger.error('LearnWorlds configuration is missing.');
      throw new ServiceUnavailableException(
        errorResponseBuilder(
          'LW_CONFIG_MISSING',
          undefined,
          'LearnWorlds configuration is not properly set.',
        ),
      );
    }

    try {
      await firstValueFrom(
        this.http.delete(url, {
          baseURL: lwConfig.learnworld_api_base_url,
          headers: {
            Authorization: `Bearer ${lwConfig.learnworld_bearer_token}`,
            'Lw-Client': lwConfig.learnworld_lw_client_id,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          data: payload,
          timeout: 10000,
        }),
      );
    } catch (error: any) {
      this.logger.error(
        `Failed to unenroll user from LearnWorlds. userId=${learnworldUserId}, productId=${payload.productId}`,
        error?.stack || error,
      );

      throw new ServiceUnavailableException(
        errorResponseBuilder(
          'LW_UNENROLL_FAILED',
          undefined,
          'Failed to unenroll user from LearnWorlds',
        ),
      );
    }
  }

  private async ensureUsernameUnique(
    userName: string,
    currentUserId: string,
    tx: PrismaTx,
  ): Promise<void> {
    const prisma = tx ?? this.prismaService;

    const existingUsername = await prisma.capeUser.findFirst({
      where: {
        userName,
        deletedAt: null,
        NOT: {
          userId: currentUserId,
        },
      },
      select: {
        userId: true,
      },
    });

    if (existingUsername) {
      throw new ConflictException({
        code: 'USERNAME_ALREADY_EXISTS',
        message: 'Username is already in use by another account.',
      });
    }
  }

  private async findUserForUpdate(userId: string, tx: PrismaTx) {
    const user = await tx.capeUser.findFirst({
      where: {
        userId,
        deletedAt: null,
      },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
        profile: true,
        userProfile: true,
      },
    });

    if (!user) {
      throw new NotFoundException(
        errorResponseBuilder(
          'CAPE_USER_NOT_FOUND',
          undefined,
          'User with given id not found',
        ),
      );
    }

    return user;
  }

  private normalizeUpdateCapeUserDto(
    dto: UpdateCapeUserDto,
  ): UpdateCapeUserDto {
    return {
      firstName: dto.firstName.trim(),
      lastName: dto.lastName.trim(),
      userName: dto.userName.trim(),
      cfCompany: dto.cfCompany.trim(),
    };
  }

  private buildLearnWorldsPayloadFromCurrentState(user: UserForUpdate) {
    return {
      first_name: user.firstName ?? '',
      last_name: user.lastName ?? '',
      username: user.userName ?? '',
      fields: {
        cf_organization: user.profile?.cfCompany ?? '',
      },
    };
  }

  private shouldUpdateLearnWorldsForUser(user: UserForUpdate): boolean {
    const hasHybridLearnerRole = user.userRoles?.some(
      (userRole) => userRole.role?.roleCode === 'HYBRID_LEARNER',
    );

    const hasLearnworldId =
      !!user.learnworldId && user.learnworldId.trim().length > 0;

    return Boolean(hasHybridLearnerRole && hasLearnworldId);
  }

  private async updateLearnWorldsUser(
    email: string,
    payload: {
      first_name: string;
      last_name: string;
      username: string;
      fields: {
        cf_organization: string;
      };
    },
  ): Promise<any> {
    const encoded = encodeURIComponent(email);
    const url = `${LW_USER}/${encoded}`;

    const lwConfig = this.config.get<any>('learnworls');

    if (
      !lwConfig?.learnworld_api_base_url ||
      !lwConfig?.learnworld_bearer_token ||
      !lwConfig?.learnworld_lw_client_id
    ) {
      this.logger.error('LearnWorlds configuration is missing.');
      throw new ServiceUnavailableException(
        errorResponseBuilder(
          'LW_CONFIG_MISSING',
          undefined,
          'LearnWorlds configuration is not properly set.',
        ),
      );
    }

    try {
      const response = await firstValueFrom(
        this.http.put(url, payload, {
          baseURL: lwConfig.learnworld_api_base_url,
          headers: {
            Authorization: `Bearer ${lwConfig.learnworld_bearer_token}`,
            'Lw-Client': lwConfig.learnworld_lw_client_id,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        }),
      );

      return response.data;
    } catch (error: any) {
      const lwStatus = error?.response?.status;
      const lwData = error?.response?.data;

      this.logger.error(
        `LearnWorlds update failed for email=${email}, status=${lwStatus}`,
        JSON.stringify(lwData ?? error?.message ?? error),
      );

      throw new BadRequestException({
        code: 'LW_UPDATE_USER_FAILED',
        message: 'Failed to update user in LearnWorlds.',
        meta: {
          status: lwStatus,
          provider: 'LearnWorlds',
        },
      });
    }
  }

  private async validateUpdateRequest(
    user: any,
    dto: UpdateCapeUserLearnworldsDto,
    tx: PrismaTx,
  ) {
    if (dto.userName && dto.userName.trim() !== user.userName) {
      const existingUser = await tx.capeUser.findFirst({
        where: {
          userName: dto.userName.trim(),
          userId: {
            not: user.userId,
          },
          deletedAt: null,
        },
        select: {
          userId: true,
        },
      });

      if (existingUser) {
        throw new ConflictException(
          errorResponseBuilder(
            'CAPE_USER_USERNAME_EXISTS',
            undefined,
            'Username already exists! Please choose a different username.',
          ),
        );
      }
    }

    if (dto.unenroll && !dto.roleCode) {
      throw new BadRequestException(
        errorResponseBuilder(
          'CAPE_USER_UNENROLL_ROLECODE_REQUIRED',
          undefined,
          'roleCode is required when unenroll data is provided.',
        ),
      );
    }

    if (dto.roleCode) {
      const userRoleCodes = user.userRoles.map(
        (userRole: any) => userRole.role.roleCode,
      );

      if (!userRoleCodes.includes(dto.roleCode)) {
        throw new BadRequestException(
          `User does not have role ${dto.roleCode}.`,
        );
      }
    }

    if (!dto.unenroll) {
      return;
    }

    if (dto.roleCode === 'HYBRID_LEARNER') {
      if (dto.unenroll.type !== 'HYBRID') {
        throw new BadRequestException(
          'For HYBRID_LEARNER, unenroll.type must be LEARNWORLDS.',
        );
      }

      if (!dto.unenroll.productId?.trim()) {
        throw new BadRequestException(
          'productId is required for HYBRID_LEARNER unenrollment.',
        );
      }
    }

    if (dto.roleCode === 'CLASSROOM_LEARNER') {
      if (dto.unenroll.type !== 'CLASSROOM') {
        throw new BadRequestException(
          'For CLASSROOM_LEARNER, unenroll.type must be PROGRAM.',
        );
      }

      if (!dto.unenroll.programId?.trim()) {
        throw new BadRequestException(
          'programId is required for CLASSROOM_LEARNER unenrollment.',
        );
      }
    }
  }

  private async updateBaseUserData(
    userId: string,
    dto: UpdateCapeUserLearnworldsDto,
    tx: PrismaTx,
  ) {
    const hasUserBaseUpdate =
      dto.firstName !== undefined ||
      dto.lastName !== undefined ||
      dto.userName !== undefined;

    if (hasUserBaseUpdate) {
      await tx.capeUser.update({
        where: {
          userId,
        },
        data: {
          ...(dto.firstName !== undefined && {
            firstName: dto.firstName.trim(),
          }),
          ...(dto.lastName !== undefined && {
            lastName: dto.lastName.trim(),
          }),
          ...(dto.userName !== undefined && {
            userName: dto.userName.trim(),
          }),
          updatedBy: 'SUPER_ADMIN',
        },
      });
    }

    const hasLearnerProfileUpdate =
      dto.cfCompany !== undefined || dto.cfCohort !== undefined;

    if (hasLearnerProfileUpdate) {
      await tx.capeLearnerProfiles.upsert({
        where: {
          userId,
        },
        create: {
          userId,
          ...(dto.cfCompany !== undefined && {
            cfCompany: dto.cfCompany.trim(),
          }),
          ...(dto.cfCohort !== undefined && {
            cfCohort: dto.cfCohort.trim(),
          }),
        },
        update: {
          ...(dto.cfCompany !== undefined && {
            cfCompany: dto.cfCompany.trim(),
          }),
          ...(dto.cfCohort !== undefined && {
            cfCohort: dto.cfCohort.trim(),
          }),
        },
      });
    }
  }

  private async handleSpecificUnenrollment(
    user: any,
    dto: UpdateCapeUserLearnworldsDto,
    tx: PrismaTx,
  ) {
    const roleCode = dto.roleCode!;

    if (roleCode === 'HYBRID_LEARNER') {
      await this.unenrollHybridLearnerByProduct(
        user.userId,
        dto.unenroll!.productId!.trim(),
        tx,
      );
      return;
    }

    if (roleCode === 'CLASSROOM_LEARNER') {
      await this.unenrollClassroomLearnerByProgram(
        user.userId,
        dto.unenroll!.programId!.trim(),
        tx,
      );
      return;
    }

    throw new BadRequestException(`Unsupported roleCode: ${roleCode}`);
  }

  private async unenrollHybridLearnerByProduct(
    userId: string,
    productId: string,
    tx: PrismaTx,
  ) {
    const enrollment = await tx.learnWorldsUserEnrollmentProgram.findUnique({
      where: {
        userId_productId: {
          userId,
          productId,
        },
      },
      select: {
        id: true,
        userId: true,
        productId: true,
      },
    });

    if (!enrollment) {
      throw new NotFoundException(
        errorResponseBuilder(
          'LEARNWORLDS_ENROLLMENT_NOT_FOUND',
          undefined,
          'LearnWorlds enrollment not found for this user and product.',
        ),
      );
    }

    await tx.learnWorldsUserEnrollmentProgram.delete({
      where: {
        userId_productId: {
          userId,
          productId,
        },
      },
    });
  }

  private async unenrollClassroomLearnerByProgram(
    userId: string,
    programId: string,
    tx: PrismaTx,
  ) {
    const enrollment = await tx.programCapeUserEnrollment.findUnique({
      where: {
        programId_userId: {
          programId,
          userId,
        },
      },
      select: {
        enrollmentId: true,
        deletedAt: true,
      },
    });

    if (!enrollment || enrollment.deletedAt) {
      throw new NotFoundException(
        'Program enrollment not found for this user and program.',
      );
    }

    await tx.programCapeUserFacilitator.deleteMany({
      where: {
        userId,
        programId,
      },
    });

    await tx.programCapeUserEnrollment.deleteMany({
      where: {
        programId,
        userId,
      },
    });
  }

  private async getUpdatedUserResponse(userId: string, tx: PrismaTx) {
    const user = await tx.capeUser.findFirst({
      where: {
        userId,
        deletedAt: null,
      },
      select: {
        userId: true,
        learnworldId: true,
        email: true,
        firstName: true,
        lastName: true,
        userName: true,
        isActive: true,
        isAdmin: true,
        isFirstTimeLogin: true,
        createdAt: true,
        updatedAt: true,
        createdBy: true,
        updatedBy: true,

        profile: {
          select: {
            cfCompany: true,
            cfCohort: true,
          },
        },

        userProfile: {
          select: {
            userId: true,
            phoneNumber: true,
            jobTitle: true,
            currentRole: true,
            targetRole: true,
            industry: true,
            careerGoals: true,
            skillsJson: true,
          },
        },

        userRoles: {
          select: {
            userRoleId: true,
            assignedAt: true,
            assignedBy: true,
            role: {
              select: {
                roleId: true,
                roleName: true,
                roleCode: true,
              },
            },
          },
        },

        learnworldsEnrollments: {
          select: {
            productId: true,
            enrolledAt: true,
            status: true,
            progress: true,
            program: {
              select: {
                productId: true,
                productTitle: true,
                productType: true,
                productUrl: true,
              },
            },
          },
        },

        programEnrollments: {
          where: {
            deletedAt: null,
          },
          select: {
            enrollmentId: true,
            status: true,
            isReviewFeedbackCompleted: true,
            program: {
              select: {
                programId: true,
                programName: true,
                programCohort: true,
                programDate: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('Updated user not found.');
    }

    return {
      item: {
        ...user,
        roles: user.userRoles.map((userRole) => ({
          userRoleId: userRole.userRoleId,
          assignedAt: userRole.assignedAt,
          assignedBy: userRole.assignedBy,
          roleId: userRole.role.roleId,
          roleCode: userRole.role.roleCode,
          roleName: userRole.role.roleName,
        })),
      },
    };
  }
}
