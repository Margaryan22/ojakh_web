import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PromoService } from './promo.service';
import { PromoController } from './promo.controller';
import { PromoAdminController } from './promo-admin.controller';

@Module({
  imports: [AuthModule],
  controllers: [PromoController, PromoAdminController],
  providers: [PromoService],
  exports: [PromoService],
})
export class PromoModule {}
