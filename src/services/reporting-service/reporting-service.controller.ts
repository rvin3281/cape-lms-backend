/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { ApiSuccess } from '@app/shared/decorator/api-success.decorator';
import { CohortIdParamDto } from '@app/shared/dto/reports/cohort-id-param.dto';
import { CohortReportQueryDto } from '@app/shared/dto/reports/cohort-report.query';
import { Controller, Get, HttpCode, Param, Query } from '@nestjs/common';
import { ReportingServiceService } from './reporting-service.service';

@Controller('report')
export class ReportingServiceController {
  constructor(private readonly reportingService: ReportingServiceService) {}

  @Get('/cohort')
  @HttpCode(200)
  @ApiSuccess({
    code: 'COHORT_REPORT_SUCCESS',
    message: 'Cohort report generated successfully',
    dataKey: 'items',
  })
  async getCohortReport(@Query() query: CohortReportQueryDto): Promise<any> {
    const page = query.page ?? 1;

    const result = await this.reportingService.getCohortReport({ page });

    return { items: result };
  }

  @Get('/cohort/:id')
  @HttpCode(200)
  @ApiSuccess({
    code: 'COHORT_BY_ID_SUCCESS',
    message: 'Cohort report by id generated successfully',
  })
  async getCohortById(@Param() params: CohortIdParamDto): Promise<any> {
    const { id } = params;

    const result = await this.reportingService.getCohortById(id);

    return result;
  }
}
