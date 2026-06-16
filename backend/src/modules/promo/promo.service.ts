import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePromoDto } from './dto/create-promo.dto';
import { UpdatePromoDto } from './dto/update-promo.dto';

export interface PromoValidationResult {
  valid: boolean;
  code?: string;
  discountKopecks: number;
  reason?: string;
}

// Поддерживаем и обычный клиент, и клиент транзакции — чтобы проверять
// промокод как в превью корзины, так и атомарно при оформлении заказа.
type Client = PrismaService | Prisma.TransactionClient;

@Injectable()
export class PromoService {
  constructor(private readonly prisma: PrismaService) {}

  private computeDiscount(
    promo: { type: string; value: number },
    subtotalKopecks: number,
  ): number {
    const raw =
      promo.type === 'percent'
        ? Math.floor((subtotalKopecks * promo.value) / 100)
        : promo.value;
    // Скидка не может быть отрицательной и не превышает сумму товаров.
    return Math.min(Math.max(0, raw), subtotalKopecks);
  }

  private async validateWith(
    client: Client,
    rawCode: string,
    userId: number | null,
    subtotalKopecks: number,
  ): Promise<PromoValidationResult> {
    const code = (rawCode ?? '').trim().toUpperCase();
    const fail = (reason: string): PromoValidationResult => ({
      valid: false,
      discountKopecks: 0,
      reason,
    });
    if (!code) return fail('Введите промокод');

    const promo = await client.promoCode.findUnique({ where: { code } });
    if (!promo || !promo.active) return fail('Промокод не найден');

    const now = new Date();
    if (promo.startsAt && promo.startsAt > now)
      return fail('Промокод ещё не действует');
    if (promo.expiresAt && promo.expiresAt < now)
      return fail('Срок действия промокода истёк');
    if (subtotalKopecks < promo.minOrderKopecks)
      return fail(
        `Промокод действует от ${Math.round(promo.minOrderKopecks / 100)} ₽`,
      );
    if (promo.maxUses != null && promo.usedCount >= promo.maxUses)
      return fail('Промокод исчерпан');
    if (promo.perUserOnce && userId != null) {
      const used = await client.order.count({
        where: { userId, promoCode: code },
      });
      if (used > 0) return fail('Промокод уже использован');
    }

    const discountKopecks = this.computeDiscount(promo, subtotalKopecks);
    if (discountKopecks <= 0) return fail('Промокод не даёт скидки');
    return { valid: true, code, discountKopecks };
  }

  /** Проверка без побочных эффектов — для превью скидки в корзине. */
  validate(
    rawCode: string,
    userId: number | null,
    subtotalKopecks: number,
  ): Promise<PromoValidationResult> {
    return this.validateWith(this.prisma, rawCode, userId, subtotalKopecks);
  }

  /**
   * Внутри транзакции оформления заказа: повторно проверяет промокод и
   * атомарно «занимает» использование (guard по maxUses от гонок).
   * Бросает BadRequestException, если код стал недействителен.
   */
  async redeem(
    tx: Prisma.TransactionClient,
    rawCode: string,
    userId: number,
    subtotalKopecks: number,
  ): Promise<{ code: string; discountKopecks: number }> {
    const v = await this.validateWith(tx, rawCode, userId, subtotalKopecks);
    if (!v.valid || !v.code) {
      throw new BadRequestException(v.reason ?? 'Промокод недействителен');
    }
    const promo = await tx.promoCode.findUnique({ where: { code: v.code } });
    if (promo!.maxUses != null) {
      const res = await tx.promoCode.updateMany({
        where: { code: v.code, usedCount: { lt: promo!.maxUses } },
        data: { usedCount: { increment: 1 } },
      });
      if (res.count === 0) throw new BadRequestException('Промокод исчерпан');
    } else {
      await tx.promoCode.update({
        where: { code: v.code },
        data: { usedCount: { increment: 1 } },
      });
    }
    return { code: v.code, discountKopecks: v.discountKopecks };
  }

  // ── Admin CRUD ────────────────────────────────────────────────────────────
  list() {
    return this.prisma.promoCode.findMany({ orderBy: { createdAt: 'desc' } });
  }

  create(dto: CreatePromoDto) {
    return this.prisma.promoCode.create({ data: this.toData(dto) });
  }

  async update(id: number, dto: UpdatePromoDto) {
    await this.getOrThrow(id);
    return this.prisma.promoCode.update({
      where: { id },
      data: this.toData(dto),
    });
  }

  async remove(id: number) {
    await this.getOrThrow(id);
    await this.prisma.promoCode.delete({ where: { id } });
    return { ok: true };
  }

  private async getOrThrow(id: number) {
    const promo = await this.prisma.promoCode.findUnique({ where: { id } });
    if (!promo) throw new NotFoundException(`Промокод #${id} не найден`);
    return promo;
  }

  // Нормализация полей формы → данные Prisma (только переданные поля).
  private toData(dto: Partial<CreatePromoDto>): Prisma.PromoCodeUncheckedCreateInput {
    if (dto.type === 'percent' && dto.value != null && (dto.value < 1 || dto.value > 100)) {
      throw new BadRequestException('Для процентной скидки value должен быть 1..100');
    }
    const data: Record<string, unknown> = {};
    if (dto.code !== undefined) data.code = dto.code.trim().toUpperCase();
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.value !== undefined) data.value = dto.value;
    if (dto.minOrderKopecks !== undefined) data.minOrderKopecks = dto.minOrderKopecks;
    if (dto.maxUses !== undefined) data.maxUses = dto.maxUses;
    if (dto.perUserOnce !== undefined) data.perUserOnce = dto.perUserOnce;
    if (dto.startsAt !== undefined) data.startsAt = dto.startsAt ? new Date(dto.startsAt) : null;
    if (dto.expiresAt !== undefined) data.expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
    if (dto.active !== undefined) data.active = dto.active;
    return data as Prisma.PromoCodeUncheckedCreateInput;
  }
}
