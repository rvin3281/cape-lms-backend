import { Prisma } from 'src/generated/client';

export type CapeUserWithRole = Prisma.CapeUserGetPayload<{
  include: { role: true };
}>;
