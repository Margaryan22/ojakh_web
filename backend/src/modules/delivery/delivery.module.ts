import { Module } from '@nestjs/common';
import { DeliveryService } from './delivery.service';
import { DeliveryController } from './delivery.controller';
import { AuthModule } from '../auth/auth.module';
import { CartModule } from '../cart/cart.module';

@Module({
  imports: [AuthModule, CartModule],
  controllers: [DeliveryController],
  providers: [DeliveryService],
  exports: [DeliveryService],
})
export class DeliveryModule {}
