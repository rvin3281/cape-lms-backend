import { Injectable } from '@nestjs/common';
import { LearnWorldsProgram, Prisma } from 'src/generated/client';
import { PrismaService } from '../prisma.service';

@Injectable()
export class LearnworldsProgram {
  constructor(private readonly prisma: PrismaService) {}

  createLearnWorldsProgram(
    data: Prisma.LearnWorldsProgramCreateInput,
  ): Promise<LearnWorldsProgram> {
    return this.prisma.learnWorldsProgram.create({ data });
  }

  findLearnworldsProgram(productId: string) {
    return this.prisma.learnWorldsProgram.findFirst({
      where: {
        productId: productId,
      },
    });
  }

  findAllProgramById(productId: string) {
    return this.prisma.learnWorldsProgram.aggregate({
      where: {
        productId: productId,
      },
    });
  }
}
