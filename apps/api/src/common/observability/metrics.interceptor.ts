import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';
import { MetricsService } from './metrics.service.js';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const startedAt = performance.now();
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const route = this.routeLabel(request, context);
    return next.handle().pipe(
      tap({
        next: () => this.record(request.method, route, response.statusCode, startedAt),
        error: (error: unknown) =>
          this.record(
            request.method,
            route,
            this.errorStatus(error, response.statusCode),
            startedAt,
          ),
      }),
    );
  }

  private record(method: string, route: string, status: number, startedAt: number): void {
    this.metrics.observeHttp(method, route, status, Math.max(0, performance.now() - startedAt));
  }

  private routeLabel(request: Request, context: ExecutionContext): string {
    return request.route?.path ?? `${context.getClass().name}.${context.getHandler().name}`;
  }

  private errorStatus(error: unknown, fallback: number): number {
    if (error && typeof error === 'object' && 'getStatus' in error) {
      const status = (error as { getStatus?: () => number }).getStatus?.();
      if (typeof status === 'number') return status;
    }
    return fallback >= 400 ? fallback : 500;
  }
}
