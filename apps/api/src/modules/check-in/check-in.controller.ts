import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/auth/auth.decorators.js';
import type { AuthenticatedUser } from '../../common/auth/auth.types.js';
import { CheckInDto } from './check-in.dto.js';
import { CheckInService } from './check-in.service.js';

@Controller('check-in')
export class CheckInController {
  constructor(private readonly checkIn: CheckInService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  check(@Body() body: CheckInDto, @CurrentUser() user: AuthenticatedUser): Promise<unknown> {
    return this.checkIn.check(user.id, body);
  }
}
