'use client';

import { useState } from 'react';
import { Button, Card, StatusBadge } from '@eventory/ui';
import type { AdminPage, AdminUserSummary } from '@eventory/contracts';
import { apiRequest, isApiError } from '../lib/api';

export function AdminConsole({
  initialPage,
  currentUserId,
}: {
  initialPage: AdminPage<AdminUserSummary>;
  currentUserId: string;
}): React.JSX.Element {
  const [page, setPage] = useState(initialPage);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');

  async function suspend(user: AdminUserSummary): Promise<void> {
    setBusyId(user.id);
    setError('');
    try {
      const updated = await apiRequest<{ id: string; status: AdminUserSummary['status'] }>(
        `/admin/users/${user.id}/status`,
        { method: 'PATCH', body: JSON.stringify({ status: 'SUSPENDED' }) },
      );
      setPage((current) => ({
        ...current,
        items: current.items.map((item) =>
          item.id === user.id ? { ...item, status: updated.status } : item,
        ),
      }));
    } catch (requestError) {
      setError(
        isApiError(requestError)
          ? (requestError.body.message ?? 'Could not update user.')
          : 'API unavailable.',
      );
    } finally {
      setBusyId('');
    }
  }

  return (
    <Card className="admin-card">
      <div className="studio-card__header">
        <div>
          <span className="kicker">Users</span>
          <h2>Keep the platform healthy.</h2>
        </div>
        <StatusBadge label={`${page.total} total`} tone="neutral" />
      </div>
      <div className="admin-table" role="table" aria-label="Platform users">
        {page.items.map((user) => (
          <div className="admin-row" role="row" key={user.id}>
            <div>
              <strong>{user.displayName}</strong>
              <small>{user.email}</small>
            </div>
            <span className="admin-role">{user.role}</span>
            <StatusBadge
              label={user.status}
              tone={user.status === 'ACTIVE' ? 'success' : 'danger'}
            />
            <Button
              type="button"
              variant="secondary"
              disabled={
                user.id === currentUserId || user.status === 'SUSPENDED' || busyId === user.id
              }
              onClick={() => void suspend(user)}
            >
              {busyId === user.id
                ? 'Saving…'
                : user.status === 'SUSPENDED'
                  ? 'Suspended'
                  : 'Suspend'}
            </Button>
          </div>
        ))}
      </div>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <p className="empty-state">
        Page {page.page} of {page.pageCount || 1}. Every moderation change is audited.
      </p>
    </Card>
  );
}
