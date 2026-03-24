import { Module } from '@nestjs/common';
import { FacilatorServiceController } from './facilator-service.controller';
import { FacilatorServiceService } from './facilator-service.service';
import { DatabaseModule } from '@app/database';

@Module({
  imports: [DatabaseModule],
  controllers: [FacilatorServiceController],
  providers: [FacilatorServiceService],
})
export class FacilatorServiceModule {}
