import { DatabaseModule } from '@app/database';
import { SharedModule } from '@app/shared';
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RedisConfig } from './config/app-config.type';
import { AuthServiceModule } from './services/auth-service/auth-service.module';
import { CourseServicesModule } from './services/course-services/course-services.module';
import { ReportingServiceModule } from './services/reporting-service/reporting-service.module';
import { UserServiceModule } from './services/user-service/user-service.module';
import { WebhookServicesModule } from './services/webhook-services/webhook-services.module';
import { ProgramServiceModule } from './services/program-service/program-service.module';

@Module({
  imports: [
    ConfigModule,
    UserServiceModule,
    ReportingServiceModule,
    DatabaseModule,
    AuthServiceModule,
    SharedModule,
    WebhookServicesModule,
    CourseServicesModule,
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const redis = config.get<RedisConfig>('redis');

        console.log('Redis config being used for BullMQ:', redis);

        if (!redis) {
          throw new Error('Missing redis config');
        }

        const res = {
          prefix: 'bull:{cape}', // works in dev + required in prod
          connection: {
            host: redis.host,
            port: redis.port,
            password: redis.password,
            db: redis.db,
            tls: redis.tls
              ? {
                  servername: redis.host,
                }
              : undefined,
            maxRetriesPerRequest: null,
            enableReadyCheck: false,
          },
          defaultJobOptions: {
            attempts: 5,
            backoff: { type: 'exponential', delay: 2000 },
            removeOnComplete: true,
            removeOnFail: false,
          },
        };

        if (!res) {
          console.log('Redis config is invalid:', redis);
          throw new Error('redix not connected');
        }
        return res;
      },
    }),
    ProgramServiceModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
