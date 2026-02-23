import { DatabaseModule } from '@app/database';
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { AzureRedisTestService } from './azure-redis-test/azure-redis-test-service.service';
import { AzureRedisTestController } from './azure-redis-test/azure-redis-test.controller';
import { AzureRedisTestProcessor } from './azure-redis-test/azure-redis-test.processor';
import { AZURE_TEST_QUEUE } from './azure-redis-test/azure-redis-test.queue';
import { LW_QUEUE } from './learnworlds.queue';
import { LearnWorldsQueueProcessor } from './processors/learnworlds.queue..user-enrollment.processor';
import { WebhookServicesController } from './webhook-services.controller';
import { WebhookServicesService } from './webhook-services.service';

@Module({
  imports: [
    DatabaseModule,
    BullModule.registerQueue(
      {
        name: LW_QUEUE.name,
      },
      {
        name: AZURE_TEST_QUEUE.name,
      },
    ),
  ],
  controllers: [WebhookServicesController, AzureRedisTestController],
  providers: [
    WebhookServicesService,
    LearnWorldsQueueProcessor,
    AzureRedisTestProcessor,
    AzureRedisTestService,
  ],
})
export class WebhookServicesModule {}
