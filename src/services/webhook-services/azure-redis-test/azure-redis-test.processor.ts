/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { PrismaService } from '@app/database';
import { AzureTestRow } from '@app/shared';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { AZURE_TEST_QUEUE } from './azure-redis-test.queue';

@Processor(AZURE_TEST_QUEUE.name)
export class AzureRedisTestProcessor extends WorkerHost {
  private readonly logger = new Logger(AzureRedisTestProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<AzureTestRow>, token?: string): Promise<any> {
    const dto = job.data;

    const externalId = dto?.externalId?.trim();
    if (!externalId) {
      throw new Error('Missing externalId');
    }

    // simulate “production logic”
    // - insert if missing
    // - update if exists
    // - mark status + attempts + message
    await this.prisma.azureRedisTestRecord.upsert({
      where: { externalId },
      create: {
        externalId,
        email: dto.email?.trim() ?? null,
        fullName: dto.fullName?.trim() ?? null,
        status: 'processed',
        attempts: 1,
        lastMessage: `Created by job ${job.id}`,
        payload: JSON.stringify(dto),
      },
      update: {
        email: dto.email?.trim() ?? null,
        fullName: dto.fullName?.trim() ?? null,
        status: 'updated',
        attempts: { increment: 1 },
        lastMessage: `Updated by job ${job.id}`,
        payload: JSON.stringify(dto),
      },
    });

    this.logger.log(`Processed externalId=${externalId}, jobId=${job.id}`);
    return { ok: true };
  }

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
