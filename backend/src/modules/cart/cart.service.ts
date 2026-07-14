import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import {
  TORT_CATEGORY,
  MAX_TORTS,
  MAX_ITEM_QTY_PER_CART,
} from '../../common/constants';

export interface CartItem {
  product_id: number;
  name: string;
  category: string;
  flavor?: string;
  size?: string;
  quantity: number;
  unit: string;
  price: number;       // kopecks per unit
  subtotal: number;    // kopecks total
  maxPerCart?: number; // max quantity per cart
}

function itemKey(item: { product_id: number; flavor?: string; size?: string }): string {
  return `${item.product_id}:${item.flavor ?? ''}:${item.size ?? ''}`;
}

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  async getCart(userId: number) {
    const cart = await this.prisma.cart.findUnique({ where: { userId } });
    if (!cart) {
      return { userId, items: [] as CartItem[], subtotal: 0 };
    }
    const items = cart.items as unknown as CartItem[];
    return {
      userId,
      items,
      subtotal: this.calcSubtotal(items),
    };
  }

  async addOrUpdateItem(userId: number, dto: AddCartItemDto) {
    const cart = await this.prisma.cart.findUnique({ where: { userId } });
    let items: CartItem[] = cart ? (cart.items as unknown as CartItem[]) : [];

    const key = itemKey(dto);

    if (dto.quantity === 0) {
      // Remove item
      items = items.filter((i) => itemKey(i) !== key);
    } else {
      // Название, категория, единица и цена берутся из БД, а не из запроса —
      // клиентским значениям доверять нельзя (подмена цены).
      const product = await this.prisma.product.findUnique({
        where: { id: dto.product_id },
      });
      if (!product || !product.available) {
        throw new BadRequestException('Товар недоступен для заказа');
      }

      const maxPerCart = this.maxPerCart(product);
      const existingIndex = items.findIndex((i) => itemKey(i) === key);

      if (existingIndex >= 0) {
        // Sum quantity
        const newQuantity = items[existingIndex].quantity + dto.quantity;
        if (newQuantity > maxPerCart) {
          throw new BadRequestException(
            `Максимум ${maxPerCart} ${product.unit} для "${product.name}" в одной корзине`,
          );
        }
        items[existingIndex] = {
          ...items[existingIndex],
          name: product.name,
          category: product.category,
          unit: product.unit,
          price: product.price,
          quantity: newQuantity,
          subtotal: product.price * newQuantity,
          maxPerCart,
        };
      } else {
        // Add new item — check tort limit
        if (product.category === TORT_CATEGORY) {
          const currentTortCount = items.filter(
            (i) => i.category === TORT_CATEGORY,
          ).length;
          if (currentTortCount >= MAX_TORTS) {
            throw new BadRequestException(
              `В одном заказе может быть не более ${MAX_TORTS} вариантов торта`,
            );
          }
        }
        if (dto.quantity > maxPerCart) {
          throw new BadRequestException(
            `Максимум ${maxPerCart} ${product.unit} для "${product.name}" в одной корзине`,
          );
        }

        items.push({
          product_id: product.id,
          name: product.name,
          category: product.category,
          flavor: product.flavor ?? dto.flavor,
          size: product.size ?? dto.size,
          quantity: dto.quantity,
          unit: product.unit,
          price: product.price,
          subtotal: product.price * dto.quantity,
          maxPerCart,
        });
      }
    }

    const updatedCart = await this.prisma.cart.upsert({
      where: { userId },
      create: { userId, items: items as any },
      update: { items: items as any },
    });

    return {
      userId,
      items: updatedCart.items as unknown as CartItem[],
      subtotal: this.calcSubtotal(updatedCart.items as unknown as CartItem[]),
    };
  }

  async setItemQuantity(userId: number, dto: AddCartItemDto) {
    const cart = await this.prisma.cart.findUnique({ where: { userId } });
    let items: CartItem[] = cart ? (cart.items as unknown as CartItem[]) : [];

    const key = itemKey(dto);

    if (dto.quantity === 0) {
      items = items.filter((i) => itemKey(i) !== key);
    } else {
      const existingIndex = items.findIndex((i) => itemKey(i) === key);
      if (existingIndex >= 0) {
        const item = items[existingIndex];
        const limit = item.maxPerCart ?? MAX_ITEM_QTY_PER_CART;
        if (dto.quantity > limit) {
          throw new BadRequestException(
            `Максимум ${limit} ${item.unit} для "${item.name}" в одной корзине`,
          );
        }
        // Цена уже записана сервером из БД — пересчитываем только subtotal.
        items[existingIndex].quantity = dto.quantity;
        items[existingIndex].subtotal = item.price * dto.quantity;
      }
    }

    const updatedCart = await this.prisma.cart.upsert({
      where: { userId },
      create: { userId, items: items as any },
      update: { items: items as any },
    });

    return {
      userId,
      items: updatedCart.items as unknown as CartItem[],
      subtotal: this.calcSubtotal(updatedCart.items as unknown as CartItem[]),
    };
  }

  async removeItem(
    userId: number,
    productId: number,
    flavor?: string,
    size?: string,
  ) {
    const cart = await this.prisma.cart.findUnique({ where: { userId } });
    if (!cart) {
      return { userId, items: [], subtotal: 0 };
    }

    const key = itemKey({ product_id: productId, flavor, size });
    const items = (cart.items as unknown as CartItem[]).filter(
      (i) => itemKey(i) !== key,
    );

    const updated = await this.prisma.cart.update({
      where: { userId },
      data: { items: items as any },
    });

    return {
      userId,
      items: updated.items as unknown as CartItem[],
      subtotal: this.calcSubtotal(updated.items as unknown as CartItem[]),
    };
  }

  async clearCart(userId: number) {
    await this.prisma.cart.upsert({
      where: { userId },
      create: { userId, items: [] },
      update: { items: [] },
    });
    return { userId, items: [], subtotal: 0 };
  }

  /**
   * Полностью заменяет содержимое корзины. Используется сервисом заказов
   * при пересверке цен: если цена товара изменилась, корзина обновляется
   * актуальными значениями из БД.
   */
  async replaceItems(userId: number, items: CartItem[]) {
    await this.prisma.cart.upsert({
      where: { userId },
      create: { userId, items: items as any },
      update: { items: items as any },
    });
    return { userId, items, subtotal: this.calcSubtotal(items) };
  }

  /**
   * Лимит количества одной позиции в корзине. Для тортов — не более MAX_TORTS
   * единиц (можно заказывать половинками), для остального — жёсткий потолок
   * MAX_ITEM_QTY_PER_CART; в обоих случаях не выше product.maxPerDay.
   * Зеркалит клиентскую логику (frontend/components/products/add-to-cart-dialog.tsx).
   */
  private maxPerCart(product: { category: string; maxPerDay: number }): number {
    const cap = product.category === TORT_CATEGORY ? MAX_TORTS : MAX_ITEM_QTY_PER_CART;
    return Math.min(product.maxPerDay, cap);
  }

  private calcSubtotal(items: CartItem[]): number {
    return items.reduce((sum, item) => sum + item.subtotal, 0);
  }
}
