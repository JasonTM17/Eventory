'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button, Field } from '@eventory/ui';
import type { AuthUser } from '@eventory/contracts';
import { apiRequest, isApiError } from '../lib/api';
import { destinationAfterAuth } from '../lib/auth-navigation';

interface AuthFormProps {
  mode: 'login' | 'register';
  nextPath?: string;
}

export function AuthForm({ mode, nextPath }: AuthFormProps): React.JSX.Element {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isRegister = mode === 'register';

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      const response = await apiRequest<{ user: AuthUser }>(`/auth/${mode}`, {
        method: 'POST',
        body: JSON.stringify({ email, password, ...(isRegister ? { displayName } : {}) }),
      });
      router.push(destinationAfterAuth(nextPath, response.user.role));
      router.refresh();
    } catch (requestError) {
      setError(
        isApiError(requestError)
          ? (requestError.body.message ?? 'Please check your details and try again.')
          : 'The API is unavailable. Please try again in a moment.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="auth-layout">
      <div className="auth-panel">
        <div className="auth-panel__intro">
          <span className="kicker">{isRegister ? 'Start your story' : 'Welcome back'}</span>
          <h1>{isRegister ? 'Make every seat count.' : 'Your next night out is waiting.'}</h1>
          <p>
            {isRegister
              ? 'Create an Eventory account to reserve seats and build events your audience remembers.'
              : 'Sign in to keep your tickets, reservations, and event studio in one calm place.'}
          </p>
        </div>
        <form className="stack-form" onSubmit={handleSubmit}>
          {isRegister ? (
            <Field label="Display name" htmlFor="display-name">
              <input
                id="display-name"
                name="displayName"
                required
                minLength={2}
                maxLength={120}
                autoComplete="name"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
              />
            </Field>
          ) : null}
          <Field label="Email address" htmlFor="email">
            <input
              id="email"
              name="email"
              required
              type="email"
              autoComplete="email"
              spellCheck={false}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </Field>
          <Field
            label="Password"
            htmlFor="password"
            {...(isRegister ? { hint: 'Use 12+ characters with upper, lower, and a number.' } : {})}
          >
            <input
              id="password"
              name="password"
              required
              minLength={isRegister ? 12 : undefined}
              type="password"
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </Field>
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Working…' : isRegister ? 'Create account' : 'Sign in'}
          </Button>
        </form>
        <p className="auth-panel__switch">
          {isRegister ? 'Already have an account?' : 'New to Eventory?'}{' '}
          <Link
            href={
              nextPath
                ? `${isRegister ? '/login' : '/register'}?next=${encodeURIComponent(nextPath)}`
                : isRegister
                  ? '/login'
                  : '/register'
            }
          >
            {isRegister ? 'Sign in' : 'Create an account'}
          </Link>
        </p>
      </div>
      <aside className="auth-aside" aria-label="Eventory promise">
        <span className="aside-number">01</span>
        <p>Less friction at checkout. More room for the moment that brought you here.</p>
        <span className="aside-rule" />
        <span className="aside-caption">
          Built for real rooms, real people, and nights worth remembering.
        </span>
      </aside>
    </div>
  );
}
