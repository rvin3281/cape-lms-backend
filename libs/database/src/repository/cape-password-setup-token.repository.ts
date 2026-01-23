import { Injectable } from '@nestjs/common';
import { PasswordSetupToken, Prisma } from 'src/generated/client';
import { PrismaService } from '../prisma.service';

type PrismaTx = Prisma.TransactionClient;
type PrismaClientLike = PrismaTx | PrismaService;

@Injectable()
export class CapePasswordSetupTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  createPasswordSetupToken(
    data: Prisma.PasswordSetupTokenCreateArgs,
    tx?: PrismaTx,
  ): Promise<PasswordSetupToken> {
    const client: PrismaClientLike = tx ?? this.prisma;
    return client.passwordSetupToken.create(data);
  }

  findToken(token: string, email: string) {
    return this.prisma.passwordSetupToken.findFirst({
      where: {
        tokenHash: token,
        email,
      },
    });
  }

  deleteTokensByEmail(email: string, tx?: Prisma.TransactionClient) {
    const client = tx ?? this.prisma;
    return client.passwordSetupToken.deleteMany({
      where: { email },
    });
  }
}
