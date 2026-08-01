import { randomUUID } from 'node:crypto';
import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

const requestIdPattern = /^[A-Za-z0-9._:-]{1,128}$/;

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(request: Request, response: Response, next: NextFunction): void {
    const candidate = request.header('x-request-id');
    const requestId = candidate && requestIdPattern.test(candidate) ? candidate : randomUUID();

    response.locals.requestId = requestId;
    response.setHeader('x-request-id', requestId);
    next();
  }
}
