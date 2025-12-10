import { Request, Response, NextFunction } from 'express';
import { createError } from '../middleware/errorHandler';
import prisma from '../database';
import BusinessOrderController from './businessOrderController';
import { OrderController } from './orderController';
import { DeliveryController } from './deliveryController';
import { orders_delivery_type } from '@prisma/client';

// Интерфейс для авторизованного запроса сотрудника
export interface EmployeeAuthRequest extends Request {
  employee?: {
    employee_id: number;
    login: string;
    access_level: string;
  };
}

export class EmployeeController {
  private static getStatusName(status: number): string {
    const statusNames: { [key: number]: string } = {
      0: 'Новый заказ',
            1: 'Принят магазином',

      2: 'Готов к выдаче',
      3: 'Доставляется', 
      4: 'Доставлен',
      66: 'не оплачен'
     
    };
    
    return statusNames[status] || 'Неизвестный статус';
  }


  static async getOrders(req: EmployeeAuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.employee) {
        return next(createError(401, 'Требуется авторизация бизнеса'));
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const date_from = req.query.date_from as string;
      const date_to = req.query.date_to as string;
      // Новые фильтры: адрес, телефон, employee_id
      const addressQuery = (req.query.address as string) || (req.query.address_query as string);
      const phoneQuery = req.query.phone as string;
      const employeeFilterId = req.query.employee_id ? parseInt(req.query.employee_id as string, 10) : undefined;

      const offset = (page - 1) * limit;

      // Если есть фильтры по телефону или адресу - используем raw SQL для эффективного поиска
      if (phoneQuery || addressQuery) {
        const normalizePhone = (s: string) => (s || '').replace(/[^\d]/g, '');
        const phoneNeedle = phoneQuery ? normalizePhone(phoneQuery) : '';
        const addrNeedle = addressQuery ? String(addressQuery).toLowerCase() : '';

        // Формируем SQL запрос с JOIN для поиска
        let sqlWhere = 'WHERE o.order_id > 1';
        const sqlParams: any[] = [];
        let paramIndex = 1;

        if (employeeFilterId && !isNaN(employeeFilterId)) {
          sqlWhere += ` AND o.employee_id = ?`;
          sqlParams.push(employeeFilterId);
          paramIndex++;
        }

        if (phoneNeedle) {
          // Поиск по телефону в таблице user
          sqlWhere += ` AND REPLACE(REPLACE(REPLACE(u.login, '+', ''), ' ', ''), '-', '') LIKE ?`;
          sqlParams.push(`%${phoneNeedle}%`);
          paramIndex++;
        }

        if (addrNeedle) {
          // Поиск по адресу в таблице user_addreses
          sqlWhere += ` AND (LOWER(a.address) LIKE ? OR LOWER(a.name) LIKE ?)`;
          sqlParams.push(`%${addrNeedle}%`, `%${addrNeedle}%`);
          paramIndex += 2;
        }

        // Получаем order_id заказов, соответствующих фильтрам
        const orderIdsRaw: any = await prisma.$queryRawUnsafe(`
          SELECT DISTINCT o.order_id
          FROM orders o
          LEFT JOIN users u ON o.user_id = u.user_id
          LEFT JOIN user_addreses a ON o.address_id = a.address_id
          ${sqlWhere}
          ORDER BY o.order_id DESC
          LIMIT ${limit} OFFSET ${offset}
        `, ...sqlParams);

        const totalCountRaw: any = await prisma.$queryRawUnsafe(`
          SELECT COUNT(DISTINCT o.order_id) as total
          FROM orders o
          LEFT JOIN users u ON o.user_id = u.user_id
          LEFT JOIN user_addreses a ON o.address_id = a.address_id
          ${sqlWhere}
        `, ...sqlParams);

        const orderIds = orderIdsRaw.map((row: any) => row.order_id);
        const totalCount = Number(totalCountRaw[0]?.total || 0);

        if (orderIds.length === 0) {
          return res.json({
            success: true,
            data: {
              orders: [],
              pagination: {
                page,
                limit,
                total: totalCount,
                totalPages: Math.ceil(totalCount / limit),
                hasNext: false,
                hasPrev: false
              }
            },
            message: 'Заказы не найдены'
          });
        }

        // Загружаем полные данные только для найденных заказов
        const orders = await prisma.orders.findMany({
          where: { order_id: { in: orderIds } },
          orderBy: { order_id: 'desc' }
        });

        // Продолжаем обработку заказов...
        const [users, addresses, statuses, orderItems, orderCosts, paymentTypes] = await Promise.all([
          prisma.user.findMany({
            where: { user_id: { in: orders.map(o => o.user_id) } },
            select: { user_id: true, name: true, first_name: true, last_name: true, login: true }
          }),
          prisma.user_addreses.findMany({
            where: { address_id: { in: orders.map(o => o.address_id).filter(id => id) } },
            select: { address_id: true, name: true, address: true, lat: true, lon: true, apartment: true, entrance: true, floor: true, other: true }
          }),
          prisma.order_status.findMany({
            where: { order_id: { in: orderIds } },
            orderBy: { log_timestamp: 'desc' }
          }),
          prisma.orders_items.findMany({
            where: { order_id: { in: orderIds } }
          }),
          prisma.orders_cost.findMany({
            where: { order_id: { in: orderIds } }
          }),
          prisma.payment_types.findMany({
            where: { payment_type_id: { in: orders.map(o => o.payment_type_id).filter(id => id !== null) as number[] } }
          })
        ]);

        const usersMap = new Map(users.map(u => [u.user_id, u]));
        const addressesMap = new Map(addresses.map(a => [a.address_id, a]));
        const statusesMap = new Map();
        statuses.forEach(status => {
          const currentStatus = statusesMap.get(status.order_id);
          if (!currentStatus || new Date(status.log_timestamp) > new Date(currentStatus.log_timestamp)) {
            statusesMap.set(status.order_id, status);
          }
        });
        const paymentTypesMap = new Map(paymentTypes.map(pt => [pt.payment_type_id, pt]));
        const orderItemsMap = new Map<number, any[]>();
        orderItems.forEach(item => {
          if (!orderItemsMap.has(item.order_id)) orderItemsMap.set(item.order_id, []);
          orderItemsMap.get(item.order_id)!.push(item);
        });
        const orderCostsMap = new Map(orderCosts.map(c => [Number(c.order_id), c]));

        const formattedOrders = orders.map(order => {
          const user = usersMap.get(order.user_id);
          const address = addressesMap.get(order.address_id);
          const currentStatus = statusesMap.get(order.order_id);
          const paymentType = paymentTypesMap.get(order.payment_type_id || 0);
          const items = orderItemsMap.get(order.order_id) || [];
          const cost = orderCostsMap.get(order.order_id);
          const totalItemsCount = items.reduce((sum, item) => sum + (item.amount || 0), 0);

          return {
            order_id: order.order_id,
            order_uuid: order.order_uuid,
            user: user ? {
              user_id: user.user_id,
              name: user.name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Пользователь'
            } : null,
            delivery_address: address ? {
              address_id: address.address_id,
              name: address.name,
              address: address.address,
              coordinates: { lat: address.lat, lon: address.lon },
              details: { apartment: address.apartment, entrance: address.entrance, floor: address.floor, comment: address.other }
            } : null,
            delivery_type: order.delivery_type,
            delivery_price: order.delivery_price,
            cost: cost ? Number(cost.cost) : 0,
            service_fee: cost ? Number(cost.service_fee) : 0,
            total_cost: (cost ? Number(cost.cost) : 0) + order.delivery_price + (cost ? Number(cost.service_fee) : 0),
            payment_type: paymentType ? { payment_type_id: paymentType.payment_type_id, name: paymentType.name } : null,
            current_status: currentStatus ? {
              status: currentStatus.status,
              status_name: EmployeeController.getStatusName(currentStatus.status),
              timestamp: currentStatus.log_timestamp,
              isCanceled: currentStatus.isCanceled
            } : {
              status: 1,
              status_name: EmployeeController.getStatusName(1),
              timestamp: order.log_timestamp,
              isCanceled: 0
            },
            items_count: totalItemsCount,
            extra: order.extra,
            delivery_date: order.delivery_date,
            log_timestamp: order.log_timestamp,
            bonus: order.bonus
          };
        });

        const totalPages = Math.ceil(totalCount / limit);
        return res.json({
          success: true,
          data: {
            orders: formattedOrders,
            pagination: {
              page,
              limit,
              total: totalCount,
              totalPages,
              hasNext: page < totalPages,
              hasPrev: page > 1
            }
          },
          message: `Найдено ${totalCount} заказов`
        });
      }

      // Базовое условие фильтрации без поиска
      let whereCondition: any = {
        order_id: { gt: 1 }
      };

      // Фильтр по employee_id на уровне БД, если передан
      if (employeeFilterId && !isNaN(employeeFilterId)) {
        whereCondition.employee_id = employeeFilterId;
      }

      // Получаем заказы с пагинацией на уровне БД
      const [orders, totalCount] = await Promise.all([
        prisma.orders.findMany({
          where: whereCondition,
          orderBy: {
            order_id: 'desc'
          },
          skip: offset,
          take: limit
        }),
        prisma.orders.count({
          where: whereCondition
        })
      ]);

      if (orders.length === 0) {
        return res.json({
          success: true,
          data: {
            orders: [],
            pagination: {
              page,
              limit,
              total: 0,
              totalPages: 0,
              hasNext: false,
              hasPrev: false
            },
            
          },
          message: 'Заказы не найдены'
        });
      }

      // Получаем ID заказов для дополнительных запросов
      const orderIds = orders.map(order => order.order_id);

      // Получаем дополнительные данные параллельно
      const [
        users,
        addresses,
        statuses,
        orderItems,
        orderCosts,
        paymentTypes
      ] = await Promise.all([
        // Пользователи
        prisma.user.findMany({
          where: { user_id: { in: orders.map(o => o.user_id) } },
          select: {
            user_id: true,
            name: true,
            first_name: true,
            last_name: true,
            login: true // номер телефона/логин для поиска
          }
        }),
        // Адреса
        prisma.user_addreses.findMany({
          where: { address_id: { in: orders.map(o => o.address_id).filter(id => id) } },
          select: {
            address_id: true,
            name: true,
            address: true,
            lat: true,
            lon: true,
            apartment: true,
            entrance: true,
            floor: true,
            other: true
          }
        }),
        // Статусы (все статусы для заказов)
        prisma.order_status.findMany({
          where: { order_id: { in: orderIds } },
          orderBy: {
            log_timestamp: 'desc'
          }
        }),
        // Товары заказов
        prisma.orders_items.findMany({
          where: { order_id: { in: orderIds } }
        }),
        // Стоимость заказов
        prisma.orders_cost.findMany({
          where: { order_id: { in: orderIds } }
        }),
        // Типы оплаты
        prisma.payment_types.findMany({
          where: { payment_type_id: { in: orders.map(o => o.payment_type_id).filter(id => id !== null) as number[] } }
        })
      ]);

      // Создаем мапы для быстрого доступа
      const usersMap = new Map(users.map(u => [u.user_id, u]));
      const addressesMap = new Map(addresses.map(a => [a.address_id, a]));
      
      // Создаем карту последних статусов для каждого заказа
      const statusesMap = new Map();
      statuses.forEach(status => {
        const currentStatus = statusesMap.get(status.order_id);
        if (!currentStatus || new Date(status.log_timestamp) > new Date(currentStatus.log_timestamp)) {
          statusesMap.set(status.order_id, status);
        }
      });
      
      const paymentTypesMap = new Map(paymentTypes.map(pt => [pt.payment_type_id, pt]));
      
      // Группируем товары по заказам
      const orderItemsMap = new Map<number, any[]>();
      orderItems.forEach(item => {
        if (!orderItemsMap.has(item.order_id)) {
          orderItemsMap.set(item.order_id, []);
        }
        orderItemsMap.get(item.order_id)!.push(item);
      });

      // Группируем стоимость по заказам
      const orderCostsMap = new Map(orderCosts.map(c => [Number(c.order_id), c]));

      // Форматируем данные заказов
      const formattedOrders = orders.map(order => {
        const user = usersMap.get(order.user_id);
        const address = addressesMap.get(order.address_id);
        const currentStatus = statusesMap.get(order.order_id);
        const paymentType = paymentTypesMap.get(order.payment_type_id || 0);
        const items = orderItemsMap.get(order.order_id) || [];
        const cost = orderCostsMap.get(order.order_id);
        
        const totalItemsCount = items.reduce((sum, item) => sum + (item.amount || 0), 0);
        
        return {
          order_id: order.order_id,
          order_uuid: order.order_uuid,
          user: user ? {
            user_id: user.user_id,
            name: user.name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Пользователь'
          } : null,
          delivery_address: address ? {
            address_id: address.address_id,
            name: address.name,
            address: address.address,
            coordinates: {
              lat: address.lat,
              lon: address.lon
            },
            details: {
              apartment: address.apartment,
              entrance: address.entrance,
              floor: address.floor,
              comment: address.other
            }
          } : null,
          delivery_type: order.delivery_type,
          delivery_price: order.delivery_price,
          cost: cost ? Number(cost.cost) : 0,
          service_fee: cost ? Number(cost.service_fee) : 0,
          total_cost: (cost ? Number(cost.cost) : 0) + order.delivery_price + (cost ? Number(cost.service_fee) : 0),
          payment_type: paymentType ? {
            payment_type_id: paymentType.payment_type_id,
            name: paymentType.name
          } : null,
          current_status: currentStatus ? {
            status: currentStatus.status,
            status_name: EmployeeController.getStatusName(currentStatus.status),
            timestamp: currentStatus.log_timestamp,
            isCanceled: currentStatus.isCanceled
          } : {
            status: 1,
            status_name: EmployeeController.getStatusName(1),
            timestamp: order.log_timestamp,
            isCanceled: 0
          },
          items_count: totalItemsCount,
          extra: order.extra,
          delivery_date: order.delivery_date,
          log_timestamp: order.log_timestamp,
          bonus: order.bonus
        };
      });

      const totalPages = Math.ceil(totalCount / limit);

      res.json({
        success: true,
        data: {
          orders: formattedOrders,
          pagination: {
            page,
            limit,
            total: totalCount,
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1
          },
          
        },
        message: `Найдено ${totalCount} заказов`
      });

    } catch (error) {
      console.error('Ошибка получения заказов бизнеса:', error);
      return next(createError(500, 'Ошибка получения заказов бизнеса'));
    }
  }

  /**
   * Получение заказа по ID
   * GET /api/employee/orders/:orderId
   */
  static async getOrderById(req: EmployeeAuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.employee) {
        return next(createError(401, 'Требуется авторизация бизнеса'));
      }

      const order_id = parseInt(req.params.orderId);

      if (isNaN(order_id)) {
        return next(createError(400, 'Некорректный ID заказа'));
      }

      // Получаем заказ
      const order = await prisma.orders.findFirst({
        where: {
          order_id: order_id,
        }
      });

      if (!order) {
        return next(createError(404, 'Заказ не найден или не принадлежит данному бизнесу'));
      }

      // Получаем дополнительные данные параллельно
      const [
        user,
        address,
        statuses,
        orderItems,
        orderCost,
        paymentType
      ] = await Promise.all([
        // Пользователь
        prisma.user.findUnique({
          where: { user_id: order.user_id },
          select: {
            user_id: true,
            name: true,
            first_name: true,
            last_name: true
          }
        }),
        // Адрес
        order.address_id ? prisma.user_addreses.findUnique({
          where: { address_id: order.address_id },
          select: {
            address_id: true,
            name: true,
            address: true,
            lat: true,
            lon: true,
            apartment: true,
            entrance: true,
            floor: true,
            other: true
          }
        }) : null,
        // Все статусы заказа (история)
        prisma.order_status.findMany({
          where: { order_id: order_id },
          orderBy: {
            log_timestamp: 'desc'
          }
        }),
        // Товары заказа
        prisma.orders_items.findMany({
          where: { order_id: order_id },
          select: {
            relation_id: true,
            order_id: true,
            item_id: true,
            amount: true,
            price: true,
            marketing_promotion_detail_id: true
          }
        }),
        // Стоимость заказа
        prisma.orders_cost.findFirst({
          where: { order_id: order_id }
        }),
        // Тип оплаты
        order.payment_type_id ? prisma.payment_types.findUnique({
          where: { payment_type_id: order.payment_type_id }
        }) : null
      ]);

      // Получаем пересчитанную стоимость заказа через OrderController
      const orderTotals = await OrderController.calculateOrderCostPublic(order_id);

      // Получаем текущий статус (последний)
      const currentStatus = statuses.length > 0 ? statuses[0] : null;

      // Форматируем товары с полной информацией
      const itemsWithDetails = await Promise.all(
        orderItems.map(async (orderItem: any) => {
          const item = await prisma.items.findUnique({
            where: { item_id: orderItem.item_id },
            select: {
              item_id: true,
              name: true,
              description: true,
              img: true,
              unit: true,
              price: true
            }
          });

          // Получаем информацию о примененной скидке, если есть
          let appliedPromotion = null;
          const promotionDetail: any = await prisma.$queryRaw`
            SELECT 
              mpd.detail_id,
              mpd.type,
              mpd.base_amount,
              mpd.add_amount,
              mpd.discount,
              mp.marketing_promotion_id,
              mp.name as promotion_name,
              mp.start_promotion_date,
              mp.end_promotion_date
            FROM marketing_promotion_details mpd
            LEFT JOIN marketing_promotions mp ON mp.marketing_promotion_id = mpd.marketing_promotion_id
            WHERE mpd.item_id = ${orderItem.item_id}
              AND mp.start_promotion_date < ${order.log_timestamp}
              AND mp.end_promotion_date > ${order.log_timestamp}
              AND mp.visible = 1
            ORDER BY mpd.discount DESC
            LIMIT 1
          `;

          if (promotionDetail && promotionDetail.length > 0) {
            const promo = promotionDetail[0];
            appliedPromotion = {
              promotion_id: promo.marketing_promotion_id,
              promotion_name: promo.promotion_name,
              detail_id: promo.detail_id,
              type: promo.type,
              discount: Number(promo.discount || 0),
              base_amount: Number(promo.base_amount || 0),
              add_amount: Number(promo.add_amount || 0),
              start_date: promo.start_promotion_date,
              end_date: promo.end_promotion_date
            };
          }

          // Получаем опции для этого товара заказа по order_item_relation_id
          const itemOptions = await prisma.order_items_options.findMany({
            where: { order_item_relation_id: orderItem.relation_id }
          });

          // Форматируем опции товара
          const formattedItemOptions = await Promise.all(
            itemOptions.map(async (option: any) => {
              // Получаем информацию об опции через option_items
              const optionItem = await prisma.option_items.findUnique({
                where: { relation_id: option.option_item_relation_id },
                select: {
                  relation_id: true,
                  option_id: true,
                  item_id: true,
                  price: true
                }
              });

              // Получаем название опции
              let optionDetail = null;
              if (optionItem) {
                optionDetail = await prisma.options.findUnique({
                  where: { option_id: optionItem.option_id },
                  select: {
                    option_id: true,
                    name: true
                  }
                });
              }

              // Получаем название продукта опции по item_id из option_items
              let optionItemDetail = null;
              if (optionItem && optionItem.item_id) {
                optionItemDetail = await prisma.items.findUnique({
                  where: { item_id: optionItem.item_id },
                  select: {
                    item_id: true,
                    name: true,
                    price: true
                  }
                });
              }

              return {
                option_id: optionItem?.option_id || 0,
                option_name: optionDetail?.name || 'Неизвестная категория опции',
                item_id: optionItem?.item_id || 0,
                name: optionItemDetail?.name || 'Неизвестная опция',
                price: Number(optionItem?.price || 0),
                selected_price: Number(option.price || 0),
                amount: Number(option.amount || 1)
              };
            })
          );

          // Рассчитываем финальную цену с учетом скидки
          const originalPrice = Number(item?.price || 0);
          const itemPrice = Number(orderItem.price || 0);
          const amount = Number(orderItem.amount || 0);
          
          let finalPrice = itemPrice;
          let discountAmount = 0;
          let effectiveAmount = amount; // Эффективное количество с учетом акции
          
          if (appliedPromotion) {
            if (appliedPromotion.type === 'SUBTRACT') {
              // Для акции типа SUBTRACT: делим количество товара на (base_amount + add_amount)
              // и вычитаем результат из количества
              const baseAmount = Number(appliedPromotion.base_amount || 0);
              const addAmount = Number(appliedPromotion.add_amount || 0);
              const divisor = baseAmount + addAmount;
              
              if (divisor > 0) {
                const freeItems = Math.floor(amount / divisor);
                effectiveAmount = amount - freeItems;
              }
            } else if (appliedPromotion.discount > 0) {
              // Для обычных скидок (процентная скидка)
              discountAmount = itemPrice * (appliedPromotion.discount / 100);
              finalPrice = itemPrice - discountAmount;
            }
          }

          return {
            relation_id: orderItem.relation_id,
            item_id: orderItem.item_id,
            name: item?.name || 'Неизвестный товар',
            description: item?.description || '',
            img: item?.img || '',
            amount: amount,
            price: itemPrice,
            unit: item?.unit || 'шт',
            original_price: originalPrice,
            final_price: finalPrice,
            discount_amount: discountAmount,
            effective_amount: effectiveAmount,
            total_cost: effectiveAmount * finalPrice,
            applied_promotion: appliedPromotion,
            options: formattedItemOptions
          };
        })
      );

      // Форматируем историю статусов
      const statusHistory = statuses.map((status: any) => ({
        status_id: status.status_id,
        status: status.status,
        status_name: EmployeeController.getStatusName(status.status),
        timestamp: status.log_timestamp,
        isCanceled: status.isCanceled
      }));

      // Рассчитываем общие показатели с использованием локальных расчетов
      const itemsTotal = itemsWithDetails.reduce((sum: number, item: any) => sum + item.total_cost, 0);
      const totalItemsCount = itemsWithDetails.reduce((sum: number, item: any) => sum + item.amount, 0);
      
      // Рассчитываем стоимость опций
      const optionsTotal = itemsWithDetails.reduce((sum: number, item: any) => {
        return sum + item.options.reduce((optSum: number, opt: any) => {
          return optSum + (opt.selected_price * opt.amount);
        }, 0);
      }, 0);
      
      const subtotal = itemsTotal + optionsTotal;
      const serviceFee = orderCost ? Number(orderCost.service_fee) : 0;
      const deliveryPrice = order.delivery_price;
      const bonusUsed = Number(order.bonus || 0);
      const totalCost = subtotal + deliveryPrice + serviceFee - bonusUsed;

      const formattedOrder = {
        order_id: order.order_id,
        order_uuid: order.order_uuid,
        user: user ? {
          user_id: user.user_id,
          name: user.name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Пользователь'
        } : null,
        delivery_address: address ? {
          address_id: address.address_id,
          name: address.name,
          address: address.address,
          coordinates: {
            lat: address.lat,
            lon: address.lon
          },
          details: {
            apartment: address.apartment,
            entrance: address.entrance,
            floor: address.floor,
            comment: address.other
          }
        } : null,
        delivery_type: order.delivery_type,
        delivery_date: order.delivery_date,
        payment_type: paymentType ? {
          payment_type_id: paymentType.payment_type_id,
          name: paymentType.name
        } : null,
        current_status: currentStatus ? {
          status: currentStatus.status,
          status_name: EmployeeController.getStatusName(currentStatus.status),
          timestamp: currentStatus.log_timestamp,
          isCanceled: currentStatus.isCanceled
        } : {
          status: 0,
          status_name: EmployeeController.getStatusName(0),
          timestamp: order.log_timestamp,
          isCanceled: 0
        },
        status_history: statusHistory,
        items: itemsWithDetails,
        items_count: totalItemsCount,
        cost_summary: {
          items_total: itemsTotal,
          delivery_price: deliveryPrice,
          service_fee: serviceFee,
          bonus_used: bonusUsed,
          subtotal: subtotal,
          total_sum: totalCost
        },
        extra: order.extra,
        created_at: order.log_timestamp,
        bonus: order.bonus
      };

      res.json({
        success: true,
        data: {
          order: formattedOrder,
          
        },
        message: `Заказ #${order_id} получен`
      });

    } catch (error) {
      console.error('Ошибка получения заказа:', error);
      return next(createError(500, 'Ошибка получения заказа'));
    }
  }

  /**
   * Создание заказа сотрудником (call-center)
   * POST /api/employee/create-order
   */
  static async createOrder(req: EmployeeAuthRequest, res: Response, next: NextFunction) {
    try {
      const { 
        business_id, 
        client_id, // ID клиента из таблицы users
        street,
        house,
        apartment,
        entrance,
        floor,
        comment,
        lat,
        lon,
        items, 
        bonus_amount = 0, 
        extra = '',
        delivery_type = 'DELIVERY',
        delivery_date,
        payment_method // ID метода оплаты
      } = req.body;

      // Проверяем авторизацию сотрудника
      if (!req.employee) {
        return next(createError(401, 'Необходима авторизация сотрудника'));
      }

      const employee_id = req.employee.employee_id;

      // Входные проверки
      if (!business_id || !items || items.length === 0) {
        return next(createError(400, 'Не все обязательные поля заполнены (business_id, items)'));
      }

      if (!payment_method) {
        return next(createError(400, 'Необходимо указать метод оплаты (payment_method: ID метода оплаты)'));
      }

      // Валидация метода оплаты - должен быть числом
      const payment_type_id = typeof payment_method === 'string' ? parseInt(payment_method) : payment_method;
      if (isNaN(payment_type_id) || payment_type_id <= 0) {
        return next(createError(400, 'payment_method должен быть числом (ID метода оплаты)'));
      }

      // Проверяем наличие client_id
      if (!client_id) {
        return next(createError(400, 'Необходимо указать client_id'));
      }

      // Проверяем существование клиента в таблице users
      const user = await prisma.user.findUnique({
        where: { user_id: client_id }
      });

      if (!user) {
        return next(createError(404, `Клиент с ID ${client_id} не найден`));
      }

      const final_user_id = client_id;
      console.log('Найден клиент:', user.login || user.name || `ID: ${client_id}`);

      // Проверяем корректность данных товаров
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!item.item_id || typeof item.item_id !== 'number') {
          return next(createError(400, `Товар ${i + 1}: отсутствует или некорректный item_id`));
        }
        
        const amount = typeof item.amount === 'string' ? parseFloat(item.amount) : item.amount;
        if (!item.amount || isNaN(amount) || amount <= 0) {
          return next(createError(400, `Товар ${i + 1}: отсутствует или некорректное количество amount`));
        }
        
        item.amount = amount;
      }

      // Для доставки проверяем адрес
      if (delivery_type === 'DELIVERY' || delivery_type === 'SCHEDULED') {
        if (!street || !house || lat === undefined || lon === undefined) {
          const deliveryTypeText = delivery_type === 'SCHEDULED' ? 'запланированной доставки' : 'доставки';
          return next(createError(400, `Для ${deliveryTypeText} необходимо указать адрес: street, house, lat, lon`));
        }
      }

      // Для запланированной доставки проверяем дату
      if (delivery_type === 'SCHEDULED') {
        if (!delivery_date) {
          return next(createError(400, 'Для запланированной доставки необходимо указать дату delivery_date'));
        }
        
        const scheduledDate = new Date(delivery_date);
        const now = new Date();
        
        if (scheduledDate <= now) {
          return next(createError(400, 'Дата запланированной доставки должна быть в будущем'));
        }
        
        const maxFutureDate = new Date();
        maxFutureDate.setDate(maxFutureDate.getDate() + 30);
        
        if (scheduledDate > maxFutureDate) {
          return next(createError(400, 'Дата запланированной доставки не может быть более чем на 30 дней вперед'));
        }
        
        console.log('Запланированная доставка на:', scheduledDate.toISOString());
      }

      console.log('Начинаем создание заказа сотрудником:', employee_id, 'для пользователя:', final_user_id);
      console.log('Получены товары:', JSON.stringify(items, null, 2));
      console.log('Метод оплаты:', payment_method);

      // Проверяем существование бизнеса
      const business = await prisma.businesses.findUnique({
        where: { business_id }
      });

      if (!business) {
        return next(createError(404, 'Бизнес не найден'));
      }

      // Проверяем существование метода оплаты по ID
      const paymentType = await prisma.payment_types.findUnique({
        where: { payment_type_id }
      });

      if (!paymentType) {
        return next(createError(404, `Метод оплаты с ID ${payment_type_id} не найден в базе данных`));
      }

      console.log('Найден метод оплаты:', paymentType.name, 'с ID:', payment_type_id);

      // Рассчитываем стоимость доставки ДО транзакции
      let deliveryPrice = 0;
      if (delivery_type === 'DELIVERY' || delivery_type === 'SCHEDULED') {
        try {
          const deliveryResult = await DeliveryController.calculateDeliveryZone({
            lat: parseFloat(lat),
            lon: parseFloat(lon),
            business_id
          });
          
          if (deliveryResult.in_zone && deliveryResult.price !== false) {
            // Округляем стоимость доставки до ближайших 50 тенге
            const rawPrice = Number(deliveryResult.price);
            deliveryPrice = Math.ceil(rawPrice / 50) * 50;
            
            if (delivery_type === 'SCHEDULED') {
              console.log('Рассчитана стоимость запланированной доставки:', deliveryPrice, '(исходная:', rawPrice, ')');
            } else {
              console.log('Рассчитана стоимость обычной доставки:', deliveryPrice, '(исходная:', rawPrice, ')');
            }
          } else {
            const deliveryTypeText = delivery_type === 'SCHEDULED' ? 'Запланированная доставка' : 'Доставка';
            return next(createError(400, `${deliveryTypeText} недоступна: ${deliveryResult.message}`));
          }
        } catch (deliveryError: any) {
          console.error('Ошибка расчета доставки:', deliveryError);
          return next(createError(500, 'Ошибка расчета доставки'));
        }
      }

      // Создаем заказ и все связанные данные в транзакции
      const orderResult = await prisma.$transaction(async (tx) => {
        let address_id = null;

        // Создаем адрес для доставки, если это доставка
        if (delivery_type === 'DELIVERY' || delivery_type === 'SCHEDULED') {
          const addressData = {
            user_id: final_user_id,
            address: street + ', ' + house + (apartment ? ', кв.' + apartment : ''),
            name: delivery_type === 'SCHEDULED' ? 'Адрес запланированной доставки' : 'Адрес доставки',
            apartment: apartment || '',
            entrance: entrance || '',
            floor: floor || '',
            other: comment || '',
            lat: parseFloat(lat),
            lon: parseFloat(lon),
            isDeleted: 0
          };

          const newAddress = await tx.user_addreses.create({
            data: addressData
          });

          address_id = newAddress.address_id;
          const addressType = delivery_type === 'SCHEDULED' ? 'запланированной доставки' : 'доставки';
          console.log(`Создан новый адрес ${addressType} с ID:`, address_id);
        }

        // Создаем заказ
        const orderData: any = {
          business_id,
          user_id: final_user_id,
          employee_id, // ID сотрудника, создавшего заказ
          order_uuid: null, // Для заказов call-center order_uuid = null
          address_id: address_id || 1,
          delivery_price: deliveryPrice,
          bonus: bonus_amount,
          extra: extra, // Дополнительная информация от пользователя
          payment_type_id: payment_type_id, // ID метода оплаты
          delivery_type: delivery_type as orders_delivery_type,
          delivery_date: delivery_date ? new Date(delivery_date) : null,
          is_canceled: 0
        };

        const order = await tx.orders.create({
          data: orderData
        });

        console.log('Создан заказ с ID:', order.order_id);

        // Создаем статус заказа (статус 0 - новый заказ, оплаченный)
        await tx.order_status.create({
          data: {
            order_id: order.order_id,
            status: 0, // Статус 0 - новый заказ (оплаченный)
            isCanceled: 0,
            log_timestamp: new Date()
          }
        });

        console.log('Создан статус заказа (status=0) для order_id:', order.order_id);

        // Добавляем товары в заказ
        for (const item of items) {
          if (!item.item_id || typeof item.item_id !== 'number') {
            throw new Error(`Некорректный item_id: ${item.item_id}`);
          }
          
          console.log('Обрабатываем товар с ID:', item.item_id);
          
          // Получаем данные товара для определения цены
          const itemData = await tx.items.findUnique({
            where: { item_id: item.item_id }
          });

          if (!itemData) {
            throw new Error(`Товар с ID ${item.item_id} не найден`);
          }

          const itemPrice = Number(itemData.price || 0);

          // Проверяем активные акции для данного товара
          let appliedPromotionDetailId = null;
          
          const now = new Date();
          const promotionDetailsRaw = await tx.$queryRaw`
            SELECT 
              mpd.detail_id,
              mpd.type,
              mpd.base_amount,
              mpd.add_amount,
              mpd.discount,
              mp.start_promotion_date,
              mp.end_promotion_date
            FROM marketing_promotion_details mpd
            LEFT JOIN marketing_promotions mp ON mp.marketing_promotion_id = mpd.marketing_promotion_id
            WHERE mpd.item_id = ${item.item_id}
              AND mp.start_promotion_date < NOW()
              AND mp.end_promotion_date > NOW()
              AND mp.visible = 1
            ORDER BY mpd.discount DESC
            LIMIT 1
          `;

          if (Array.isArray(promotionDetailsRaw) && promotionDetailsRaw.length > 0) {
            appliedPromotionDetailId = (promotionDetailsRaw[0] as any).detail_id;
            console.log('Применена акция detail_id:', appliedPromotionDetailId, 'для товара:', item.item_id);
          }

          const orderItem = await tx.orders_items.create({
            data: {
              order_id: order.order_id,
              item_id: item.item_id,
              amount: item.amount,
              price: itemPrice,
              marketing_promotion_detail_id: appliedPromotionDetailId
            }
          });

          console.log('Добавлен товар:', orderItem);

          // Добавляем опции товара
          if (item.options && item.options.length > 0) {
            for (const option of item.options) {
              const optionData = await tx.option_items.findUnique({
                where: { relation_id: option.option_item_relation_id }
              });

              if (optionData) {
                await tx.order_items_options.create({
                  data: {
                    order_item_relation_id: orderItem.relation_id,
                    item_id: optionData.item_id,
                    option_item_relation_id: option.option_item_relation_id,
                    order_id: order.order_id,
                    price: Number(optionData.price || 0),
                    amount: item.amount / (optionData.parent_item_amount || 1)
                  }
                });
              }
            }
          }
        }

        // Рассчитываем итоговую стоимость заказа
        // Используем raw SQL для расчета
        const totalResult: any = await tx.$queryRaw`
          SELECT 
            COALESCE(SUM(
              CASE 
                WHEN mpd.discount IS NOT NULL THEN 
                  oi.price * oi.amount * (1 - mpd.discount / 100)
                ELSE 
                  oi.price * oi.amount
              END
            ), 0) as items_sum
          FROM orders_items oi
          LEFT JOIN marketing_promotion_details mpd ON oi.marketing_promotion_detail_id = mpd.detail_id
          WHERE oi.order_id = ${order.order_id}
        `;

        const optionsResult: any = await tx.$queryRaw`
          SELECT COALESCE(SUM(price * amount), 0) as options_sum
          FROM order_items_options
          WHERE order_id = ${order.order_id}
        `;

        const sum_before_delivery = Number(totalResult[0]?.items_sum || 0) + Number(optionsResult[0]?.options_sum || 0);
        const total_sum = sum_before_delivery + deliveryPrice;
        const totals = { sum_before_delivery, total_sum };
        
        console.log('Заказ создан сотрудником. Итоговая сумма:', totals.total_sum);
        console.log('Сумма до доставки:', totals.sum_before_delivery, 'Стоимость доставки:', deliveryPrice);
        console.log('Метод оплаты ID:', payment_type_id);

        return {
          success: true,
          order_id: order.order_id,
          total_sum: totals.total_sum,
          delivery_price: deliveryPrice,
          address_id,
          payment_type_id
        };
      }, {
        maxWait: 10000,
        timeout: 100000
      });

      res.status(201).json({
        success: true,
        data: {
          order_id: orderResult.order_id,
          order_uuid: null,
          total_sum: orderResult.total_sum,
          delivery_price: orderResult.delivery_price,
          address_id: orderResult.address_id,
          is_canceled: 0,
          delivery_type: delivery_type,
          payment_type_id: orderResult.payment_type_id,
          created_by: 'call_center',
          employee_id
        },
        message: `Заказ успешно создан сотрудником. Метод оплаты ID: ${payment_type_id}`
      });

    } catch (error: any) {
      console.error('Ошибка создания заказа сотрудником:', error);
      next(createError(500, `Ошибка создания заказа: ${error.message}`));
    }
  }

  // ============================
  // Управление категориями (только для SUPERVISOR и ADMIN)
  // ============================

  /**
   * Получение полной структуры категорий и суперкатегорий для управления
   * GET /api/employee/categories/structure
   */
  static async getCategoriesStructure(req: EmployeeAuthRequest, res: Response, next: NextFunction) {
    try {
      // Получаем все суперкатегории
      const supercategories = await prisma.supercategories.findMany({
        orderBy: { priority: 'desc' }
      });

      // Получаем все категории (включая скрытые для управления)
      const allCategories = await prisma.categories.findMany({
        orderBy: [
          { supercategory_id: 'asc' },
          { parent_category: 'asc' },
          { name: 'asc' }
        ]
      });

      // Группируем категории по суперкатегориям
      const structure = supercategories.map(supercat => {
        // Получаем корневые категории для этой суперкатегории
        const rootCategories = allCategories
          .filter(cat => cat.supercategory_id === supercat.supercategory_id && cat.parent_category === 0)
          .map(rootCat => {
            // Получаем подкатегории для каждой корневой категории
            const subcategories = allCategories
              .filter(cat => cat.parent_category === rootCat.category_id)
              .map(subcat => ({
                category_id: subcat.category_id,
                name: subcat.name,
                img: subcat.img,
                photo: subcat.photo,
                visible: subcat.visible,
                parent_category: subcat.parent_category,
                supercategory_id: subcat.supercategory_id
              }));

            return {
              category_id: rootCat.category_id,
              name: rootCat.name,
              img: rootCat.img,
              photo: rootCat.photo,
              visible: rootCat.visible,
              parent_category: rootCat.parent_category,
              supercategory_id: rootCat.supercategory_id,
              subcategories
            };
          });

        return {
          supercategory_id: supercat.supercategory_id,
          name: supercat.name,
          priority: supercat.priority,
          categories: rootCategories
        };
      });

      // Добавляем категории без суперкатегории (если есть)
      const orphanCategories = allCategories
        .filter(cat => !cat.supercategory_id && cat.parent_category === 0)
        .map(rootCat => {
          const subcategories = allCategories
            .filter(cat => cat.parent_category === rootCat.category_id)
            .map(subcat => ({
              category_id: subcat.category_id,
              name: subcat.name,
              img: subcat.img,
              photo: subcat.photo,
              visible: subcat.visible,
              parent_category: subcat.parent_category,
              supercategory_id: subcat.supercategory_id
            }));

          return {
            category_id: rootCat.category_id,
            name: rootCat.name,
            img: rootCat.img,
            photo: rootCat.photo,
            visible: rootCat.visible,
            parent_category: rootCat.parent_category,
            supercategory_id: rootCat.supercategory_id,
            subcategories
          };
        });

      res.json({
        success: true,
        data: {
          supercategories: structure,
          orphan_categories: orphanCategories,
          stats: {
            total_supercategories: supercategories.length,
            total_categories: allCategories.filter(c => c.parent_category === 0).length,
            total_subcategories: allCategories.filter(c => c.parent_category !== 0).length,
            visible_categories: allCategories.filter(c => c.visible === 1).length,
            hidden_categories: allCategories.filter(c => c.visible === 0).length
          }
        },
        message: 'Структура категорий получена успешно'
      });

    } catch (error: any) {
      console.error('Ошибка получения структуры категорий:', error);
      next(createError(500, `Ошибка получения структуры категорий: ${error.message}`));
    }
  }

  /**
   * Создание новой категории
   * POST /api/employee/categories
   */
  static async createCategory(req: EmployeeAuthRequest, res: Response, next: NextFunction) {
    try {
      const { name, supercategory_id, parent_category = 0, visible = 1, img = '' } = req.body;

      if (!name || !supercategory_id) {
        return next(createError(400, 'Необходимо указать name и supercategory_id'));
      }

      // Проверяем существование суперкатегории
      const supercategory = await prisma.supercategories.findUnique({
        where: { supercategory_id }
      });

      if (!supercategory) {
        return next(createError(404, 'Суперкатегория не найдена'));
      }

      // Если указана родительская категория, проверяем ее существование
      if (parent_category !== 0) {
        const parentCat = await prisma.categories.findUnique({
          where: { category_id: parent_category }
        });

        if (!parentCat) {
          return next(createError(404, 'Родительская категория не найдена'));
        }
      }

      const category = await prisma.categories.create({
        data: {
          name,
          supercategory_id,
          parent_category,
          img,
          visible: visible ? 1 : 0
        }
      });

      res.status(201).json({
        success: true,
        data: { category },
        message: 'Категория успешно создана'
      });

    } catch (error: any) {
      console.error('Ошибка создания категории:', error);
      next(createError(500, `Ошибка создания категории: ${error.message}`));
    }
  }

  /**
   * Обновление категории
   * PUT /api/employee/categories/:id
   */
  static async updateCategory(req: EmployeeAuthRequest, res: Response, next: NextFunction) {
    try {
      const category_id = parseInt(req.params.id);

      if (isNaN(category_id)) {
        return next(createError(400, 'Неверный ID категории'));
      }

      const { name, supercategory_id, parent_category, visible } = req.body;

      // Проверяем существование категории
      const category = await prisma.categories.findUnique({
        where: { category_id }
      });

      if (!category) {
        return next(createError(404, 'Категория не найдена'));
      }

      // Проверяем существование суперкатегории, если она указана
      if (supercategory_id) {
        const supercategory = await prisma.supercategories.findUnique({
          where: { supercategory_id }
        });

        if (!supercategory) {
          return next(createError(404, 'Суперкатегория не найдена'));
        }
      }

      // Если указана родительская категория, проверяем ее существование
      if (parent_category !== undefined && parent_category !== 0) {
        const parentCat = await prisma.categories.findUnique({
          where: { category_id: parent_category }
        });

        if (!parentCat) {
          return next(createError(404, 'Родительская категория не найдена'));
        }

        // Проверяем, что категория не является родителем самой себя
        if (parent_category === category_id) {
          return next(createError(400, 'Категория не может быть родителем самой себя'));
        }
      }

      const updatedCategory = await prisma.categories.update({
        where: { category_id },
        data: {
          ...(name && { name }),
          ...(supercategory_id && { supercategory_id }),
          ...(parent_category !== undefined && { parent_category }),
          ...(visible !== undefined && { visible: visible ? 1 : 0 })
        }
      });

      res.json({
        success: true,
        data: { category: updatedCategory },
        message: 'Категория успешно обновлена'
      });

    } catch (error: any) {
      console.error('Ошибка обновления категории:', error);
      next(createError(500, `Ошибка обновления категории: ${error.message}`));
    }
  }

  /**
   * Удаление категории
   * DELETE /api/employee/categories/:id
   */
  static async deleteCategory(req: EmployeeAuthRequest, res: Response, next: NextFunction) {
    try {
      const category_id = parseInt(req.params.id);

      if (isNaN(category_id)) {
        return next(createError(400, 'Неверный ID категории'));
      }

      // Проверяем существование категории
      const category = await prisma.categories.findUnique({
        where: { category_id }
      });

      if (!category) {
        return next(createError(404, 'Категория не найдена'));
      }

      // Проверяем, есть ли подкатегории
      const subcategories = await prisma.categories.count({
        where: { parent_category: category_id }
      });

      if (subcategories > 0) {
        return next(createError(400, 'Невозможно удалить категорию с подкатегориями'));
      }

      // Проверяем, есть ли товары в этой категории через items_groups
      const itemsCount = await prisma.items_groups.count({
        where: { category_id }
      });

      if (itemsCount > 0) {
        return next(createError(400, 'Невозможно удалить категорию с товарами'));
      }

      await prisma.categories.delete({
        where: { category_id }
      });

      res.json({
        success: true,
        message: 'Категория успешно удалена'
      });

    } catch (error: any) {
      console.error('Ошибка удаления категории:', error);
      next(createError(500, `Ошибка удаления категории: ${error.message}`));
    }
  }

  // ============================
  // Управление суперкатегориями (только для SUPERVISOR и ADMIN)
  // ============================

  /**
   * Создание суперкатегории
   * POST /api/employee/supercategories
   */
  static async createSupercategory(req: EmployeeAuthRequest, res: Response, next: NextFunction) {
    try {
      const { name, priority = 0 } = req.body;

      if (!name) {
        return next(createError(400, 'Необходимо указать name'));
      }

      const supercategory = await prisma.supercategories.create({
        data: {
          name,
          priority: parseInt(priority)
        }
      });

      res.status(201).json({
        success: true,
        data: { supercategory },
        message: 'Суперкатегория успешно создана'
      });

    } catch (error: any) {
      console.error('Ошибка создания суперкатегории:', error);
      next(createError(500, `Ошибка создания суперкатегории: ${error.message}`));
    }
  }

  /**
   * Обновление суперкатегории
   * PUT /api/employee/supercategories/:id
   */
  static async updateSupercategory(req: EmployeeAuthRequest, res: Response, next: NextFunction) {
    try {
      const supercategory_id = parseInt(req.params.id);

      if (isNaN(supercategory_id)) {
        return next(createError(400, 'Неверный ID суперкатегории'));
      }

      const { name, priority } = req.body;

      // Проверяем существование суперкатегории
      const supercategory = await prisma.supercategories.findUnique({
        where: { supercategory_id }
      });

      if (!supercategory) {
        return next(createError(404, 'Суперкатегория не найдена'));
      }

      const updatedSupercategory = await prisma.supercategories.update({
        where: { supercategory_id },
        data: {
          ...(name && { name }),
          ...(priority !== undefined && { priority: parseInt(priority) })
        }
      });

      res.json({
        success: true,
        data: { supercategory: updatedSupercategory },
        message: 'Суперкатегория успешно обновлена'
      });

    } catch (error: any) {
      console.error('Ошибка обновления суперкатегории:', error);
      next(createError(500, `Ошибка обновления суперкатегории: ${error.message}`));
    }
  }

  /**
   * Удаление суперкатегории
   * DELETE /api/employee/supercategories/:id
   */
  static async deleteSupercategory(req: EmployeeAuthRequest, res: Response, next: NextFunction) {
    try {
      const supercategory_id = parseInt(req.params.id);

      if (isNaN(supercategory_id)) {
        return next(createError(400, 'Неверный ID суперкатегории'));
      }

      // Проверяем существование суперкатегории
      const supercategory = await prisma.supercategories.findUnique({
        where: { supercategory_id }
      });

      if (!supercategory) {
        return next(createError(404, 'Суперкатегория не найдена'));
      }

      // Проверяем, есть ли категории в этой суперкатегории
      const categoriesCount = await prisma.categories.count({
        where: { supercategory_id }
      });

      if (categoriesCount > 0) {
        return next(createError(400, 'Невозможно удалить суперкатегорию с категориями'));
      }

      await prisma.supercategories.delete({
        where: { supercategory_id }
      });

      res.json({
        success: true,
        message: 'Суперкатегория успешно удалена'
      });

    } catch (error: any) {
      console.error('Ошибка удаления суперкатегории:', error);
      next(createError(500, `Ошибка удаления суперкатегории: ${error.message}`));
    }
  }

  // ==================== УПРАВЛЕНИЕ АКЦИЯМИ ====================

  /**
   * Получение списка всех акций
   * GET /api/employee/promotions
   */
  static async getPromotions(req: EmployeeAuthRequest, res: Response, next: NextFunction) {
    try {
      const business_id = req.query.business_id ? parseInt(req.query.business_id as string) : undefined;
      const visible = req.query.visible !== undefined ? (req.query.visible === 'true' ? 1 : 0) : undefined;

      const promotions = await prisma.marketing_promotions.findMany({
        where: {
          ...(business_id && { business_id }),
          ...(visible !== undefined && { visible })
        },
        orderBy: {
          marketing_promotion_id: 'desc'
        }
      });

      // Вручную подгружаем связанные данные
      const promotionsWithDetails = await Promise.all(
        promotions.map(async (promotion) => {
          const details = await prisma.marketing_promotion_details.findMany({
            where: { marketing_promotion_id: promotion.marketing_promotion_id }
          });

          const stories = await prisma.marketing_promotion_stories.findMany({
            where: { marketing_promotion_id: promotion.marketing_promotion_id }
          });

          const business = await prisma.businesses.findUnique({
            where: { business_id: promotion.business_id },
            select: { business_id: true, name: true }
          });

          return {
            ...promotion,
            marketing_promotion_details: details,
            marketing_promotion_stories: stories,
            business
          };
        })
      );

      res.json({
        success: true,
        data: { promotions: promotionsWithDetails }
      });

    } catch (error: any) {
      console.error('Ошибка получения акций:', error);
      next(createError(500, `Ошибка получения акций: ${error.message}`));
    }
  }

  /**
   * Получение акции по ID
   * GET /api/employee/promotions/:id
   */
  static async getPromotionById(req: EmployeeAuthRequest, res: Response, next: NextFunction) {
    try {
      const marketing_promotion_id = parseInt(req.params.id);

      if (isNaN(marketing_promotion_id)) {
        return next(createError(400, 'Неверный ID акции'));
      }

      const promotion = await prisma.marketing_promotions.findUnique({
        where: { marketing_promotion_id }
      });

      if (!promotion) {
        return next(createError(404, 'Акция не найдена'));
      }

      // Вручную подгружаем связанные данные
      const details = await prisma.marketing_promotion_details.findMany({
        where: { marketing_promotion_id }
      });

      const stories = await prisma.marketing_promotion_stories.findMany({
        where: { marketing_promotion_id }
      });

      const business = await prisma.businesses.findUnique({
        where: { business_id: promotion.business_id },
        select: { business_id: true, name: true }
      });

      res.json({
        success: true,
        data: {
          promotion: {
            ...promotion,
            marketing_promotion_details: details,
            marketing_promotion_stories: stories,
            business
          }
        }
      });

    } catch (error: any) {
      console.error('Ошибка получения акции:', error);
      next(createError(500, `Ошибка получения акции: ${error.message}`));
    }
  }

  /**
   * Создание новой акции
   * POST /api/employee/promotions
   */
  static async createPromotion(req: EmployeeAuthRequest, res: Response, next: NextFunction) {
    try {
      const { name, start_promotion_date, end_promotion_date, business_id, cover, visible } = req.body;

      // Валидация обязательных полей
      if (!name || !start_promotion_date || !end_promotion_date || !business_id) {
        return next(createError(400, 'Отсутствуют обязательные поля: name, start_promotion_date, end_promotion_date, business_id'));
      }

      // Проверка существования бизнеса
      const business = await prisma.businesses.findUnique({
        where: { business_id: parseInt(business_id) }
      });

      if (!business) {
        return next(createError(404, 'Бизнес не найден'));
      }

      // Валидация дат
      const startDate = new Date(start_promotion_date);
      const endDate = new Date(end_promotion_date);

      if (endDate <= startDate) {
        return next(createError(400, 'Дата окончания должна быть позже даты начала'));
      }

      const promotion = await prisma.marketing_promotions.create({
        data: {
          name,
          start_promotion_date: startDate,
          end_promotion_date: endDate,
          business_id: parseInt(business_id),
          cover: cover || '',
          visible: visible !== undefined ? (visible ? 1 : 0) : 1
        }
      });

      res.status(201).json({
        success: true,
        data: { promotion },
        message: 'Акция успешно создана'
      });

    } catch (error: any) {
      console.error('Ошибка создания акции:', error);
      next(createError(500, `Ошибка создания акции: ${error.message}`));
    }
  }

  /**
   * Обновление акции
   * PUT /api/employee/promotions/:id
   */
  static async updatePromotion(req: EmployeeAuthRequest, res: Response, next: NextFunction) {
    try {
      const marketing_promotion_id = parseInt(req.params.id);

      if (isNaN(marketing_promotion_id)) {
        return next(createError(400, 'Неверный ID акции'));
      }

      const { name, start_promotion_date, end_promotion_date, business_id, cover, visible } = req.body;

      // Проверяем существование акции
      const promotion = await prisma.marketing_promotions.findUnique({
        where: { marketing_promotion_id }
      });

      if (!promotion) {
        return next(createError(404, 'Акция не найдена'));
      }

      // Если меняется бизнес, проверяем его существование
      if (business_id && parseInt(business_id) !== promotion.business_id) {
        const business = await prisma.businesses.findUnique({
          where: { business_id: parseInt(business_id) }
        });

        if (!business) {
          return next(createError(404, 'Бизнес не найден'));
        }
      }

      // Валидация дат
      const startDate = start_promotion_date ? new Date(start_promotion_date) : promotion.start_promotion_date;
      const endDate = end_promotion_date ? new Date(end_promotion_date) : promotion.end_promotion_date;

      if (endDate <= startDate) {
        return next(createError(400, 'Дата окончания должна быть позже даты начала'));
      }

      const updatedPromotion = await prisma.marketing_promotions.update({
        where: { marketing_promotion_id },
        data: {
          ...(name && { name }),
          ...(start_promotion_date && { start_promotion_date: startDate }),
          ...(end_promotion_date && { end_promotion_date: endDate }),
          ...(business_id && { business_id: parseInt(business_id) }),
          ...(cover !== undefined && { cover }),
          ...(visible !== undefined && { visible: visible ? 1 : 0 })
        }
      });

      res.json({
        success: true,
        data: { promotion: updatedPromotion },
        message: 'Акция успешно обновлена'
      });

    } catch (error: any) {
      console.error('Ошибка обновления акции:', error);
      next(createError(500, `Ошибка обновления акции: ${error.message}`));
    }
  }

  /**
   * Удаление акции
   * DELETE /api/employee/promotions/:id
   */
  static async deletePromotion(req: EmployeeAuthRequest, res: Response, next: NextFunction) {
    try {
      const marketing_promotion_id = parseInt(req.params.id);

      if (isNaN(marketing_promotion_id)) {
        return next(createError(400, 'Неверный ID акции'));
      }

      // Проверяем существование акции
      const promotion = await prisma.marketing_promotions.findUnique({
        where: { marketing_promotion_id }
      });

      if (!promotion) {
        return next(createError(404, 'Акция не найдена'));
      }

      // Удаляем связанные данные
      await prisma.$transaction([
        // Удаляем детали акции
        prisma.marketing_promotion_details.deleteMany({
          where: { marketing_promotion_id }
        }),
        // Удаляем истории акции
        prisma.marketing_promotion_stories.deleteMany({
          where: { marketing_promotion_id }
        }),
        // Удаляем саму акцию
        prisma.marketing_promotions.delete({
          where: { marketing_promotion_id }
        })
      ]);

      res.json({
        success: true,
        message: 'Акция успешно удалена'
      });

    } catch (error: any) {
      console.error('Ошибка удаления акции:', error);
      next(createError(500, `Ошибка удаления акции: ${error.message}`));
    }
  }

  // ==================== УПРАВЛЕНИЕ ДЕТАЛЯМИ АКЦИЙ ====================

  /**
   * Добавление детали к акции
   * POST /api/employee/promotions/:id/details
   */
  static async addPromotionDetail(req: EmployeeAuthRequest, res: Response, next: NextFunction) {
    try {
      const marketing_promotion_id = parseInt(req.params.id);

      if (isNaN(marketing_promotion_id)) {
        return next(createError(400, 'Неверный ID акции'));
      }

      const { type, base_amount, add_amount, item_id, name, discount } = req.body;

      // Валидация обязательных полей
      if (!type || !item_id) {
        return next(createError(400, 'Отсутствуют обязательные поля: type, item_id'));
      }

      // Проверяем существование акции
      const promotion = await prisma.marketing_promotions.findUnique({
        where: { marketing_promotion_id }
      });

      if (!promotion) {
        return next(createError(404, 'Акция не найдена'));
      }

      // Проверяем существование товара
      const item = await prisma.items.findUnique({
        where: { item_id: parseInt(item_id) }
      });

      if (!item) {
        return next(createError(404, 'Товар не найден'));
      }

      // Валидация типа акции
      if (type === 'SUBTRACT') {
        if (!base_amount || !add_amount) {
          return next(createError(400, 'Для типа SUBTRACT требуются base_amount и add_amount'));
        }
        if (parseInt(base_amount) <= 0 || parseInt(add_amount) <= 0) {
          return next(createError(400, 'base_amount и add_amount должны быть больше 0'));
        }
      } else if (discount !== undefined) {
        if (parseInt(discount) < 0 || parseInt(discount) > 100) {
          return next(createError(400, 'Скидка должна быть от 0 до 100'));
        }
      }

      const detail = await prisma.marketing_promotion_details.create({
        data: {
          type,
          base_amount: base_amount ? parseFloat(base_amount) : null,
          add_amount: add_amount ? parseFloat(add_amount) : null,
          marketing_promotion_id,
          item_id: parseInt(item_id),
          name: name || item.name,
          discount: discount ? parseFloat(discount) : null
        }
      });

      res.status(201).json({
        success: true,
        data: { detail },
        message: 'Деталь акции успешно добавлена'
      });

    } catch (error: any) {
      console.error('Ошибка добавления детали акции:', error);
      next(createError(500, `Ошибка добавления детали акции: ${error.message}`));
    }
  }

  /**
   * Обновление детали акции
   * PUT /api/employee/promotions/details/:detailId
   */
  static async updatePromotionDetail(req: EmployeeAuthRequest, res: Response, next: NextFunction) {
    try {
      const detail_id = parseInt(req.params.detailId);

      if (isNaN(detail_id)) {
        return next(createError(400, 'Неверный ID детали'));
      }

      const { type, base_amount, add_amount, item_id, name, discount } = req.body;

      // Проверяем существование детали
      const detail = await prisma.marketing_promotion_details.findUnique({
        where: { detail_id }
      });

      if (!detail) {
        return next(createError(404, 'Деталь акции не найдена'));
      }

      // Если меняется товар, проверяем его существование
      if (item_id && parseInt(item_id) !== detail.item_id) {
        const item = await prisma.items.findUnique({
          where: { item_id: parseInt(item_id) }
        });

        if (!item) {
          return next(createError(404, 'Товар не найден'));
        }
      }

      // Валидация типа акции
      const finalType = type || detail.type;
      if (finalType === 'SUBTRACT') {
        const finalBaseAmount = base_amount !== undefined ? parseFloat(base_amount) : (detail.base_amount ? parseFloat(detail.base_amount.toString()) : null);
        const finalAddAmount = add_amount !== undefined ? parseFloat(add_amount) : (detail.add_amount ? parseFloat(detail.add_amount.toString()) : null);
        
        if (!finalBaseAmount || !finalAddAmount) {
          return next(createError(400, 'Для типа SUBTRACT требуются base_amount и add_amount'));
        }
        if (finalBaseAmount <= 0 || finalAddAmount <= 0) {
          return next(createError(400, 'base_amount и add_amount должны быть больше 0'));
        }
      } else if (discount !== undefined) {
        if (parseInt(discount) < 0 || parseInt(discount) > 100) {
          return next(createError(400, 'Скидка должна быть от 0 до 100'));
        }
      }

      const updatedDetail = await prisma.marketing_promotion_details.update({
        where: { detail_id },
        data: {
          ...(type && { type }),
          ...(base_amount !== undefined && { base_amount: parseFloat(base_amount) }),
          ...(add_amount !== undefined && { add_amount: parseFloat(add_amount) }),
          ...(item_id && { item_id: parseInt(item_id) }),
          ...(name && { name }),
          ...(discount !== undefined && { discount: parseFloat(discount) })
        }
      });

      res.json({
        success: true,
        data: { detail: updatedDetail },
        message: 'Деталь акции успешно обновлена'
      });

    } catch (error: any) {
      console.error('Ошибка обновления детали акции:', error);
      next(createError(500, `Ошибка обновления детали акции: ${error.message}`));
    }
  }

  /**
   * Удаление детали акции
   * DELETE /api/employee/promotions/details/:detailId
   */
  static async deletePromotionDetail(req: EmployeeAuthRequest, res: Response, next: NextFunction) {
    try {
      const detail_id = parseInt(req.params.detailId);

      if (isNaN(detail_id)) {
        return next(createError(400, 'Неверный ID детали'));
      }

      // Проверяем существование детали
      const detail = await prisma.marketing_promotion_details.findUnique({
        where: { detail_id }
      });

      if (!detail) {
        return next(createError(404, 'Деталь акции не найдена'));
      }

      await prisma.marketing_promotion_details.delete({
        where: { detail_id }
      });

      res.json({
        success: true,
        message: 'Деталь акции успешно удалена'
      });

    } catch (error: any) {
      console.error('Ошибка удаления детали акции:', error);
      next(createError(500, `Ошибка удаления детали акции: ${error.message}`));
    }
  }

  // ==================== УПРАВЛЕНИЕ ИСТОРИЯМИ АКЦИЙ ====================

  /**
   * Добавление истории к акции
   * POST /api/employee/promotions/:id/stories
   */
  static async addPromotionStory(req: EmployeeAuthRequest, res: Response, next: NextFunction) {
    try {
      const marketing_promotion_id = parseInt(req.params.id);

      if (isNaN(marketing_promotion_id)) {
        return next(createError(400, 'Неверный ID акции'));
      }

      const { cover, promo } = req.body;

      // Валидация обязательных полей
      if (!cover) {
        return next(createError(400, 'Отсутствует обязательное поле: cover'));
      }

      // Проверяем существование акции
      const promotion = await prisma.marketing_promotions.findUnique({
        where: { marketing_promotion_id }
      });

      if (!promotion) {
        return next(createError(404, 'Акция не найдена'));
      }

      const story = await prisma.marketing_promotion_stories.create({
        data: {
          cover,
          marketing_promotion_id,
          promo: promo || ''
        }
      });

      res.status(201).json({
        success: true,
        data: { story },
        message: 'История акции успешно добавлена'
      });

    } catch (error: any) {
      console.error('Ошибка добавления истории акции:', error);
      next(createError(500, `Ошибка добавления истории акции: ${error.message}`));
    }
  }

  /**
   * Обновление истории акции
   * PUT /api/employee/promotions/stories/:storyId
   */
  static async updatePromotionStory(req: EmployeeAuthRequest, res: Response, next: NextFunction) {
    try {
      const story_id = parseInt(req.params.storyId);

      if (isNaN(story_id)) {
        return next(createError(400, 'Неверный ID истории'));
      }

      const { cover, promo } = req.body;

      // Проверяем существование истории
      const story = await prisma.marketing_promotion_stories.findUnique({
        where: { story_id }
      });

      if (!story) {
        return next(createError(404, 'История акции не найдена'));
      }

      const updatedStory = await prisma.marketing_promotion_stories.update({
        where: { story_id },
        data: {
          ...(cover && { cover }),
          ...(promo !== undefined && { promo })
        }
      });

      res.json({
        success: true,
        data: { story: updatedStory },
        message: 'История акции успешно обновлена'
      });

    } catch (error: any) {
      console.error('Ошибка обновления истории акции:', error);
      next(createError(500, `Ошибка обновления истории акции: ${error.message}`));
    }
  }

  /**
   * Удаление истории акции
   * DELETE /api/employee/promotions/stories/:storyId
   */
  static async deletePromotionStory(req: EmployeeAuthRequest, res: Response, next: NextFunction) {
    try {
      const story_id = parseInt(req.params.storyId);

      if (isNaN(story_id)) {
        return next(createError(400, 'Неверный ID истории'));
      }

      // Проверяем существование истории
      const story = await prisma.marketing_promotion_stories.findUnique({
        where: { story_id }
      });

      if (!story) {
        return next(createError(404, 'История акции не найдена'));
      }

      await prisma.marketing_promotion_stories.delete({
        where: { story_id }
      });

      res.json({
        success: true,
        message: 'История акции успешно удалена'
      });

    } catch (error: any) {
      console.error('Ошибка удаления истории акции:', error);
      next(createError(500, `Ошибка удаления истории акции: ${error.message}`));
    }
  }
}


