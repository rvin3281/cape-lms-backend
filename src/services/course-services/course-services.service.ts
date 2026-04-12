/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { LW_USER } from '@app/shared';
import { HttpService } from '@nestjs/axios';
import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { errorResponseBuilder } from 'utils/errorResponseBuilder';
import { handleServiceCatchError } from 'utils/handleServiceCatchError';

@Injectable()
export class CourseServicesService {
  private readonly logger = new Logger(CourseServicesService.name);

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  async getOverallCourseProgram(id: string): Promise<{ totalCourse: number }> {
    const url = `${LW_USER}/${id}/courses`;

    try {
      const lwConfig = this.config.get<any>('learnworls');

      const res = await firstValueFrom(
        this.http.get(url, {
          headers: {
            Authorization: `Bearer ${lwConfig.learnworld_bearer_token}`,
            'Lw-Client': lwConfig.learnworld_lw_client_id,
            Accept: 'application/json',
          },
          baseURL: lwConfig.learnworld_api_base_url,
        }),
      );

      if (!res.data || res.data === '') {
        throw new ForbiddenException(
          errorResponseBuilder('LW_SERVICE_UNAVAILABLE'),
        );
      }
      const courseData = res?.data;
      const totalCourse = courseData.meta?.totalItems;

      return { totalCourse };
    } catch (error) {
      handleServiceCatchError(error, this.logger);
    }
  }
}
