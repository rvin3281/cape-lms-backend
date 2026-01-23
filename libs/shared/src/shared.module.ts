import { Module } from '@nestjs/common';
import { SharedService } from './shared.service';
import { MockDataService } from './mock-data.service';

@Module({
  providers: [SharedService, MockDataService],
  exports: [SharedService, MockDataService],
})
export class SharedModule {}
