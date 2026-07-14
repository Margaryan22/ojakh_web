import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService, STATUS_MESSAGES } from './notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../push/push.service';
import { MailService } from '../mail/mail.service';
import { EventsService } from '../events/events.service';

const mockPrisma = {
  notification: {
    create: jest.fn(),
    findMany: jest.fn(),
    updateMany: jest.fn(),
    count: jest.fn(),
  },
  user: {
    findUnique: jest.fn().mockResolvedValue({ email: 'test@example.com' }),
  },
  // Пагинированный список собирается через $transaction([findMany, count])
  $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
};

const mockPushService = {
  sendToUser: jest.fn().mockResolvedValue(undefined),
};

const mockMailService = {
  sendOrderStatus: jest.fn().mockResolvedValue(undefined),
};

describe('NotificationsService', () => {
  let service: NotificationsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: PushService, useValue: mockPushService },
        { provide: MailService, useValue: mockMailService },
        { provide: EventsService, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    jest.clearAllMocks();
  });

  describe('createForOrder', () => {
    it('должен создать уведомление со статусом "preparing"', async () => {
      const notification = { id: 1, userId: 1, orderId: 42, status: 'preparing', message: '...', isRead: false };
      mockPrisma.notification.create.mockResolvedValue(notification);

      const result = await service.createForOrder(1, 42, 'preparing');

      expect(result).toBeTruthy();
      expect(mockPrisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 1,
          orderId: 42,
          status: 'preparing',
          message: expect.stringContaining('42'),
        }),
      });
    });

    it('должен подставлять id заказа в сообщение', async () => {
      mockPrisma.notification.create.mockResolvedValue({ id: 1 });

      await service.createForOrder(1, 42, 'preparing');

      const createCall = mockPrisma.notification.create.mock.calls[0][0];
      expect(createCall.data.message).toContain('42');
      expect(createCall.data.message).not.toContain('{id}');
    });

    it.each(['preparing', 'ready', 'delivering', 'completed', 'cancelled'])(
      'должен создать уведомление для статуса "%s"',
      async (status) => {
        mockPrisma.notification.create.mockResolvedValue({ id: 1 });

        const result = await service.createForOrder(1, 1, status);

        expect(result).not.toBeNull();
        expect(mockPrisma.notification.create).toHaveBeenCalled();
      },
    );

    it('должен вернуть null для неизвестного статуса', async () => {
      const result = await service.createForOrder(1, 1, 'unknown_status');

      expect(result).toBeNull();
      expect(mockPrisma.notification.create).not.toHaveBeenCalled();
    });

    it('сообщение должно соответствовать шаблону из STATUS_MESSAGES', async () => {
      mockPrisma.notification.create.mockResolvedValue({ id: 1 });

      await service.createForOrder(1, 99, 'ready');

      const createCall = mockPrisma.notification.create.mock.calls[0][0];
      const expected = STATUS_MESSAGES['ready'].replace('{id}', '99');
      expect(createCall.data.message).toBe(expected);
    });
  });

  describe('getForUser', () => {
    it('должен вернуть уведомления пользователя с метаданными пагинации', async () => {
      const notifications = [{ id: 1, userId: 1, message: 'test' }];
      mockPrisma.notification.findMany.mockResolvedValue(notifications);
      mockPrisma.notification.count.mockResolvedValue(1);

      const result = await service.getForUser(1);

      expect(result.notifications).toEqual(notifications);
      expect(result.total).toBe(1);
      expect(mockPrisma.notification.findMany).toHaveBeenCalledWith({
        where: { userId: 1 },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 50,
      });
    });
  });

  describe('markAllRead', () => {
    it('должен отметить все непрочитанные уведомления как прочитанные', async () => {
      mockPrisma.notification.updateMany.mockResolvedValue({ count: 3 });

      const result = await service.markAllRead(1);

      expect(result).toEqual({ ok: true });
      expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith({
        where: { userId: 1, isRead: false },
        data: { isRead: true },
      });
    });
  });

  describe('markOneRead', () => {
    it('должен отметить конкретное уведомление как прочитанное', async () => {
      mockPrisma.notification.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.markOneRead(1, 5);

      expect(result).toEqual({ ok: true });
      expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith({
        where: { id: 5, userId: 1 },
        data: { isRead: true },
      });
    });
  });
});
