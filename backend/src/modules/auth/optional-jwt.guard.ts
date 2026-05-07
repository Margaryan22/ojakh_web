import { ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { JwtGuard } from './jwt.guard';

/**
 * - no Authorization header → allow as guest (no req.user)
 * - header present but token invalid → 401 (a forged/stale token must
 *   surface as an error so callers cannot silently treat the request
 *   as a guest and skip auth checks).
 */
@Injectable()
export class OptionalJwtGuard extends JwtGuard {
  constructor(jwtService: JwtService, config: ConfigService) {
    super(jwtService, config);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const authHeader: string | undefined = req.headers['authorization'];
    if (!authHeader) return true;
    return await super.canActivate(context);
  }
}
