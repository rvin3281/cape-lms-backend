/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import {
  AddFacilitatorDto,
  PaginationQueryDto,
  UpdateFacilitatorDto,
} from '@app/shared';
import { ApiSuccess } from '@app/shared/decorator/api-success.decorator';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { FacilatorServiceService } from './facilator-service.service';

@Controller('facilitator')
export class FacilatorServiceController {
  constructor(
    private readonly facilatorServiceService: FacilatorServiceService,
  ) {}

  @Post()
  @HttpCode(200)
  @ApiSuccess({ code: 'FACILITATOR_ADDED_SUCCESSFULLY', message: 'success' })
  addFacilitator(@Body() dto: AddFacilitatorDto) {
    return this.facilatorServiceService.addFacilitator(dto);
  }

  @Get()
  @HttpCode(200)
  @ApiSuccess({
    code: 'GET_FACILILATOR',
    message: 'success',
    dataKey: 'items',
    meta: (result) => result.meta,
  })
  getAllFacilitator(@Query() query: PaginationQueryDto) {
    return this.facilatorServiceService.getAllFacilitator(query);
  }

  @Patch('/:id')
  @HttpCode(200)
  @ApiSuccess({ code: 'UPDATE_FACILITATOR', message: 'success' })
  updateFacilitator(
    @Param() param: { id: string },
    @Body() dto: UpdateFacilitatorDto,
  ) {
    return this.facilatorServiceService.updateFacilitator(param.id, dto);
  }

  @Delete('/:id')
  @HttpCode(204)
  @ApiSuccess({
    code: 'DELETE_FACILITATOR',
    message: 'success',
  })
  deleteFacilitator(@Param() param: { id: string }) {
    return this.facilatorServiceService.deleteFacilitator(param.id);
  }
}
