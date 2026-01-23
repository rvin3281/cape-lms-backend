import { DatabaseModule } from '@app/database';
import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { AuthServiceController } from './auth-service.controller';
import { AuthServiceService } from './auth-service.service';

@Module({
  imports: [
    DatabaseModule,
    HttpModule.register({
      timeout: 10_000,
      maxRedirects: 0,
    }),
  ],
  providers: [AuthServiceService],
  controllers: [AuthServiceController],
})
export class AuthServiceModule {}
