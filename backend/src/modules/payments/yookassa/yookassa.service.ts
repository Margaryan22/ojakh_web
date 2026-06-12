import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

const DEFAULT_API_BASE = 'https://api.yookassa.ru/v3';

export interface YookassaPayment {
  id: string;
  status: 'pending' | 'waiting_for_capture' | 'succeeded' | 'canceled';
  paid: boolean;
  confirmation?: { type: string; confirmation_token?: string };
  metadata?: Record<string, string>;
}

// Нейтральная позиция чека: количество уже «свёрнуто» в сумму строки,
// поэтому сумма позиций всегда сходится с платежом до копейки.
export interface ReceiptLine {
  description: string;
  amountKopecks: number;
  paymentSubject: 'commodity' | 'service';
}

export interface CreateYookassaPaymentParams {
  amountKopecks: number;
  description: string;
  idempotenceKey: string;
  metadata?: Record<string, string>;
  customerEmail?: string;
  receiptLines?: ReceiptLine[];
}

const RECEIPT_DESCRIPTION_MAX = 128;

/**
 * Тонкий клиент API ЮKassa (https://yookassa.ru/developers/api).
 * Аутентификация — Basic auth shopId:secretKey. Платёж создаётся с
 * confirmation.type = 'embedded': фронт получает confirmation_token
 * и рендерит виджет ЮKassa (карта, СБП и пр. — по настройкам кабинета).
 */
@Injectable()
export class YookassaService {
  private readonly logger = new Logger(YookassaService.name);

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(
      this.config.get<string>('YOOKASSA_SHOP_ID') &&
        this.config.get<string>('YOOKASSA_SECRET_KEY'),
    );
  }

  private get apiBase(): string {
    return this.config.get<string>('YOOKASSA_API_BASE') || DEFAULT_API_BASE;
  }

  private get auth() {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException(
        'Оплата через ЮKassa не настроена (YOOKASSA_SHOP_ID / YOOKASSA_SECRET_KEY)',
      );
    }
    return {
      username: this.config.get<string>('YOOKASSA_SHOP_ID')!,
      password: this.config.get<string>('YOOKASSA_SECRET_KEY')!,
    };
  }

  // Чек 54-ФЗ отправляется, когда в кабинете включены «ЮKassa Чеки».
  // Отключение: YOOKASSA_SEND_RECEIPT=0 (например, пока фискализация не активна).
  private get sendReceipt(): boolean {
    return (this.config.get<string>('YOOKASSA_SEND_RECEIPT') ?? '1') !== '0';
  }

  private buildReceipt(params: CreateYookassaPaymentParams) {
    if (!this.sendReceipt || !params.customerEmail || !params.receiptLines?.length) {
      return undefined;
    }
    const vatCode = Number(this.config.get<string>('YOOKASSA_VAT_CODE')) || 1;
    const taxSystemCode = Number(
      this.config.get<string>('YOOKASSA_TAX_SYSTEM_CODE'),
    );
    return {
      customer: { email: params.customerEmail },
      items: params.receiptLines.map((line) => ({
        description: line.description.slice(0, RECEIPT_DESCRIPTION_MAX),
        quantity: '1.00',
        amount: {
          value: (line.amountKopecks / 100).toFixed(2),
          currency: 'RUB',
        },
        vat_code: vatCode,
        payment_subject: line.paymentSubject,
        payment_mode: 'full_payment',
      })),
      ...(taxSystemCode ? { tax_system_code: taxSystemCode } : {}),
    };
  }

  async createPayment(
    params: CreateYookassaPaymentParams,
  ): Promise<YookassaPayment> {
    const receipt = this.buildReceipt(params);
    const body = {
      amount: {
        value: (params.amountKopecks / 100).toFixed(2),
        currency: 'RUB',
      },
      capture: true,
      confirmation: { type: 'embedded' },
      description: params.description,
      metadata: params.metadata ?? {},
      ...(receipt ? { receipt } : {}),
    };

    try {
      const { data } = await axios.post<YookassaPayment>(
        `${this.apiBase}/payments`,
        body,
        {
          auth: this.auth,
          headers: { 'Idempotence-Key': params.idempotenceKey },
          timeout: 15_000,
        },
      );
      return data;
    } catch (e: any) {
      this.logger.error(
        `YooKassa createPayment failed: ${e?.response?.status} ${JSON.stringify(e?.response?.data ?? e?.message)}`,
      );
      throw new ServiceUnavailableException(
        'Не удалось создать платёж в ЮKassa, попробуйте позже',
      );
    }
  }

  /**
   * Используется и вебхуком, и sync-эндпоинтом: статус платежа всегда
   * перезапрашивается у ЮKassa, телу вебхука не доверяем (подписи нет).
   */
  async getPayment(providerPaymentId: string): Promise<YookassaPayment | null> {
    try {
      const { data } = await axios.get<YookassaPayment>(
        `${this.apiBase}/payments/${providerPaymentId}`,
        { auth: this.auth, timeout: 15_000 },
      );
      return data;
    } catch (e: any) {
      if (e?.response?.status === 404) return null;
      this.logger.error(
        `YooKassa getPayment(${providerPaymentId}) failed: ${e?.response?.status} ${e?.message}`,
      );
      throw new ServiceUnavailableException(
        'Не удалось получить статус платежа из ЮKassa',
      );
    }
  }
}
