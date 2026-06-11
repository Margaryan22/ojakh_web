import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import {
  WAREHOUSE_LAT,
  WAREHOUSE_LON,
} from '../../../common/constants';

const DEFAULT_API_BASE = 'https://b2b.taxi.yandex.net';
const WAREHOUSE_ADDRESS = 'г. Нижний Новгород, ул. Мельникова, 29А';

// Терминальные статусы claim — поллер по ним останавливается.
export const YANDEX_TERMINAL_STATUSES = [
  'delivered_finish',
  'returned_finish',
  'cancelled',
  'cancelled_with_payment',
  'cancelled_by_taxi',
  'failed',
  'performer_not_found',
];

export interface YandexOrderInfo {
  id: number;
  orderNumber: string | null;
  address: string;
  addressLat: number | null;
  addressLon: number | null;
  addressApartment?: string | null;
  addressEntrance?: string | null;
  addressFloor?: string | null;
  addressIntercom?: string | null;
  deliveryNotes?: string | null;
  recipientName?: string | null;
  contactPhone?: string | null;
  userName?: string | null;
  userPhone?: string | null;
}

/**
 * Клиент Claims API v2 Яндекс Доставки (экспресс-доставка курьером):
 * https://yandex.ru/dev/logistics/api/ref/express/
 * OAuth-токен выдаётся в кабинете Яндекс Доставки после договора.
 * Тестовая среда — YANDEX_DELIVERY_API_BASE=https://b2b.taxi.tst.yandex.net.
 */
@Injectable()
export class YandexDeliveryService {
  private readonly logger = new Logger(YandexDeliveryService.name);

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(this.config.get<string>('YANDEX_DELIVERY_TOKEN'));
  }

  private get http(): AxiosInstance {
    const base = this.config.get<string>('YANDEX_DELIVERY_API_BASE') || DEFAULT_API_BASE;
    return axios.create({
      baseURL: `${base}/b2b/cargo/integration/v2`,
      headers: {
        Authorization: `Bearer ${this.config.get<string>('YANDEX_DELIVERY_TOKEN')}`,
        'Accept-Language': 'ru',
      },
      timeout: 15_000,
    });
  }

  /** Предварительная цена курьера, в копейках. */
  async checkPrice(order: YandexOrderInfo): Promise<number> {
    const { data } = await this.http.post('/check-price', {
      items: [
        {
          quantity: 1,
          size: { length: 0.4, width: 0.4, height: 0.3 },
          weight: 5,
        },
      ],
      route_points: [
        { coordinates: [WAREHOUSE_LON, WAREHOUSE_LAT] },
        { coordinates: [order.addressLon!, order.addressLat!] },
      ],
      requirements: { taxi_class: 'express' },
    });
    // API отдаёт цену строкой в рублях, например "512.00"
    return Math.round(parseFloat(data.price) * 100);
  }

  /** Создаёт и подтверждает заявку. Возвращает claim_id. */
  async createClaim(order: YandexOrderInfo): Promise<{ claimId: string; status: string }> {
    const contactPhone =
      order.contactPhone || order.userPhone || '';
    const contactName =
      order.recipientName || order.userName || 'Получатель';
    const comment = [
      order.addressEntrance && `подъезд ${order.addressEntrance}`,
      order.addressFloor && `этаж ${order.addressFloor}`,
      order.addressApartment && `кв. ${order.addressApartment}`,
      order.addressIntercom && `домофон ${order.addressIntercom}`,
      order.deliveryNotes,
    ]
      .filter(Boolean)
      .join(', ');

    // request_id детерминирован от заказа — повторный вызов не создаст дубль
    const requestId = `order-${order.id}-claim`;

    const { data: created } = await this.http.post(
      `/claims/create?request_id=${requestId}`,
      {
        items: [
          {
            title: `Заказ №${order.orderNumber ?? order.id}`,
            quantity: 1,
            cost_value: '0.00',
            cost_currency: 'RUB',
            pickup_point: 1,
            droppof_point: 2,
            size: { length: 0.4, width: 0.4, height: 0.3 },
            weight: 5,
          },
        ],
        route_points: [
          {
            point_id: 1,
            visit_order: 1,
            type: 'source',
            address: {
              fullname: WAREHOUSE_ADDRESS,
              coordinates: [WAREHOUSE_LON, WAREHOUSE_LAT],
            },
            contact: {
              name: 'Очаг',
              phone:
                this.config.get<string>('YANDEX_DELIVERY_CONTACT_PHONE') ||
                '+70000000000',
            },
          },
          {
            point_id: 2,
            visit_order: 2,
            type: 'destination',
            address: {
              fullname: order.address,
              coordinates: [order.addressLon!, order.addressLat!],
              ...(comment ? { comment } : {}),
            },
            contact: { name: contactName, phone: contactPhone },
          },
        ],
        client_requirements: { taxi_class: 'express' },
      },
    );

    const claimId: string = created.id;

    const { data: accepted } = await this.http.post(
      `/claims/accept?claim_id=${claimId}`,
      { version: created.version ?? 1 },
    );

    this.logger.log(`Яндекс-заявка создана: ${claimId} (${accepted.status})`);
    return { claimId, status: accepted.status ?? created.status ?? 'accepted' };
  }

  async getClaimInfo(claimId: string): Promise<{ status: string }> {
    const { data } = await this.http.post(`/claims/info?claim_id=${claimId}`);
    return { status: data.status };
  }
}
