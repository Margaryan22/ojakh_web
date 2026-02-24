import {
  Body,
  Controller,
  Delete,
  Get,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '../auth/jwt.guard';
import { CartService } from './cart.service';
import { AddCartItemDto } from './dto/add-cart-item.dto';

@ApiTags('cart')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  @ApiOperation({ summary: 'Get current user cart' })
  getCart(@Req() req: any) {
    return this.cartService.getCart(req.user.id);
  }

  @Post('items')
  @ApiOperation({ summary: 'Add or update cart item' })
  addOrUpdateItem(@Req() req: any, @Body() dto: AddCartItemDto) {
    return this.cartService.addOrUpdateItem(req.user.id, dto);
  }

  @Delete('items')
  @ApiOperation({ summary: 'Remove specific item from cart' })
  @ApiQuery({ name: 'product_id', required: true, type: Number })
  @ApiQuery({ name: 'flavor', required: false, type: String })
  @ApiQuery({ name: 'size', required: false, type: String })
  removeItem(
    @Req() req: any,
    @Query('product_id', ParseIntPipe) productId: number,
    @Query('flavor') flavor?: string,
    @Query('size') size?: string,
  ) {
    return this.cartService.removeItem(req.user.id, productId, flavor, size);
  }

  @Delete()
  @ApiOperation({ summary: 'Clear entire cart' })
  clearCart(@Req() req: any) {
    return this.cartService.clearCart(req.user.id);
  }
}
