import { DatabaseModule } from '@app/database';
import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { CourseServicesController } from './course-services.controller';
import { CourseServicesService } from './course-services.service';

@Module({
  imports: [
    DatabaseModule,
    HttpModule.register({
      timeout: 10_000,
      maxRedirects: 0,
    }),
  ],
  controllers: [CourseServicesController],
  providers: [CourseServicesService],
})
export class CourseServicesModule {}
