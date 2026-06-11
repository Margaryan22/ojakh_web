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

export interface CreateYookassaPaymentParams {
  amountKopecks: number;
  description: string;
  idempotenceKey: string;
  metadata?: Record<string, string>;
}

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

  async createPayment(
    params: CreateYookassaPaymentParams,
  ): Promise<YookassaPayment> {
    // TODO: добавить объект receipt (чек 54-ФЗ) до приёма боевых платежей,
    // если у магазина настроена онлайн-фискализация.
    const body = {
      amount: {
        value: (params.amountKopecks / 100).toFixed(2),
        currency: 'RUB',
      },
      capture: true,
      confirmation: { type: 'embedded' },
      description: params.description,
      metadata: params.metadata ?? {},
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
