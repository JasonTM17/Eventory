'use client';

import { useState } from 'react';
import { Button, Card, Field, StatusBadge } from '@eventory/ui';
import type { OrganizationSummary } from '@eventory/contracts';
import { apiRequest, isApiError } from '../lib/api';

export function OrganizerStudio({
  organizations,
}: {
  organizations: OrganizationSummary[];
}): React.JSX.Element {
  const [items, setItems] = useState(organizations);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState(organizations[0]?.id ?? '');
  const [organizationName, setOrganizationName] = useState('');
  const [eventName, setEventName] = useState('');
  const [eventStart, setEventStart] = useState('');
  const [eventEnd, setEventEnd] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function createOrganization(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const created = await apiRequest<OrganizationSummary>('/organizations', {
        method: 'POST',
        body: JSON.stringify({ name: organizationName }),
      });
      setItems((current) => [...current, created]);
      setSelectedOrganizationId(created.id);
      setOrganizationName('');
      setMessage('Workspace created. Add your first event below.');
    } catch (requestError) {
      setError(
        isApiError(requestError)
          ? (requestError.body.message ?? 'Could not create workspace.')
          : 'API unavailable.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function createEvent(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!selectedOrganizationId) return setError('Create or select a workspace first.');
    setBusy(true);
    setError('');
    try {
      await apiRequest('/organizer/events', {
        method: 'POST',
        body: JSON.stringify({
          organizationId: selectedOrganizationId,
          name: eventName,
          startAt: new Date(eventStart).toISOString(),
          endAt: new Date(eventEnd).toISOString(),
        }),
      });
      setEventName('');
      setEventStart('');
      setEventEnd('');
      setMessage('Draft saved. Add sessions and ticket types from the API workflow next.');
    } catch (requestError) {
      setError(
        isApiError(requestError)
          ? (requestError.body.message ?? 'Could not create event.')
          : 'API unavailable.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="studio-grid">
      <Card className="studio-card studio-card--wide">
        <div className="studio-card__header">
          <div>
            <span className="kicker">Workspace</span>
            <h2>Your event rooms</h2>
          </div>
          <StatusBadge
            label={`${items.length} workspace${items.length === 1 ? '' : 's'}`}
            tone="neutral"
          />
        </div>
        {items.length ? (
          <div className="workspace-list">
            {items.map((organization) => (
              <button
                type="button"
                className={`workspace-item ${selectedOrganizationId === organization.id ? 'workspace-item--selected' : ''}`}
                key={organization.id}
                onClick={() => setSelectedOrganizationId(organization.id)}
              >
                <span>
                  <strong>{organization.name}</strong>
                  <small>{organization.slug}</small>
                </span>
                <span className="workspace-role">{organization.membership}</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="empty-state">
            No workspace yet. Start with a name your audience will recognize.
          </p>
        )}
        <form className="inline-form" onSubmit={createOrganization}>
          <label className="sr-only" htmlFor="organization-name">
            New workspace name
          </label>
          <input
            id="organization-name"
            required
            value={organizationName}
            onChange={(event) => setOrganizationName(event.target.value)}
            placeholder="New workspace name"
          />
          <Button type="submit" variant="secondary" disabled={busy}>
            Create workspace
          </Button>
        </form>
      </Card>
      <Card className="studio-card">
        <div className="studio-card__header">
          <div>
            <span className="kicker">Draft studio</span>
            <h2>Shape the night</h2>
          </div>
        </div>
        <form className="stack-form" onSubmit={createEvent}>
          <Field label="Event name">
            <input
              required
              minLength={2}
              value={eventName}
              onChange={(event) => setEventName(event.target.value)}
              placeholder="A night people talk about"
            />
          </Field>
          <Field label="Starts">
            <input
              required
              type="datetime-local"
              value={eventStart}
              onChange={(event) => setEventStart(event.target.value)}
            />
          </Field>
          <Field label="Ends">
            <input
              required
              type="datetime-local"
              value={eventEnd}
              onChange={(event) => setEventEnd(event.target.value)}
            />
          </Field>
          <Button type="submit" disabled={busy || !items.length}>
            Save draft
          </Button>
        </form>
      </Card>
      <Card className="studio-card studio-card--accent">
        <span className="kicker">Next signal</span>
        <h2>Publish with confidence.</h2>
        <p>
          Add at least one session and ticket type, then Eventory will validate the release before
          it reaches the public discovery feed.
        </p>
        {message ? (
          <p className="form-success" role="status">
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
      </Card>
    </div>
  );
}
