import { Injectable } from '@nestjs/common';
import { CapeUserProfiles, Prisma } from 'src/generated/client';
import { PrismaService } from '../prisma.service';

type PrismaTx = Prisma.TransactionClient;

@Injectable()
export class CapeUserProfileV2Repository {
  constructor(private readonly prisma: PrismaService) {}

  createUserProfile(
    data: Prisma.CapeUserProfilesCreateArgs,
    tx?: PrismaTx,
  ): Promise<CapeUserProfiles> {
    const client = tx ?? this.prisma;
    return client.capeUserProfiles.create(data);
  }

  updateUserProfile(
    data: Prisma.CapeUserProfilesUpdateArgs,
    tx?: PrismaTx,
  ): Promise<CapeUserProfiles> {
    const client = tx ?? this.prisma;
    return client.capeUserProfiles.update(data);
  }
}
