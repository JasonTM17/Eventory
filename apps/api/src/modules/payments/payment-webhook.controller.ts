import {
  Body,
  Controller,
  ForbiddenException,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Public, RateLimit } from '../../common/auth/auth.decorators.js';
import { BookingsService } from '../bookings/bookings.service.js';
import { MockPaymentCompleteDto, PaymentWebhookDto } from './payment.dto.js';
import { serializeWebhookPayload } from './payment-provider.js';
import { PaymentsService } from './payments.service.js';

@Controller('payments')
export class PaymentWebhookController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly bookings: BookingsService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Post('webhooks/mock')
  @HttpCode(HttpStatus.OK)
  @RateLimit(300)
  webhook(
    @Body() body: PaymentWebhookDto,
    @Headers('x-mock-payment-signature') signature?: string,
  ): Promise<unknown> {
    const payload = this.payments.verifyMockWebhook(serializeWebhookPayload(body), signature);
    return this.bookings.handlePaymentWebhook(payload);
  }

  @Public()
  @Post('mock/:providerReference/complete')
  @HttpCode(HttpStatus.OK)
  @RateLimit(30)
  completeMock(
    @Param('providerReference') providerReference: string,
    @Body() body: MockPaymentCompleteDto,
  ): Promise<unknown> {
    if (this.config.getOrThrow<string>('NODE_ENV') === 'production') {
      throw new ForbiddenException({
        code: 'MOCK_PAYMENT_DISABLED',
        message: 'Mock payments are disabled in production',
      });
    }
    return this.bookings.completeMockPayment(providerReference, body.outcome);
  }
}
