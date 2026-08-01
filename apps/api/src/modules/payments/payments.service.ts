import { Injectable } from '@nestjs/common';
import type {
  CreatePaymentInput,
  CreatedPayment,
  PaymentWebhookPayload,
} from './payment-provider.js';
import { MockPaymentProvider } from './payment-provider.js';

@Injectable()
export class PaymentsService {
  constructor(private readonly provider: MockPaymentProvider) {}

  create(input: CreatePaymentInput): Promise<CreatedPayment> {
    return this.provider.createPayment(input);
  }

  verifyMockWebhook(payload: string, signature: string | undefined): PaymentWebhookPayload {
    return this.provider.verifyWebhook(payload, signature);
  }
}
