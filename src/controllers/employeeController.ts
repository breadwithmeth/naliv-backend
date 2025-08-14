import { Request, Response, NextFunction } from 'express';
import { createError } from '../middleware/errorHandler';
import prisma from '../database';
import BusinessOrderController from './businessOrderController';
import { OrderController } from './orderController';

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
      // Базовое условие фильтрации по бизнесу
      let whereCondition: any = {
        order_id: { gt: 1 }
      };

      // Фильтр по employee_id на уровне БД, если передан
      if (employeeFilterId && !isNaN(employeeFilterId)) {
        whereCondition.employee_id = employeeFilterId;
      }

      // Фильтр по дате
      //if (date_from || date_to) {
      //  whereCondition.log_timestamp = {};
      //  if (date_from) {
      //    whereCondition.log_timestamp.gte = new Date(date_from);
      //  }
      //  if (date_to) {
      //    whereCondition.log_timestamp.lte = new Date(date_to);
      //  }
      //}

      // Получаем заказы с пагинацией
      const [orders, totalCount] = await Promise.all([
        prisma.orders.findMany({
          where: whereCondition,
          orderBy: {
            order_id: 'desc'
          },
         // skip: offset,
          take: 100
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

      // Пост-фильтрация по телефону и адресу + пагинация
      const normalizePhone = (s: string) => (s || '').replace(/[^\d]/g, '');
      const phoneNeedle = phoneQuery ? normalizePhone(phoneQuery) : '';
      const addrNeedle = addressQuery ? String(addressQuery).toLowerCase() : '';

      const filteredOrders = orders.filter(order => {
        // Фильтр по телефону клиента (по полю login пользователя)
        if (phoneNeedle) {
          const u = usersMap.get(order.user_id) as any;
          const userPhone = u?.login ? normalizePhone(u.login) : '';
          if (!userPhone.includes(phoneNeedle)) return false;
        }
        // Фильтр по адресу доставки (по строкам address и name)
        if (addrNeedle) {
          const a = addressesMap.get(order.address_id) as any;
          const addrStr = `${a?.address || ''} ${a?.name || ''}`.toLowerCase();
          if (!addrStr.includes(addrNeedle)) return false;
        }
        return true;
      });

      // Пагинация на уровне приложения
      const paginatedOrders = filteredOrders.slice(offset, offset + limit);

      // Форматируем данные заказов
      const formattedOrders = paginatedOrders.map(order => {
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

      const total = filteredOrders.length;
      const totalPages = Math.ceil(total / limit);

      res.json({
        success: true,
        data: {
          orders: formattedOrders,
          pagination: {
            page,
            limit,
            total,
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1
          },
          
        },
        message: `Найдено ${total} заказов`
      });

    } catch (error) {
      console.error('Ошибка получения заказов бизнеса:', error);
      return next(createError(500, 'Ошибка получения заказов бизнеса'));
    }
  }

  /**
   * Получение заказа по ID
   * GET /api/business/orders/:id
   */
  static async getOrderById(req: EmployeeAuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.employee) {
        return next(createError(401, 'Требуется авторизация бизнеса'));
      }

      const order_id = parseInt(req.params.id);

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
          where: { order_id: order_id }
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

          return {
            relation_id: orderItem.relation_id,
            item_id: orderItem.item_id,
            name: item?.name || 'Неизвестный товар',
            description: item?.description || '',
            img: item?.img || '',
            amount: Number(orderItem.amount || 0),
            price: Number(orderItem.price || 0),
            unit: item?.unit || 'шт',
            original_price: Number(item?.price || 0),
            total_cost: Number(orderItem.amount || 0) * Number(orderItem.price || 0),
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

      // Рассчитываем общие показатели с использованием пересчитанной стоимости
      const itemsTotal = itemsWithDetails.reduce((sum: number, item: any) => sum + item.total_cost, 0);
      const totalItemsCount = itemsWithDetails.reduce((sum: number, item: any) => sum + item.amount, 0);
      
      // Используем пересчитанную стоимость из OrderController
      const subtotal = orderTotals.sum_before_delivery;
      const serviceFee = orderCost ? Number(orderCost.service_fee) : 0;
      const deliveryPrice = order.delivery_price;
      const bonusUsed = Number(order.bonus || 0);
      const totalCost = orderTotals.total_sum;

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
}
