import { Controller, Get, Header, Headers, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Public } from '../auth/auth.decorators.js';
import { MetricsService } from './metrics.service.js';

@Controller('metrics')
@Public()
export class MetricsController {
  constructor(
    private readonly metrics: MetricsService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  async scrape(@Headers('x-metrics-token') token?: string): Promise<string> {
    const configuredToken = this.config.getOrThrow<string>('METRICS_TOKEN');
    if (
      this.config.getOrThrow<string>('NODE_ENV') === 'production' &&
      (!configuredToken || token !== configuredToken)
    ) {
      throw new UnauthorizedException({
        code: 'METRICS_AUTH_REQUIRED',
        message: 'Metrics authentication is required',
      });
    }
    return this.metrics.render();
  }
}
