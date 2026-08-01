import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export interface TicketQrMaterial {
  publicCode: string;
  eventSessionId: string;
  qrNonce: string;
  qrKeyVersion: number;
}

export interface VerifiedTicketQr {
  version: 1;
  keyVersion: number;
  publicCode: string;
  sessionBinding: string;
  qrNonce: string;
}

const QR_PREFIX = 'evtqr';
const QR_VERSION = 1;

@Injectable()
export class TicketQrService {
  constructor(private readonly config: ConfigService) {}

  createPayload(material: TicketQrMaterial): string {
    const keyVersion = this.config.getOrThrow<number>('QR_KEY_VERSION');
    if (material.qrKeyVersion !== keyVersion) {
      throw new BadRequestException({
        code: 'QR_KEY_VERSION_UNSUPPORTED',
        message: 'This ticket uses an unsupported QR signing key version',
      });
    }

    const publicCode = this.normalizePublicCode(material.publicCode);
    const sessionBinding = this.sessionBinding(material.eventSessionId);
    const nonce = this.normalizeNonce(material.qrNonce);
    const body = [QR_PREFIX, QR_VERSION, keyVersion, publicCode, sessionBinding, nonce].join('.');
    return `${body}.${this.sign(body, keyVersion)}`;
  }

  verifyPayload(rawPayload: string): VerifiedTicketQr | null {
    const parts = rawPayload.trim().split('.');
    if (parts.length !== 7) return null;

    const [prefix, versionValue, keyVersionValue, publicCode, sessionBinding, qrNonce, signature] =
      parts;
    if (prefix !== QR_PREFIX || versionValue !== String(QR_VERSION)) return null;
    const keyVersion = Number(keyVersionValue);
    if (!Number.isInteger(keyVersion) || keyVersion < 1 || keyVersion > 100) return null;
    if (!publicCode || !/^[A-Z0-9-]{8,40}$/.test(publicCode)) return null;
    if (!sessionBinding || !/^[A-Za-z0-9_-]{20,64}$/.test(sessionBinding)) return null;
    if (!qrNonce || !/^[A-Za-z0-9_-]{16,80}$/.test(qrNonce)) return null;
    if (!signature || !/^[A-Za-z0-9_-]{40,64}$/.test(signature)) return null;

    const configuredVersion = this.config.getOrThrow<number>('QR_KEY_VERSION');
    if (keyVersion !== configuredVersion) return null;

    const body = [prefix, QR_VERSION, keyVersion, publicCode, sessionBinding, qrNonce].join('.');
    const expected = Buffer.from(this.sign(body, keyVersion));
    const actual = Buffer.from(signature);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

    return {
      version: QR_VERSION,
      keyVersion,
      publicCode,
      sessionBinding,
      qrNonce,
    };
  }

  sessionBinding(eventSessionId: string): string {
    return createHash('sha256').update(eventSessionId).digest('base64url').slice(0, 32);
  }

  private sign(body: string, keyVersion: number): string {
    if (keyVersion !== this.config.getOrThrow<number>('QR_KEY_VERSION')) {
      throw new BadRequestException({
        code: 'QR_KEY_VERSION_UNSUPPORTED',
        message: 'This ticket uses an unsupported QR signing key version',
      });
    }
    return createHmac('sha256', this.config.getOrThrow<string>('QR_SIGNING_SECRET'))
      .update(body)
      .digest('base64url');
  }

  private normalizePublicCode(value: string): string {
    const publicCode = value.trim().toUpperCase();
    if (!/^[A-Z0-9-]{8,40}$/.test(publicCode)) {
      throw new BadRequestException({
        code: 'TICKET_CODE_INVALID',
        message: 'Ticket code is invalid',
      });
    }
    return publicCode;
  }

  private normalizeNonce(value: string): string {
    const nonce = value.trim();
    if (!/^[A-Za-z0-9_-]{16,80}$/.test(nonce)) {
      throw new BadRequestException({
        code: 'QR_NONCE_INVALID',
        message: 'QR nonce is invalid',
      });
    }
    return nonce;
  }
}
