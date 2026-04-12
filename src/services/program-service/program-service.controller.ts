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
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ProgramServiceService } from './program-service.service';
import { ApiSuccess } from '@app/shared/decorator/api-success.decorator';
import {
  PaginationQueryDto,
  UpdateLearnworldsProgramDto,
  UserProgramOnboardingDto,
} from '@app/shared';
import { FileInterceptor } from '@nestjs/platform-express';
import { errorResponseBuilder } from 'utils/errorResponseBuilder';

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

  @Patch('onboard/learner/:programId')
  @HttpCode(200)
  @ApiSuccess({
    code: 'UPDATE_CLASSROOM_PROGRAM_SUCCESS',
    message: 'success',
  })
  @UseInterceptors(
    FileInterceptor('learnerFile', {
      limits: {
        fileSize: 10 * 1024 * 1024,
      },
      fileFilter: (req, file, cb) => {
        const allowed = [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
        ];

        if (!allowed.includes(file.mimetype)) {
          return cb(
            new BadRequestException(
              errorResponseBuilder(
                'INVALID_FILE_TYPE',
                undefined,
                'Only Excel files (.xlsx, .xls) are allowed',
              ),
            ),
            false,
          );
        }

        cb(null, true);
      },
    }),
  )
  async updateClassroomProgram(
    @Param('programId') programId: string,
    @Body() body: any,
    @UploadedFile() learnerFile?: Express.Multer.File,
  ) {
    return this.programServiceService.updateClassroomProgram(
      programId,
      body,
      learnerFile,
    );
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

  @Get('learnworlds')
  @HttpCode(200)
  @ApiSuccess({
    code: 'GET_ALL_LEARNWORLDS_PROGRAM',
    dataKey: 'items',
    message: 'success',
    meta: (result) => result.meta,
  })
  getAllLearnworldsProgram(@Query() query: PaginationQueryDto) {
    return this.programServiceService.getAllLearnworldsProgram(query);
  }

  @Patch('learnworlds/:productId')
  @HttpCode(200)
  @ApiSuccess({
    code: 'UPDATE_LEARNWORLDS_PROGRAM',
    dataKey: 'item',
    message: 'LearnWorlds program updated successfully',
  })
  updateLearnworldsProgram(
    @Param('productId') productId: string,
    @Body() dto: UpdateLearnworldsProgramDto,
  ) {
    return this.programServiceService.updateLearnworldsProgram(productId, dto);
  }

  @Delete('learnworlds/:productId')
  @HttpCode(200)
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  )
  // @ApiSuccess({
  //   code: 'DELETE_LEARNWORLDS_PROGRAM_SUCCESS',
  //   message: 'LearnWorlds program deleted successfully',
  //   dataKey: 'item',
  // })
  async deleteLearnworldsProgram(@Param() param: { productId: string }) {
    return this.programServiceService.deleteLearnworldsProgram(param.productId);
  }
}
