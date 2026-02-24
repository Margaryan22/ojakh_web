import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async createPayment(orderId: number): Promise<{ payment_id: string; status: string }> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException(`Order #${orderId} not found`);
    }

    const paymentId = uuidv4();

    await this.prisma.order.update({
      where: { id: orderId },
      data: { paymentId },
    });

    return { payment_id: paymentId, status: 'pending' };
  }

  async confirmPayment(paymentId: string): Promise<{ ok: boolean; order_id: number }> {
    const order = await this.prisma.order.findFirst({
      where: { paymentId },
    });

    if (!order) {
      throw new NotFoundException(`Payment ${paymentId} not found`);
    }

    await this.prisma.order.update({
      where: { id: order.id },
      data: {
        status: 'paid',
        paidAt: new Date(),
      },
    });

    return { ok: true, order_id: order.id };
  }
}
