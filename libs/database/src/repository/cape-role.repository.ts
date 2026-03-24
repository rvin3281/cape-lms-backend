import { Injectable } from '@nestjs/common';
import { CapeRole } from 'src/generated/client';
import { PrismaService } from '../prisma.service';

@Injectable()
export class CapeRoleRepository {
  constructor(private readonly prisma: PrismaService) {}

  findRoleByLevel(roleLevel: string): Promise<CapeRole | null> {
    return this.prisma.capeRole.findFirst({ where: { level: roleLevel } });
  }
}
