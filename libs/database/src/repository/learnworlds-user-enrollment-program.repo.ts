import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

type FindProgramsByUserIdArgs = {
  userId: string;
  status?: string; // optional filter
};

@Injectable()
export class LearnWorldsUserEnrollmentProgramRepo {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns enrollments + program info (single query)
   */
  findProgramsByUserId(args: FindProgramsByUserIdArgs) {
    const { userId, status } = args;

    return this.prisma.learnWorldsUserEnrollmentProgram.findMany({
      where: {
        userId,
        ...(status ? { status } : {}),
      },
      orderBy: [{ enrolledAt: 'desc' }],
      select: {
        id: true,
        userId: true,
        productId: true,
        enrolledAt: true,
        status: true,
        progress: true,

        program: {
          select: {
            productId: true,
            productTitle: true,
            productType: true,
            productCurrency: true,
            productDescription: true,
            productPrice: true,
            productUrl: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });
  }
}
