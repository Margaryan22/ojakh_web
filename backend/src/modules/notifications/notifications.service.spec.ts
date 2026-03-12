import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService, STATUS_MESSAGES } from './notifications.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  notification: {
    create: jest.fn(),
    findMany: jest.fn(),
    updateMany: jest.fn(),
  },
};

describe('NotificationsService', () => {
  let service: NotificationsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: mockPrisma },
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

    it.each(['preparing', 'ready', 'delivery_ordered', 'completed', 'cancelled'])(
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
    it('должен вернуть последние 50 уведомлений пользователя', async () => {
      const notifications = [{ id: 1, userId: 1, message: 'test' }];
      mockPrisma.notification.findMany.mockResolvedValue(notifications);

      const result = await service.getForUser(1);

      expect(result).toEqual(notifications);
      expect(mockPrisma.notification.findMany).toHaveBeenCalledWith({
        where: { userId: 1 },
        orderBy: { createdAt: 'desc' },
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
