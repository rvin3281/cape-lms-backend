import { PrismaService } from '@app/database';
import { AzureTestRow } from '@app/shared';
import { InjectQueue } from '@nestjs/bullmq';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { AZURE_TEST_QUEUE } from './azure-redis-test.queue';

@Injectable()
export class AzureRedisTestService {
  private readonly logger = new Logger(AzureRedisTestService.name);

  constructor(
    @InjectQueue(AZURE_TEST_QUEUE.name) private readonly queue: Queue,
    private readonly prisma: PrismaService,
  ) {}

  async enqueueBulk(rows: AzureTestRow[]) {
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new BadRequestException('No rows found');
    }

    // minimal validation only (fast)
    for (const r of rows) {
      if (!r.externalId?.trim()) {
        throw new BadRequestException('externalId is required for all rows');
      }
    }

    // create "pending" records first (optional but very useful for visibility)
    await this.prisma.azureRedisTestRecord.createMany({
      data: rows.map((r) => ({
        externalId: r.externalId.trim(),
        email: r.email?.trim() ?? null,
        fullName: r.fullName?.trim() ?? null,
        status: 'pending',
        payload: JSON.stringify(r),
      })),
    });

    // enqueue jobs (idempotent)
    const jobs = rows.map((r) => {
      const externalId = r.externalId.trim();
      return this.queue.add(AZURE_TEST_QUEUE.jobs.UPSERT_RECORD, r, {
        jobId: `azure-test-${externalId}`, // idempotent
        attempts: 5,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: true,
        removeOnFail: false,
      });
    });

    await Promise.all(jobs);

    return { enqueued: rows.length };
  }

  async getLatest(limit = 50) {
    return this.prisma.azureRedisTestRecord.findMany({
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });
  }

  async getByExternalId(externalId: string) {
    return this.prisma.azureRedisTestRecord.findUnique({
      where: { externalId },
    });
  }
}
