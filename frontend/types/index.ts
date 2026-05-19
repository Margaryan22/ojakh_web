import type { ProductLabel } from '@/lib/product-labels';

export type ProductCategory = 'хинкали' | 'пельмени' | 'блинчики' | 'хлеб' | 'десерты' | 'торты';
export type OrderStatus =
  | 'new'
  | 'paid'
  | 'preparing'
  | 'ready'
  | 'awaiting_payment_for_courier'
  | 'delivering'
  | 'completed'
  | 'cancelled';
export type DeliveryTimeSlot =
  | '10:00-11:00'
  | '11:00-12:00'
  | '12:00-13:00'
  | '13:00-14:00'
  | '14:00-15:00'
  | '15:00-16:00'
  | '16:00-17:00'
  | '17:00-18:00'
  | '18:00-19:00'
  | '19:00-20:00'
  | '20:00-21:00'
  | '21:00-22:00';

export interface User {
  id: number;
  email: string;
  name: string;
  phone?: string;
  role: 'user' | 'admin';
  createdAt: string;
}

export interface Product {
  id: number;
  name: string;
  category: ProductCategory;
  flavor?: string;
  size?: string;
  weightGrams?: number;
  unit: 'шт' | 'кг';
  price: number; // kopecks
  imageUrl?: string;
  description?: string;
  ingredients?: string;
  available: boolean;
  maxPerDay: number;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  label?: ProductLabel | null;
}

export interface CartItem {
  product_id: number;
  name: string;
  category: string;
  flavor?: string;
  size?: string;
  quantity: number;
  unit: string;
  price: number;       // kopecks per unit
  subtotal: number;    // kopecks total
  maxPerCart?: number; // max quantity per user cart
}

export interface Cart {
  items: CartItem[];
}

export interface Order {
  id: number;
  orderNumber?: string;
  userId: number;
  items: CartItem[];
  subtotal: number;
  deliveryCost: number;
  total: number;
  status: OrderStatus;
  address?: string;
  addressLat?: number | null;
  addressLon?: number | null;
  recipientName?: string | null;
  deliveryDate: string;
  deliveryTime?: string;
  isPickup: boolean;
  createdAt: string;
  paidAt?: string;
  readyAt?: string;
  paymentId?: string;
  dispatchedAt?: string | null;
  deliveryRecalcKopecks?: number | null;
  deliverySurchargeKopecks?: number | null;
  doplataPaymentId?: string | null;
}

export interface DeliveryQuote {
  priceKopecks: number;
  surchargeKopecks: number;
  recalcId: string;
  expiresAt: string;
}

export type DeliveryClaimResponse =
  | { status: 'awaiting_payment'; doplataPaymentId: string; surchargeKopecks: number }
  | { status: 'delivering' };

export interface AddressSuggestion {
  value: string;
  geoLat: number | null;
  geoLon: number | null;
}

export interface ApartmentRange {
  entrance: number | null;
  floors: [number, number] | null;
  from: number;
  to: number;
}

export interface BuildingInfo {
  knownBuilding: boolean;
  floorsCount: number | null;
  floorsUnderground: number | null;
  entranceCount: number | null;
  apartmentRanges: ApartmentRange[] | null;
}

export interface Review {
  id: number;
  rating: number;
  text: string;
  createdAt: string;
  user: { id: number; name: string };
}

export interface ReviewSummary {
  average: number | null;
  count: number;
}

export interface SlotAvailability {
  count: number;
  max: number;
  available: boolean;
}

export type DeliveryCostBreakdown =
  | { type: 'free_threshold'; thresholdKopecks: number }
  | {
      type: 'distance';
      baseKopecks: number;
      freeKm: number;
      perKmKopecks: number;
      extraKm: number;
    }
  | { type: 'fallback'; baseKopecks: number };

export interface UserAddress {
  id: number;
  label: string | null;
  address: string;
  lat: number | null;
  lon: number | null;
  apartment: string | null;
  entrance: string | null;
  floor: string | null;
  intercom: string | null;
  notes: string | null;
  createdAt: string;
}

export interface OrderMessage {
  id: number;
  orderId: number;
  senderRole: 'user' | 'admin';
  senderId: number;
  text: string;
  readByUser: boolean;
  readByAdmin: boolean;
  createdAt: string;
}

export interface AdminUnreadSummary {
  count: number;
  byOrder: Record<number, number>;
}

export interface DateAvailability {
  available: boolean;
  tortCount: number;
  maxTorts: number;
  unitCount: number;
  maxUnits: number;
  unitsAvailable: number;
  tortsAvailable: number;
  slots: Record<string, SlotAvailability>;
  blackedOut: boolean;
  reason?: string;
}
