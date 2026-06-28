export const TORT_CATEGORY = 'торты';

export const MAX_TORTS = 2;
export const DEFAULT_MAX_UNITS = 100;

// Сколько заказов помещается в один интервал доставки по умолчанию.
// Может быть переопределено на конкретную дату через DailyLimit.slotCapacities.
export const DEFAULT_SLOT_CAPACITY = 6;

// Список окон доставки. Дублируется на фронте (frontend/lib/constants.ts).
// Слот-лейблы используются как ключи в DailyLimit.slotCapacities.
export const DELIVERY_TIME_SLOTS = [
  '10:00-11:00',
  '11:00-12:00',
  '12:00-13:00',
  '13:00-14:00',
  '14:00-15:00',
  '15:00-16:00',
  '16:00-17:00',
  '17:00-18:00',
  '18:00-19:00',
  '19:00-20:00',
  '20:00-21:00',
  '21:00-22:00',
] as const;

export const MIN_DAYS_AHEAD = 2;
export const MAX_DAYS_AHEAD = 15;

// Срок на оплату нового заказа. По истечении заказ автоматически отменяется
// (cron OrdersSchedulerService + ленивая отмена при чтении заказа).
// Дублируется на фронте для обратного отсчёта (frontend/lib/constants.ts).
export const PAYMENT_EXPIRES_MS = 15 * 60 * 1000; // 15 минут

export const ACTIVE_STATUSES = [
  'new',
  'paid',
  'preparing',
  'ready',
  'awaiting_payment_for_courier',
  'delivering',
];

// Координаты склада (захардкожены — единственная точка отгрузки,
// г. Нижний Новгород, ул. Мельникова, 29А).
export const WAREHOUSE_LAT = 56.3269;
export const WAREHOUSE_LON = 43.9548;

// Базовая цена доставки до 5 км — фикс. Сверх — DELIVERY_PER_KM_KOPECKS за км.
export const DELIVERY_BASE_KOPECKS = 50_000; // 500₽
export const DELIVERY_FREE_KM = 5;
export const DELIVERY_PER_KM_KOPECKS = 4_000; // 40₽
export const FALLBACK_DELIVERY_COST = DELIVERY_BASE_KOPECKS;

// Бесплатная доставка при заказе от 4000₽.
export const FREE_DELIVERY_THRESHOLD_KOPECKS = 400_000;

// Минимальная сумма заказа (subtotal, без доставки) — 1000₽.
export const MIN_ORDER_KOPECKS = 100_000;

export const RECALC_TTL_SECONDS_DEFAULT = 300;

export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
