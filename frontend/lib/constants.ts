import type { OrderStatus, ProductCategory, DeliveryTimeSlot } from '@/types';

export const STATUS_LABELS: Record<OrderStatus, string> = {
  new: 'Новый',
  paid: 'Оплачен',
  preparing: 'Готовится',
  ready: 'Готов',
  awaiting_payment_for_courier: 'Ожидает доплату за доставку',
  delivering: 'В доставке',
  completed: 'Завершён',
  cancelled: 'Отменён',
};

// Статусы заявки Яндекс Доставки (Claims API). Неизвестные статусы не
// показываем — карта покрывает основные шаги жизненного цикла заявки.
export const YANDEX_CLAIM_STATUS_LABELS: Record<string, string> = {
  new: 'Заявка создана',
  estimating: 'Оцениваем доставку',
  ready_for_approval: 'Заявка ждёт подтверждения',
  accepted: 'Заявка подтверждена',
  performer_lookup: 'Ищем курьера',
  performer_draft: 'Ищем курьера',
  performer_found: 'Курьер найден',
  pickup_arrived: 'Курьер приехал на склад',
  ready_for_pickup_confirmation: 'Курьер забирает заказ',
  pickuped: 'Курьер забрал заказ',
  delivery_arrived: 'Курьер у вас',
  ready_for_delivery_confirmation: 'Курьер передаёт заказ',
  delivered: 'Доставлен',
  delivered_finish: 'Доставлен',
  returning: 'Заказ возвращается',
  returned_finish: 'Заказ возвращён',
  performer_not_found: 'Курьер не найден',
  cancelled: 'Доставка отменена',
  cancelled_with_payment: 'Доставка отменена',
  cancelled_by_taxi: 'Доставка отменена курьером',
  failed: 'Ошибка доставки',
};

export const STATUS_COLORS: Record<OrderStatus, string> = {
  new: 'bg-yellow-100 text-yellow-800',
  paid: 'bg-blue-100 text-blue-800',
  preparing: 'bg-purple-100 text-purple-800',
  ready: 'bg-green-100 text-green-800',
  awaiting_payment_for_courier: 'bg-amber-100 text-amber-800',
  delivering: 'bg-cyan-100 text-cyan-800',
  completed: 'bg-gray-100 text-gray-800',
  cancelled: 'bg-red-100 text-red-800',
};

export const CATEGORY_LABELS: Record<ProductCategory, string> = {
  'хинкали': 'Хинкали',
  'пельмени': 'Пельмени',
  'блинчики': 'Блинчики',
  'хлеб': 'Хлеб',
  'десерты': 'Десерты',
  'торты': 'Торты',
};

export const CATEGORY_EMOJI: Record<ProductCategory, string> = {
  'хинкали': '🥟',
  'пельмени': '🥟',
  'блинчики': '🫓',
  'хлеб': '🍞',
  'десерты': '🍰',
  'торты': '🎂',
};

export const CATEGORY_ORDER: ProductCategory[] = [
  'хинкали',
  'пельмени',
  'блинчики',
  'хлеб',
  'десерты',
  'торты',
];

export const DELIVERY_TIME_SLOTS: DeliveryTimeSlot[] = [
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
];

export const CAKE_CATEGORY = 'торты';
export const ADMIN_ROLE = 'admin';

export const MAX_TORTS_PER_ORDER = 2;
export const MAX_ITEM_QTY_PER_ORDER = 50;

export const DEFAULT_SLOT_CAPACITY = 6;

export const MIN_DAYS_AHEAD = 2;
export const MAX_DAYS_AHEAD = 15;

export const POLLING_INTERVAL_MS = 30_000;
// Дублирует DELIVERY_BASE_KOPECKS бекенда (backend/src/common/constants.ts).
export const FALLBACK_DELIVERY_COST = 30_000;
export const FREE_DELIVERY_THRESHOLD_KOPECKS = 400_000;
export const MIN_ORDER_KOPECKS = 100_000;

export const WAREHOUSE_ADDRESS = 'г. Нижний Новгород, ул. Мельникова, 29А';
