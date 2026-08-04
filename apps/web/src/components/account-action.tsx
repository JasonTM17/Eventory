'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiRequest } from '../lib/api';

interface AccountActionProps {
  displayName: string;
}

export function AccountAction({ displayName }: AccountActionProps): React.JSX.Element {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function signOut(): Promise<void> {
    setBusy(true);
    setError('');
    try {
      await apiRequest<{ success: true }>('/auth/logout', { method: 'POST' });
      router.push('/');
      router.refresh();
    } catch {
      setError('Could not sign out. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="account-action-wrap">
      <button
        className="account-action"
        type="button"
        onClick={() => void signOut()}
        disabled={busy}
      >
        <span className="account-action__avatar" aria-hidden="true">
          {displayName.slice(0, 1).toUpperCase()}
        </span>
        <span>{busy ? 'Signing out…' : displayName}</span>
        <span className="account-action__hint">Sign out</span>
      </button>
      {error ? (
        <span className="account-action__error" role="alert">
          {error}
        </span>
      ) : null}
    </span>
  );
}
