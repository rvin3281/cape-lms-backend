import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LearnworldsGateway } from './learnworlds/learnworlds.gateway';
import { MockDataService } from './mock-data.service';
import { SharedService } from './shared.service';

@Module({
  imports: [HttpModule, ConfigModule],
  providers: [SharedService, MockDataService, LearnworldsGateway],
  exports: [SharedService, MockDataService, LearnworldsGateway],
})
export class SharedModule {}
