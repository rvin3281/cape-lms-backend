/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ProgramServiceService } from './program-service.service';
import { ApiSuccess } from '@app/shared/decorator/api-success.decorator';
import { PaginationQueryDto, UserProgramOnboardingDto } from '@app/shared';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('program')
export class ProgramServiceController {
  constructor(private readonly programServiceService: ProgramServiceService) {}

  @Post('onboard/learner')
  @HttpCode(200)
  @ApiSuccess({ code: 'USER_PROGRAM_UPLOAD_SUCCESS', message: 'success' })
  @UseInterceptors(
    FileInterceptor('learnerFile', {
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
      },
      fileFilter: (req, file, cb) => {
        const allowed = [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
          'application/vnd.ms-excel', // xls
        ];

        if (!allowed.includes(file.mimetype)) {
          return cb(
            new BadRequestException('Only Excel files (.xlsx, .xls) allowed'),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  userProgramOnboarding(
    @Body() dto: UserProgramOnboardingDto,
    @UploadedFile() learnerFile: Express.Multer.File,
  ) {
    if (!learnerFile) {
      throw new BadRequestException('Excel file is required');
    }

    return this.programServiceService.userProgramOnboarding(dto, learnerFile);
  }

  @Get('onboard/learner')
  @HttpCode(200)
  @ApiSuccess({
    code: 'GET_ALL_PROGRAM_ONBOARDING',
    dataKey: 'items',
    message: 'success',
    meta: (result) => result.meta,
  })
  getAllProgramOnboarding(@Query() query: PaginationQueryDto) {
    return this.programServiceService.getAllProgramOnboarding(query);
  }

  @Delete('onboard/learner/:id')
  @HttpCode(204)
  @ApiSuccess({
    code: 'DELETE_PROGRAM_ONBOARDING',
    message: 'success',
  })
  deleteProgramOnboarding(@Param() param: { id: string }) {
    return this.programServiceService.deleteProgramOnboarding(param.id);
  }
}
