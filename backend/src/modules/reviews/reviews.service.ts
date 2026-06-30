import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async upsert(userId: number, dto: CreateReviewDto) {
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
      select: { id: true },
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return this.prisma.review.upsert({
      where: { userId_productId: { userId, productId: dto.productId } },
      create: {
        userId,
        productId: dto.productId,
        rating: dto.rating,
        text: dto.text,
      },
      update: {
        rating: dto.rating,
        text: dto.text,
      },
      include: { user: { select: { id: true, name: true } } },
    });
  }

  async remove(userId: number, reviewId: number) {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
      select: { userId: true },
    });
    if (!review) {
      throw new NotFoundException('Review not found');
    }
    if (review.userId !== userId) {
      throw new ForbiddenException('You can delete only your own review');
    }
    await this.prisma.review.delete({ where: { id: reviewId } });
    return { ok: true };
  }

  list(productId: number) {
    return this.prisma.review.findMany({
      where: { productId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { user: { select: { id: true, name: true } } },
    });
  }

  /** Все отзывы для модерации в админке (с автором и товаром), новые сверху. */
  listAllForAdmin({ limit, offset }: { limit: number; offset: number }) {
    return this.prisma.review.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        user: { select: { id: true, name: true, email: true } },
        product: { select: { id: true, name: true } },
      },
    });
  }

  /** Удаление любого отзыва администратором (модерация). */
  async removeAsAdmin(reviewId: number) {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
      select: { id: true },
    });
    if (!review) {
      throw new NotFoundException('Review not found');
    }
    await this.prisma.review.delete({ where: { id: reviewId } });
    return { ok: true };
  }

  async summary(productId: number) {
    const result = await this.prisma.review.aggregate({
      where: { productId },
      _avg: { rating: true },
      _count: { _all: true },
    });
    return {
      average: result._avg.rating,
      count: result._count._all,
    };
  }
}
