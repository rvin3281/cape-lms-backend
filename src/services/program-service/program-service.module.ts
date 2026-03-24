import { Module } from '@nestjs/common';
import { ProgramServiceController } from './program-service.controller';
import { ProgramServiceService } from './program-service.service';
import { FacilatorServiceModule } from './facilator-service/facilator-service.module';
import { DatabaseModule } from '@app/database';

@Module({
  controllers: [ProgramServiceController],
  providers: [ProgramServiceService],
  imports: [FacilatorServiceModule, DatabaseModule],
})
export class ProgramServiceModule {}
