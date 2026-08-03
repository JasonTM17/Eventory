'use client';

import { useEffect, useRef, useState } from 'react';
import { Button, Card, Field, StatusBadge } from '@eventory/ui';
import type { CheckInResponse } from '@eventory/contracts';
import { apiRequest, isApiError } from '../lib/api';

type BarcodeResult = { rawValue?: string };
type BarcodeDetectorInstance = { detect(source: HTMLVideoElement): Promise<BarcodeResult[]> };
type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => BarcodeDetectorInstance;

function resultTone(
  result: CheckInResponse['result'],
): 'neutral' | 'success' | 'warning' | 'danger' {
  if (result === 'VALID') return 'success';
  if (result === 'ALREADY_CHECKED_IN') return 'warning';
  return 'danger';
}

export function CheckInScanner(): React.JSX.Element {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const detectorRef = useRef<BarcodeDetectorInstance | null>(null);
  const [payload, setPayload] = useState('');
  const [eventSessionId, setEventSessionId] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraMessage, setCameraMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [response, setResponse] = useState<CheckInResponse | null>(null);
  const [error, setError] = useState('');

  useEffect(() => stopCamera, []);

  async function submit(value = payload): Promise<void> {
    const trimmed = value.trim();
    if (!trimmed) {
      setError('Paste or scan a signed QR payload first.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = await apiRequest<CheckInResponse>('/check-in', {
        method: 'POST',
        body: JSON.stringify({ qrPayload: trimmed, ...(eventSessionId ? { eventSessionId } : {}) }),
      });
      setResponse(result);
      setPayload('');
    } catch (requestError) {
      setResponse(null);
      setError(
        isApiError(requestError)
          ? (requestError.body.message ?? 'Scan rejected.')
          : 'API unavailable.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function startCamera(): Promise<void> {
    setCameraMessage('');
    const detectorConstructor = (
      window as Window & { BarcodeDetector?: BarcodeDetectorConstructor }
    ).BarcodeDetector;
    if (!detectorConstructor) {
      setCameraMessage('This browser cannot decode QR codes yet. Use the manual field below.');
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraMessage('Camera access is unavailable. Use the manual field below.');
      return;
    }
    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      detectorRef.current = new detectorConstructor({ formats: ['qr_code'] });
      if (!videoRef.current) return;
      videoRef.current.srcObject = streamRef.current;
      await videoRef.current.play();
      setCameraActive(true);
      scanFrame();
    } catch {
      stopCamera();
      setCameraMessage('Camera permission was not granted. Use the manual field below.');
    }
  }

  function stopCamera(): void {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    detectorRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
  }

  function scanFrame(): void {
    if (!detectorRef.current || !videoRef.current || !streamRef.current) return;
    void detectorRef.current
      .detect(videoRef.current)
      .then((results) => {
        const value = results.find((result) => result.rawValue)?.rawValue;
        if (value) {
          stopCamera();
          setPayload(value);
          void submit(value);
          return;
        }
        timerRef.current = setTimeout(scanFrame, 250);
      })
      .catch(() => {
        timerRef.current = setTimeout(scanFrame, 500);
      });
  }

  return (
    <div className="scanner-grid">
      <Card className="scanner-card scanner-card--camera">
        <div className="studio-card__header">
          <div>
            <span className="kicker">Live scanner</span>
            <h2>Validate the room.</h2>
          </div>
          <StatusBadge label="Online only" tone="warning" />
        </div>
        <div className="scanner-preview">
          {cameraActive ? (
            <video ref={videoRef} muted playsInline aria-label="QR scanner camera" />
          ) : (
            <span>Camera preview appears here</span>
          )}
        </div>
        <div className="scanner-actions">
          {cameraActive ? (
            <Button type="button" variant="secondary" onClick={stopCamera}>
              Stop camera
            </Button>
          ) : (
            <Button type="button" onClick={() => void startCamera()}>
              Start camera
            </Button>
          )}
          <span>Requires HTTPS or localhost and browser camera permission.</span>
        </div>
        {cameraMessage ? (
          <p className="form-error" role="status">
            {cameraMessage}
          </p>
        ) : null}
      </Card>
      <Card className="scanner-card">
        <div className="studio-card__header">
          <div>
            <span className="kicker">Manual fallback</span>
            <h2>Paste a signed code.</h2>
          </div>
        </div>
        <form
          className="stack-form"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <Field
            label="Event session (optional)"
            htmlFor="event-session-id"
            hint="If selected, a ticket from another session is rejected before mutation."
          >
            <input
              id="event-session-id"
              name="eventSessionId"
              value={eventSessionId}
              onChange={(event) => setEventSessionId(event.target.value)}
              placeholder="Session UUID…"
            />
          </Field>
          <Field label="QR payload" htmlFor="qr-payload">
            <textarea
              id="qr-payload"
              name="qrPayload"
              className="scanner-input"
              required
              rows={5}
              value={payload}
              onChange={(event) => setPayload(event.target.value)}
              placeholder="evtqr.1.1.…"
            />
          </Field>
          <Button type="submit" disabled={busy}>
            {busy ? 'Checking…' : 'Check in ticket'}
          </Button>
        </form>
        {response ? (
          <p
            className={`scanner-result scanner-result--${resultTone(response.result)}`}
            role="status"
          >
            <strong>{response.result.replace(/_/g, ' ')}</strong>
            <span>
              {response.ticketCode} · {response.ticketStatus}
            </span>
          </p>
        ) : null}
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        <p className="scanner-note">
          Offline scanning is intentionally not enabled yet: every scan must reach the API so the
          database uniqueness rule remains authoritative.
        </p>
      </Card>
    </div>
  );
}
