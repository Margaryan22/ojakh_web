import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFeedbackDto } from './dto/create-feedback.dto';

@Injectable()
export class FeedbackService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: number | null, dto: CreateFeedbackDto) {
    await this.prisma.feedback.create({
      data: {
        userId,
        kind: dto.kind,
        text: dto.text,
      },
    });
    return { ok: true };
  }

  async listForAdmin(params: { unreadOnly: boolean; limit: number; offset: number }) {
    const where = params.unreadOnly ? { readAt: null } : {};
    const [items, total] = await Promise.all([
      this.prisma.feedback.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: params.offset,
        take: params.limit,
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
      this.prisma.feedback.count({ where }),
    ]);
    return { items, total };
  }

  async unreadCount() {
    const count = await this.prisma.feedback.count({ where: { readAt: null } });
    return { count };
  }

  async markRead(id: number) {
    const existing = await this.prisma.feedback.findUnique({
      where: { id },
      select: { id: true, readAt: true },
    });
    if (!existing) throw new NotFoundException('Feedback not found');
    if (existing.readAt) return { ok: true };
    await this.prisma.feedback.update({
      where: { id },
      data: { readAt: new Date() },
    });
    return { ok: true };
  }
}
