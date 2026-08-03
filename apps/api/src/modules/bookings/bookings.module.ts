import { Module } from '@nestjs/common';
import { PaymentsModule } from '../payments/payments.module.js';
import { SeatingModule } from '../seating/seating.module.js';
import { BookingsController } from './bookings.controller.js';
import { BookingsService } from './bookings.service.js';
import { BookingReconciliationWorker } from './booking-reconciliation.worker.js';
import { PaymentWebhookController } from '../payments/payment-webhook.controller.js';

@Module({
  imports: [SeatingModule, PaymentsModule],
  controllers: [BookingsController, PaymentWebhookController],
  providers: [BookingsService, BookingReconciliationWorker],
  exports: [BookingsService],
})
export class BookingsModule {}
