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

        if (!redis) {
          throw new Error('Missing redis config');
        }

        const res = {
          connection: {
            host: redis.host,
            port: redis.port,
            password: redis.password,
            db: redis.db,
          },
          defaultJobOptions: {
            attempts: 5,
            backoff: { type: 'exponential', delay: 2000 },
            removeOnComplete: true,
            removeOnFail: false,
          },
        };

        if (!res) throw new Error('redix not connected');
        console.log('No connection');
        return res;
      },
    }),
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
