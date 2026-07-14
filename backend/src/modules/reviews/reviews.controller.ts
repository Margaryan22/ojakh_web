import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '../auth/jwt.guard';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';

@ApiTags('reviews')
@Controller()
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post('reviews')
  @ApiBearerAuth()
  @UseGuards(JwtGuard)
  @ApiOperation({ summary: 'Create or update a review for a product' })
  upsert(@Req() req: any, @Body() dto: CreateReviewDto) {
    return this.reviewsService.upsert(req.user.id, dto);
  }

  @Delete('reviews/:id')
  @ApiBearerAuth()
  @UseGuards(JwtGuard)
  @ApiOperation({ summary: 'Delete own review' })
  remove(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.reviewsService.remove(req.user.id, id);
  }

  @Get('products/:productId/reviews')
  @ApiOperation({ summary: 'List reviews for a product (paginated, newest first)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  list(
    @Param('productId', ParseIntPipe) productId: number,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.reviewsService.list(productId, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('products/:productId/reviews/summary')
  @ApiOperation({ summary: 'Average rating and count for a product' })
  summary(@Param('productId', ParseIntPipe) productId: number) {
    return this.reviewsService.summary(productId);
  }

  @Get('products/:productId/reviews/can-review')
  @ApiBearerAuth()
  @UseGuards(JwtGuard)
  @ApiOperation({
    summary: 'Может ли текущий пользователь оставить отзыв (покупал ли товар)',
  })
  canReview(
    @Req() req: any,
    @Param('productId', ParseIntPipe) productId: number,
  ) {
    return this.reviewsService.canReview(req.user.id, productId);
  }
}
