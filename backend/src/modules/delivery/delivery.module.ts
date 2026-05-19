import { Module } from '@nestjs/common';
import { DeliveryService } from './delivery.service';
import { DeliveryController } from './delivery.controller';
import { AuthModule } from '../auth/auth.module';
import { CartModule } from '../cart/cart.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { DeliveryClaimsService } from './claims/delivery-claims.service';
import { DeliveryClaimsController } from './claims/delivery-claims.controller';
import { TwoGisService } from './two-gis.service';
import { DaDataCleanerService } from './dadata-cleaner.service';
import { BuildingInfoService } from './building-info.service';
import { AddressVerifierService } from './address-verifier.service';

@Module({
  imports: [AuthModule, CartModule, NotificationsModule],
  controllers: [DeliveryController, DeliveryClaimsController],
  providers: [
    DeliveryService,
    DeliveryClaimsService,
    TwoGisService,
    DaDataCleanerService,
    BuildingInfoService,
    AddressVerifierService,
  ],
  exports: [
    DeliveryService,
    DeliveryClaimsService,
    TwoGisService,
    DaDataCleanerService,
    BuildingInfoService,
    AddressVerifierService,
  ],
})
export class DeliveryModule {}
