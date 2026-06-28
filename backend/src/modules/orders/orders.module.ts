import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersSchedulerService } from './orders.scheduler';
import { OrdersController } from './orders.controller';
import { AuthModule } from '../auth/auth.module';
import { CartModule } from '../cart/cart.module';
import { DeliveryModule } from '../delivery/delivery.module';
import { PaymentsModule } from '../payments/payments.module';
import { AddressesModule } from '../addresses/addresses.module';
import { SettingsModule } from '../settings/settings.module';
import { PromoModule } from '../promo/promo.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [AuthModule, CartModule, DeliveryModule, PaymentsModule, AddressesModule, SettingsModule, PromoModule, NotificationsModule],
  controllers: [OrdersController],
  providers: [OrdersService, OrdersSchedulerService],
  exports: [OrdersService],
})
export class OrdersModule {}
