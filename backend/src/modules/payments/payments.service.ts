import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import { DeliveryClaimsService } from '../delivery/claims/delivery-claims.service';
import {
  YookassaService,
  YookassaPayment,
  ReceiptLine,
} from './yookassa/yookassa.service';
import type { CartItem } from '../cart/cart.service';

export type PaymentKind = 'main' | 'doplata';
export type PaymentProvider = 'yookassa' | 'manual';

export interface CreatePaymentResult {
  payment_id: string;
  provider: PaymentProvider;
  status: string;
  kind: PaymentKind;
  amount_kopecks: number;
  confirmation_token?: string;
}

// confirmation_token ЮKassa живёт ~1 час; pending-платёж моложе этого окна
// переиспользуем, чтобы перезагрузка страницы не плодила платежи.
const REUSE_PENDING_MS = 50 * 60 * 1000;

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly deliveryClaims: DeliveryClaimsService,
    private readonly yookassa: YookassaService,
  ) {}

  getConfig(): { provider: PaymentProvider } {
    return { provider: this.yookassa.isConfigured() ? 'yookassa' : 'manual' };
  }

  async createPayment(
    orderId: number,
    kind: PaymentKind = 'main',
    userId?: number,
  ): Promise<CreatePaymentResult> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { user: { select: { email: true } } },
    });
    if (!order) {
      throw new NotFoundException(`Order #${orderId} not found`);
    }
    if (userId !== undefined && order.userId !== userId) {
      throw new ForbiddenException('Cannot create payment for another user');
    }

    if (kind === 'main' && order.status !== 'new') {
      throw new ConflictException(
        `Заказ уже оплачен или отменён (статус ${order.status})`,
      );
    }
    if (kind === 'doplata' && order.status !== 'awaiting_payment_for_courier') {
      throw new ConflictException(
        `Доплата не требуется (статус заказа ${order.status})`,
      );
    }

    const amountKopecks =
      kind === 'doplata'
        ? (order.deliverySurchargeKopecks ?? 0)
        : order.total;
    if (amountKopecks <= 0) {
      throw new ConflictException('Сумма к оплате должна быть больше нуля');
    }

    const provider = this.getConfig().provider;

    // Переиспользуем свежий pending-платёж того же вида и суммы
    const existing = await this.prisma.payment.findFirst({
      where: {
        orderId,
        kind,
        provider,
        status: 'pending',
        amountKopecks,
        createdAt: { gte: new Date(Date.now() - REUSE_PENDING_MS) },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (existing && (provider === 'manual' || existing.confirmationToken)) {
      return {
        payment_id: existing.id,
        provider,
        status: existing.status,
        kind,
        amount_kopecks: existing.amountKopecks,
        confirmation_token: existing.confirmationToken ?? undefined,
      };
    }

    const payment = await this.prisma.payment.create({
      data: { orderId, kind, provider, amountKopecks },
    });

    let confirmationToken: string | undefined;
    if (provider === 'yookassa') {
      const orderLabel = String(order.orderNumber ?? order.id);
      const yk = await this.yookassa.createPayment({
        amountKopecks,
        description:
          kind === 'doplata'
            ? `Доплата за доставку по заказу №${orderLabel}`
            : `Оплата заказа №${orderLabel}`,
        idempotenceKey: payment.id,
        metadata: {
          payment_id: payment.id,
          order_id: String(order.id),
          kind,
        },
        customerEmail: order.user.email,
        receiptLines: this.buildReceiptLines(order, kind, amountKopecks, orderLabel),
      });
      confirmationToken = yk.confirmation?.confirmation_token;
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          providerPaymentId: yk.id,
          confirmationToken: confirmationToken ?? null,
        },
      });
    }

    // Указатель «активный платёж» на заказе (легаси-поля)
    await this.prisma.order.update({
      where: { id: orderId },
      data:
        kind === 'doplata'
          ? { doplataPaymentId: payment.id }
          : { paymentId: payment.id },
    });

    return {
      payment_id: payment.id,
      provider,
      status: 'pending',
      kind,
      amount_kopecks: amountKopecks,
      confirmation_token: confirmationToken,
    };
  }

  /**
   * Позиции чека 54-ФЗ. Количество сворачивается в сумму строки
   * (quantity всегда 1, вес/штуки — в описании): при дробных количествах
   * (кг) построчное умножение цены на количество у ЮKassa может разойтись
   * с суммой платежа на копейку, а чек обязан сходиться точно. Остаточная
   * разница от округлений добавляется к последней позиции.
   */
  private buildReceiptLines(
    order: { items: unknown; deliveryCost: number },
    kind: PaymentKind,
    amountKopecks: number,
    orderLabel: string,
  ): ReceiptLine[] {
    if (kind === 'doplata') {
      return [
        {
          description: `Доплата за доставку по заказу №${orderLabel}`,
          amountKopecks,
          paymentSubject: 'service',
        },
      ];
    }

    const items = (order.items as CartItem[] | null) ?? [];
    const lines: ReceiptLine[] = items.map((it) => {
      const details = [it.flavor, it.size].filter(Boolean).join(', ');
      const name = details ? `${it.name} (${details})` : it.name;
      return {
        description: `${name} × ${it.quantity} ${it.unit ?? 'шт'}`,
        amountKopecks: Math.round(it.subtotal ?? it.price * it.quantity),
        paymentSubject: 'commodity' as const,
      };
    });
    if (order.deliveryCost > 0) {
      lines.push({
        description: 'Доставка',
        amountKopecks: order.deliveryCost,
        paymentSubject: 'service',
      });
    }

    const sum = lines.reduce((acc, l) => acc + l.amountKopecks, 0);
    const diff = amountKopecks - sum;
    if (diff !== 0 && lines.length > 0) {
      lines[lines.length - 1].amountKopecks += diff;
    }
    if (lines.length === 0 || lines.some((l) => l.amountKopecks <= 0)) {
      return [
        {
          description: `Оплата заказа №${orderLabel}`,
          amountKopecks,
          paymentSubject: 'commodity',
        },
      ];
    }
    return lines;
  }

  /**
   * Ручное подтверждение — только для provider='manual' (перевод по
   * реквизитам). Платежи ЮKassa подтверждаются вебхуком/синком.
   */
  async confirmPayment(
    paymentId: string,
    userId: number,
  ): Promise<{ ok: boolean; order_id: number; kind: PaymentKind }> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { order: { select: { id: true, userId: true } } },
    });

    if (payment) {
      if (payment.order.userId !== userId) {
        throw new ForbiddenException('Cannot confirm payment for another user');
      }
      if (payment.provider !== 'manual') {
        throw new ConflictException(
          'Платёж ЮKassa подтверждается автоматически после оплаты',
        );
      }
      await this.markSucceeded(payment.id, payment.kind as PaymentKind, payment.orderId);
      return { ok: true, order_id: payment.orderId, kind: payment.kind as PaymentKind };
    }

    // Легаси-заказы, созданные до появления модели Payment: paymentId на
    // заказе — просто UUID без Payment-строки.
    return this.confirmLegacyPayment(paymentId, userId);
  }

  private async confirmLegacyPayment(
    paymentId: string,
    userId: number,
  ): Promise<{ ok: boolean; order_id: number; kind: PaymentKind }> {
    const mainOrder = await this.prisma.order.findFirst({
      where: { paymentId },
    });
    if (mainOrder) {
      if (mainOrder.userId !== userId) {
        throw new ForbiddenException('Cannot confirm payment for another user');
      }
      await this.prisma.order.update({
        where: { id: mainOrder.id },
        data: { status: 'paid', paidAt: new Date() },
      });
      return { ok: true, order_id: mainOrder.id, kind: 'main' };
    }

    const doplataOrder = await this.prisma.order.findFirst({
      where: { doplataPaymentId: paymentId },
    });
    if (doplataOrder) {
      if (doplataOrder.userId !== userId) {
        throw new ForbiddenException('Cannot confirm payment for another user');
      }
      await this.deliveryClaims.onDoplataConfirmed(doplataOrder.id);
      return { ok: true, order_id: doplataOrder.id, kind: 'doplata' };
    }

    throw new NotFoundException(`Payment ${paymentId} not found`);
  }

  /**
   * Fallback к вебхуку: фронт опрашивает этот метод, пока виджет открыт.
   * Статус перезапрашивается у ЮKassa — телу клиента не доверяем.
   */
  async syncPayment(
    paymentId: string,
    userId: number,
  ): Promise<{ status: string; order_id: number; kind: PaymentKind }> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { order: { select: { userId: true } } },
    });
    if (!payment) {
      throw new NotFoundException(`Payment ${paymentId} not found`);
    }
    if (payment.order.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    if (
      payment.provider === 'yookassa' &&
      payment.status === 'pending' &&
      payment.providerPaymentId
    ) {
      const yk = await this.yookassa.getPayment(payment.providerPaymentId);
      if (yk) {
        await this.applyProviderStatus(payment.providerPaymentId, yk);
      }
    }

    const fresh = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    });
    return {
      status: fresh!.status,
      order_id: fresh!.orderId,
      kind: fresh!.kind as PaymentKind,
    };
  }

  /**
   * Применяет статус, полученный из API ЮKassa (вебхук или sync).
   * Идемпотентно: updateMany с гардом по статусу.
   */
  async applyProviderStatus(
    providerPaymentId: string,
    fetched: YookassaPayment,
  ): Promise<void> {
    const payment = await this.prisma.payment.findUnique({
      where: { providerPaymentId },
    });
    if (!payment) {
      this.logger.warn(
        `applyProviderStatus: неизвестный платёж ЮKassa ${providerPaymentId}`,
      );
      return;
    }

    if (fetched.status === 'succeeded') {
      await this.markSucceeded(payment.id, payment.kind as PaymentKind, payment.orderId);
    } else if (fetched.status === 'canceled') {
      await this.prisma.payment.updateMany({
        where: { id: payment.id, status: 'pending' },
        data: { status: 'canceled', canceledAt: new Date() },
      });
    }
  }

  private async markSucceeded(
    paymentId: string,
    kind: PaymentKind,
    orderId: number,
  ): Promise<void> {
    const moved = await this.prisma.payment.updateMany({
      where: { id: paymentId, status: 'pending' },
      data: { status: 'succeeded', paidAt: new Date() },
    });
    if (moved.count !== 1) return; // уже обработан

    if (kind === 'main') {
      await this.prisma.order.updateMany({
        where: { id: orderId, status: 'new' },
        data: { status: 'paid', paidAt: new Date() },
      });
    } else {
      await this.deliveryClaims.onDoplataConfirmed(orderId);
    }
  }
}
