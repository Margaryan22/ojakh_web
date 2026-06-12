import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { YookassaService, ReceiptLine } from './yookassa.service';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('YookassaService', () => {
  let service: YookassaService;
  let config: Record<string, string | undefined>;

  const lines: ReceiptLine[] = [
    { description: 'Хинкали говядина × 10 шт', amountKopecks: 90000, paymentSubject: 'commodity' },
    { description: 'Доставка', amountKopecks: 15000, paymentSubject: 'service' },
  ];

  const baseParams = {
    amountKopecks: 105000,
    description: 'Оплата заказа №1234',
    idempotenceKey: 'pay-uuid',
    customerEmail: 'buyer@test.local',
    receiptLines: lines,
  };

  beforeEach(async () => {
    config = {
      YOOKASSA_SHOP_ID: 'shop-id',
      YOOKASSA_SECRET_KEY: 'secret',
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        YookassaService,
        { provide: ConfigService, useValue: { get: (k: string) => config[k] } },
      ],
    }).compile();

    service = module.get<YookassaService>(YookassaService);
    jest.clearAllMocks();
    mockedAxios.post.mockResolvedValue({
      data: { id: 'yk-id', status: 'pending', paid: false },
    });
  });

  it('должен включить чек: quantity 1.00, рублёвые суммы, vat_code по умолчанию 1', async () => {
    await service.createPayment(baseParams);

    const body = mockedAxios.post.mock.calls[0][1] as any;
    expect(body.receipt).toEqual({
      customer: { email: 'buyer@test.local' },
      items: [
        {
          description: 'Хинкали говядина × 10 шт',
          quantity: '1.00',
          amount: { value: '900.00', currency: 'RUB' },
          vat_code: 1,
          payment_subject: 'commodity',
          payment_mode: 'full_payment',
        },
        {
          description: 'Доставка',
          quantity: '1.00',
          amount: { value: '150.00', currency: 'RUB' },
          vat_code: 1,
          payment_subject: 'service',
          payment_mode: 'full_payment',
        },
      ],
    });
  });

  it('должен применить YOOKASSA_VAT_CODE и YOOKASSA_TAX_SYSTEM_CODE', async () => {
    config.YOOKASSA_VAT_CODE = '4';
    config.YOOKASSA_TAX_SYSTEM_CODE = '2';

    await service.createPayment(baseParams);

    const body = mockedAxios.post.mock.calls[0][1] as any;
    expect(body.receipt.tax_system_code).toBe(2);
    expect(body.receipt.items[0].vat_code).toBe(4);
  });

  it('должен обрезать description позиции до 128 символов', async () => {
    await service.createPayment({
      ...baseParams,
      receiptLines: [
        {
          description: 'Х'.repeat(200),
          amountKopecks: 105000,
          paymentSubject: 'commodity',
        },
      ],
    });

    const body = mockedAxios.post.mock.calls[0][1] as any;
    expect(body.receipt.items[0].description).toHaveLength(128);
  });

  it('YOOKASSA_SEND_RECEIPT=0 — чек не отправляется', async () => {
    config.YOOKASSA_SEND_RECEIPT = '0';

    await service.createPayment(baseParams);

    const body = mockedAxios.post.mock.calls[0][1] as any;
    expect(body.receipt).toBeUndefined();
  });

  it('без email покупателя чек не отправляется', async () => {
    await service.createPayment({ ...baseParams, customerEmail: undefined });

    const body = mockedAxios.post.mock.calls[0][1] as any;
    expect(body.receipt).toBeUndefined();
  });

  it('amount платежа не зависит от чека', async () => {
    await service.createPayment(baseParams);

    const body = mockedAxios.post.mock.calls[0][1] as any;
    expect(body.amount).toEqual({ value: '1050.00', currency: 'RUB' });
    expect(body.confirmation).toEqual({ type: 'embedded' });
  });
});
