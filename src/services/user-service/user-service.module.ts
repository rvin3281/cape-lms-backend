import { DatabaseModule } from '@app/database';
import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { UserServiceController } from './user-service.controller';
import { UserServiceService } from './user-service.service';

@Module({
  imports: [
    DatabaseModule,
    HttpModule.register({
      timeout: 10_000,
      maxRedirects: 0,
    }),
  ],
  controllers: [UserServiceController],
  providers: [UserServiceService],
})
export class UserServiceModule {}
