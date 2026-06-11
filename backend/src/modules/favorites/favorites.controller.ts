import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '../auth/jwt.guard';
import { FavoritesService } from './favorites.service';
import { MergeFavoritesDto } from './dto/merge-favorites.dto';

@ApiTags('favorites')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller('favorites')
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Get()
  @ApiOperation({ summary: 'Get current user favorites' })
  getFavorites(@Req() req: any) {
    return this.favoritesService.getFavorites(req.user.id);
  }

  // Должен быть объявлен до POST :productId, иначе "merge" матчится как параметр
  @Post('merge')
  @ApiOperation({ summary: 'Merge guest favorites into account after login' })
  merge(@Req() req: any, @Body() dto: MergeFavoritesDto) {
    return this.favoritesService.merge(req.user.id, dto.productIds);
  }

  @Post(':productId')
  @ApiOperation({ summary: 'Add product to favorites' })
  add(@Req() req: any, @Param('productId', ParseIntPipe) productId: number) {
    return this.favoritesService.add(req.user.id, productId);
  }

  @Delete(':productId')
  @ApiOperation({ summary: 'Remove product from favorites' })
  remove(@Req() req: any, @Param('productId', ParseIntPipe) productId: number) {
    return this.favoritesService.remove(req.user.id, productId);
  }
}
