import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BookingsService } from './bookings.service.js';

@Injectable()
export class BookingReconciliationWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BookingReconciliationWorker.name);
  private timer?: ReturnType<typeof setInterval>;
  private running = false;

  constructor(
    private readonly config: ConfigService,
    private readonly bookings: BookingsService,
  ) {}

  onModuleInit(): void {
    if (!this.config.getOrThrow<boolean>('BOOKING_RECONCILIATION_WORKER_ENABLED')) return;
    this.timer = setInterval(() => void this.runCycle(), 5_000);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async runCycle(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.bookings.recoverPendingProviderPayments();
      await this.bookings.expirePendingBookings();
      await this.bookings.reconcilePendingPaymentWebhooks();
    } catch (error) {
      this.logger.error(
        `Booking reconciliation cycle failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    } finally {
      this.running = false;
    }
  }
}
