import { Injectable } from '@nestjs/common';
import { LearnWorldsUserEnrollmentProgram, Prisma } from 'src/generated/client';
import { PrismaService } from '../prisma.service';

@Injectable()
export class LearnworldsUserEnrollmentRepository {
  constructor(private readonly prisma: PrismaService) {}

  createLearnWorldsUserEnrollment(
    data: Prisma.LearnWorldsUserEnrollmentProgramCreateInput,
  ): Promise<LearnWorldsUserEnrollmentProgram> {
    return this.prisma.learnWorldsUserEnrollmentProgram.create({ data });
  }

  findLearnWorldsUserEnrollment(
    productId: string,
    userId: string,
  ): Promise<LearnWorldsUserEnrollmentProgram | null> {
    return this.prisma.learnWorldsUserEnrollmentProgram.findFirst({
      where: {
        productId: productId,
        userId: userId,
      },
    });
  }
}
