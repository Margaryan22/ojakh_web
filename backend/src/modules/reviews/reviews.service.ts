import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { normalizePagination } from '../../common/dto/pagination.dto';
import { CreateReviewDto } from './dto/create-review.dto';

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Покупал ли пользователь товар: есть ли завершённый заказ, в items
   * которого (JSON-снапшот корзины) встречается этот product_id.
   */
  async hasPurchased(userId: number, productId: number): Promise<boolean> {
    const count = await this.prisma.order.count({
      where: {
        userId,
        status: 'completed',
        items: { array_contains: [{ product_id: productId }] },
      },
    });
    return count > 0;
  }

  async canReview(userId: number, productId: number) {
    return { allowed: await this.hasPurchased(userId, productId) };
  }

  async upsert(userId: number, dto: CreateReviewDto) {
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
      select: { id: true },
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Отзыв можно оставить только на купленный товар (защита от накрутки).
    if (!(await this.hasPurchased(userId, dto.productId))) {
      throw new ForbiddenException(
        'Отзывы могут оставлять только покупатели этого товара',
      );
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

  async list(productId: number, pagination: { page?: number; limit?: number } = {}) {
    const { page, limit, skip } = normalizePagination(pagination, { limit: 50 });

    const [reviews, total] = await this.prisma.$transaction([
      this.prisma.review.findMany({
        where: { productId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: { user: { select: { id: true, name: true } } },
      }),
      this.prisma.review.count({ where: { productId } }),
    ]);

    // Бейдж «Подтверждённая покупка»: одним запросом выясняем, кто из авторов
    // страницы имеет завершённый заказ с этим товаром. Старые отзывы могли
    // быть оставлены до введения правила «только покупатели».
    const authorIds = [...new Set(reviews.map((r) => r.userId))];
    const purchases = authorIds.length
      ? await this.prisma.order.findMany({
          where: {
            userId: { in: authorIds },
            status: 'completed',
            items: { array_contains: [{ product_id: productId }] },
          },
          select: { userId: true },
        })
      : [];
    const buyerIds = new Set(purchases.map((o) => o.userId));

    return {
      reviews: reviews.map((r) => ({
        ...r,
        verifiedPurchase: buyerIds.has(r.userId),
      })),
      total,
      page,
      limit,
    };
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
