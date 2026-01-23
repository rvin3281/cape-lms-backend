import { LearnWorldsUserProgramEnrollmentDto } from '@app/shared';
import { InjectQueue } from '@nestjs/bullmq';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { LW_QUEUE } from './learnworlds.queue';

@Injectable()
export class WebhookServicesService {
  private readonly logger: Logger = new Logger(WebhookServicesService.name);

  constructor(@InjectQueue(LW_QUEUE.name) private readonly lwQueue: Queue) {}

  async userProgramEnrollment(
    value: LearnWorldsUserProgramEnrollmentDto,
  ): Promise<{ success: true }> {
    // 1) Minimal validation only (fast)
    if (!value?.user?.email || !value?.user?.id || !value?.user?.username) {
      throw new BadRequestException('Missing user fields (email/id/username)');
    }

    if (
      !value?.product?.id ||
      !value?.product?.title ||
      !value?.product?.type
    ) {
      throw new BadRequestException('Missing product fields (id/title/type)');
    }

    // 2) Enqueue heavy work
    await this.enqueueUserEnrollment(value);

    // 3) FAST ACK
    return { success: true };
  }

  async enqueueUserEnrollment(dto: LearnWorldsUserProgramEnrollmentDto) {
    const email = dto?.user?.email?.trim()?.toLowerCase() || 'unknown';
    const productId = dto?.product?.id || 'unknown';

    const jobId = `lw-enroll-${email}-${productId}`;

    await this.lwQueue.add(LW_QUEUE.jobs.USER_ENROLLMENT, dto, {
      jobId,
    });
  }
}
