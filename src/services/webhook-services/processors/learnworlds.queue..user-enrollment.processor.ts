/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { PrismaService } from '@app/database';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { Job } from 'bullmq';
import { LW_QUEUE } from '../learnworlds.queue';
import { errorResponseBuilder } from 'utils/errorResponseBuilder';

@Processor(LW_QUEUE.name)
export class LearnWorldsQueueProcessor extends WorkerHost {
  private readonly logger = new Logger(LearnWorldsQueueProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    this.logger.log(`PROCESS() hit: ${job.name} | id=${job.id}`);

    switch (job.name) {
      case LW_QUEUE.jobs.USER_ENROLLMENT:
        return this.handleUserEnrollment(job);
      default:
        this.logger.warn(`Unhandled job: ${job.name}`);
        return;
    }
  }

  private async handleUserEnrollment(job: Job<any>) {
    const dto = job.data;

    // full validation inside worker (safe)
    if (!dto?.user?.email || !dto?.user?.id || !dto?.user?.username) {
      throw new BadRequestException('Missing user fields (email/id/username)');
    }
    if (!dto?.product?.id || !dto?.product?.title || !dto?.product?.type) {
      throw new BadRequestException('Missing product fields (id/title/type)');
    }

    const email = dto.user.email.trim().toLowerCase();
    const lwUserId = dto.user.id;
    const username = dto.user.username;
    const productId = dto.product.id;

    // ✅ transaction: user + program + enrollment
    await this.prisma.$transaction(async (tx) => {
      // 1) role
      const role = await tx.capeRole.findFirst({
        where: { roleCode: 'HYBRID_LEARNER' },
      });
      if (!role)
        throw new NotFoundException(
          errorResponseBuilder(
            'HYBRID_LEARNER_ROLE_NOT_FOUND',
            undefined,
            'Please run data seeding to create roles on cape_roles table',
          ),
        );

      // 2) upsert user (by email)
      let user = await tx.capeUser.findUnique({ where: { email } });

      if (!user) {
        user = await tx.capeUser.create({
          data: {
            learnworldId: lwUserId,
            email,
            userName: username,
            passwordHash: '',
            firstName: dto?.user?.first_name,
            lastName: dto?.user?.last_name,
            roleId: role.roleId,
            isActive: false,
            isAdmin: false,
            isFirstTimeLogin: true,
          },
        });
      } else {
        // optional sync
        await tx.capeUser.update({
          where: { email },
          data: {
            learnworldId: user.learnworldId ?? lwUserId,
          },
        });
      }

      // 3) upsert program
      await tx.learnWorldsProgram.upsert({
        where: { productId },
        create: {
          productId,
          productTitle: dto.product.title,
          productType: dto.product.type,
          productCurrency: dto.product.currency ?? null,
          productDescription: dto.product.description ?? null,
          productPrice: dto.product.price ?? null,
          productUrl: dto.product.url ?? null,
        },
        update: {
          productTitle: dto.product.title,
          productType: dto.product.type,
          productCurrency: dto.product.currency ?? null,
          productDescription: dto.product.description ?? null,
          productPrice: dto.product.price ?? null,
          productUrl: dto.product.url ?? null,
        },
      });

      // 4) upsert enrollment (requires @@unique([userId, productId]))
      await tx.learnWorldsUserEnrollmentProgram.upsert({
        where: {
          userId_productId: {
            userId: user.userId,
            productId,
          },
        },
        create: {
          userId: user.userId,
          productId,
          enrolledAt: new Date(),
          status: 'active',
          progress: null,
        },
        update: {
          status: 'active',
        },
      });
    });

    this.logger.log(`Enrollment processed: ${email} -> ${productId}`);
    return { ok: true };
  }

  // Optional worker events (good for debugging)
  @OnWorkerEvent('active')
  onActive(job: Job) {
    this.logger.log(`Active job ${job.id} (${job.name})`);
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.log(`Completed job ${job.id} (${job.name})`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error) {
    this.logger.error(`Failed job ${job?.id} (${job?.name}): ${err.message}`);
  }
}
