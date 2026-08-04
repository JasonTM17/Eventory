import assert from 'node:assert/strict';
import test from 'node:test';
import { destinationAfterAuth } from './auth-navigation';

test('keeps a safe local destination after authentication', () => {
  assert.equal(
    destinationAfterAuth('/events/night/seats/session-1', 'ATTENDEE'),
    '/events/night/seats/session-1',
  );
});

test('rejects protocol-relative destinations', () => {
  assert.equal(destinationAfterAuth('//malicious.example', 'ATTENDEE'), '/events');
  assert.equal(destinationAfterAuth('/\\malicious.example', 'ATTENDEE'), '/events');
  assert.equal(destinationAfterAuth('/%5C%5Cmalicious.example', 'ATTENDEE'), '/events');
});

test('routes each role to its relevant home', () => {
  assert.equal(destinationAfterAuth(undefined, 'ATTENDEE'), '/events');
  assert.equal(destinationAfterAuth(undefined, 'ORGANIZER'), '/organizer');
  assert.equal(destinationAfterAuth(undefined, 'ADMIN'), '/admin');
});
