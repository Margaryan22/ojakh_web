import { Module } from '@nestjs/common';
import { DeliveryService } from './delivery.service';
import { DeliveryController } from './delivery.controller';
import { AuthModule } from '../auth/auth.module';
import { CartModule } from '../cart/cart.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { DeliveryClaimsService } from './claims/delivery-claims.service';
import { DeliveryClaimsController } from './claims/delivery-claims.controller';

@Module({
  imports: [AuthModule, CartModule, NotificationsModule],
  controllers: [DeliveryController, DeliveryClaimsController],
  providers: [DeliveryService, DeliveryClaimsService],
  exports: [DeliveryService, DeliveryClaimsService],
})
export class DeliveryModule {}
