import { Injectable } from '@nestjs/common';
import {
  BookingStatus,
  OutboxStatus,
  PaymentReconciliationStatus,
  PaymentStatus,
} from '../../generated/prisma/client.js';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import { RedisService } from '../../infrastructure/redis/redis.service.js';
import { OutboxService } from '../../modules/outbox/outbox.service.js';

interface HttpMetric {
  count: number;
  durationMs: number;
}

@Injectable()
export class MetricsService {
  private readonly http = new Map<string, HttpMetric>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly outbox: OutboxService,
  ) {}

  observeHttp(method: string, route: string, status: number, durationMs: number): void {
    const key = `${method}|${route}|${status}`;
    const current = this.http.get(key);
    if (current) {
      current.count += 1;
      current.durationMs += durationMs;
      return;
    }
    if (this.http.size >= 500) return;
    this.http.set(key, { count: 1, durationMs });
  }

  async render(): Promise<string> {
    const lines = [
      '# HELP eventory_http_requests_total HTTP requests handled by the API.',
      '# TYPE eventory_http_requests_total counter',
    ];
    for (const [key, metric] of this.http) {
      const [method, route, status] = key.split('|');
      lines.push(
        `eventory_http_requests_total{method="${this.escapeLabel(method)}",route="${this.escapeLabel(route)}",status="${this.escapeLabel(status)}"} ${metric.count}`,
      );
    }
    lines.push(
      '# HELP eventory_http_request_duration_ms_total Total request duration in milliseconds.',
    );
    lines.push('# TYPE eventory_http_request_duration_ms_total counter');
    for (const [key, metric] of this.http) {
      const [method, route, status] = key.split('|');
      lines.push(
        `eventory_http_request_duration_ms_total{method="${this.escapeLabel(method)}",route="${this.escapeLabel(route)}",status="${this.escapeLabel(status)}"} ${metric.durationMs.toFixed(3)}`,
      );
    }

    const [bookings, payments, checkIns, outboxPending, activeHolds, reconciliations] =
      await Promise.all([
        this.prisma.booking.count().catch(() => 0),
        this.prisma.payment.count({ where: { status: PaymentStatus.SUCCEEDED } }).catch(() => 0),
        this.prisma.ticketCheckIn.count().catch(() => 0),
        this.prisma.outboxEvent.count({ where: { status: OutboxStatus.PENDING } }).catch(() => 0),
        this.redis.count('eventory:seat-hold:*').catch(() => 0),
        this.prisma.paymentReconciliation
          .count({ where: { status: PaymentReconciliationStatus.OPEN } })
          .catch(() => 0),
      ]);

    lines.push('# HELP eventory_bookings_total Bookings stored in the database.');
    lines.push('# TYPE eventory_bookings_total gauge');
    lines.push(`eventory_bookings_total ${bookings}`);
    lines.push(
      '# HELP eventory_payments_succeeded_total Successful payments stored in the database.',
    );
    lines.push('# TYPE eventory_payments_succeeded_total gauge');
    lines.push(`eventory_payments_succeeded_total ${payments}`);
    lines.push('# HELP eventory_checkins_total Ticket check-ins stored in the database.');
    lines.push('# TYPE eventory_checkins_total gauge');
    lines.push(`eventory_checkins_total ${checkIns}`);
    lines.push('# HELP eventory_outbox_pending Pending outbox events.');
    lines.push('# TYPE eventory_outbox_pending gauge');
    lines.push(`eventory_outbox_pending ${outboxPending}`);
    lines.push('# HELP eventory_outbox_claim_failures_total Outbox claim failures.');
    lines.push('# TYPE eventory_outbox_claim_failures_total counter');
    lines.push(`eventory_outbox_claim_failures_total ${this.outbox.getClaimFailureCount()}`);
    lines.push(
      '# HELP eventory_payment_reconciliations_open Payments captured without automatic fulfillment.',
    );
    lines.push('# TYPE eventory_payment_reconciliations_open gauge');
    lines.push(`eventory_payment_reconciliations_open ${reconciliations}`);
    lines.push('# HELP eventory_active_seat_holds Active seat holds in Redis.');
    lines.push('# TYPE eventory_active_seat_holds gauge');
    lines.push(`eventory_active_seat_holds ${activeHolds}`);
    lines.push('# HELP eventory_bookings_pending Bookings awaiting payment.');
    lines.push('# TYPE eventory_bookings_pending gauge');
    lines.push(
      `eventory_bookings_pending ${await this.prisma.booking.count({ where: { status: BookingStatus.PENDING } }).catch(() => 0)}`,
    );
    return `${lines.join('\n')}\n`;
  }

  private escapeLabel(value: string | undefined): string {
    return (value ?? 'unknown')
      .replaceAll('\\', '\\\\')
      .replaceAll('"', '\\"')
      .replaceAll('\n', '\\n');
  }
}
