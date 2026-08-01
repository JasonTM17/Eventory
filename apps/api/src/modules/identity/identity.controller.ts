import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { CurrentUser, Public, RateLimit } from '../../common/auth/auth.decorators.js';
import type { AuthenticatedUser } from '../../common/auth/auth.types.js';
import { IdentityService } from './identity.service.js';
import { LoginDto, RegisterDto } from './identity.dto.js';

@Controller('auth')
export class IdentityController {
  constructor(private readonly identity: IdentityService) {}

  @Public()
  @RateLimit(10)
  @Post('register')
  register(
    @Body() body: RegisterDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ user: AuthenticatedUser }> {
    return this.identity.register(body, response, request);
  }

  @Public()
  @RateLimit(10)
  @Post('login')
  login(
    @Body() body: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ user: AuthenticatedUser }> {
    return this.identity.login(body, response, request);
  }

  @Public()
  @RateLimit(30)
  @Post('refresh')
  refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ user: AuthenticatedUser }> {
    return this.identity.refresh(request, response);
  }

  @Post('logout')
  @RateLimit(60)
  logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ success: true }> {
    return this.identity.logout(request, response);
  }

  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser): { user: AuthenticatedUser } {
    return { user };
  }
}
