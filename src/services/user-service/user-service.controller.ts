/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import {
  IUpdateAccountProfile,
  IUpdateCareerProfile,
  PaginationQueryDto,
  UnenrollUserProgramsDto,
  UpdateOnboardingUserDto,
  UserIdParamDto,
} from '@app/shared';
import { ApiSuccess } from '@app/shared/decorator/api-success.decorator';
import { LearnWorldsSsoDto } from '@app/shared/dto/learnworlds-sso.dto';
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
import { UserServiceService } from './user-service.service';
import {
  UpdateCapeUserDto,
  UpdateCapeUserLearnworldsDto,
} from '@app/shared/dto/update-cape-user.dto';

@Controller('user')
export class UserServiceController {
  constructor(private readonly userService: UserServiceService) {}

  @Get('classroom-program/:id')
  @HttpCode(200)
  @ApiSuccess({
    code: 'GET_ALL_PROGRAM_BY_USER',
    message: 'success',
    dataKey: 'items',
  })
  getAllClassroomProgramByUser(@Param() param: UserIdParamDto) {
    return this.userService.getAllClassroomProgramByUser(param.id);
  }

  @Get('all-program/:id')
  @HttpCode(200)
  @ApiSuccess({
    code: 'GET_ALL_PROGRAM_BY_USER',
    message: 'success',
  })
  getAllProgramByUser(@Param() param: UserIdParamDto) {
    return this.userService.getAllProgramByUser(param.id);
  }

  @Post('learnworlds/sso')
  @HttpCode(200)
  @ApiSuccess({
    code: 'SSO_AUTHENTICATED',
    message: 'success',
  })
  async sso(@Body() body: LearnWorldsSsoDto) {
    // email should ALWAYS come from authenticated user
    return this.userService.generateSsoUrl(body.email, body.redirectUrl);
  }

  // NOTE: ADD AUTH GUARD -> SECURED API TO GET ACCESS TOKEN AND VALIDATE THE API
  // NOTE: FOR THE TEMPORARY WE USE EMAIL TO GET DATA BY EMAIL
  @Get('/user-profile')
  @ApiSuccess({
    code: 'GET_USER_PROFILE_DATA',
    message: 'success',
  })
  async getUserProfileData(@Query() query: { email: string }) {
    const { email } = query;
    return this.userService.getUserProfileData(email);
  }

  @Patch('/user-profile/career')
  @ApiSuccess({
    code: 'UPDATE_USER_PROFILE_CAREER_DATA',
    message: 'success',
  })
  async updateUserProfileCareerData(
    @Query() query: UpdateOnboardingUserDto,
    @Body() body: IUpdateCareerProfile,
  ) {
    const { email } = query;
    return this.userService.updateUserProfileCareerData(email, body);
  }

  @Patch('/user-profile/account')
  @ApiSuccess({
    code: 'UPDATE_USER_PROFILE_ACCOUNT_DATA',
    message: 'success',
  })
  async updateUserProfileAccountData(
    @Query() query: UpdateOnboardingUserDto,
    @Body() body: IUpdateAccountProfile,
  ) {
    const { email } = query;
    return this.userService.updateUserProfileAccountData(email, body);
  }

  @Get('/cape')
  @HttpCode(200)
  @ApiSuccess({
    code: 'GET_ALL_CAPE_USER_DATA',
    message: 'success',
    dataKey: 'items',
    meta: (result) => result.meta,
  })
  async getCaperUserData(@Query() query: PaginationQueryDto) {
    return this.userService.getCaperUserData(query);
  }

  @Get('/cape/:id')
  @HttpCode(200)
  @ApiSuccess({
    code: 'UPDATE_CAPE_USER_DATA',
    message: 'success',
  })
  async updateCapeUserData(
    @Param() param: { id: string },
    @Body() dto: UpdateCapeUserLearnworldsDto,
  ) {
    return this.userService.updateCapeUserData(param.id, dto);
  }

  @Patch('/cape/:id')
  @HttpCode(200)
  @ApiSuccess({
    code: 'UPDATE_CAPE_USER_DATA',
    message: 'success',
  })
  async updateCapeUser(
    @Param() param: { id: string },
    @Body() dto: UpdateCapeUserDto,
  ) {
    return this.userService.updateCapeUser(param.id, dto);
  }

  @Delete('/cape/:id')
  @HttpCode(204)
  @ApiSuccess({
    code: 'DELETE_CAPE_USER_DATA',
    message: 'success',
  })
  async deleteCapeUser(@Param() param: { id: string }) {
    return this.userService.deleteCapeUser(param.id);
  }

  @Get('/cape/:id/programs')
  @HttpCode(200)
  @ApiSuccess({
    code: 'GET_ALL_PROGRAM_BY_USER',
    message: 'success',
    dataKey: 'items',
    meta: (result) => result.meta,
  })
  async getAllProgramOfUser(@Param() param: { id: string }) {
    return this.userService.getAllProgramOfUser(param.id);
  }

  @Delete('/cape/programs/unenroll')
  @HttpCode(200)
  @ApiSuccess({
    code: 'USER_UNENROLLED_FROM_PROGRAMS',
    message: 'success',
  })
  async unenrollUserFromPrograms(@Body() dto: UnenrollUserProgramsDto) {
    return this.userService.unenrollUserFromPrograms(dto);
  }
}
