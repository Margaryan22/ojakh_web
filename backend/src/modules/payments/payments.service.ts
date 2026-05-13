import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import { DeliveryClaimsService } from '../delivery/claims/delivery-claims.service';

export type PaymentKind = 'main' | 'doplata';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly deliveryClaims: DeliveryClaimsService,
  ) {}

  async createPayment(
    orderId: number,
    kind: PaymentKind = 'main',
  ): Promise<{ payment_id: string; status: string; kind: PaymentKind }> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException(`Order #${orderId} not found`);
    }

    const paymentId = uuidv4();

    await this.prisma.order.update({
      where: { id: orderId },
      data:
        kind === 'doplata'
          ? { doplataPaymentId: paymentId }
          : { paymentId },
    });

    return { payment_id: paymentId, status: 'pending', kind };
  }

  async confirmPayment(
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
}
