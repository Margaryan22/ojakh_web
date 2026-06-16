import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { YookassaService } from './yookassa/yookassa.service';
import { YookassaWebhookController } from './yookassa/yookassa-webhook.controller';
import { AuthModule } from '../auth/auth.module';
import { DeliveryModule } from '../delivery/delivery.module';
import { PromoModule } from '../promo/promo.module';

@Module({
  imports: [AuthModule, DeliveryModule, PromoModule],
  controllers: [PaymentsController, YookassaWebhookController],
  providers: [PaymentsService, YookassaService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
