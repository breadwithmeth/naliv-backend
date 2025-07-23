// Types для системы заказов
import { orders_delivery_type } from '@prisma/client';

export type DeliveryType = orders_delivery_type;

export const DeliveryType = {
  DELIVERY: 'DELIVERY' as orders_delivery_type,
  SCHEDULED: 'SCHEDULED' as orders_delivery_type,
  PICKUP: 'PICKUP' as orders_delivery_type
} as const;

export interface CreateOrderRequest {
  user_id: number;
  business_id: number;
  address_id: number;
  payment_type_id?: number;
  items: CreateOrderItem[];
  bonus?: number;
  extra?: string;
  delivery_type: DeliveryType;
  delivery_date?: string; // Для SCHEDULED заказов
}

export interface CreateOrderItem {
  item_id: number;
  amount: number;
  price?: number;
  options?: CreateOrderItemOption[];
}

export interface CreateOrderItemOption {
  option_item_relation_id: number;
  price: number;
  amount?: number;
}

export interface OrderResponse {
  order_id: number;
  cart_id?: number;
  user_id: number;
  log_timestamp: Date;
  address_id: number;
  delivery_price: number;
  bonus: number;
  order_uuid?: string;
  payment_id?: string;
  accepted_at?: Date;
  ready_at?: Date;
  payment_type_id?: number;
  extra?: string;
  courier_id?: number;
  courier_shift_id?: number;
  is_canceled: number;
  employee_id?: number;
  business_id?: number;
  aggregator?: string;
  aggregator_order_id?: string;
  delivery_type?: DeliveryType;
  delivery_date?: Date;
}

export interface OrderItemResponse {
  relation_id: number;
  order_id: number;
  item_id: number;
  price_id?: number;
  amount: number;
  price?: number;
  marketing_promotion_detail_id?: number;
}

export interface OrderWithDetails extends OrderResponse {
  items: (OrderItemResponse & {
    item_name?: string;
    item_code?: string;
    options?: OrderItemOptionResponse[];
  })[];
  business?: {
    id: number;
    name: string;
    address: string;
  };
  user?: {
    id: number;
    name?: string;
    phone?: string;
  };
  status?: {
    status: number;
    isCanceled: number;
    log_timestamp: Date;
  };
  cost?: {
    cost: number;
    service_fee: number;
    delivery: number;
  };
}

export interface OrderItemOptionResponse {
  relation_id: number;
  order_item_relation_id: number;
  item_id: number;
  option_item_relation_id: number;
  price_id?: number;
  order_id: number;
  price: number;
  amount?: number;
}

export enum OrderStatus {
  NEW = 0,           // новый
  ACCEPTED = 1,      // принят магазином  
  COLLECTED = 2,     // собран
  GIVEN_TO_COURIER = 3, // отдан курьеру
  DELIVERED = 4,     // доставлен
  UNPAID = 66,       // не оплачен
  CANCELED = 7       // отменен
}

export interface OrderStatusUpdate {
  order_id: number;
  status: OrderStatus;
  isCanceled?: boolean;
}

// Типы для маркетинговых акций
export interface MarketingPromotion {
  marketing_promotion_id: number;
  name?: string | null;
  start_promotion_date: Date;
  end_promotion_date: Date;
  business_id: number;
  visible: number;
}

export interface MarketingPromotionDetail {
  detail_id: number;
  type: string;
  base_amount?: number | null;
  add_amount?: number | null;
  marketing_promotion_id: number;
  item_id: number;
  name: string;
  discount?: number | null;
}

export interface PromotionCalculationResult {
  originalQuantity: number;
  chargedQuantity: number;
  freeQuantity: number;
  promotion?: MarketingPromotionDetail;
  // Поля для процентных скидок
  discountedPrice?: number;
  discountAmount?: number;
  discountPercent?: number;
}
