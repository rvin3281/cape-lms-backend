import { Prisma } from 'src/generated/client';

export type CapeUserWithRoles = Prisma.CapeUserGetPayload<{
  include: {
    userRoles: {
      include: {
        role: true;
      };
    };
  };
}>;
