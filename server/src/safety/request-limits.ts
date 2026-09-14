import { HttpException, HttpStatus, Injectable, Module, ServiceUnavailableException, SetMetadata, UnauthorizedException, UseGuards, applyDecorators } from '@nestjs/common';
import type { CanActivate, ExecutionContext, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { DatabaseModule } from '../database/database.module';
import { PrismaService } from '../database/prisma.service';
import type { IdentityRequest } from '../auth/auth.identity';
type Budget = { scope: string; maximum: number; milliseconds: number };
const key = 'lantern-request-budget';
export async function consumeRequestWindow(tx: Prisma.TransactionClient, subject: string, budget: Budget, now = Date.now(), initialCount = 0) {
  const bucket = Math.floor(now / budget.milliseconds); const reset = (bucket + 1) * budget.milliseconds;
  const id = createHash('sha256').update(`${subject}\0${budget.scope}\0${bucket}`).digest('hex');
  const old = await tx.requestWindow.findUnique({ where: { id } }); const used = Math.max(old?.count ?? 0, initialCount);
  if (used >= budget.maximum) throw new HttpException({ code: 'REQUEST_LIMIT', retryAfterSeconds: Math.max(1, Math.ceil((reset - now) / 1000)), message: 'Please wait a little before trying again.' }, HttpStatus.TOO_MANY_REQUESTS);
  if (old) await tx.requestWindow.update({ where: { id }, data: { count: used + 1 } });
  else await tx.requestWindow.create({ data: { id, count: used + 1, expiresAt: new Date(reset) } });
}
@Injectable()
export class RequestLimits implements OnModuleInit, OnModuleDestroy {
  private timer: ReturnType<typeof setInterval> | undefined;
  constructor(private readonly prisma: PrismaService) {}
  onModuleInit() { this.timer = setInterval(() => { void this.prisma.requestWindow.deleteMany({ where: { expiresAt: { lt: new Date() } } }).catch(() => {}); }, 300_000); this.timer.unref(); }
  onModuleDestroy() { clearInterval(this.timer); }
  async consume(subject: string, budget: Budget, now = Date.now()) {
    for (let attempt = 0; attempt < 4; attempt++) {
      try { await this.prisma.$transaction(tx => consumeRequestWindow(tx, subject, budget, now), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 5000 }); return;
      } catch (error) {
        if (error instanceof HttpException) throw error;
        if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2002', 'P2034'].includes(error.code) && attempt < 3) continue;
        throw new ServiceUnavailableException({ code: 'REQUEST_CHECK_UNAVAILABLE', message: 'The palace post is resting. Please try again.' });
      }
    }
  }
}
@Injectable()
export class RequestLimitGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly limits: RequestLimits) {}
  async canActivate(context: ExecutionContext) {
    const budget = this.reflector.get<Budget>(key, context.getHandler()); if (!budget) return true;
    const identity = context.switchToHttp().getRequest<IdentityRequest>().lanternPostIdentity; if (!identity) throw new UnauthorizedException();
    try { await this.limits.consume(identity.subject, budget); return true; }
    catch (error) {
      if (error instanceof HttpException && error.getStatus() === 429) {
        const body = error.getResponse() as { retryAfterSeconds: number };
        const response = context.switchToHttp().getResponse<{ setHeader(name: string, value: string): void }>();
        response.setHeader('Retry-After', String(body.retryAfterSeconds)); response.setHeader('Cache-Control', 'no-store');
      }
      throw error;
    }
  }
}
export const RequestLimit = (scope: string, maximum: number, milliseconds = 60_000) => applyDecorators(SetMetadata(key, { scope, maximum, milliseconds }), UseGuards(RequestLimitGuard));
@Module({ imports: [DatabaseModule], providers: [RequestLimits, RequestLimitGuard], exports: [RequestLimits, RequestLimitGuard] })
export class RequestLimitsModule {}
