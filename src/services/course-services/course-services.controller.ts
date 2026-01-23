import { UserIdParamDto } from '@app/shared';
import { ApiSuccess } from '@app/shared/decorator/api-success.decorator';
import { Controller, Get, HttpCode, Param } from '@nestjs/common';
import { CourseServicesService } from './course-services.service';

@Controller('course')
export class CourseServicesController {
  constructor(private readonly courseService: CourseServicesService) {}

  @Get('/get-overall-progress/:id')
  @ApiSuccess()
  @HttpCode(200)
  getOverallCourseProgress(@Param() param: UserIdParamDto) {
    const { id } = param;
    return this.courseService.getOverallCourseProgram(id);
  }
}
