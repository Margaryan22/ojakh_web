import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AddCartItemDto } from './dto/add-cart-item.dto';

export interface CartItem {
  product_id: number;
  name: string;
  category: string;
  flavor?: string;
  size?: string;
  quantity: number;
  unit: string;
  price: number;    // kopecks per unit
  subtotal: number; // kopecks total
}

const TORT_CATEGORY = 'торты';
const MAX_TORTS_PER_CART = 2;

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
      const existingIndex = items.findIndex((i) => itemKey(i) === key);

      if (existingIndex >= 0) {
        // Update quantity
        items[existingIndex].quantity = dto.quantity;
        items[existingIndex].subtotal = dto.price * dto.quantity;
      } else {
        // Add new item — check tort limit
        if (dto.category === TORT_CATEGORY) {
          const currentTortCount = items.filter(
            (i) => i.category === TORT_CATEGORY,
          ).length;
          if (currentTortCount >= MAX_TORTS_PER_CART) {
            throw new BadRequestException(
              `You can only add up to ${MAX_TORTS_PER_CART} cake variants per order`,
            );
          }
        }

        items.push({
          product_id: dto.product_id,
          name: dto.name,
          category: dto.category,
          flavor: dto.flavor,
          size: dto.size,
          quantity: dto.quantity,
          unit: dto.unit,
          price: dto.price,
          subtotal: dto.price * dto.quantity,
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

  private calcSubtotal(items: CartItem[]): number {
    return items.reduce((sum, item) => sum + item.subtotal, 0);
  }
}
