export function formatDate(value: string, timezone = 'Asia/Ho_Chi_Minh'): string {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: timezone,
  }).format(new Date(value));
}

export function formatMoney(minor: number, currency: string): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(minor);
}

export function statusTone(status: string): 'neutral' | 'success' | 'warning' | 'danger' {
  if (status === 'PUBLISHED' || status === 'SALES_OPEN') return 'success';
  if (status === 'SALES_CLOSED' || status === 'ONGOING') return 'warning';
  if (status === 'CANCELLED') return 'danger';
  return 'neutral';
}
