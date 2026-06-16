import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminGuard } from '../auth/admin.guard';
import { PromoService } from './promo.service';
import { CreatePromoDto } from './dto/create-promo.dto';
import { UpdatePromoDto } from './dto/update-promo.dto';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('admin/promo')
export class PromoAdminController {
  constructor(private readonly promo: PromoService) {}

  @Get()
  @ApiOperation({ summary: 'Список промокодов (admin only)' })
  list() {
    return this.promo.list();
  }

  @Post()
  @ApiOperation({ summary: 'Создать промокод (admin only)' })
  create(@Body() dto: CreatePromoDto) {
    return this.promo.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Обновить промокод (admin only)' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePromoDto) {
    return this.promo.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Удалить промокод (admin only)' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.promo.remove(id);
  }
}
