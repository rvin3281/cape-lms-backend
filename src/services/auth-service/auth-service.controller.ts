/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { ApiSuccess } from '@app/shared/decorator/api-success.decorator';

import {
  AUTH_COOKIES,
  CapeOnboardingProfileDto,
  LoginDto,
  LoginResult,
} from '@app/shared';
import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Ip,
  Logger,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthServiceService } from './auth-service.service';

@Controller('auth')
export class AuthServiceController {
  private readonly logger = new Logger(AuthServiceController.name);

  constructor(private readonly authService: AuthServiceService) {}

  @Post('/onboarding')
  @ApiSuccess({ code: 'ONBOARDING_SUCCESS', message: 'success' })
  @HttpCode(200)
  async onBoardingUser(@Body() body: CapeOnboardingProfileDto): Promise<any> {
    return await this.authService.onBoardingUser(body);
  }

  /**
   *
   * @param body
   * @returns
   */
  @Post('/learnworlds/validate-email')
  @ApiSuccess({
    code: 'LEARNWORLDS_VALIDATE_EMAIL_SUCCESS',
    message: 'Email is valid',
  })
  @HttpCode(200)
  async validateLearnworldsEmail(@Body() body: { email: string }) {
    const { email } = body;
    return this.authService.validateLearnworldsEmail(email);
  }

  @Post('/validate-email')
  @ApiSuccess({
    code: 'VALIDATE_EMAIL_SUCCESS',
    message: 'Email is valid',
  })
  @HttpCode(200)
  async validateEmail(@Body() body: { email: string }) {
    const { email } = body;
    return this.authService.validateEmail(email);
  }

  @Post('/set-password')
  @ApiSuccess({
    code: 'SET_PASSWORD_SUCCESS',
    message: 'Password updated successfully',
  })
  @HttpCode(200)
  async setPassword(
    @Body()
    body: {
      email: string;
      password: string;
      confirmPassword: string;
      token: string;
    },
  ) {
    const { email, password, confirmPassword, token } = body;
    return this.authService.setPassword(
      email,
      password,
      confirmPassword,
      token,
    );
  }

  // NOTE: MUST IMPLEMENT VALIDATION FOR  BODY
  @Get('validate-password-token')
  @ApiSuccess({
    code: 'VALIDATE_PASSWORD_SUCCESS',
    message: 'Password token validated',
  })
  @HttpCode(200)
  async validatePasswordToken(
    @Query('token') token: string,
    @Query('email') email: string,
  ) {
    return this.authService.validatePasswordToken(token, email);
  }

  // =========================================================
  // GET /auth/me
  // - Reads access_token cookie
  // - Returns user if valid
  // =========================================================
  @Get('/me')
  @ApiSuccess({ code: 'ME_SUCCESS', message: 'Authenticated' })
  @HttpCode(200)
  async me(@Req() req: Request) {
    const accessToken: string | undefined = req.cookies?.[
      AUTH_COOKIES.access
    ] as string | undefined;
    return this.authService.me(accessToken);
  }

  // =========================================================
  // POST /auth/refresh
  // - Reads refresh_token cookie
  // - If valid => sets NEW access_token cookie
  // - Returns user (optional, but useful)
  // =========================================================
  @Post('/refresh')
  @ApiSuccess({ code: 'REFRESH_SUCCESS', message: 'Token refreshed' })
  @HttpCode(200)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    // @Headers('user-agent') userAgent: string,
  ) {
    const refreshTokenRaw = req.cookies?.[AUTH_COOKIES.refresh] as
      | string
      | undefined;

    const result = await this.authService.refresh(refreshTokenRaw);

    // Cookie options (tune for prod)
    const secure = process.env.COOKIE_SECURE === 'false';
    const sameSite =
      (process.env.COOKIE_SAMESITE as 'none' | 'lax' | 'strict' | undefined) ??
      'none';
    const domain = process.env.COOKIE_DOMAIN || undefined;

    // Set NEW access token cookie
    res.cookie(AUTH_COOKIES.access, result.accessToken, {
      httpOnly: true,
      secure,
      sameSite,
      domain,
      maxAge: 15 * 60 * 1000, // keep consistent with ACCESS TTL
    });

    return { user: result.user };
  }

  // =========================================================
  // POST /auth/logout
  // - Revokes refresh token
  // - Clears BOTH cookies
  // =========================================================
  @Post('/logout')
  @ApiSuccess({ code: 'LOGOUT_SUCCESS', message: 'Logged out' })
  @HttpCode(200)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshTokenRaw = req.cookies?.[AUTH_COOKIES.refresh] as
      | string
      | undefined;

    await this.authService.logout(refreshTokenRaw);

    const secure = process.env.COOKIE_SECURE === 'false';
    const sameSite =
      (process.env.COOKIE_SAMESITE as 'none' | 'lax' | 'strict' | undefined) ??
      'none';
    const domain = process.env.COOKIE_DOMAIN || undefined;
    try {
      await this.authService.logout(refreshTokenRaw);
    } catch (error) {
      this.logger.warn('Logout revoke failed, clearing cookies anyway');
    } finally {
      res.cookie(AUTH_COOKIES.access, '', {
        httpOnly: true,
        secure,
        sameSite,
        domain,
        maxAge: 0,
      });

      res.cookie(AUTH_COOKIES.refresh, '', {
        httpOnly: true,
        secure,
        sameSite,
        domain,
        maxAge: 0,
      });

      res.cookie(AUTH_COOKIES.authScope, '', {
        httpOnly: true,
        secure,
        sameSite,
        domain,
        maxAge: 0,
      });
    }

    return { ok: true };
  }

  @Post('/login')
  @ApiSuccess({
    code: 'LOGIN_SUCCESS',
    message: 'Login successful',
  })
  // @ApiSuccess({
  // dataKey: 'items',
  //   meta: (result: IPaginatedResult) => ({
  //     code: 'LOGIN_SUCCESS',
  //   message: 'Login successful',
  //     page: result.page,
  //     limit: result.limit,
  //     total: result.total,
  //   }),
  // })
  @HttpCode(200)
  async login(
    @Body() body: LoginDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<any> {
    const result: LoginResult = await this.authService.login(body, {
      ip,
      userAgent,
    });

    // Cookie options (tune for prod)
    const secure = process.env.COOKIE_SECURE === 'false';
    const sameSite =
      (process.env.COOKIE_SAMESITE as 'none' | 'lax' | 'strict' | undefined) ??
      'none';
    const domain = process.env.COOKIE_DOMAIN || undefined;

    res.cookie('access_token', result.accessToken, {
      httpOnly: true,
      secure,
      sameSite,
      domain,
      // path: '/',
      maxAge: 15 * 60 * 1000, // keep in sync with access TTL
    });

    res.cookie('refresh_token', result.refreshToken.rawToken, {
      httpOnly: true,
      secure,
      sameSite,
      domain,
      // path: '/auth', // scoping is safer (optional)
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.cookie('auth_scope', result.user.authScope, {
      httpOnly: true,
      secure,
      sameSite,
      domain,
      // path: "/",
      maxAge: 1000 * 60 * 60 * 24 * 30,
    });

    // return body (don’t return raw refresh token)
    return {
      user: result.user,
    };
  }
}
