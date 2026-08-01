import { Card, StatusBadge } from '@eventory/ui';
import type { EventAnalyticsSummary } from '@eventory/contracts';
import { formatMoney } from '../lib/format';

export function AnalyticsDashboard({
  metrics,
}: {
  metrics: EventAnalyticsSummary;
}): React.JSX.Element {
  const currency = metrics.payments.currencies[0] ?? 'VND';
  return (
    <div className="analytics-stack">
      <div className="metric-grid">
        <Card className="metric-card">
          <span className="kicker">Bookings</span>
          <strong>{metrics.bookings.total}</strong>
          <small>
            Across {metrics.sessions} session{metrics.sessions === 1 ? '' : 's'}
          </small>
        </Card>
        <Card className="metric-card">
          <span className="kicker">Gross paid</span>
          <strong>{formatMoney(metrics.payments.grossMinor, currency)}</strong>
          <small>
            {metrics.payments.successfulCount} successful payment
            {metrics.payments.successfulCount === 1 ? '' : 's'}
          </small>
        </Card>
        <Card className="metric-card">
          <span className="kicker">Attendance</span>
          <strong>{Math.round(metrics.attendance.checkInRate * 100)}%</strong>
          <small>
            {metrics.attendance.checkedIn} of {metrics.attendance.issued} tickets checked in
          </small>
        </Card>
      </div>
      <Card className="analytics-detail">
        <div className="studio-card__header">
          <div>
            <span className="kicker">Window</span>
            <h2>Signals, not noise.</h2>
          </div>
          <StatusBadge label={currency} tone="neutral" />
        </div>
        <div className="analytics-rows">
          <div>
            <span>Confirmed bookings</span>
            <strong>{metrics.bookings.byStatus.CONFIRMED ?? 0}</strong>
          </div>
          <div>
            <span>Payment failures</span>
            <strong>{metrics.payments.byStatus.FAILED ?? 0}</strong>
          </div>
          <div>
            <span>Checked in</span>
            <strong>{metrics.attendance.checkedIn}</strong>
          </div>
        </div>
        <p className="empty-state">
          {new Date(metrics.from).toLocaleDateString()} →{' '}
          {new Date(metrics.to).toLocaleDateString()}. Values are scoped to this event and bounded
          to a one-year window.
        </p>
      </Card>
    </div>
  );
}
