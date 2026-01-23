import { UserIdParamDto } from '@app/shared';
import { ApiSuccess } from '@app/shared/decorator/api-success.decorator';
import { LearnWorldsSsoDto } from '@app/shared/dto/learnworlds-sso.dto';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { UserServiceService } from './user-service.service';

@Controller('user')
export class UserServiceController {
  constructor(private readonly userService: UserServiceService) {}

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
}
