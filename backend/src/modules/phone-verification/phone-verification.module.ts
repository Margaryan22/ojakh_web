import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PhoneVerificationController } from './phone-verification.controller';
import { PhoneVerificationService } from './phone-verification.service';
import { TelegramGatewayService } from './telegram-gateway.service';
import { PerUserThrottlerGuard } from './per-user-throttler.guard';

@Module({
  imports: [AuthModule],
  controllers: [PhoneVerificationController],
  providers: [
    PhoneVerificationService,
    TelegramGatewayService,
    PerUserThrottlerGuard,
  ],
})
export class PhoneVerificationModule {}
