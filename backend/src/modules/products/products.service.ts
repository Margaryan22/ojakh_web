import { Injectable, NotFoundException } from '@nestjs/common';
import { Product } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TtlCache } from '../../common/ttl-cache';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { QueryProductsDto } from './dto/query-products.dto';

// Каталог читается на каждый заход в магазин, а меняется только из админки —
// 60с кэша снимают основную нагрузку с БД, инвалидация при мутациях мгновенная.
const CACHE_TTL_MS = 60_000;

@Injectable()
export class ProductsService {
  private readonly listCache = new TtlCache<Product[]>(CACHE_TTL_MS);
  private readonly itemCache = new TtlCache<Product>(CACHE_TTL_MS);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: QueryProductsDto) {
    // Поисковые запросы не кэшируем: пространство ключей неограниченно,
    // а выигрыш минимален. Кэш — только для «горячих» списков каталога.
    const searchTerm = query.search?.trim();
    const cacheKey = searchTerm
      ? null
      : `${query.category ?? '*'}:${query.available ?? '*'}:${query.sort ?? '*'}`;
    if (cacheKey) {
      const cached = this.listCache.get(cacheKey);
      if (cached) return cached;
    }

    const where: any = {};

    if (query.category !== undefined) {
      where.category = query.category;
    }

    if (query.available !== undefined) {
      where.available = query.available;
    }

    if (searchTerm) {
      where.OR = [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { flavor: { contains: searchTerm, mode: 'insensitive' } },
        { description: { contains: searchTerm, mode: 'insensitive' } },
      ];
    }

    // «Новинки» — по id: у Product нет createdAt, autoincrement id монотонен.
    const orderBy =
      query.sort === 'price_asc'
        ? [{ price: 'asc' as const }, { name: 'asc' as const }]
        : query.sort === 'price_desc'
          ? [{ price: 'desc' as const }, { name: 'asc' as const }]
          : query.sort === 'new'
            ? [{ id: 'desc' as const }]
            : [{ category: 'asc' as const }, { name: 'asc' as const }];

    const products = await this.prisma.product.findMany({ where, orderBy });
    if (cacheKey) {
      this.listCache.set(cacheKey, products);
    }
    return products;
  }

  async findOne(id: number) {
    const cached = this.itemCache.get(String(id));
    if (cached) return cached;

    const product = await this.prisma.product.findUnique({ where: { id } });

    if (!product) {
      throw new NotFoundException(`Product #${id} not found`);
    }

    this.itemCache.set(String(id), product);
    return product;
  }

  async create(dto: CreateProductDto) {
    const product = await this.prisma.product.create({ data: dto });
    this.invalidateCache();
    return product;
  }

  async update(id: number, dto: UpdateProductDto) {
    await this.exists(id);
    const product = await this.prisma.product.update({ where: { id }, data: dto });
    this.invalidateCache();
    return product;
  }

  async remove(id: number) {
    await this.exists(id);
    // Soft delete: товар скрывается из каталога, но сохраняется в БД,
    // чтобы не оборвать связанные отзывы (FK on Review с onDelete: Cascade)
    // и snapshot-копии в исторических заказах.
    const product = await this.prisma.product.update({
      where: { id },
      data: { available: false },
    });
    this.invalidateCache();
    return product;
  }

  private async exists(id: number) {
    // Мутации проверяют существование напрямую в БД, минуя кэш.
    const product = await this.prisma.product.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!product) {
      throw new NotFoundException(`Product #${id} not found`);
    }
  }

  private invalidateCache() {
    this.listCache.clear();
    this.itemCache.clear();
  }
}
