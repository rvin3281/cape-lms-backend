/* eslint-disable @typescript-eslint/no-redundant-type-constituents */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { PrismaService } from '@app/database';
import {
  DUPLICATE_EMAIL_FOUND_ON_THE_EXCEL,
  INVALID_EXCEL_TEMPLATE,
  LearnerRow,
  LearnerRowError,
  LW_BUNDLE,
  LW_USER,
  NO_DATA_ON_EXCEL,
  NO_ROLE_FOUND,
  PaginationQueryDto,
  ROW_ERROR_FOUND,
  UpdateLearnworldsProgramDto,
  UserProgramOnboardingDto,
} from '@app/shared';
import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { errorResponseBuilder } from 'utils/errorResponseBuilder';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { handleServiceCatchError } from 'utils/handleServiceCatchError';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

type LearnWorldsProgramType =
  | 'course'
  | 'bundle'
  | 'subscription'
  | 'learning_program'
  | string;

type PrismaTx = Parameters<Parameters<PrismaService['$transaction']>[0]>[0];

@Injectable()
export class ProgramServiceService {
  private readonly logger = new Logger(ProgramServiceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly http: HttpService,
  ) {}

  async userProgramOnboarding(
    dto: UserProgramOnboardingDto,
    learnerFile: Express.Multer.File,
  ) {
    const workbook = new ExcelJS.Workbook();

    const buf = Buffer.from(new Uint8Array(learnerFile.buffer));
    await workbook.xlsx.load(buf as any);

    // 2) Pick the first worksheet
    const sheet = workbook.worksheets[0];

    if (!sheet) throw new BadRequestException('Excel sheet not found');

    // 3) Read header row (row 1)
    const headerRow = sheet.getRow(1);
    const headers = headerRow.values as Array<string | null>;
    // NOTE: values is 1-indexed, so index 0 is empty

    // Normalize headers: trim + lower
    const normalizedHeaders = headers.slice(1).map((h) =>
      String(h ?? '')
        .trim()
        .toLowerCase(),
    );

    // 4) Validate template headers (expected: name, email)
    const expected = [
      'username',
      'email',
      'firstname',
      'lastname',
      'organization',
    ];
    const missing = expected.filter((x) => !normalizedHeaders.includes(x));
    if (missing.length > 0) {
      throw new BadRequestException(
        errorResponseBuilder(INVALID_EXCEL_TEMPLATE),
      );
    }

    const headerIndexMap = new Map<string, number>();
    normalizedHeaders.forEach((h, idx) => {
      headerIndexMap.set(h, idx + 1);
    });

    const usernameCol = headerIndexMap.get('username');
    const emailCol = headerIndexMap.get('email');
    const firstnameCol = headerIndexMap.get('firstname');
    const lastnameCol = headerIndexMap.get('lastname');
    const organizationCol = headerIndexMap.get('organization');

    // 5) Read data rows (from row 2 until last row)
    const totalRows = sheet.actualRowCount; // includes header
    const dataRows: LearnerRow[] = [];
    const rowErrors: LearnerRowError[] = [];

    for (let r = 2; r <= totalRows; r++) {
      const row = sheet.getRow(r);
      const username = this.getCellString(
        row.getCell(usernameCol as number).value,
      );
      const email = this.getCellString(row.getCell(emailCol as number).value);
      const firstname = this.getCellString(
        row.getCell(firstnameCol as number).value,
      );
      const lastname = this.getCellString(
        row.getCell(lastnameCol as number).value,
      );
      const organization = this.getCellString(
        row.getCell(organizationCol as number).value,
      );

      // ignore fully empty rows (common in excel)
      if (!username && !email && !firstname && !lastname && !organization)
        continue;

      const errors: string[] = [];

      // 6) Row-level validation
      if (!username) errors.push(`Row number ${r}: Username is required`);
      if (!email) errors.push(`Row number ${r}: Email is required`);
      if (!firstname) errors.push(`Row number ${r}: first name is required`);
      if (!lastname) errors.push(`Row number ${r}: last name is required`);
      if (!organization)
        errors.push(`Row number ${r}: Organization is required`);

      if (email && !this.isValidEmail(email))
        errors.push(`Row number ${r}: Invalid email format`);

      if (errors.length > 0) {
        rowErrors.push({
          item: r,
          errors,
        });
        continue;
      }

      dataRows.push({
        rowNumber: r,
        username: username.trim(),
        email: email.trim().toLowerCase(),
        firstname: firstname.trim(),
        lastname: lastname.trim(),
        organization: organization?.trim(),
      });
    }

    if (rowErrors.length > 0) {
      throw new BadRequestException(
        errorResponseBuilder(ROW_ERROR_FOUND, undefined, undefined, rowErrors),
      );
    }

    if (dataRows.length === 0) {
      throw new BadRequestException(errorResponseBuilder(NO_DATA_ON_EXCEL));
    }

    // Validate duplicate emails inside the uploaded file
    const duplicateEmailsInFile = this.findDuplicateEmails(
      dataRows.map((x) => x.email),
    );

    if (duplicateEmailsInFile.length > 0) {
      const rowErrors: LearnerRowError[] = [
        {
          errors: duplicateEmailsInFile.map(
            (email) => `Duplicate email ${email} found`,
          ),
        },
      ];

      throw new BadRequestException(
        errorResponseBuilder(
          DUPLICATE_EMAIL_FOUND_ON_THE_EXCEL,
          undefined,
          undefined,
          rowErrors,
        ),
      );
    }
    // Program Date
    const programDate = new Date(dto.programDate);
    if (Number.isNaN(programDate.getTime())) {
      this.logger.error(`Program date has error ${dto.programDate}`);
      throw new BadRequestException('Invalid program date');
    }

    // Get role id based on CLASSROOM_LEARNER role
    const classroomRole = await this.prisma.capeRole.findUnique({
      where: {
        roleCode: 'CLASSROOM_LEARNER',
      },
    });

    // if not role found throw error
    if (!classroomRole) {
      throw new NotFoundException(
        errorResponseBuilder(
          NO_ROLE_FOUND,
          undefined,
          `CLASSROOM_LEARNER role does not exist. Please contact developer`,
        ),
      );
    }

    // Check program duplication ==> duplicate name
    const existingProgram = await this.prisma.program.findFirst({
      where: {
        programName: dto.programName,
        deletedAt: null,
      },
    });

    // if duplicate program exist throw error
    if (existingProgram) {
      throw new BadRequestException(
        errorResponseBuilder('DUPLICATE_PROGRAM_NAME'),
      );
    }

    // Check existing learner
    const learnerEmails = dataRows.map((x) => x.email);

    // Existing users + their roles
    const existingUsers = await this.prisma.capeUser.findMany({
      where: {
        email: {
          in: learnerEmails,
        },
        deletedAt: null,
      },
      select: {
        userId: true,
        email: true,
        userName: true,
        firstName: true,
        lastName: true,
        isAdmin: true,
        userRoles: {
          select: {
            role: {
              select: {
                roleId: true,
                roleCode: true,
                roleName: true,
              },
            },
          },
        },
        profile: {
          select: {
            userId: true,
            cfCompany: true,
          },
        },
      },
    });

    const existingUserMap = new Map(
      existingUsers.map((user) => [user.email.toLowerCase(), user]),
    );

    const invalidExistingUsers = existingUsers.filter((user) => user.isAdmin);

    if (invalidExistingUsers.length > 0) {
      const existingRoleErrors: LearnerRowError[] = [
        {
          errors: invalidExistingUsers.map((user) => {
            const currentRoles =
              user.userRoles.map((x) => x.role.roleCode).join(', ') ||
              'NO_ROLE';

            return `Email ${user.email} already exists with role(s) ${currentRoles} and is marked as admin. Admin accounts cannot be onboarded as classroom learners.`;
          }),
        },
      ];

      throw new BadRequestException(
        errorResponseBuilder(
          'INVALID_EXISTING_USER_ROLE',
          undefined,
          'Some existing users are admin accounts and cannot be onboarded as classroom learners',
          existingRoleErrors,
        ),
      );
    }
    const newRows = dataRows.filter(
      (row) => !existingUserMap.has(row.email.toLowerCase()),
    );

    const existingRows = dataRows.filter((row) =>
      existingUserMap.has(row.email.toLowerCase()),
    );

    // ----------------------------- BEGIN TRANSACTION -----------------------
    await this.prisma.$transaction(async (tx) => {
      // Create Program
      const createdProgram = await tx.program.create({
        data: {
          programName: dto.programName,
          programDate,
          programCohort: dto.programCohort,
          createdBy: 'SYSTEM',
          updatedBy: 'SYSTEM',
        },
      });

      const programId = createdProgram.programId;

      // Create ProgramFacilitator mappings
      await tx.programFacilitator.createMany({
        data: dto.facilitators.map((f) => ({
          programId: programId,
          facilitatorId: f.facilitatorId,
          createdAt: new Date(),
        })),
      });

      if (newRows.length > 0) {
        const usersToCreate = await Promise.all(
          newRows.map(async (row) => {
            const tempPassword = randomBytes(16).toString('hex');
            const passwordHash = await bcrypt.hash(tempPassword, 10);

            return {
              email: row.email,
              userName: row.username,
              firstName: row.firstname,
              lastName: row.lastname,
              passwordHash,
              isActive: false,
              isAdmin: false,
              isFirstTimeLogin: true,
              createdBy: 'SYSTEM',
              updatedBy: 'SYSTEM',
            };
          }),
        );

        await tx.capeUser.createMany({
          data: usersToCreate,
        });
      }

      // =========================================================
      // 4) Resolve all users again after creation
      // =========================================================
      const allUsersWithRoles = await tx.capeUser.findMany({
        where: {
          email: {
            in: learnerEmails,
          },
          deletedAt: null,
        },
        select: {
          userId: true,
          email: true,
          userName: true,
          profile: {
            select: {
              userId: true,
              cfCompany: true,
            },
          },
          userRoles: {
            select: {
              role: {
                select: {
                  roleId: true,
                  roleCode: true,
                },
              },
            },
          },
        },
      });

      if (allUsersWithRoles.length !== dataRows.length) {
        this.logger.error(
          `Mismatch detected. Expected ${dataRows.length} learners, found ${allUsersWithRoles.length} users after onboarding.`,
        );

        throw new BadRequestException(
          'Mismatch detected while resolving learner records.',
        );
      }

      const allUserMap = new Map(
        allUsersWithRoles.map((user) => [user.email.toLowerCase(), user]),
      );

      // =========================================================
      // 5) Attach CLASSROOM_LEARNER role to any user missing it
      //    This includes existing HYBRID / INDIVIDUAL users
      // =========================================================
      const usersMissingClassroomRole = allUsersWithRoles.filter((user) => {
        const hasClassroomRole = user.userRoles.some(
          (userRole) => userRole.role.roleCode === 'CLASSROOM_LEARNER',
        );

        return !hasClassroomRole;
      });

      if (usersMissingClassroomRole.length > 0) {
        await tx.capeUserRole.createMany({
          data: usersMissingClassroomRole.map((user) => ({
            userId: user.userId,
            roleId: classroomRole.roleId,
            assignedBy: 'SYSTEM',
          })),
        });
      }

      // =========================================================
      // 6) Create learner profile only for users who do not have one
      //    Do not overwrite profile if it already exists
      // =========================================================
      const profilesToCreate = dataRows
        .map((row) => {
          const resolvedUser = allUserMap.get(row.email.toLowerCase());

          if (!resolvedUser) return null;
          if (resolvedUser.profile) return null;

          return {
            userId: resolvedUser.userId,
            cfCompany: row.organization
              ? this.capitalizeWords(row.organization.trim())
              : 'Nil',
          };
        })
        .filter(
          (item): item is { userId: string; cfCompany: string } => !!item,
        );

      if (profilesToCreate.length > 0) {
        await tx.capeLearnerProfiles.createMany({
          data: profilesToCreate,
        });
      }

      // =========================================================
      // 7) Resolve plain users for enrollment and facilitator mapping
      // =========================================================
      const allUsers = allUsersWithRoles.map((user) => ({
        userId: user.userId,
        email: user.email,
        userName: user.userName,
      }));

      await tx.programCapeUserEnrollment.createMany({
        data: allUsers.map((user) => ({
          programId,
          userId: user.userId,
          status: 'ACTIVE',
          isReviewFeedbackCompleted: false,
          createdBy: 'SYSTEM',
          updatedBy: 'SYSTEM',
        })),
      });

      const facilitatorAssignments = allUsers.flatMap((user) =>
        dto.facilitators.map((f) => ({
          programId,
          facilitatorId: f.facilitatorId,
          userId: user.userId,
          createdBy: 'SYSTEM',
          updatedBy: 'SYSTEM',
        })),
      );

      await tx.programCapeUserFacilitator.createMany({
        data: facilitatorAssignments,
      });
    });

    return {
      success: true,
      code: 'PROGRAM_ONBOARDING_SUCCESS',
      message: 'Program onboarding completed successfully',
      data: {
        totalLearners: dataRows.length,
        newLearnersCreated: newRows.length,
        existingLearnersMapped: existingRows.length,
      },
    };
  }

  async updateClassroomProgram(
    programId: string,
    body: any,
    learnerFile?: Express.Multer.File,
  ) {
    try {
      const programName =
        typeof body?.programName === 'string' ? body.programName.trim() : '';
      const programCohort =
        typeof body?.programCohort === 'string'
          ? body.programCohort.trim()
          : '';
      const programDateRaw = body?.programDate;

      if (!programName) {
        throw new BadRequestException(
          errorResponseBuilder(
            'PROGRAM_NAME_REQUIRED',
            undefined,
            'Program name is required',
          ),
        );
      }

      if (!programCohort) {
        throw new BadRequestException(
          errorResponseBuilder(
            'PROGRAM_COHORT_REQUIRED',
            undefined,
            'Program cohort is required',
          ),
        );
      }

      if (!programDateRaw) {
        throw new BadRequestException(
          errorResponseBuilder(
            'PROGRAM_DATE_REQUIRED',
            undefined,
            'Program date is required',
          ),
        );
      }

      const programDate = new Date(programDateRaw);
      if (Number.isNaN(programDate.getTime())) {
        throw new BadRequestException(
          errorResponseBuilder(
            'INVALID_PROGRAM_DATE',
            undefined,
            'Invalid program date',
          ),
        );
      }

      const normalizedFacilitators = this.normalizeFacilitators(
        body?.facilitators,
      );
      const uniqueFacilitatorIds = this.validateAndGetUniqueFacilitatorIds(
        normalizedFacilitators,
      );

      const existingProgram = await this.prisma.program.findFirst({
        where: {
          programId,
          deletedAt: null,
        },
        include: {
          facilitators: {
            select: {
              facilitatorId: true,
            },
          },
        },
      });

      if (!existingProgram) {
        throw new NotFoundException(
          errorResponseBuilder(
            'PROGRAM_NOT_FOUND',
            undefined,
            'Selected classroom program was not found',
          ),
        );
      }

      const duplicateProgram = await this.prisma.program.findFirst({
        where: {
          programName,
          deletedAt: null,
          NOT: {
            programId,
          },
        },
        select: {
          programId: true,
        },
      });

      if (duplicateProgram) {
        throw new BadRequestException(
          errorResponseBuilder(
            'DUPLICATE_PROGRAM_NAME',
            undefined,
            'Another classroom program already exists with the same name',
          ),
        );
      }

      const classroomRole = await this.prisma.capeRole.findUnique({
        where: {
          roleCode: 'CLASSROOM_LEARNER',
        },
      });

      if (!classroomRole) {
        throw new NotFoundException(
          errorResponseBuilder(
            'NO_ROLE_FOUND',
            undefined,
            'CLASSROOM_LEARNER role does not exist. Please contact developer',
          ),
        );
      }

      const validFacilitators = await this.prisma.facilitator.findMany({
        where: {
          facilitatorId: {
            in: uniqueFacilitatorIds,
          },
          deletedAt: null,
        },
        select: {
          facilitatorId: true,
        },
      });

      if (validFacilitators.length !== uniqueFacilitatorIds.length) {
        throw new BadRequestException(
          errorResponseBuilder(
            'FACILITATOR_NOT_FOUND',
            undefined,
            'One or more selected facilitators do not exist',
          ),
        );
      }

      let dataRows: LearnerRow[] = [];
      let newRows: LearnerRow[] = [];
      let existingRows: LearnerRow[] = [];
      let newlyEnrolledCount = 0;
      let newLearnersCreated = 0;
      let skippedAlreadyEnrolledCount = 0;

      if (learnerFile) {
        const parsedRows = await this.parseLearnerExcelFile(learnerFile);
        dataRows = parsedRows;

        const learnerEmails = dataRows.map((x) => x.email);

        const existingUsers = await this.prisma.capeUser.findMany({
          where: {
            email: {
              in: learnerEmails,
            },
            deletedAt: null,
          },
          select: {
            userId: true,
            email: true,
            userName: true,
            firstName: true,
            lastName: true,
            isAdmin: true,
            userRoles: {
              select: {
                role: {
                  select: {
                    roleId: true,
                    roleCode: true,
                    roleName: true,
                  },
                },
              },
            },
            profile: {
              select: {
                userId: true,
                cfCompany: true,
              },
            },
          },
        });

        const existingUserMap = new Map(
          existingUsers.map((user) => [user.email.toLowerCase(), user]),
        );

        const invalidExistingUsers = existingUsers.filter(
          (user) => user.isAdmin,
        );

        if (invalidExistingUsers.length > 0) {
          const existingRoleErrors: LearnerRowError[] = [
            {
              errors: invalidExistingUsers.map((user) => {
                const currentRoles =
                  user.userRoles.map((x) => x.role.roleCode).join(', ') ||
                  'NO_ROLE';

                return `Email ${user.email} already exists with role(s) ${currentRoles} and is marked as admin. Admin accounts cannot be onboarded as classroom learners.`;
              }),
            },
          ];

          throw new BadRequestException(
            errorResponseBuilder(
              'INVALID_EXISTING_USER_ROLE',
              undefined,
              'Some existing users are admin accounts and cannot be onboarded as classroom learners',
              existingRoleErrors,
            ),
          );
        }

        newRows = dataRows.filter(
          (row) => !existingUserMap.has(row.email.toLowerCase()),
        );

        existingRows = dataRows.filter((row) =>
          existingUserMap.has(row.email.toLowerCase()),
        );
      }

      const result = await this.prisma.$transaction(async (tx) => {
        await tx.program.update({
          where: {
            programId,
          },
          data: {
            programName,
            programCohort,
            programDate,
            updatedBy: 'SYSTEM',
          },
        });

        await tx.programFacilitator.deleteMany({
          where: {
            programId,
          },
        });

        await tx.programFacilitator.createMany({
          data: uniqueFacilitatorIds.map((facilitatorId) => ({
            programId,
            facilitatorId,
            createdAt: new Date(),
          })),
        });

        if (learnerFile && newRows.length > 0) {
          const usersToCreate = await Promise.all(
            newRows.map(async (row) => {
              const tempPassword = randomBytes(16).toString('hex');
              const passwordHash = await bcrypt.hash(tempPassword, 10);

              return {
                email: row.email,
                userName: row.username,
                firstName: row.firstname,
                lastName: row.lastname,
                passwordHash,
                isActive: false,
                isAdmin: false,
                isFirstTimeLogin: true,
                createdBy: 'SYSTEM',
                updatedBy: 'SYSTEM',
              };
            }),
          );

          await tx.capeUser.createMany({
            data: usersToCreate,
          });

          newLearnersCreated = usersToCreate.length;
        }

        if (learnerFile && dataRows.length > 0) {
          const learnerEmails = dataRows.map((x) => x.email);

          const allUsersWithRoles = await tx.capeUser.findMany({
            where: {
              email: {
                in: learnerEmails,
              },
              deletedAt: null,
            },
            select: {
              userId: true,
              email: true,
              userName: true,
              profile: {
                select: {
                  userId: true,
                  cfCompany: true,
                },
              },
              userRoles: {
                select: {
                  role: {
                    select: {
                      roleId: true,
                      roleCode: true,
                    },
                  },
                },
              },
            },
          });

          if (allUsersWithRoles.length !== dataRows.length) {
            throw new BadRequestException(
              errorResponseBuilder(
                'LEARNER_RESOLUTION_MISMATCH',
                undefined,
                'Mismatch detected while resolving learner records.',
              ),
            );
          }

          const allUserMap = new Map(
            allUsersWithRoles.map((user) => [user.email.toLowerCase(), user]),
          );

          const usersMissingClassroomRole = allUsersWithRoles.filter((user) => {
            const hasClassroomRole = user.userRoles.some(
              (userRole) => userRole.role.roleCode === 'CLASSROOM_LEARNER',
            );

            return !hasClassroomRole;
          });

          if (usersMissingClassroomRole.length > 0) {
            await tx.capeUserRole.createMany({
              data: usersMissingClassroomRole.map((user) => ({
                userId: user.userId,
                roleId: classroomRole.roleId,
                assignedBy: 'SYSTEM',
              })),
            });
          }

          const profilesToCreate = dataRows
            .map((row) => {
              const resolvedUser = allUserMap.get(row.email.toLowerCase());

              if (!resolvedUser) return null;
              if (resolvedUser.profile) return null;

              return {
                userId: resolvedUser.userId,
                cfCompany: row.organization
                  ? this.capitalizeWords(row.organization.trim())
                  : 'Nil',
              };
            })
            .filter(
              (item): item is { userId: string; cfCompany: string } => !!item,
            );

          if (profilesToCreate.length > 0) {
            await tx.capeLearnerProfiles.createMany({
              data: profilesToCreate,
            });
          }

          const resolvedUsers = allUsersWithRoles.map((user) => ({
            userId: user.userId,
            email: user.email,
          }));

          const existingEnrollments =
            await tx.programCapeUserEnrollment.findMany({
              where: {
                programId,
                userId: {
                  in: resolvedUsers.map((u) => u.userId),
                },
                deletedAt: null,
              },
              select: {
                userId: true,
              },
            });

          const enrolledUserIdSet = new Set(
            existingEnrollments.map((x) => x.userId),
          );

          const usersToEnroll = resolvedUsers.filter(
            (user) => !enrolledUserIdSet.has(user.userId),
          );

          skippedAlreadyEnrolledCount =
            resolvedUsers.length - usersToEnroll.length;

          if (usersToEnroll.length > 0) {
            await tx.programCapeUserEnrollment.createMany({
              data: usersToEnroll.map((user) => ({
                programId,
                userId: user.userId,
                status: 'ACTIVE',
                isReviewFeedbackCompleted: false,
                createdBy: 'SYSTEM',
                updatedBy: 'SYSTEM',
              })),
            });
          }

          newlyEnrolledCount = usersToEnroll.length;
        }

        const activeEnrollments = await tx.programCapeUserEnrollment.findMany({
          where: {
            programId,
            deletedAt: null,
            status: 'ACTIVE',
          },
          select: {
            userId: true,
          },
        });

        await tx.programCapeUserFacilitator.deleteMany({
          where: {
            programId,
          },
        });

        if (activeEnrollments.length > 0) {
          const facilitatorAssignments = activeEnrollments.flatMap(
            (enrollment) =>
              uniqueFacilitatorIds.map((facilitatorId) => ({
                programId,
                facilitatorId,
                userId: enrollment.userId,
                createdBy: 'SYSTEM',
                updatedBy: 'SYSTEM',
              })),
          );

          await tx.programCapeUserFacilitator.createMany({
            data: facilitatorAssignments,
          });
        }

        return {
          success: true,
          code: 'UPDATE_CLASSROOM_PROGRAM_SUCCESS',
          message: 'Classroom program updated successfully',
          data: {
            programId,
            totalLearnersFromExcel: dataRows.length,
            newLearnersCreated,
            existingLearnersFromExcel: existingRows.length,
            newlyEnrolledLearners: newlyEnrolledCount,
            skippedAlreadyEnrolledLearners: skippedAlreadyEnrolledCount,
            totalFacilitators: uniqueFacilitatorIds.length,
          },
        };
      });

      return result;
    } catch (error) {
      handleServiceCatchError(error, this.logger);
    }
  }

  async getAllProgramOnboarding(query: PaginationQueryDto) {
    try {
      const page = query.page ?? 1;
      const pageSize = query.pageSize ?? 10;

      const skip = (page - 1) * pageSize;
      const take = pageSize;

      const whereClause = {
        deletedAt: null,
      };

      const [programs, total] = await this.prisma.$transaction([
        this.prisma.program.findMany({
          where: whereClause,
          skip,
          take,
          orderBy: {
            createdAt: 'desc',
          },
          include: {
            _count: {
              select: {
                enrollments: {
                  where: {
                    deletedAt: null,
                    status: 'ACTIVE',
                  },
                },
                facilitators: {
                  where: {
                    facilitator: {
                      deletedAt: null,
                    },
                  },
                },
              },
            },
            facilitators: {
              where: {
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
        }),
        this.prisma.program.count({
          where: whereClause,
        }),
      ]);

      const items = programs.map(({ _count, facilitators, ...program }) => ({
        ...program,
        totalEnrollments: _count.enrollments,
        totalFacilitators: _count.facilitators,
        facilitators: facilitators.map((item) => ({
          facilitatorId: item.facilitator.facilitatorId,
          facilitatorName: item.facilitator.facilitatorName,
        })),
      }));

      return {
        items,
        meta: {
          page,
          pageSize,
          total,
          totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
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

  async deleteProgramOnboarding(programId: string) {
    try {
      const existingProgram = await this.prisma.program.findUnique({
        where: {
          programId,
        },
      });

      if (!existingProgram) {
        throw new NotFoundException(
          errorResponseBuilder(
            'PROGRAM_NOT_FOUND',
            undefined,
            'Program not found',
          ),
        );
      }

      await this.prisma.$transaction([
        this.prisma.programFacilitator.deleteMany({
          where: {
            programId,
          },
        }),

        this.prisma.programCapeUserFacilitator.deleteMany({
          where: {
            programId,
          },
        }),

        this.prisma.programCapeUserEnrollment.deleteMany({
          where: {
            programId,
          },
        }),

        this.prisma.program.delete({
          where: {
            programId,
          },
        }),
      ]);

      return {
        success: true,
        code: 'DELETE_PROGRAM_ONBOARDING_SUCCESS',
        message: 'Program onboarding deleted successfully',
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

  private async parseLearnerExcelFile(
    learnerFile: Express.Multer.File,
  ): Promise<LearnerRow[]> {
    const workbook = new ExcelJS.Workbook();
    const buf = Buffer.from(new Uint8Array(learnerFile.buffer));
    await workbook.xlsx.load(buf as any);

    const sheet = workbook.worksheets[0];

    if (!sheet) {
      throw new BadRequestException(
        errorResponseBuilder(
          'EXCEL_SHEET_NOT_FOUND',
          undefined,
          'Excel sheet not found',
        ),
      );
    }

    const headerRow = sheet.getRow(1);
    const headers = headerRow.values as Array<string | null>;

    const normalizedHeaders = headers.slice(1).map((h) =>
      String(h ?? '')
        .trim()
        .toLowerCase(),
    );

    const expected = [
      'username',
      'email',
      'firstname',
      'lastname',
      'organization',
    ];

    const missing = expected.filter((x) => !normalizedHeaders.includes(x));
    if (missing.length > 0) {
      throw new BadRequestException(
        errorResponseBuilder('INVALID_EXCEL_TEMPLATE'),
      );
    }

    const headerIndexMap = new Map<string, number>();
    normalizedHeaders.forEach((h, idx) => {
      headerIndexMap.set(h, idx + 1);
    });

    const usernameCol = headerIndexMap.get('username');
    const emailCol = headerIndexMap.get('email');
    const firstnameCol = headerIndexMap.get('firstname');
    const lastnameCol = headerIndexMap.get('lastname');
    const organizationCol = headerIndexMap.get('organization');

    const totalRows = sheet.actualRowCount;
    const dataRows: LearnerRow[] = [];
    const rowErrors: LearnerRowError[] = [];

    for (let r = 2; r <= totalRows; r++) {
      const row = sheet.getRow(r);

      const username = this.getCellString(
        row.getCell(usernameCol as number).value,
      );
      const email = this.getCellString(row.getCell(emailCol as number).value);
      const firstname = this.getCellString(
        row.getCell(firstnameCol as number).value,
      );
      const lastname = this.getCellString(
        row.getCell(lastnameCol as number).value,
      );
      const organization = this.getCellString(
        row.getCell(organizationCol as number).value,
      );

      if (!username && !email && !firstname && !lastname && !organization) {
        continue;
      }

      const errors: string[] = [];

      if (!username) errors.push(`Row number ${r}: Username is required`);
      if (!email) errors.push(`Row number ${r}: Email is required`);
      if (!firstname) errors.push(`Row number ${r}: First name is required`);
      if (!lastname) errors.push(`Row number ${r}: Last name is required`);
      if (!organization)
        errors.push(`Row number ${r}: Organization is required`);

      if (email && !this.isValidEmail(email)) {
        errors.push(`Row number ${r}: Invalid email format`);
      }

      if (errors.length > 0) {
        rowErrors.push({
          item: r,
          errors,
        });
        continue;
      }

      dataRows.push({
        rowNumber: r,
        username: username.trim(),
        email: email.trim().toLowerCase(),
        firstname: firstname.trim(),
        lastname: lastname.trim(),
        organization: organization.trim(),
      });
    }

    if (rowErrors.length > 0) {
      throw new BadRequestException(
        errorResponseBuilder(
          'ROW_ERROR_FOUND',
          undefined,
          undefined,
          rowErrors,
        ),
      );
    }

    if (dataRows.length === 0) {
      throw new BadRequestException(errorResponseBuilder('NO_DATA_ON_EXCEL'));
    }

    const duplicateEmailsInFile = this.findDuplicateEmails(
      dataRows.map((x) => x.email),
    );

    if (duplicateEmailsInFile.length > 0) {
      const duplicateErrors: LearnerRowError[] = [
        {
          errors: duplicateEmailsInFile.map(
            (email) => `Duplicate email ${email} found`,
          ),
        },
      ];

      throw new BadRequestException(
        errorResponseBuilder(
          'DUPLICATE_EMAIL_FOUND_ON_THE_EXCEL',
          undefined,
          undefined,
          duplicateErrors,
        ),
      );
    }

    return dataRows;
  }

  private isValidEmail(email: string): boolean {
    // simple production-safe regex (not perfect, but good enough)
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  private getCellString(value: any): string {
    if (!value) return '';

    if (typeof value === 'string') return value.trim();

    if (typeof value === 'object') {
      if (value.text) return String(value.text).trim();
      if (value.result) return String(value.result).trim();
    }
    return String(value).trim();
  }

  private findDuplicateEmails(emails: string[]): string[] {
    const seen = new Set<string>();
    const duplicates = new Set<string>();

    for (const email of emails) {
      const normalized = email.trim().toLowerCase();
      if (seen.has(normalized)) {
        duplicates.add(normalized);
      } else {
        seen.add(normalized);
      }
    }

    return Array.from(duplicates);
  }

  private capitalizeWords(value: string): string {
    return value
      .toLowerCase()
      .split(' ')
      .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1) : ''))
      .join(' ');
  }

  private normalizeFacilitators(
    rawFacilitators: any,
  ): { facilitatorId: string }[] {
    let parsed = rawFacilitators;

    if (typeof rawFacilitators === 'string') {
      try {
        parsed = JSON.parse(rawFacilitators);
      } catch {
        throw new BadRequestException(
          errorResponseBuilder(
            'INVALID_FACILITATOR_PAYLOAD',
            undefined,
            'Facilitators payload is invalid',
          ),
        );
      }
    }

    if (!Array.isArray(parsed)) {
      throw new BadRequestException(
        errorResponseBuilder(
          'INVALID_FACILITATOR_PAYLOAD',
          undefined,
          'Facilitators must be an array',
        ),
      );
    }

    const normalized = parsed.map((item) => ({
      facilitatorId:
        typeof item?.facilitatorId === 'string'
          ? item.facilitatorId.trim()
          : '',
    }));

    const hasEmpty = normalized.some((item) => !item.facilitatorId);

    if (hasEmpty) {
      throw new BadRequestException(
        errorResponseBuilder(
          'FACILITATOR_ID_REQUIRED',
          undefined,
          'Every facilitator row must contain a valid facilitatorId',
        ),
      );
    }

    return normalized;
  }

  private validateAndGetUniqueFacilitatorIds(
    facilitators: { facilitatorId: string }[],
  ): string[] {
    const facilitatorIds = facilitators.map((x) => x.facilitatorId.trim());

    const uniqueFacilitatorIds = Array.from(new Set(facilitatorIds));

    if (uniqueFacilitatorIds.length !== facilitatorIds.length) {
      throw new BadRequestException(
        errorResponseBuilder(
          'DUPLICATE_FACILITATOR_FOUND',
          undefined,
          'Duplicate facilitators are not allowed in the same program',
        ),
      );
    }

    return uniqueFacilitatorIds;
  }

  async getAllLearnworldsProgram(query: PaginationQueryDto) {
    try {
      const page = query.page ?? 1;
      const pageSize = query.pageSize ?? 10;

      const skip = (page - 1) * pageSize;
      const take = pageSize;

      const [programs, total] = await this.prisma.$transaction([
        this.prisma.learnWorldsProgram.findMany({
          skip,
          take,
          orderBy: {
            createdAt: 'desc',
          },
          include: {
            _count: {
              select: {
                enrollments: true,
              },
            },
          },
        }),
        this.prisma.learnWorldsProgram.count(),
      ]);

      const items = programs.map(({ _count, ...program }) => ({
        productId: program.productId,
        productTitle: program.productTitle,
        productType: program.productType,
        productDescription: program.productDescription,
        productUrl: program.productUrl,
        createdAt: program.createdAt,
        totalLearnersEnrollment: _count.enrollments,
      }));

      return {
        items,
        meta: {
          page,
          pageSize,
          total,
          totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
        },
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      handleServiceCatchError(error, this.logger);
    }
  }

  async updateLearnworldsProgram(
    productId: string,
    dto: UpdateLearnworldsProgramDto,
  ) {
    try {
      if (!productId || !productId.trim()) {
        throw new BadRequestException(
          errorResponseBuilder(
            'PRODUCT_ID_REQUIRED',
            undefined,
            'Product id is required',
          ),
        );
      }

      const hasAtLeastOneField =
        dto.productTitle !== undefined ||
        dto.productDescription !== undefined ||
        dto.productUrl !== undefined;

      if (!hasAtLeastOneField) {
        throw new BadRequestException(
          errorResponseBuilder(
            'NO_UPDATE_PAYLOAD',
            undefined,
            'At least one field is required to update LearnWorlds program',
          ),
        );
      }

      const existingProgram = await this.prisma.learnWorldsProgram.findUnique({
        where: {
          productId: productId.trim(),
        },
      });

      if (!existingProgram) {
        throw new NotFoundException(
          errorResponseBuilder(
            'LEARNWORLDS_PROGRAM_NOT_FOUND',
            undefined,
            'LearnWorlds program with given product id not found',
          ),
        );
      }

      const dataToUpdate: {
        productTitle?: string | null;
        productDescription?: string | null;
        productUrl?: string | null;
      } = {};

      if (dto.productTitle !== undefined) {
        dataToUpdate.productTitle = dto.productTitle || null;
      }

      if (dto.productDescription !== undefined) {
        dataToUpdate.productDescription = dto.productDescription || null;
      }

      if (dto.productUrl !== undefined) {
        dataToUpdate.productUrl = dto.productUrl || null;
      }

      const updatedProgram = await this.prisma.learnWorldsProgram.update({
        where: {
          productId: productId.trim(),
        },
        data: dataToUpdate,
        include: {
          _count: {
            select: {
              enrollments: true,
            },
          },
        },
      });

      return {
        item: {
          productId: updatedProgram.productId,
          productTitle: updatedProgram.productTitle,
          productType: updatedProgram.productType,
          productDescription: updatedProgram.productDescription,
          productUrl: updatedProgram.productUrl,
          createdAt: updatedProgram.createdAt,
          updatedAt: updatedProgram.updatedAt,
          totalLearnersEnrollment: updatedProgram._count.enrollments,
        },
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      handleServiceCatchError(error, this.logger);
    }
  }

  async deleteLearnworldsProgram(productId: string): Promise<any> {
    try {
      const program = await this.prisma.learnWorldsProgram.findUnique({
        where: { productId },
        include: {
          enrollments: {
            include: {
              user: {
                select: {
                  userId: true,
                  email: true,
                  learnworldId: true,
                },
              },
            },
          },
        },
      });

      if (!program) {
        throw new NotFoundException(
          errorResponseBuilder(
            'LEARNWORLDS_PROGRAM_NOT_FOUND',
            undefined,
            'The selected LearnWorlds program was not found.',
          ),
        );
      }

      const warnings: string[] = [];

      // Best effort only. Never block delete.
      const remoteProductExists =
        await this.safeCheckLearnWorldsProductExists(productId);

      if (remoteProductExists === false) {
        warnings.push(
          `LearnWorlds product ${productId} was not found remotely. Internal records were still deleted.`,
        );
      }

      if (remoteProductExists !== false) {
        for (const enrollment of program.enrollments) {
          const lwUserId = enrollment.user?.learnworldId;

          if (!lwUserId) {
            warnings.push(
              `Skipped LearnWorlds unenrollment for internal user ${enrollment.userId} because learnworldId is missing.`,
            );
            continue;
          }

          const unenrolled = await this.safeUnenrollUserFromLearnWorlds(
            lwUserId,
            {
              productId,
              productType: 'bundle',
            },
          );

          if (!unenrolled) {
            warnings.push(
              `Failed to unenroll LearnWorlds user ${lwUserId} from product ${productId}. Admin may need to remove it manually in LearnWorlds.`,
            );
          }
        }
      }

      const deleted = await this.prisma.$transaction(async (tx: PrismaTx) => {
        const deletedEnrollments =
          await tx.learnWorldsUserEnrollmentProgram.deleteMany({
            where: { productId },
          });

        const deletedProgram = await tx.learnWorldsProgram.delete({
          where: { productId },
          select: {
            productId: true,
            productTitle: true,
            productType: true,
          },
        });

        return {
          deletedProgram,
          deletedEnrollmentCount: deletedEnrollments.count,
        };
      });

      return {
        code: 'DELETE_LEARNWORLDS_PROGRAM_SUCCESS',
        message: 'LearnWorlds program deleted successfully',
        data: {
          productId: deleted.deletedProgram.productId,
          productTitle: deleted.deletedProgram.productTitle,
          productType: deleted.deletedProgram.productType,
          deletedEnrollmentCount: deleted.deletedEnrollmentCount,
          warnings,
        },
      };
    } catch (error) {
      handleServiceCatchError(error, this.logger);
    }
  }

  private normalizeProductType(
    productType?: string | null,
  ): LearnWorldsProgramType {
    const normalized = String(productType || '')
      .trim()
      .toLowerCase();

    // keep aligned with how LearnWorlds unenroll endpoint expects it
    if (normalized === 'bundle') return 'bundle';
    if (normalized === 'course') return 'course';
    if (normalized === 'subscription') return 'subscription';

    // if your DB stores learning_program, map it safely
    if (normalized === 'learning_program') {
      // choose the most appropriate mapping for your actual LW API usage
      return 'bundle';
    }

    // fallback so delete flow still proceeds
    return 'course';
  }

  private getLearnWorldsHeaders() {
    const lwConfig = this.config.get<any>('learnworls');

    if (
      !lwConfig?.learnworld_api_base_url ||
      !lwConfig?.learnworld_bearer_token ||
      !lwConfig?.learnworld_lw_client_id
    ) {
      throw new ServiceUnavailableException(
        errorResponseBuilder(
          'LW_CONFIG_MISSING',
          undefined,
          'LearnWorlds configuration is not properly set.',
        ),
      );
    }

    return {
      baseURL: lwConfig.learnworld_api_base_url,
      headers: {
        Authorization: `Bearer ${lwConfig.learnworld_bearer_token}`,
        'Lw-Client': lwConfig.learnworld_lw_client_id,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    };
  }

  private async safeCheckLearnWorldsProductExists(
    productId: string,
  ): Promise<boolean | null> {
    try {
      const config = this.getLearnWorldsHeaders();

      const path = `${LW_BUNDLE}/${encodeURIComponent(productId)}`;

      await firstValueFrom(this.http.get(path, config));
      return true;
    } catch (error: any) {
      const status = error?.response?.status;

      if (status === 404) {
        this.logger.warn(
          `LearnWorlds product not found remotely. productId=${productId}`,
        );
        return false;
      }

      this.logger.warn(
        `Unable to verify LearnWorlds product existence. productId=${productId}`,
        error?.stack || error,
      );
      return null;
    }
  }

  /**
   * Best effort only. Never throws.
   */
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

    const config = this.getLearnWorldsHeaders();

    await firstValueFrom(
      this.http.delete(url, {
        ...config,
        data: payload,
      }),
    );
  }
}
