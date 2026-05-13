export const TORT_CATEGORY = 'торты';

export const MAX_TORTS = 2;
export const DEFAULT_MAX_UNITS = 100;

export const MIN_DAYS_AHEAD = 2;
export const MAX_DAYS_AHEAD = 15;

export const ACTIVE_STATUSES = [
  'new',
  'paid',
  'preparing',
  'ready',
  'awaiting_payment_for_courier',
  'delivering',
];

// Адрес склада (захардкожен — единственная точка отгрузки).
export const WAREHOUSE_ADDRESS = 'г. Нижний Новгород, ул. Мельникова, 29А';
export const WAREHOUSE_LAT = 56.3269;
export const WAREHOUSE_LON = 43.9548;

// Базовая цена доставки до 5 км — фикс. Сверх — DELIVERY_PER_KM_KOPECKS за км.
export const DELIVERY_BASE_KOPECKS = 50_000; // 500₽
export const DELIVERY_FREE_KM = 5;
export const DELIVERY_PER_KM_KOPECKS = 4_000; // 40₽
export const FALLBACK_DELIVERY_COST = DELIVERY_BASE_KOPECKS;

// Бесплатная доставка при заказе от 4000₽.
export const FREE_DELIVERY_THRESHOLD_KOPECKS = 400_000;

export const RECALC_TTL_SECONDS_DEFAULT = 300;

export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
