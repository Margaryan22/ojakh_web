import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertAddressDto } from './dto/upsert-address.dto';

export const MAX_ADDRESSES_PER_USER = 5;

export interface AutoSaveAddressInput {
  userId: number;
  address: string;
  lat?: number | null;
  lon?: number | null;
  apartment?: string | null;
  entrance?: string | null;
  floor?: string | null;
  intercom?: string | null;
  notes?: string | null;
}

@Injectable()
export class AddressesService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: number) {
    return this.prisma.userAddress.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(userId: number, dto: UpsertAddressDto) {
    const count = await this.prisma.userAddress.count({ where: { userId } });
    if (count >= MAX_ADDRESSES_PER_USER) {
      throw new BadRequestException(
        `Можно сохранить не более ${MAX_ADDRESSES_PER_USER} адресов`,
      );
    }
    return this.prisma.userAddress.create({
      data: { userId, ...this.normalize(dto) },
    });
  }

  async update(userId: number, id: number, dto: UpsertAddressDto) {
    const existing = await this.prisma.userAddress.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Адрес не найден');
    if (existing.userId !== userId) throw new ForbiddenException();
    return this.prisma.userAddress.update({
      where: { id },
      data: this.normalize(dto),
    });
  }

  async remove(userId: number, id: number) {
    const existing = await this.prisma.userAddress.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Адрес не найден');
    if (existing.userId !== userId) throw new ForbiddenException();
    await this.prisma.userAddress.delete({ where: { id } });
    return { ok: true };
  }

  /**
   * Безопасное автосохранение из createOrder.
   * - Не падает (поглощает любые ошибки), не блокирует создание заказа.
   * - Дедуплицирует по точному совпадению строки address.
   * - При достижении лимита — молча не сохраняет (пользователь явно увидит
   *   на /profile/addresses, что место кончилось).
   */
  async autoSaveFromOrder(input: AutoSaveAddressInput): Promise<void> {
    try {
      const address = input.address.trim();
      if (!address) return;

      const existing = await this.prisma.userAddress.findFirst({
        where: { userId: input.userId, address },
      });
      if (existing) return;

      const count = await this.prisma.userAddress.count({
        where: { userId: input.userId },
      });
      if (count >= MAX_ADDRESSES_PER_USER) return;

      await this.prisma.userAddress.create({
        data: {
          userId: input.userId,
          address,
          lat: input.lat ?? null,
          lon: input.lon ?? null,
          apartment: input.apartment?.trim() || null,
          entrance: input.entrance?.trim() || null,
          floor: input.floor?.trim() || null,
          intercom: input.intercom?.trim() || null,
          notes: input.notes?.trim() || null,
        },
      });
    } catch {
      // intentionally swallow — auto-save is best-effort
    }
  }

  private normalize(dto: UpsertAddressDto) {
    return {
      label: dto.label?.trim() || null,
      address: dto.address.trim(),
      lat: dto.lat ?? null,
      lon: dto.lon ?? null,
      apartment: dto.apartment?.trim() || null,
      entrance: dto.entrance?.trim() || null,
      floor: dto.floor?.trim() || null,
      intercom: dto.intercom?.trim() || null,
      notes: dto.notes?.trim() || null,
    };
  }
}
