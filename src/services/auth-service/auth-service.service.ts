/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  CapePasswordSetupTokenRepository,
  CapeRoleRepository,
  CapeUserProfileRepository,
  CapeUserRepository,
} from '@app/database';
import { RefreshTokenRepository } from '@app/database/repository/refresh-token.repository';
import {
  AuthSession,
  CapeOnboardingProfileDto,
  CapeUserWithRoles,
  CONFIRM_PASSWORD_FIELD_REQUIRED,
  DEFAULTS,
  EMAIL_FIELD_REQUIRED,
  EMAIL_PASSWORD_REQUIRED,
  JWT_SECRET_NOT_CONFIGURED,
  LearnWorldsUser,
  LOGIN_USER_NOT_FOUND,
  LoginDto,
  LoginResult,
  LogoutResult,
  LW_GET_USER,
  PASSWORD_HASH_MISSING,
  PASSWORD_INVALID,
  REFRESH_TOKEN_INVALID,
  REFRESH_TOKEN_MISSING,
  RefreshResult,
  ROLE_CODE,
  UNAUTHENTICATED,
  UNAUTHENTICATED_NO_ACCESS_TOKEN,
  UNAUTHENTICATED_NO_USER_FOUND,
  UNAUTHENTICATED_NOROLE,
  UNAUTHENTICATED_PAYLOAD,
  VALIDATE_YOUR_EMAIL,
} from '@app/shared';
import {
  EMAIL_NOT_FOUND_QUERY,
  PASSWORD_FIELD_REQUIRED,
  ROLE_CODE_FIELD_REQUIRED,
} from '@app/shared/constant/error-item.constants';
import { LearnworldsGateway } from '@app/shared/learnworlds/learnworlds.gateway';
import { HttpService } from '@nestjs/axios';
import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';
import { Prisma } from 'src/generated/client';
import { errorResponseBuilder } from 'utils/errorResponseBuilder';
import { handleServiceCatchError } from 'utils/handleServiceCatchError';
import { signAccessToken, verifyAccessToken } from 'utils/jwt';
import { hashPassword, verifyPassword } from 'utils/password';
import { createRawToken, hashToken } from 'utils/password-setup-token.util';
import { PasswordCapsCheck } from 'utils/password-validation-checks/passwordCapsCheck';
import { PasswordConsistentCheck } from 'utils/password-validation-checks/passwordConsistentCheck';
import { PasswordLengthChecks } from 'utils/password-validation-checks/passwordLengthCheck';
import { PasswordNumberCheck } from 'utils/password-validation-checks/passwordNumberCheck';
import { PasswordSpecialCharCheck } from 'utils/password-validation-checks/passwordSpeciaCharCheck';
import { createRawRefreshToken, hashRefreshToken } from 'utils/refreshToken';

@Injectable()
export class AuthServiceService {
  private readonly logger = new Logger(AuthServiceService.name);

  constructor(
    private readonly capeUserRepo: CapeUserRepository,
    private readonly capeRoleRepo: CapeRoleRepository,
    private readonly capeUserProfileRepo: CapeUserProfileRepository,
    private readonly config: ConfigService,
    private readonly refreshTokenRepo: RefreshTokenRepository,
    private readonly http: HttpService,
    private readonly capePasswordSetupTokenRepo: CapePasswordSetupTokenRepository,
    private readonly learnworldsGateway: LearnworldsGateway,
  ) {}

  async onBoardingUser(dto: CapeOnboardingProfileDto): Promise<any> {
    try {
      // 1) Get user with learner profile (cape_learner_profiles)
      const user = await this.capeUserRepo.findUserByEmailWithProfile(
        dto.email,
      );

      // 2) If no user found -> error
      if (!user) {
        throw new NotFoundException(
          errorResponseBuilder(
            'ONBOARDING_ERROR',
            [
              {
                code: 'ONBOARDING_USER_EMAIL_NOT_FOUND',
                meta: { field: 'email' },
              },
            ],
            `Email ${dto.email} not found`,
          ),
        );
      }

      // NEW #1: Block if onboarding already completed
      if (user.isFirstTimeLogin === false) {
        throw new BadRequestException(
          errorResponseBuilder(
            'ONBOARDING_ERROR',
            [
              {
                code: 'ONBOARDING_ALREADY_COMPLETED',
              },
            ],
            `Onboarding already completed for email ${dto.email}`,
          ),
        );
      }

      // 3) Ensure learner profile exists (your requirement #1/#2)
      if (!user.profile) {
        throw new NotFoundException(
          errorResponseBuilder(
            'ONBOARDING_ERROR',
            [
              {
                code: 'ONBOARDING_LEARNER_PROFILE_NOT_FOUND',
              },
            ],
            `Learner profile not found for email ${dto.email}`,
          ),
        );
      }

      // NEW #2: if first/last changed -> update username too
      const firstNameChanged = dto.firstName !== user.firstName;
      const lastNameChanged = dto.lastName !== user.lastName;
      const orgChanged = dto.organization !== (user.profile?.cfCompany ?? null);

      const nextUserName =
        firstNameChanged || lastNameChanged
          ? `${dto.firstName} ${dto.lastName}`.trim()
          : user.userName;

      // 4) Update LearnWorlds only if name/org changed
      const nameOrOrgChanged =
        firstNameChanged || lastNameChanged || orgChanged;

      if (nameOrOrgChanged) {
        const encoded = encodeURIComponent(dto.email);
        const url = `${LW_GET_USER}/${encoded}`;

        const updateData = {
          first_name: dto.firstName,
          last_name: dto.lastName,
          fields: {
            cf_company: dto.organization,
          },
        };

        // const lwConfig = this.config.get<any>('learnworls');

        const res = await this.learnworldsGateway.updateUserByEmail(
          url,
          updateData,
        );
        // const res = await firstValueFrom(
        //   this.http.put(url, updateData, {
        //     headers: {
        //       Authorization: `Bearer ${lwConfig.learnworld_bearer_token}`,
        //       'Lw-Client': lwConfig.learnworld_lw_client_id,
        //       Accept: 'application/json',
        //     },
        //     baseURL: lwConfig.learnworld_api_base_url,
        //   }),
        // );

        // if (!res || res?.response.status !== 200) {
        //   throw new BadGatewayException(
        //     errorResponseBuilder(
        //       'ONBOARDING_ERROR',
        //       [
        //         {
        //           code: 'ONBOARDING_LEARNWORLDS_UPDATE_FAILED',
        //         },
        //       ],
        //       'Unable to update user profile on learning platform. Please try again later.',
        //     ),
        //   );
        // }

        // If LW is disabled, treat it as success (skip external call)
        if (res.skipped) {
          // Optional We can throw an error
          this.logger.warn(
            `[LW DISABLED] Proceeding without LW update for ${dto.email}. User Data not Updated on LW`,
          );
        } else {
          if (res.response.status !== 200) {
            throw new BadGatewayException(
              errorResponseBuilder(
                'ONBOARDING_ERROR',
                [{ code: 'ONBOARDING_LEARNWORLDS_UPDATE_FAILED' }],
                'Unable to update user profile on learning platform. Please try again later.',
              ),
            );
          }
        }
      }

      // 5) Persist to DB in ONE transaction (custom db must reflect LW changes)
      //    - If LW update succeeded, we update CapeUser first/last + learner profile cf_company
      //    - upsert/create CapeUserProfiles (v2)
      //    - set isFirstTimeLogin = false
      const result = await this.capeUserRepo['prisma'].$transaction(
        async (tx: Prisma.TransactionClient) => {
          // 5a) If name/org changed -> update custom db to match
          if (nameOrOrgChanged) {
            await tx.capeUser.update({
              where: { email: dto.email },
              data: {
                ...(firstNameChanged ? { firstName: dto.firstName } : {}),
                ...(lastNameChanged ? { lastName: dto.lastName } : {}),
                ...(firstNameChanged || lastNameChanged
                  ? { userName: nextUserName }
                  : {}),
                ...(orgChanged
                  ? {
                      profile: {
                        update: {
                          cfCompany: dto.organization,
                        },
                      },
                    }
                  : {}),
                updatedAt: new Date(),
                updatedBy: dto.email,
              },
            });
          }

          // 5b) Update or create CapeUserProfiles (v2) linked by FK userId
          //     (your schema: userId unique)
          const skillsJson = JSON.stringify(dto.skills ?? []);

          await tx.capeUserProfiles.upsert({
            where: { userId: user.userId },
            update: {
              phoneNumber: dto.phoneNumber,
              jobTitle: dto.jobTitle,
              currentRole: dto.currentRole,
              targetRole: dto.targetRole,
              industry: dto.industry,
              careerGoals: dto.careerGoals,
              skillsJson,
            },
            create: {
              userId: user.userId,
              phoneNumber: dto.phoneNumber,
              jobTitle: dto.jobTitle,
              currentRole: dto.currentRole,
              targetRole: dto.targetRole,
              industry: dto.industry,
              careerGoals: dto.careerGoals,
              skillsJson,
            },
          });

          // 5c) Mark onboarding complete
          const updatedUser = await tx.capeUser.update({
            where: { email: dto.email },
            data: {
              isFirstTimeLogin: false,
              updatedAt: new Date(),
              updatedBy: dto.email,
            },
            include: {
              profile: true,
              userProfile: true,
            },
          });

          return updatedUser;
        },
      );

      return { success: true, data: result };
    } catch (error) {
      handleServiceCatchError(error, this.logger);
    }
  }

  async validatePasswordToken(
    token: string,
    email: string,
  ): Promise<{ valid: boolean }> {
    try {
      // 1. normalize email/token
      const normalizedEmail = email?.trim().toLowerCase();
      const normalizeToken = token.trim();
      // 2. If token empty then return error

      if (!normalizedEmail) {
        throw new UnauthorizedException(
          errorResponseBuilder('SET_PASSWORD_EMAIL_MISSING'),
        );
      }

      if (!normalizeToken) {
        throw new UnauthorizedException(
          errorResponseBuilder('SET_PASSWORD_NOT_VALIDATED'),
        );
      }

      const tokenHash = hashToken(normalizeToken);

      // 3. find token in table
      const tokenExist = await this.capePasswordSetupTokenRepo.findToken(
        tokenHash,
        normalizedEmail,
      );

      // 4. If token not exist return error
      if (!tokenExist) {
        throw new UnauthorizedException(
          errorResponseBuilder('SET_PASSWORD_TOKEN_NOT_EXIST'),
        );
      }
      // 5. if token token exist then return success
      return { valid: true };
    } catch (error) {
      if (error instanceof HttpException) throw error;

      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        message,
        error instanceof Error ? error.stack : undefined,
      );
      throw new InternalServerErrorException('An unexpected error occurs');
    }
  }

  async validateEmail(email: string): Promise<any> {
    try {
      const normalizedEmail = email.trim().toLowerCase();

      const user: CapeUserWithRoles | null =
        await this.capeUserRepo.findUserByEmailAndRole(normalizedEmail);

      if (!user) {
        throw new NotFoundException(
          errorResponseBuilder(
            'USER_NOT_FOUND',
            undefined,
            'No account found for the provided email.',
          ),
        );
      }

      const hasClassroomLearnerRole = user.userRoles.some(
        (userRole) => userRole.role.roleCode === 'CLASSROOM_LEARNER',
      );

      if (!hasClassroomLearnerRole) {
        throw new BadRequestException(
          errorResponseBuilder(
            'INVALID_USER_ROLE',
            undefined,
            'This email is not registered as a classroom learner account.',
          ),
        );
      }

      if (user.isActive) {
        throw new BadRequestException(
          errorResponseBuilder(
            'USER_EXIST_ACTIVE',
            undefined,
            'Your account is already activated. Please login using your email and password.',
          ),
        );
      }

      if (!user.isFirstTimeLogin) {
        throw new BadRequestException(
          errorResponseBuilder(
            'USER_EXIST_ACTIVE',
            undefined,
            'Your account is already activated. Please login using your email and password.',
          ),
        );
      }

      const rawToken = createRawToken();
      const tokenHash = hashToken(rawToken);

      await this.capePasswordSetupTokenRepo.deleteTokensByEmail(
        normalizedEmail,
      );
      await this.capePasswordSetupTokenRepo.createPasswordSetupToken({
        data: {
          email: normalizedEmail,
          tokenHash,
        },
      });

      return { email: normalizedEmail, token: rawToken };
    } catch (error) {
      if (error instanceof HttpException) throw error;

      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        message,
        error instanceof Error ? error.stack : undefined,
      );
      throw new InternalServerErrorException('An unexpected error occurs');
    }
  }

  /**
   *
   * @param email
   */
  async validateLearnworldsEmail(
    email: string,
  ): Promise<{ email: string; token?: string }> {
    const encoded = encodeURIComponent(email);
    const url = `${LW_GET_USER}/${encoded}`;

    try {
      // 0) Normalize & validate input
      const normalizedEmail = email?.trim().toLowerCase();
      if (
        !normalizedEmail ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
      ) {
        throw new BadRequestException(
          errorResponseBuilder(EMAIL_NOT_FOUND_QUERY, [
            {
              code: EMAIL_NOT_FOUND_QUERY,
              meta: { field: 'email' },
            },
          ]),
        );
      }

      // 1) Check if user already exists in OUR database
      // - If exists and isActive=true: return { valid: true } (user should go to normal login)
      // - If exists and isActive=false: continue (resume onboarding)
      const isExistingUser: CapeUserWithRoles | null =
        await this.capeUserRepo.findUserByEmailAndRole(normalizedEmail);

      // user data must be pre-created on the database by webhook
      if (!isExistingUser) {
        throw new ForbiddenException(
          errorResponseBuilder('NO_PROGRAM_ENROLLED_HYBRID', [
            {
              code: 'NO_PROGRAM_ENROLLED_HYBRID',
              meta: { email: normalizedEmail },
            },
          ]),
        );
      }

      const hasClassroomLearnerRole = isExistingUser.userRoles.some(
        (userRole) => userRole.role.roleCode === 'HYBRID_LEARNER',
      );

      if (!hasClassroomLearnerRole) {
        throw new BadRequestException(
          errorResponseBuilder(
            'INVALID_USER_ROLE_HYBRID',
            undefined,
            'This email is not registered as a classroom learner account.',
          ),
        );
      }

      if (isExistingUser?.isActive) {
        throw new ConflictException(errorResponseBuilder('USER_EXIST_ACTIVE'));
      }

      if (!isExistingUser?.isFirstTimeLogin) {
        throw new BadRequestException(
          errorResponseBuilder('LW_USER_EXIST_COMPLETED_ONBOARDING'),
        );
      }

      // 2) Call LearnWorlds API: Get user by email (encoded)
      // - GET /v2/users/{emailEncoded}?include_suspended=true
      // - If 404 (not found): return { valid: false }
      // - If 401/403: throw service unavailable / configuration error (token/client id)
      // - If other errors: throw internal error
      const lwConfig = this.config.get<any>('learnworls');
      const res = await firstValueFrom(
        this.http.get(url, {
          headers: {
            Authorization: `Bearer ${lwConfig.learnworld_bearer_token}`,
            'Lw-Client': lwConfig.learnworld_lw_client_id,
            Accept: 'application/json',
          },
          baseURL: lwConfig.learnworld_api_base_url,
        }),
      );

      if (res.status !== 200) {
        throw new BadGatewayException(
          errorResponseBuilder('LW_FAILED_FETCH_USER_DATA'),
        );
      }

      if (!res.data || res.data === '') {
        throw new ForbiddenException(
          errorResponseBuilder('LW_SERVICE_UNAVAILABLE'),
        );
      }

      const lwUser: LearnWorldsUser = res.data;

      // 3) Eligibility checks (business rules)
      // - If lwUser.is_suspended === true: return { valid: false }
      // - If lwUser.is_admin === true or lwUser.is_instructor === true:
      if (lwUser.is_suspended) {
        throw new ForbiddenException(errorResponseBuilder('LW_USER_SUSPENDED'));
      }
      if (lwUser.is_admin || lwUser.is_instructor) {
        throw new ForbiddenException(
          errorResponseBuilder('LW_USER_ADMIN_INSTRUCTOR'),
        );
      }

      /** DB transaction for user + profile creation **/

      // 5) Create or update local user (inactive, no password yet)
      // - Upsert user by email:
      //     - passwordHash = null
      //     - isActive = false
      //     - lwUserId = lwUser.id (from LearnWorlds)

      // 6) Create user profile record (if not exists)

      //Hashtoken
      const rawToken = createRawToken();
      const hashTokenNew = hashToken(rawToken);

      await this.capeUserRepo['prisma'].$transaction(
        async (tx: Prisma.TransactionClient) => {
          // Create User
          // await this.capeUserRepo.updateUserFromLearnWorlds(
          //   normalizedEmail,
          //   {
          //     firstName: lwUser.first_name || undefined,
          //     lastName: lwUser.last_name || undefined,
          //     userName: lwUser.username || undefined,
          //     roleId: existRole.roleId,
          //     updatedBy: 'system',
          //   },
          //   tx,
          // );

          const profilePayload = {
            bio: lwUser.fields?.bio ?? null,
            location: lwUser.fields?.location ?? null,
            url: lwUser.fields?.url ?? null,
            fb: lwUser.fields?.fb ?? null,
            twitter: lwUser.fields?.twitter ?? null,
            instagram: lwUser.fields?.instagram ?? null,
            linkedin: lwUser.fields?.linkedin ?? null,
            skype: lwUser.fields?.skype ?? null,
            behance: lwUser.fields?.behance ?? null,
            dribbble: lwUser.fields?.dribbble ?? null,
            github: lwUser.fields?.github ?? null,
            cfCompany: (lwUser.fields as any)?.cf_organization ?? null,
            cfCohort: (lwUser.fields as any)?.cf_cohort ?? null,
            npsScore:
              typeof lwUser.nps_score === 'number' ? lwUser.nps_score : null,
            npsComment:
              typeof lwUser.nps_comment === 'string'
                ? lwUser.nps_comment
                : null,
            tags: lwUser.tags?.join(',') ?? null,
          };

          await this.capeUserProfileRepo.upsertUserProfile(
            {
              where: {
                userId: isExistingUser.userId,
              },
              create: {
                userId: isExistingUser.userId,
                ...profilePayload,
              },
              update: {
                ...profilePayload,
              },
            },
            tx,
          );

          // (c) Replace token (delete old tokens -> create new)
          await this.capePasswordSetupTokenRepo.deleteTokensByEmail(
            normalizedEmail,
            tx,
          );

          await this.capePasswordSetupTokenRepo.createPasswordSetupToken(
            {
              data: {
                tokenHash: hashTokenNew,
                email: normalizedEmail,
              },
            },
            tx,
          );
        },
      );

      return { email: normalizedEmail, token: rawToken };
    } catch (error) {
      if (error instanceof AxiosError) {
        const status = error.response?.status;

        // Any LearnWorlds rejection becomes ONE business error
        if (status === 404 || status === 401 || status === 403) {
          throw new ForbiddenException(
            errorResponseBuilder('LW_USER_NOT_ELIGIBLE', [
              {
                code: 'LW_USER_NOT_ELIGIBLE',
                meta: { provider: 'learnworlds' },
              },
            ]),
          );
        }

        // LearnWorlds down / 5xx
        if (status && status >= 500) {
          throw new ServiceUnavailableException(
            errorResponseBuilder('LW_SERVICE_UNAVAILABLE'),
          );
        }
      }

      if (error instanceof HttpException) throw error;

      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        message,
        error instanceof Error ? error.stack : undefined,
      );
      throw new InternalServerErrorException('An unexpected error occurs');
    }
  }

  async setPassword(
    email: string,
    password: string,
    confirmPassword: string,
    token: string,
  ): Promise<{ success: boolean }> {
    try {
      // 1) Check email, password, confirmPassword not empty
      if (!email || !token || !password || !confirmPassword) {
        throw new BadRequestException(
          errorResponseBuilder('FORM_FIELD_ERROR', [
            ...(email
              ? []
              : [{ code: EMAIL_NOT_FOUND_QUERY, meta: { field: 'email' } }]),
            ...(token
              ? []
              : [
                  {
                    code: 'SET_PASSWORD_NOT_VALIDATED',
                    meta: { field: 'token' },
                  },
                ]),
            ...(password
              ? []
              : [
                  {
                    code: PASSWORD_FIELD_REQUIRED,
                    meta: { field: 'password' },
                  },
                ]),
            ...(confirmPassword
              ? []
              : [
                  {
                    code: CONFIRM_PASSWORD_FIELD_REQUIRED,
                    meta: { field: 'confirmPassword' },
                  },
                ]),
          ]),
        );
      }

      // 1.1) Normalize & validate email
      const normalizedEmail = email?.trim().toLowerCase();
      const normalizedToken = token.trim();

      if (!normalizedToken) {
        throw new UnauthorizedException(
          errorResponseBuilder('SET_PASSWORD_NOT_VALIDATED'),
        );
      }

      const tokenHash = hashToken(normalizedToken);

      const tokenExist = await this.capePasswordSetupTokenRepo.findToken(
        tokenHash,
        normalizedEmail,
      );

      if (!tokenExist) {
        throw new UnauthorizedException(
          errorResponseBuilder('SET_PASSWORD_TOKEN_NOT_EXIST'),
        );
      }

      PasswordConsistentCheck(password, confirmPassword);
      PasswordLengthChecks(password);
      PasswordCapsCheck(password);
      PasswordNumberCheck(password);
      PasswordSpecialCharCheck(password);

      const hashedPassword = await hashPassword(password);

      await this.capeUserRepo['prisma'].$transaction(async (tx) => {
        const user = await this.capeUserRepo.findUserByEmail(normalizedEmail);

        if (!user) {
          throw new NotFoundException(
            errorResponseBuilder('USER_NOT_FOUND', [
              {
                code: 'USER_NOT_FOUND',
                meta: { field: 'email', value: normalizedEmail },
              },
            ]),
          );
        }

        if (user.isActive) {
          throw new ConflictException(
            errorResponseBuilder('USER_ALREADY_ACTIVE', [
              {
                code: 'USER_ALREADY_ACTIVE',
                meta: { field: 'email', value: normalizedEmail },
              },
            ]),
          );
        }

        await this.capeUserRepo.updateUserPasswordAndActivate(
          normalizedEmail,
          {
            passwordHash: hashedPassword,
            updatedBy: normalizedEmail,
          },
          tx,
        );

        await this.capePasswordSetupTokenRepo.deleteTokensByEmail(
          normalizedEmail,
          tx,
        );
      });

      // 8) Return success
      return { success: true };
    } catch (error) {
      if (error instanceof HttpException) throw error;

      const message = error instanceof Error ? error.message : 'Unknown error';

      this.logger.error(
        message,
        error instanceof Error ? error.stack : undefined,
      );
      throw new InternalServerErrorException('An unexpected error occurs');
    }
  }

  // =========================================================
  // GET /auth/me
  // - Only validates access_token cookie
  // - If expired/invalid => 401
  // =========================================================
  async me(accessToken: string | undefined): Promise<AuthSession> {
    try {
      if (!accessToken)
        throw new UnauthorizedException(
          errorResponseBuilder(UNAUTHENTICATED_NO_ACCESS_TOKEN),
        );

      const jwtSecret = this.config.get<string>('JWT_ACCESS_SECRET');
      if (!jwtSecret) {
        throw new InternalServerErrorException(
          errorResponseBuilder(JWT_SECRET_NOT_CONFIGURED),
        );
      }

      const payload = await verifyAccessToken({
        token: accessToken,
        secret: jwtSecret,
      });
      if (!payload)
        throw new UnauthorizedException(
          errorResponseBuilder(UNAUTHENTICATED_PAYLOAD),
        );

      // Enterprise: confirm user still existws / not deleted
      const user = await this.capeUserRepo.findUserByUserIdWithProfileAndRoles(
        payload.sub,
      );
      if (!user || user.deletedAt)
        throw new UnauthorizedException(
          errorResponseBuilder(UNAUTHENTICATED_NO_USER_FOUND),
        );

      if (!user.userRoles || user.userRoles.length === 0) {
        throw new UnauthorizedException(
          errorResponseBuilder(UNAUTHENTICATED_NOROLE),
        );
      }

      const matchedUserRole = user.userRoles.find(
        (userRole) => userRole.role.roleId === payload.roleId,
      );

      if (!matchedUserRole) {
        throw new UnauthorizedException(
          errorResponseBuilder('SESSION_ROLE_NOT_FOUND'),
        );
      }

      const selectedRole = matchedUserRole.role;

      return {
        user: {
          id: user.userId,
          firstName: user.firstName,
          lastName: user.lastName,
          name: user.userName,
          email: user.email,
          isFirstTimeLogin: user.isFirstTimeLogin,
          roleId: selectedRole.roleId,
          roleName: selectedRole.roleName,
          roleCode: selectedRole.roleCode,
          company: user.profile?.cfCompany || '',
          authScope: payload.authScope,
        },
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;

      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        message,
        error instanceof Error ? error.stack : undefined,
      );
      throw new InternalServerErrorException('An unexpected error occurs');
    }
  }

  // =========================================================
  // POST /auth/refresh
  // - Validates refresh_token cookie (opaque)
  // - Checks DB (hash match + not revoked + not expired)
  // - Issues NEW access token
  // =========================================================
  async refresh(refreshTokenRaw: string | undefined): Promise<RefreshResult> {
    try {
      if (!refreshTokenRaw)
        throw new UnauthorizedException(
          errorResponseBuilder(REFRESH_TOKEN_MISSING),
        );

      const refreshHash = hashRefreshToken(refreshTokenRaw);

      const tokenRow = await this.refreshTokenRepo.findValidByHash(refreshHash);
      if (!tokenRow)
        throw new UnauthorizedException(
          errorResponseBuilder(REFRESH_TOKEN_INVALID),
        );

      const user = await this.capeUserRepo.findUserByUserIdWithProfileAndRoles(
        tokenRow.userId,
      );

      if (!user || user.deletedAt)
        throw new UnauthorizedException(errorResponseBuilder(UNAUTHENTICATED));

      if (!user.userRoles || user.userRoles.length === 0) {
        throw new UnauthorizedException(
          errorResponseBuilder(UNAUTHENTICATED_NOROLE),
        );
      }

      const matchedUserRole = user.userRoles.find(
        (userRole) => userRole.role.roleId === tokenRow.selectedRoleId,
      );

      if (!matchedUserRole) {
        throw new UnauthorizedException(
          errorResponseBuilder('SESSION_ROLE_NOT_FOUND'),
        );
      }

      const selectedRole = matchedUserRole.role;

      const scope: 'admin' | 'learner' =
        selectedRole.roleCode === ROLE_CODE.CAPE_ADMIN ||
        selectedRole.roleCode === ROLE_CODE.HR_FOCAL_ADMIN
          ? 'admin'
          : 'learner';

      const jwtSecret = this.config.get<string>('JWT_ACCESS_SECRET');
      if (!jwtSecret)
        throw new InternalServerErrorException(
          errorResponseBuilder(JWT_SECRET_NOT_CONFIGURED),
        );

      const expiresInSeconds =
        Number(
          this.config.get<string>('ACCESS_TOKEN_TTL_SECONDS') ??
            DEFAULTS.accessTtlSeconds,
        ) || DEFAULTS.accessTtlSeconds;

      const accessToken = await signAccessToken({
        payload: {
          email: String(user.email),
          roleId: String(selectedRole.roleId),
          roleCode: String(selectedRole.roleCode),
          authScope: scope,
        },
        subject: String(user.userId),
        secret: jwtSecret,
        expiresInSeconds,
      });

      // Optional enterprise hardening:
      // - rotate refresh token each refresh, revoke old tokenRow
      // We'll keep it simple for now: do NOT rotate to avoid changing your schema/flow.

      return {
        user: {
          id: user.userId,
          firstName: user.firstName,
          lastName: user.lastName,
          name: user.userName,
          email: user.email,
          isFirstTimeLogin: user.isFirstTimeLogin,
          roleName: selectedRole.roleName,
          roleId: selectedRole.roleId,
          roleCode: selectedRole.roleCode,
          authScope: scope,
        },
        accessToken,
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;

      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        message,
        error instanceof Error ? error.stack : undefined,
      );
      throw new InternalServerErrorException('An unexpected error occurs');
    }
  }

  async login(
    data: LoginDto,
    meta?: { ip?: string; userAgent?: string },
  ): Promise<LoginResult> {
    try {
      // =========================================================
      // STEP 0) Validate basic input early (fast fail)
      // =========================================================
      const email = data.email?.trim().toLowerCase();
      const password = data.password;
      const roleCode = data.roleCode;

      if (!email || !password || !roleCode) {
        throw new BadRequestException(
          errorResponseBuilder(EMAIL_PASSWORD_REQUIRED, [
            ...(email
              ? []
              : [{ code: EMAIL_FIELD_REQUIRED, meta: { field: 'email' } }]),
            ...(password
              ? []
              : [
                  {
                    code: PASSWORD_FIELD_REQUIRED,
                    meta: { field: 'password' },
                  },
                ]),
            ...(roleCode
              ? []
              : [
                  {
                    code: ROLE_CODE_FIELD_REQUIRED,
                    meta: { field: 'roleCode' },
                  },
                ]),
          ]),
        );
      }

      // =========================================================
      // STEP 1) Find admin user by email
      // =========================================================
      const user = await this.capeUserRepo.findUserByEmailAndRole(email);

      // IMPORTANT (enterprise): do NOT reveal whether email exists
      // Return same error for "email not found" and "wrong password"
      if (!user) {
        throw new UnauthorizedException(
          errorResponseBuilder(LOGIN_USER_NOT_FOUND, [
            {
              code: LOGIN_USER_NOT_FOUND,
              meta: {
                field: 'email',
              },
            },
          ]),
        );
      }

      if (!user.isActive) {
        throw new UnauthorizedException(
          errorResponseBuilder(VALIDATE_YOUR_EMAIL, [
            {
              code: VALIDATE_YOUR_EMAIL,
              meta: {
                field: 'email',
              },
            },
          ]),
        );
      }

      if (!user.userRoles || user.userRoles.length === 0) {
        throw new UnauthorizedException(
          errorResponseBuilder(UNAUTHENTICATED_NOROLE),
        );
      }

      const matchedUserRole = user.userRoles.find(
        (userRole) => userRole.role.roleCode === roleCode,
      );

      console.log('Matched User Role:', matchedUserRole);

      if (!matchedUserRole) {
        throw new UnauthorizedException(
          errorResponseBuilder('ROLE_NOT_MATCH', [
            {
              code: 'ROLE_NOT_MATCH',
              meta: {
                field: 'roleCode',
              },
            },
          ]),
        );
      }

      const selectedRole = matchedUserRole.role;

      console.log('Selected Role:', selectedRole);
      // =========================================================
      // STEP 2) Verify password (bcrypt compare)
      // =========================================================
      // Adjust field name based on your Prisma model (common: passwordHash)
      const passwordHash = user.passwordHash as string | undefined;

      if (!passwordHash) {
        // If user exists but no hash, treat as invalid credentials (or account misconfigured)
        throw new UnauthorizedException(
          errorResponseBuilder(PASSWORD_HASH_MISSING),
        );
      }

      const ok = await verifyPassword(password, passwordHash);
      if (!ok) {
        throw new UnauthorizedException(
          errorResponseBuilder(PASSWORD_INVALID, [
            {
              code: PASSWORD_INVALID,
              meta: {
                field: 'password',
              },
            },
          ]),
        );
      }

      // =========================================================
      // STEP 3) Build access token payload (JWT)
      // =========================================================
      // Adjust role field name based on your schema

      // Find the user role
      // const role = (user.role as string | undefined) ?? 'ADMIN';

      const jwtSecret = this.config.get<string>('JWT_ACCESS_SECRET');
      if (!jwtSecret) {
        // Misconfiguration is server fault, not user fault
        throw new InternalServerErrorException('JWT secret is not configured');
      }

      const expiresInSeconds =
        Number(this.config.get<string>('ACCESS_TOKEN_TTL_SECONDS') ?? 900) ||
        900;

      const scope: 'admin' | 'learner' =
        selectedRole.roleCode === ROLE_CODE.CAPE_ADMIN ||
        selectedRole.roleCode === ROLE_CODE.HR_FOCAL_ADMIN
          ? 'admin'
          : 'learner';

      const accessToken = await signAccessToken({
        payload: {
          email: String(user.email),
          roleId: String(selectedRole.roleId),
          roleCode: String(selectedRole.roleCode),
          authScope: scope,
        },
        subject: String(user.userId),
        secret: jwtSecret,
        expiresInSeconds,
      });

      // =========================================================
      // STEP 4) Generate refresh token (opaque random token)
      //        - Store only HASH in DB (never store raw token)
      //        - Raw token will be set to httpOnly cookie
      // =========================================================
      const rawRefreshToken = createRawRefreshToken();
      const refreshTokenHash = hashRefreshToken(rawRefreshToken);

      const ttlDays =
        Number(this.config.get<string>('REFRESH_TOKEN_TTL_DAYS') ?? 7) || 7;

      const refreshExpiresAt = new Date();
      refreshExpiresAt.setDate(refreshExpiresAt.getDate() + ttlDays);

      // Save refresh token hash in DB (with optional meta for auditing)
      await this.refreshTokenRepo.createRefreshToken({
        userId: String(user.userId),
        tokenHash: refreshTokenHash,
        expiresAt: refreshExpiresAt,
        ipAddress: meta?.ip,
        userAgent: meta?.userAgent,
        selectedRoleId: String(selectedRole.roleId),
        selectedRoleCode: String(selectedRole.roleCode),
        authScope: scope,
      });

      // =========================================================
      // STEP 5) Return tokens + minimal user profile
      //        - Controller will set cookies and return success body
      // =========================================================
      return {
        user: {
          id: String(user.userId),
          firstName: String(user.firstName),
          lastName: String(user.lastName),
          name: String(user.userName),
          email: String(user.email),
          roleId: String(selectedRole.roleId),
          roleCode: String(selectedRole.roleCode),
          roleName: String(selectedRole.roleName),
          isFirstTimeLogin: user.isFirstTimeLogin,
          authScope: scope,
          // permissions,
        },
        accessToken,
        refreshToken: {
          rawToken: rawRefreshToken,
          expiresAt: refreshExpiresAt,
        },
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;

      const message = error instanceof Error ? error.message : 'Unknown error';
      const stack = error instanceof Error ? error.stack : undefined;

      this.logger.error(
        message,
        stack,
        JSON.stringify({
          service: AuthServiceService.name,
        }),
      );
      throw new InternalServerErrorException('An unexpected error occurs');
    }
  }

  // =========================================================
  // POST /auth/logout
  // - Revokes refresh token in DB (best practice)
  // =========================================================
  async logout(refreshTokenRaw: string | undefined): Promise<LogoutResult> {
    try {
      if (!refreshTokenRaw) {
        // If cookie missing, treat as already logged out
        return { ok: true };
      }

      const refreshHash = hashRefreshToken(refreshTokenRaw);

      const tokenRow = await this.refreshTokenRepo.findValidByHash(refreshHash);
      if (tokenRow) {
        await this.refreshTokenRepo.revokeById(tokenRow.id);
      }

      return { ok: true };
    } catch (error) {
      if (error instanceof HttpException) throw error;

      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        message,
        error instanceof Error ? error.stack : undefined,
      );
      throw new InternalServerErrorException('An unexpected error occurs');
    }
  }
}
