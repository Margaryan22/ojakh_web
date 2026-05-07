import {
  BadRequestException,
  Controller,
  Get,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '../auth/jwt.guard';
import { OptionalJwtGuard } from '../auth/optional-jwt.guard';
import { CartService } from '../cart/cart.service';
import { DeliveryService, CheckDateOpts } from './delivery.service';
import { TORT_CATEGORY } from '../../common/constants';

@ApiTags('delivery')
@ApiBearerAuth()
@UseGuards(OptionalJwtGuard)
@Controller('delivery')
export class DeliveryController {
  constructor(
    private readonly deliveryService: DeliveryService,
    private readonly cartService: CartService,
  ) {}

  @Get('check-date')
  @ApiOperation({ summary: 'Check date availability for delivery' })
  @ApiQuery({ name: 'date', required: true, example: '2026-03-01' })
  @ApiQuery({ name: 'with_tort', required: false, type: Boolean })
  @ApiQuery({ name: 'extra_units', required: false, type: Number })
  @ApiQuery({ name: 'extra_torts', required: false, type: Number })
  async checkDate(
    @Req() req: any,
    @Query('date') date: string,
    @Query('with_tort') withTort?: string,
    @Query('extra_units') extraUnits?: string,
    @Query('extra_torts') extraTorts?: string,
  ) {
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new BadRequestException('Дата должна быть в формате ГГГГ-ММ-ДД');
    }

    const opts = await this.resolveOpts(req, withTort, extraUnits, extraTorts);
    return this.deliveryService.checkDate(date, opts);
  }

  @Get('calendar')
  @ApiOperation({ summary: 'Get availability for all upcoming delivery dates' })
  @ApiQuery({ name: 'with_tort', required: false, type: Boolean })
  @ApiQuery({ name: 'extra_units', required: false, type: Number })
  @ApiQuery({ name: 'extra_torts', required: false, type: Number })
  async getCalendar(
    @Req() req: any,
    @Query('with_tort') withTort?: string,
    @Query('extra_units') extraUnits?: string,
    @Query('extra_torts') extraTorts?: string,
  ) {
    const opts = await this.resolveOpts(req, withTort, extraUnits, extraTorts);
    return this.deliveryService.getCalendar(opts);
  }

  @Get('cost')
  @ApiOperation({ summary: 'Get delivery cost estimate (Yandex Delivery API)' })
  @ApiQuery({ name: 'address', required: false, example: 'Нижний Новгород, ул. Большая Покровская 1' })
  getDeliveryCost(@Query('address') address?: string) {
    return this.deliveryService.getDeliveryCost(address);
  }

  @Get('suggest-address')
  @UseGuards(JwtGuard)
  @ApiOperation({ summary: 'Address autocomplete via server-side DaData proxy' })
  @ApiQuery({ name: 'q', required: true })
  suggestAddress(@Query('q') q?: string) {
    return this.deliveryService.suggestAddress(q ?? '');
  }

  /**
   * If user is authenticated → derive units/torts from their server-side cart (trusted source).
   * Otherwise → fall back to client-supplied query params (guest cart in localStorage).
   * with_tort is also derived from the cart for authenticated users.
   */
  private async resolveOpts(
    req: any,
    withTortRaw: string | undefined,
    extraUnitsRaw: string | undefined,
    extraTortsRaw: string | undefined,
  ): Promise<CheckDateOpts> {
    const userId: number | undefined = req?.user?.id;

    if (userId) {
      const cart = await this.cartService.getCart(userId);
      let unitCount = 0;
      let tortCount = 0;
      for (const item of cart.items) {
        unitCount += Number(item.quantity) || 0;
        if (item.category === TORT_CATEGORY) tortCount += 1;
      }
      return {
        withTort: tortCount > 0,
        extraUnits: unitCount,
        extraTorts: tortCount,
      };
    }

    const extraUnits = Math.max(0, Number(extraUnitsRaw) || 0);
    const extraTorts = Math.max(0, Number(extraTortsRaw) || 0);
    const withTort =
      withTortRaw === 'true' || withTortRaw === '1' || extraTorts > 0;

    return { withTort, extraUnits, extraTorts };
  }
}
