import { Module } from '@nestjs/common';
import { ReportingServiceController } from './reporting-service.controller';
import { ReportingServiceService } from './reporting-service.service';
import { SharedModule } from '@app/shared';

@Module({
  imports: [SharedModule],
  controllers: [ReportingServiceController],
  providers: [ReportingServiceService],
})
export class ReportingServiceModule {}
