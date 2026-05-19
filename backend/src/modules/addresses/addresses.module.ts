import { Module } from '@nestjs/common';
import { AddressesService } from './addresses.service';
import { AddressesController } from './addresses.controller';
import { AuthModule } from '../auth/auth.module';
import { DeliveryModule } from '../delivery/delivery.module';

@Module({
  imports: [AuthModule, DeliveryModule],
  controllers: [AddressesController],
  providers: [AddressesService],
  exports: [AddressesService],
})
export class AddressesModule {}
