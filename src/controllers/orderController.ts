import { Request, Response, NextFunction } from 'express';
import prisma from '../database';
import { createError } from '../middleware/errorHandler';
import { 
  CreateOrderRequest, 
  OrderStatus,
  DeliveryType,
  MarketingPromotion,
  MarketingPromotionDetail,
  PromotionCalculationResult
} from '../types/orders';
import { orders_delivery_type } from '@prisma/client';
import { DeliveryController } from './deliveryController';

interface AuthRequest extends Request {
  user?: {
    user_id: number;
    login: string;
  };
  employee?: {
    employee_id: number;
    login: string;
    access_level: string;
  };
}

export class OrderController {

  /**
   * Получить активные акции для бизнеса
   */
  private static async getActivePromotions(businessId: number): Promise<(MarketingPromotion & { details: MarketingPromotionDetail[] })[]> {
    const now = new Date();
    
    const promotions = await prisma.marketing_promotions.findMany({
      where: {
        business_id: businessId,
        visible: 1,
        start_promotion_date: { lte: now },
        end_promotion_date: { gte: now }
      }
    });

    const promotionsWithDetails = [];
    for (const promotion of promotions) {
      const details = await prisma.marketing_promotion_details.findMany({
        where: { marketing_promotion_id: promotion.marketing_promotion_id }
      });
      
      promotionsWithDetails.push({
        ...promotion,
        details: details.map(detail => ({
          ...detail,
          base_amount: detail.base_amount ? Number(detail.base_amount) : undefined,
          add_amount: detail.add_amount ? Number(detail.add_amount) : undefined,
          discount: detail.discount ? Number(detail.discount) : undefined
        }))
      });
    }

    return promotionsWithDetails;
  }

  /**
   * Применить акции типа SUBTRACT к товару
   */
  private static calculateSubtractPromotion(
    quantity: number, 
    baseAmount: number, 
    addAmount: number
  ): PromotionCalculationResult {
    if (quantity < baseAmount) {
      return {
        originalQuantity: quantity,
        chargedQuantity: quantity,
        freeQuantity: 0
      };
    }

    // Сколько полных наборов акции (base_amount + add_amount)
    const fullSets = Math.floor(quantity / (baseAmount + addAmount));
    // Остаток товаров после полных наборов
    const remainder = quantity % (baseAmount + addAmount);
    
    // Количество бесплатных товаров из полных наборов
    let freeFromSets = fullSets * addAmount;
    // Количество товаров к оплате из полных наборов
    let chargedFromSets = fullSets * baseAmount;
    
    // Обрабатываем остаток
    let chargedFromRemainder = 0;
    let freeFromRemainder = 0;
    
    if (remainder >= baseAmount) {
      // Если остаток больше или равен базовому количеству, 
      // то можем дать часть бесплатных товаров
      chargedFromRemainder = baseAmount;
      freeFromRemainder = remainder - baseAmount;
    } else {
      // Иначе платим за весь остаток
      chargedFromRemainder = remainder;
    }

    const totalCharged = chargedFromSets + chargedFromRemainder;
    const totalFree = freeFromSets + freeFromRemainder;

    return {
      originalQuantity: quantity,
      chargedQuantity: totalCharged,
      freeQuantity: totalFree
    };
  }

  /**
   * Применить акции типа DISCOUNT к товару
   */
  private static calculateDiscountPromotion(
    quantity: number,
    price: number,
    discountPercent: number
  ): PromotionCalculationResult {
    const discountAmount = (discountPercent / 100) * price;
    const discountedPrice = price - discountAmount;
    
    return {
      originalQuantity: quantity,
      chargedQuantity: quantity, // Количество остается то же
      freeQuantity: 0, // Нет бесплатных товаров, только скидка
      discountedPrice: discountedPrice,
      discountAmount: discountAmount,
      discountPercent: discountPercent
    };
  }

  /**
   * Применить акции к товарам заказа
   */
  private static async applyPromotions(
    businessId: number,
    orderItems: { item_id: number; amount: number; price: number }[]
  ): Promise<{ item: any; promotion?: PromotionCalculationResult; originalAmount: number; chargedAmount: number; originalCost: number; discountedCost: number }[]> {
    const activePromotions = await this.getActivePromotions(businessId);
    const result = [];

    for (const item of orderItems) {
      let bestPromotion: PromotionCalculationResult | undefined;
      let maxDiscount = 0;

      // Ищем лучшую акцию для данного товара
      for (const promotion of activePromotions) {
        for (const detail of promotion.details) {
          if (detail.item_id === item.item_id) {
            let calculation: PromotionCalculationResult | undefined;
            let discount = 0;

            if (detail.type === 'SUBTRACT' && detail.base_amount && detail.add_amount) {
              // Акция типа "купи X получи Y бесплатно"
              calculation = this.calculateSubtractPromotion(
                item.amount,
                detail.base_amount,
                detail.add_amount
              );
              discount = (calculation.originalQuantity - calculation.chargedQuantity) * item.price;
              
            } else if (detail.type === 'DISCOUNT' && detail.discount) {
              // Процентная скидка
              calculation = this.calculateDiscountPromotion(
                item.amount,
                item.price,
                detail.discount
              );
              discount = calculation.discountAmount! * item.amount;
            }

            if (calculation && discount > maxDiscount) {
              maxDiscount = discount;
              bestPromotion = {
                ...calculation,
                promotion: detail
              };
            }
          }
        }
      }

      const originalCost = item.amount * item.price;
      let chargedAmount = item.amount;
      let discountedCost = originalCost;

      if (bestPromotion) {
        if (bestPromotion.promotion?.type === 'SUBTRACT') {
          // Для акций SUBTRACT - меняется количество к оплате
          chargedAmount = bestPromotion.chargedQuantity;
          discountedCost = chargedAmount * item.price;
        } else if (bestPromotion.promotion?.type === 'DISCOUNT') {
          // Для акций DISCOUNT - меняется цена за единицу
          chargedAmount = item.amount;
          discountedCost = item.amount * bestPromotion.discountedPrice!;
        }
      }

      result.push({
        item,
        promotion: bestPromotion,
        originalAmount: item.amount,
        chargedAmount,
        originalCost,
        discountedCost
      });
    }

    return result;
  }
  
  /**
   * Создание нового заказа
   * POST /api/orders
   */
  static async createOrder(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { 
        user_id, 
        business_id, 
        address_id, 
        payment_type_id, 
        items, 
        bonus = 0, 
        extra,
        delivery_type,
        delivery_date
      }: CreateOrderRequest = req.body;

      // Валидация данных
      if (!user_id || !business_id || !items || items.length === 0 || !delivery_type) {
        return next(createError(400, 'Не указаны обязательные поля: user_id, business_id, items, delivery_type'));
      }

      // Валидация типа доставки
      const validDeliveryTypes = Object.values(orders_delivery_type);
      if (!validDeliveryTypes.includes(delivery_type as orders_delivery_type)) {
        return next(createError(400, 'Неверный тип доставки. Доступные типы: DELIVERY, SCHEDULED, PICKUP'));
      }

      // Для доставки address_id обязателен
      if ((delivery_type === orders_delivery_type.DELIVERY || delivery_type === orders_delivery_type.SCHEDULED)) {
        if (!address_id) {
          return next(createError(400, 'Для доставки необходимо указать address_id'));
        }
      }

      // Валидация даты доставки для SCHEDULED заказов
      let parsedDeliveryDate: Date | null = null;
      if (delivery_type === orders_delivery_type.SCHEDULED) {
        if (!delivery_date) {
          return next(createError(400, 'Для типа доставки SCHEDULED необходимо указать дату доставки'));
        }

        parsedDeliveryDate = new Date(delivery_date);
        const now = new Date();
        const minDeliveryTime = new Date(now.getTime() + 2 * 60 * 60 * 1000); // +2 часа
        const maxDeliveryTime = new Date(now.getTime() + 24 * 60 * 60 * 1000); // +24 часа

        if (isNaN(parsedDeliveryDate.getTime())) {
          return next(createError(400, 'Неверный формат даты доставки'));
        }

        if (parsedDeliveryDate < minDeliveryTime) {
          return next(createError(400, 'Дата доставки должна быть не раньше чем через 2 часа от текущего момента'));
        }

        if (parsedDeliveryDate > maxDeliveryTime) {
          return next(createError(400, 'Дата доставки должна быть не позднее чем через 24 часа от текущего момента'));
        }
      }

      // Устанавливаем address_id (для PICKUP может быть 0)
      const finalAddressId = (delivery_type === orders_delivery_type.PICKUP) ? (address_id || 0) : address_id;

      // Проверяем существование пользователя
      const user = await prisma.user.findUnique({
        where: { user_id }
      });

      if (!user) {
        return next(createError(404, 'Пользователь не найден'));
      }

      // Проверяем существование бизнеса
      const business = await prisma.businesses.findUnique({
        where: { business_id: business_id }
      });

      if (!business) {
        return next(createError(404, 'Бизнес не найден'));
      }

      // Генерируем UUID для заказа
      const orderUuid = `ORDER-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

      // Определяем кто создает заказ: пользователь или сотрудник
      let createdBy = null;
      if (req.employee) {
        createdBy = req.employee.employee_id;
      }

      // Рассчитываем стоимость доставки автоматически для всех заказов с доставкой
      let finalDeliveryPrice = 0;
      let deliveryCalculationInfo = null;
      
      if (delivery_type === orders_delivery_type.DELIVERY || delivery_type === orders_delivery_type.SCHEDULED) {
        // Получаем адрес пользователя для расчета доставки
        const userAddress = await prisma.user_addreses.findUnique({
          where: { 
            address_id: address_id,
            user_id: user_id,
            isDeleted: 0
          }
        });

        if (!userAddress) {
          return next(createError(404, 'Адрес доставки не найден или не принадлежит пользователю'));
        }

        if (!userAddress.lat || !userAddress.lon) {
          return next(createError(400, 'У адреса доставки отсутствуют координаты'));
        }

        const lat = Number(userAddress.lat);
        const lon = Number(userAddress.lon);

        // Валидируем координаты
        if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
          return next(createError(400, 'Некорректные координаты в адресе доставки'));
        }

        try {
          const deliveryResult = await DeliveryController.calculateDeliveryZone({
            lat,
            lon,
            business_id
          });
          
          if (deliveryResult.in_zone && deliveryResult.price !== false) {
            finalDeliveryPrice = Number(deliveryResult.price);
            deliveryCalculationInfo = {
              delivery_type: deliveryResult.delivery_type,
              message: deliveryResult.message,
              max_distance: deliveryResult.max_distance,
              current_distance: deliveryResult.current_distance,
              address: {
                address_id: userAddress.address_id,
                address: userAddress.address,
                name: userAddress.name,
                lat: lat,
                lon: lon
              }
            };
          } else {
            // Если доставка невозможна, возвращаем ошибку
            return next(createError(400, `Доставка по указанному адресу невозможна: ${deliveryResult.message}`));
          }
        } catch (deliveryError: any) {
          console.error('Ошибка расчета доставки:', deliveryError);
          return next(createError(500, `Ошибка расчета стоимости доставки: ${deliveryError.message}`));
        }
      }

      // Сначала создаем заказ
      const order = await prisma.orders.create({
        data: {
          user_id,
          business_id,
          address_id: finalAddressId,
          payment_type_id,
          delivery_price: finalDeliveryPrice,
          bonus,
          extra,
          order_uuid: orderUuid,
          created_by: createdBy, // ID сотрудника, если заказ создается сотрудником
          delivery_type: delivery_type,
          delivery_date: parsedDeliveryDate,
          log_timestamp: new Date()
        }
      });

      // Подготавливаем данные товаров для расчета акций
      const itemsForPromotion = [];
      for (const item of items) {
        // Проверяем существование товара
        const itemData = await prisma.items.findUnique({
          where: { item_id: item.item_id }
        });

        if (!itemData) {
          return next(createError(404, `Товар с ID ${item.item_id} не найден`));
        }

        // Используем цену из товара или переданную цену
        const currentPrice = item.price || (itemData.price ? Number(itemData.price) : 0);
        
        if (currentPrice <= 0) {
          return next(createError(400, `Не найдена цена для товара ${itemData.name}`));
        }

        itemsForPromotion.push({
          item_id: item.item_id,
          amount: item.amount,
          price: currentPrice,
          originalItem: item,
          itemData
        });
      }

      // Применяем акции к товарам
      const itemsWithPromotions = await OrderController.applyPromotions(business_id, itemsForPromotion);

      // Добавляем товары в заказ и считаем общую стоимость
      const orderItems = [];
      let totalCost = finalDeliveryPrice;
      let totalDiscount = 0;

      for (const itemWithPromo of itemsWithPromotions) {
        const { item, promotion, chargedAmount, originalCost, discountedCost } = itemWithPromo;

        // Создаем запись товара в заказе
        const orderItem = await prisma.orders_items.create({
          data: {
            order_id: order.order_id,
            item_id: item.item_id,
            price_id: null,
            amount: item.amount, // Сохраняем оригинальное количество
            price: item.price,
            marketing_promotion_detail_id: promotion?.promotion?.detail_id || null
          }
        });

        orderItems.push({
          ...orderItem,
          promotion: promotion,
          charged_amount: chargedAmount,
          original_cost: originalCost,
          discounted_cost: discountedCost
        });

        totalCost += discountedCost;
        totalDiscount += (originalCost - discountedCost);

        // Добавляем опции товара (если есть)
        if (item.originalItem.options && item.originalItem.options.length > 0) {
          for (const option of item.originalItem.options) {
            await prisma.order_items_options.create({
              data: {
                order_item_relation_id: orderItem.relation_id,
                item_id: item.item_id,
                option_item_relation_id: option.option_item_relation_id,
                order_id: order.order_id,
                price: option.price,
                amount: option.amount || 1
              }
            });
            
            totalCost += option.price * (option.amount || 1);
          }
        }
      }

      // Создаем запись стоимости заказа
      await prisma.orders_cost.create({
        data: {
          order_id: order.order_id,
          cost: totalCost,
          service_fee: 0,
          delivery: finalDeliveryPrice,
          log_timestamp: new Date()
        }
      });

      // Определяем начальный статус заказа на основе типа оплаты
      let initialStatus = OrderStatus.NEW;
      
      if (payment_type_id) {
        // Проверяем тип оплаты
        const paymentType = await prisma.payment_types.findUnique({
          where: { payment_type_id }
        });
        
        if (paymentType && paymentType.in_app === 1) {
          initialStatus = OrderStatus.UNPAID;
        }
      }

      // Создаем начальный статус заказа
      await prisma.order_status.create({
        data: {
          order_id: order.order_id,
          status: initialStatus,
          isCanceled: 0,
          log_timestamp: new Date()
        }
      });

      res.status(201).json({
        success: true,
        data: {
          order_id: order.order_id,
          order_uuid: orderUuid,
          total_cost: totalCost,
          delivery_price: finalDeliveryPrice,
          total_discount: totalDiscount,
          items_count: orderItems.length,
          promotions_applied: orderItems.filter(item => item.promotion).length,
          delivery_calculation: deliveryCalculationInfo
        },
        message: 'Заказ успешно создан'
      });

    } catch (error: any) {
      console.error('Ошибка создания заказа:', error);
      next(createError(500, `Ошибка создания заказа: ${error.message}`));
    }
  }

  /**
   * Получение заказа по ID
   * GET /api/orders/:id
   */
  static async getOrderById(req: Request, res: Response, next: NextFunction) {
    try {
      const orderId = parseInt(req.params.id);

      if (isNaN(orderId)) {
        return next(createError(400, 'Неверный ID заказа'));
      }

      // Получаем основную информацию о заказе
      const order = await prisma.orders.findUnique({
        where: { order_id: orderId }
      });

      if (!order) {
        return next(createError(404, 'Заказ не найден'));
      }

      // Получаем товары заказа
      const orderItems = await prisma.orders_items.findMany({
        where: { order_id: orderId }
      });

      // Получаем информацию о товарах
      const items = [];
      for (const orderItem of orderItems) {
        const item = await prisma.items.findUnique({
          where: { item_id: orderItem.item_id }
        });

        // Получаем информацию об акции (если применена)
        let promotionDetail = null;
        if (orderItem.marketing_promotion_detail_id) {
          promotionDetail = await prisma.marketing_promotion_details.findUnique({
            where: { detail_id: orderItem.marketing_promotion_detail_id }
          });
        }

        items.push({
          ...orderItem,
          item_name: item?.name,
          item_code: item?.code,
          item_img: item?.img,
          promotion_detail: promotionDetail
        });
      }

      // Получаем бизнес
      const business = await prisma.businesses.findUnique({
        where: { business_id: order.business_id || 0 }
      });

      // Получаем пользователя
      const user = await prisma.user.findUnique({
        where: { user_id: order.user_id }
      });

      // Получаем статус заказа
      const status = await prisma.order_status.findFirst({
        where: { order_id: orderId },
        orderBy: { log_timestamp: 'desc' }
      });

      // Получаем стоимость заказа
      const cost = await prisma.orders_cost.findFirst({
        where: { order_id: orderId }
      });

      // Получаем сотрудника, который создал заказ (если есть)
      let createdByEmployee = null;
      if (order.created_by) {
        const employee = await prisma.employee.findUnique({
          where: { employee_id: order.created_by },
          select: {
            employee_id: true,
            name: true,
            login: true,
            access_level: true
          }
        });
        createdByEmployee = employee;
      }

      res.json({
        success: true,
        data: {
          order: {
            ...order,
            items,
            business: business ? {
              id: business.business_id,
              name: business.name,
              address: business.address
            } : null,
            user: user ? {
              id: user.user_id,
              name: user.name,
              phone: user.login
            } : null,
            status: status ? {
              status: status.status,
              isCanceled: status.isCanceled,
              log_timestamp: status.log_timestamp
            } : null,
            cost: cost ? {
              cost: Number(cost.cost),
              service_fee: Number(cost.service_fee),
              delivery: Number(cost.delivery)
            } : null,
            created_by_employee: createdByEmployee
          }
        },
        message: 'Заказ найден'
      });

    } catch (error: any) {
      console.error('Ошибка получения заказа:', error);
      next(createError(500, `Ошибка получения заказа: ${error.message}`));
    }
  }

  /**
   * Получение заказов пользователя
   * GET /api/orders/user/:userId
   */
  static async getUserOrders(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = parseInt(req.params.userId);
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const offset = (page - 1) * limit;

      if (isNaN(userId)) {
        return next(createError(400, 'Неверный ID пользователя'));
      }

      // Проверяем права доступа
      if (req.user && req.user.user_id !== userId) {
        return next(createError(403, 'Доступ запрещен'));
      }

      const [orders, total] = await Promise.all([
        prisma.orders.findMany({
          where: { user_id: userId },
          orderBy: { log_timestamp: 'desc' },
          skip: offset,
          take: limit
        }),
        prisma.orders.count({
          where: { user_id: userId }
        })
      ]);

      // Получаем дополнительную информацию для каждого заказа
      const ordersWithDetails = [];
      for (const order of orders) {
        // Получаем бизнес
        const business = await prisma.businesses.findUnique({
          where: { business_id: order.business_id || 0 }
        });

        // Получаем последний статус
        const status = await prisma.order_status.findFirst({
          where: { order_id: order.order_id },
          orderBy: { log_timestamp: 'desc' }
        });

        // Получаем стоимость
        const cost = await prisma.orders_cost.findFirst({
          where: { order_id: order.order_id }
        });

        // Считаем количество товаров
        const itemsCount = await prisma.orders_items.count({
          where: { order_id: order.order_id }
        });

        ordersWithDetails.push({
          ...order,
          business: business ? {
            id: business.business_id,
            name: business.name,
            address: business.address,
            logo: business.logo
          } : null,
          status: status ? {
            status: status.status,
            isCanceled: status.isCanceled,
            log_timestamp: status.log_timestamp
          } : null,
          cost: cost ? {
            cost: Number(cost.cost),
            service_fee: Number(cost.service_fee),
            delivery: Number(cost.delivery)
          } : null,
          items_count: itemsCount
        });
      }

      const totalPages = Math.ceil(total / limit);

      res.json({
        success: true,
        data: {
          orders: ordersWithDetails,
          pagination: {
            current_page: page,
            per_page: limit,
            total,
            total_pages: totalPages
          }
        },
        message: `Найдено ${total} заказов`
      });

    } catch (error: any) {
      console.error('Ошибка получения заказов пользователя:', error);
      next(createError(500, `Ошибка получения заказов: ${error.message}`));
    }
  }

  /**
   * Обновление статуса заказа
   * PUT /api/orders/:id/status
   */
  static async updateOrderStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const orderId = parseInt(req.params.id);
      const { status, isCanceled } = req.body;

      if (isNaN(orderId)) {
        return next(createError(400, 'Неверный ID заказа'));
      }

      if (!status || !Object.values(OrderStatus).includes(status)) {
        return next(createError(400, 'Неверный статус заказа'));
      }

      // Проверяем существование заказа
      const order = await prisma.orders.findUnique({
        where: { order_id: orderId }
      });

      if (!order) {
        return next(createError(404, 'Заказ не найден'));
      }

      // Создаем новую запись статуса
      const statusRecord = await prisma.order_status.create({
        data: {
          order_id: orderId,
          status,
          isCanceled: isCanceled ? 1 : 0,
          log_timestamp: new Date()
        }
      });

      // Если заказ отменяется, обновляем флаг в основной таблице
      if (isCanceled) {
        await prisma.orders.update({
          where: { order_id: orderId },
          data: { is_canceled: 1 }
        });
      }

      // Обновляем время принятия/готовности заказа
      const updateData: any = {};
      if (status === OrderStatus.ACCEPTED && !order.accepted_at) {
        updateData.accepted_at = new Date();
      }
      if (status === OrderStatus.DELIVERED && !order.ready_at) {
        updateData.ready_at = new Date();
      }

      if (Object.keys(updateData).length > 0) {
        await prisma.orders.update({
          where: { order_id: orderId },
          data: updateData
        });
      }

      res.json({
        success: true,
        data: { 
          status_record: statusRecord,
          order_id: orderId,
          new_status: status
        },
        message: 'Статус заказа обновлен'
      });

    } catch (error: any) {
      console.error('Ошибка обновления статуса заказа:', error);
      next(createError(500, `Ошибка обновления статуса: ${error.message}`));
    }
  }

  /**
   * Отмена заказа
   * DELETE /api/orders/:id
   */
  static async cancelOrder(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const orderId = parseInt(req.params.id);

      if (isNaN(orderId)) {
        return next(createError(400, 'Неверный ID заказа'));
      }

      const order = await prisma.orders.findUnique({
        where: { order_id: orderId }
      });

      if (!order) {
        return next(createError(404, 'Заказ не найден'));
      }

      // Проверяем права доступа
      if (req.user && req.user.user_id !== order.user_id) {
        return next(createError(403, 'Доступ запрещен'));
      }

      // Получаем текущий статус
      const currentStatusRecord = await prisma.order_status.findFirst({
        where: { order_id: orderId },
        orderBy: { log_timestamp: 'desc' }
      });

      // Проверяем, можно ли отменить заказ
      const currentStatus = currentStatusRecord?.status;
      if (currentStatus && currentStatus >= OrderStatus.COLLECTED) {
        return next(createError(400, 'Заказ нельзя отменить на текущей стадии'));
      }

      if (order.is_canceled === 1) {
        return next(createError(400, 'Заказ уже отменен'));
      }

      // Отменяем заказ
      await prisma.$transaction([
        prisma.orders.update({
          where: { order_id: orderId },
          data: { is_canceled: 1 }
        }),
        prisma.order_status.create({
          data: {
            order_id: orderId,
            status: OrderStatus.CANCELED,
            isCanceled: 1,
            log_timestamp: new Date()
          }
        })
      ]);

      res.json({
        success: true,
        data: { order_id: orderId },
        message: 'Заказ отменен'
      });

    } catch (error: any) {
      console.error('Ошибка отмены заказа:', error);
      next(createError(500, `Ошибка отмены заказа: ${error.message}`));
    }
  }
}
