import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';

@Injectable()
export class EmailService implements OnModuleDestroy {
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(config: ConfigService) {
    this.from = config.getOrThrow<string>('MAIL_FROM');
    this.transporter = nodemailer.createTransport({
      host: config.getOrThrow<string>('MAILPIT_HOST'),
      port: config.getOrThrow<number>('MAILPIT_PORT'),
      secure: false,
      connectionTimeout: 2_000,
      greetingTimeout: 2_000,
      socketTimeout: 4_000,
    });
  }

  async send(input: { recipient: string; subject: string; text: string }): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to: input.recipient,
      subject: input.subject,
      text: input.text,
    });
  }

  onModuleDestroy(): void {
    this.transporter.close();
  }
}
