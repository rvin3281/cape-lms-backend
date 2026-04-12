import { Module } from '@nestjs/common';
import { ProgramServiceController } from './program-service.controller';
import { ProgramServiceService } from './program-service.service';
import { FacilatorServiceModule } from './facilator-service/facilator-service.module';
import { DatabaseModule } from '@app/database';
import { HttpModule } from '@nestjs/axios';

@Module({
  controllers: [ProgramServiceController],
  providers: [ProgramServiceService],
  imports: [
    FacilatorServiceModule,
    DatabaseModule,
    HttpModule.register({
      timeout: 10_000,
      maxRedirects: 0,
    }),
  ],
})
export class ProgramServiceModule {}
