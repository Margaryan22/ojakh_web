export type ProductCategory = 'хинкали' | 'пельмени' | 'блинчики' | 'хлеб' | 'десерты' | 'торты';
export type OrderStatus = 'new' | 'paid' | 'preparing' | 'ready' | 'delivery_ordered' | 'completed' | 'cancelled';
export type DeliveryTimeSlot = '10:00-14:00' | '14:00-18:00' | '18:00-22:00';

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
  available: boolean;
  maxPerDay: number;
}

export interface CartItem {
  product_id: number;
  name: string;
  category: string;
  flavor?: string;
  size?: string;
  quantity: number;
  unit: string;
  price: number;    // kopecks per unit
  subtotal: number; // kopecks total
}

export interface Cart {
  items: CartItem[];
}

export interface Order {
  id: number;
  userId: number;
  items: CartItem[];
  subtotal: number;
  deliveryCost: number;
  total: number;
  status: OrderStatus;
  address?: string;
  deliveryDate: string;
  deliveryTime?: string;
  isPickup: boolean;
  createdAt: string;
  paidAt?: string;
  readyAt?: string;
  paymentId?: string;
}

export interface DateAvailability {
  available: boolean;
  tortCount: number;
  maxTorts: number;
  orderCount: number;
  maxOrders: number;
  reason?: string;
}
