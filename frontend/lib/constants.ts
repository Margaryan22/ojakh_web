import type { OrderStatus, ProductCategory, DeliveryTimeSlot } from '@/types';

export const STATUS_LABELS: Record<OrderStatus, string> = {
  new: 'Новый',
  paid: 'Оплачен',
  preparing: 'Готовится',
  ready: 'Готов',
  delivery_ordered: 'Доставка оформлена',
  completed: 'Завершён',
  cancelled: 'Отменён',
};

export const STATUS_COLORS: Record<OrderStatus, string> = {
  new: 'bg-yellow-100 text-yellow-800',
  paid: 'bg-blue-100 text-blue-800',
  preparing: 'bg-purple-100 text-purple-800',
  ready: 'bg-green-100 text-green-800',
  delivery_ordered: 'bg-teal-100 text-teal-800',
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
  '10:00-14:00',
  '14:00-18:00',
  '18:00-22:00',
];

export const MAX_TORTS_PER_ORDER = 2;
export const MAX_TORTS_PER_DAY = 2;
export const MAX_ITEM_QTY_PER_ORDER = 50;
