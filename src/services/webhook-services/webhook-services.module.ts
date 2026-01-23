import { DatabaseModule } from '@app/database';
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { LW_QUEUE } from './learnworlds.queue';
import { LearnWorldsQueueProcessor } from './processors/learnworlds.queue..user-enrollment.processor';
import { WebhookServicesController } from './webhook-services.controller';
import { WebhookServicesService } from './webhook-services.service';

@Module({
  imports: [
    DatabaseModule,
    BullModule.registerQueue({
      name: LW_QUEUE.name,
    }),
  ],
  controllers: [WebhookServicesController],
  providers: [WebhookServicesService, LearnWorldsQueueProcessor],
})
export class WebhookServicesModule {}
