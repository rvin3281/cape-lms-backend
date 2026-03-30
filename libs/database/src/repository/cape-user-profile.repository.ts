import { Injectable } from '@nestjs/common';
import { capeLearnerProfiles, Prisma } from 'src/generated/client';
import { PrismaService } from '../prisma.service';

type PrismaTx = Prisma.TransactionClient;

@Injectable()
export class CapeUserProfileRepository {
  constructor(private readonly prisma: PrismaService) {}

  createUserProfile(
    data: Prisma.capeLearnerProfilesCreateArgs,
    tx?: PrismaTx,
  ): Promise<capeLearnerProfiles> {
    const client = tx ?? this.prisma;
    return client.capeLearnerProfiles.create(data);
  }

  findUserProfileById(id: string, tx?: PrismaTx) {
    const client = tx ?? this.prisma;
    return client.capeLearnerProfiles.findUnique({ where: { userId: id } });
  }

  upsertUserProfile(
    args: Prisma.capeLearnerProfilesUpsertArgs,
    tx?: PrismaTx,
  ): Promise<capeLearnerProfiles> {
    const client = tx ?? this.prisma;
    return client.capeLearnerProfiles.upsert(args);
  }
}
