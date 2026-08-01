import { IsIn, IsInt, IsString, IsUUID, Length, Max, Min } from 'class-validator';
import type { PaymentWebhookType } from './payment-provider.js';

export class PaymentWebhookDto {
  @IsUUID()
  id!: string;

  @IsIn(['payment.succeeded', 'payment.failed', 'payment.expired'])
  type!: PaymentWebhookType;

  @IsString()
  @Max(160)
  reference!: string;

  @IsInt()
  @Min(0)
  amountMinor!: number;

  @IsString()
  @Length(3, 3)
  currency!: string;
}

export class MockPaymentCompleteDto {
  @IsIn(['succeed', 'fail', 'expire'])
  outcome!: 'succeed' | 'fail' | 'expire';
}
