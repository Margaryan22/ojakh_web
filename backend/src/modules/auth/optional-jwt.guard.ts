import { ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { JwtGuard } from './jwt.guard';

@Injectable()
export class OptionalJwtGuard extends JwtGuard {
  constructor(jwtService: JwtService, config: ConfigService) {
    super(jwtService, config);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      return await super.canActivate(context);
    } catch {
      // No token or invalid token — still allow access, just without user
      return true;
    }
  }
}
