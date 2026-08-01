import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MockPaymentProvider } from './payment-provider.js';
import { PaymentsService } from './payments.service.js';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: MockPaymentProvider,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => new MockPaymentProvider(config),
    },
    PaymentsService,
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
