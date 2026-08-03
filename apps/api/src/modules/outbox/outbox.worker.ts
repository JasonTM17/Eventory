import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OutboxService } from './outbox.service.js';

@Injectable()
export class OutboxWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxWorker.name);
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  private claimFailureStreak = 0;
  private retryNotBefore = 0;

  constructor(
    private readonly config: ConfigService,
    private readonly outbox: OutboxService,
  ) {}

  onModuleInit(): void {
    if (!this.config.getOrThrow<boolean>('OUTBOX_WORKER_ENABLED')) return;
    this.timer = setInterval(() => void this.runCycle(), 1_000);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async runCycle(): Promise<void> {
    if (this.running) return;
    if (Date.now() < this.retryNotBefore) return;
    this.running = true;
    const failuresBefore = this.outbox.getClaimFailureCount();
    let cycleFailed = false;
    try {
      await this.outbox.processOnce();
    } catch (error) {
      cycleFailed = true;
      this.logger.error(
        `Outbox cycle failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    } finally {
      const claimFailed = this.outbox.getClaimFailureCount() > failuresBefore;
      if (cycleFailed || claimFailed) {
        this.claimFailureStreak = Math.min(this.claimFailureStreak + 1, 5);
        const delayMs = Math.min(30_000, 1_000 * 2 ** (this.claimFailureStreak - 1));
        this.retryNotBefore = Date.now() + delayMs;
      } else {
        this.claimFailureStreak = 0;
        this.retryNotBefore = 0;
      }
      this.running = false;
    }
  }
}
