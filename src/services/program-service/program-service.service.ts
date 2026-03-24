/* eslint-disable @typescript-eslint/no-unsafe-member-access */

/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { PrismaService } from '@app/database';
import {
  DUPLICATE_EMAIL_FOUND_ON_THE_EXCEL,
  INVALID_EXCEL_TEMPLATE,
  LearnerRow,
  LearnerRowError,
  NO_DATA_ON_EXCEL,
  NO_ROLE_FOUND,
  PaginationQueryDto,
  ROW_ERROR_FOUND,
  UserProgramOnboardingDto,
} from '@app/shared';
import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { errorResponseBuilder } from 'utils/errorResponseBuilder';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';

@Injectable()
export class ProgramServiceService {
  private readonly logger = new Logger(ProgramServiceService.name);

  constructor(private readonly prisma: PrismaService) {}

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
    const role = await this.prisma.capeRole.findUnique({
      where: {
        roleCode: 'CLASSROOM_LEARNER',
      },
    });

    // if not role found throw error
    if (!role) {
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
        roleId: true,
        role: {
          select: {
            roleCode: true,
          },
        },
      },
    });

    const existingUserMap = new Map(
      existingUsers.map((user) => [user.email.toLowerCase(), user]),
    );

    const invalidExistingUsers = existingUsers.filter(
      (user) => user.role.roleCode !== 'CLASSROOM_LEARNER',
    );

    if (invalidExistingUsers.length > 0) {
      const existingRoleErrors: LearnerRowError[] = [
        {
          errors: invalidExistingUsers.map(
            (user) =>
              `Email ${user.email} already exists with role ${user.role.roleCode}. Only CLASSROOM_LEARNER can be onboarded here.`,
          ),
        },
      ];

      throw new BadRequestException(
        errorResponseBuilder(
          'INVALID_EXISTING_USER_ROLE',
          undefined,
          'Some existing users are not classroom learners',
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

      // Get role id
      const roleId = role.roleId;

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
              roleId,
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

        // fetch newly created users back using newRows emails
        const createdNewUsers = await tx.capeUser.findMany({
          where: {
            email: {
              in: newRows.map((row) => row.email),
            },
            deletedAt: null,
          },
          select: {
            userId: true,
            email: true,
          },
        });

        const createdNewUserMap = new Map(
          createdNewUsers.map((user) => [user.email.toLowerCase(), user]),
        );

        const profilesToCreate = newRows
          .map((row) => {
            const createdUser = createdNewUserMap.get(row.email.toLowerCase());

            if (!createdUser) {
              return null;
            }

            return {
              userId: createdUser.userId,
              cfCompany: row.organization
                ? this.capitalizeWords(row.organization.trim())
                : 'Nil',
            };
          })
          .filter(
            (item): item is { userId: string; cfCompany: string } => !!item,
          );

        if (profilesToCreate.length !== newRows.length) {
          this.logger.error(
            `Mismatch detected while creating learner profiles. Expected ${newRows.length}, found ${profilesToCreate.length}.`,
          );

          throw new BadRequestException(
            'Mismatch detected while creating learner profile records.',
          );
        }

        await tx.capeLearnerProfiles.createMany({
          data: profilesToCreate,
        });
      }

      const allUsers = await tx.capeUser.findMany({
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
        },
      });

      if (allUsers.length !== dataRows.length) {
        this.logger.error(
          `Mismatch detected. Expected ${dataRows.length} learners, found ${allUsers.length} users after onboarding.`,
        );

        throw new BadRequestException(
          'Mismatch detected while resolving learner records.',
        );
      }

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

  async getAllProgramOnboarding(query: PaginationQueryDto) {
    try {
      const page = query.page ?? 1;
      const pageSize = query.pageSize ?? 10;

      const skip = (page - 1) * pageSize;
      const take = pageSize;

      const whereClause = {
        deletedAt: null,
      };

      // Get All program
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
          },
        }),
        this.prisma.program.count({
          where: whereClause,
        }),
      ]);

      if (programs.length === 0) {
        throw new NotFoundException(
          errorResponseBuilder(
            'NO_PROGRAM_FOUND',
            undefined,
            'No program data found on database',
          ),
        );
      }

      const items = programs.map(({ _count, ...program }) => ({
        ...program,
        totalEnrollments: _count.enrollments,
        totalFacilitators: _count.facilitators,
      }));

      return {
        items,
        meta: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
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
}
