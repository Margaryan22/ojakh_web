import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OrderMessagesController } from './order-messages.controller';
import { OrderMessagesService } from './order-messages.service';
import { PerUserThrottlerGuard } from './per-user-throttler.guard';

@Module({
  imports: [AuthModule],
  controllers: [OrderMessagesController],
  providers: [OrderMessagesService, PerUserThrottlerGuard],
})
export class OrderMessagesModule {}
