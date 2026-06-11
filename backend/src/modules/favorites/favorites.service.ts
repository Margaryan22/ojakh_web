import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FavoritesService {
  constructor(private readonly prisma: PrismaService) {}

  async getFavorites(userId: number) {
    const favorites = await this.prisma.favorite.findMany({
      where: { userId },
      include: { product: true },
      orderBy: { createdAt: 'asc' },
    });
    return { items: favorites.map((f) => f.product) };
  }

  async add(userId: number, productId: number) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      throw new NotFoundException('Товар не найден');
    }

    await this.prisma.favorite.upsert({
      where: { userId_productId: { userId, productId } },
      create: { userId, productId },
      update: {},
    });

    return this.getFavorites(userId);
  }

  async remove(userId: number, productId: number) {
    await this.prisma.favorite.deleteMany({ where: { userId, productId } });
    return this.getFavorites(userId);
  }

  // Перенос гостевого избранного в аккаунт после логина:
  // несуществующие товары молча пропускаются, дубликаты игнорируются.
  async merge(userId: number, productIds: number[]) {
    if (productIds.length > 0) {
      const existing = await this.prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true },
      });
      if (existing.length > 0) {
        await this.prisma.favorite.createMany({
          data: existing.map(({ id }) => ({ userId, productId: id })),
          skipDuplicates: true,
        });
      }
    }
    return this.getFavorites(userId);
  }
}
