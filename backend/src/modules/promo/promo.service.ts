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

  /**
   * Проверяет промокод без побочных эффектов: для превью скидки в корзине и
   * для расчёта скидки при оформлении. Использование НЕ засчитывается здесь —
   * оно учитывается только когда заказ реально оплачен (см. markUsed,
   * вызывается из PaymentsService при успешной оплате).
   */
  async validate(
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

    const promo = await this.prisma.promoCode.findUnique({ where: { code } });
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
      // «Использован» = был оплачен (paidAt проставляется при успешной оплате).
      const used = await this.prisma.order.count({
        where: { userId, promoCode: code, paidAt: { not: null } },
      });
      if (used > 0) return fail('Промокод уже использован');
    }

    const discountKopecks = this.computeDiscount(promo, subtotalKopecks);
    if (discountKopecks <= 0) return fail('Промокод не даёт скидки');
    return { valid: true, code, discountKopecks };
  }

  /**
   * Засчитывает использование промокода. Вызывается ровно один раз — когда
   * заказ перешёл в статус «оплачен» (PaymentsService.markSucceeded).
   * updateMany — чтобы не упасть, если код успели удалить из админки.
   */
  async markUsed(code: string): Promise<void> {
    await this.prisma.promoCode.updateMany({
      where: { code },
      data: { usedCount: { increment: 1 } },
    });
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
  private toData(
    dto: Partial<CreatePromoDto>,
  ): Prisma.PromoCodeUncheckedCreateInput {
    if (
      dto.type === 'percent' &&
      dto.value != null &&
      (dto.value < 1 || dto.value > 100)
    ) {
      throw new BadRequestException(
        'Для процентной скидки value должен быть 1..100',
      );
    }
    const data: Record<string, unknown> = {};
    if (dto.code !== undefined) data.code = dto.code.trim().toUpperCase();
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.value !== undefined) data.value = dto.value;
    if (dto.minOrderKopecks !== undefined)
      data.minOrderKopecks = dto.minOrderKopecks;
    if (dto.maxUses !== undefined) data.maxUses = dto.maxUses;
    if (dto.perUserOnce !== undefined) data.perUserOnce = dto.perUserOnce;
    if (dto.startsAt !== undefined)
      data.startsAt = dto.startsAt ? new Date(dto.startsAt) : null;
    if (dto.expiresAt !== undefined)
      data.expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
    if (dto.active !== undefined) data.active = dto.active;
    return data as Prisma.PromoCodeUncheckedCreateInput;
  }
}
