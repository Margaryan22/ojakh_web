import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class PerUserThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const userId = req.user?.id;
    if (userId) return `user:${userId}`;
    const ip = req.ip ?? req.ips?.[0] ?? 'unknown';
    return `ip:${ip}`;
  }
}
