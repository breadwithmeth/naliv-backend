import { Request, Response, NextFunction } from 'express';
import prisma from '../database';
import { createError } from '../middleware/errorHandler';
import { BusinessAuthRequest } from '../middleware/businessAuth';
import { OrderController } from './orderController';

interface HalykChargeResponse {
  code: string;
  message?: string;
  reference?: string;
  approvalCode?: string;
  responseCode?: string;
}

interface HalykTokenResponse {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

export class BusinessOrderController {

  /**
   * Получение заказов бизнеса
   * GET /api/business/orders
   */
  static async getBusinessOrders(req: BusinessAuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.business) {
        return next(createError(401, 'Требуется авторизация бизнеса'));
      }

      const business_id = req.business.business_id;
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const date_from = req.query.date_from as string;
      const date_to = req.query.date_to as string;

      const offset = (page - 1) * limit;

      // Базовое условие фильтрации по бизнесу
      let whereCondition: any = {
        business_id: business_id
      };

      // Фильтр по дате
      if (date_from || date_to) {
        whereCondition.log_timestamp = {};
        if (date_from) {
          whereCondition.log_timestamp.gte = new Date(date_from);
        }
        if (date_to) {
          whereCondition.log_timestamp.lte = new Date(date_to);
        }
      }

      // Получаем заказы с пагинацией
      const [orders, totalCount] = await Promise.all([
        prisma.orders.findMany({
          where: whereCondition,
          orderBy: {
            log_timestamp: 'desc'
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
            business: {
              business_id: req.business.business_id,
              name: req.business.name
            }
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
            last_name: true
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
            status_name: BusinessOrderController.getStatusName(currentStatus.status),
            timestamp: currentStatus.log_timestamp,
            isCanceled: currentStatus.isCanceled
          } : {
            status: 1,
            status_name: BusinessOrderController.getStatusName(1),
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
          business: {
            business_id: req.business.business_id,
            name: req.business.name
          }
        },
        message: `Найдено ${totalCount} заказов для бизнеса`
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
  static async getOrderById(req: BusinessAuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.business) {
        return next(createError(401, 'Требуется авторизация бизнеса'));
      }

      const order_id = parseInt(req.params.id);
      const business_id = req.business.business_id;

      if (isNaN(order_id)) {
        return next(createError(400, 'Некорректный ID заказа'));
      }

      // Получаем заказ
      const order = await prisma.orders.findFirst({
        where: {
          order_id: order_id,
          business_id: business_id
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
        status_name: BusinessOrderController.getStatusName(status.status),
        timestamp: status.log_timestamp,
        isCanceled: status.isCanceled
      }));

      // Рассчитываем общие показатели
      const itemsTotal = itemsWithDetails.reduce((sum: number, item: any) => sum + item.total_cost, 0);
      const totalItemsCount = itemsWithDetails.reduce((sum: number, item: any) => sum + item.amount, 0);
      const subtotal = orderCost ? Number(orderCost.cost) : 0;
      const serviceFee = orderCost ? Number(orderCost.service_fee) : 0;
      const deliveryPrice = order.delivery_price;
      const bonusUsed = Number(order.bonus || 0);
      const totalCost = subtotal + deliveryPrice + serviceFee;

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
          status_name: BusinessOrderController.getStatusName(currentStatus.status),
          timestamp: currentStatus.log_timestamp,
          isCanceled: currentStatus.isCanceled
        } : {
          status: 0,
          status_name: BusinessOrderController.getStatusName(0),
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
          business: {
            business_id: req.business.business_id,
            name: req.business.name
          }
        },
        message: `Заказ #${order_id} получен`
      });

    } catch (error) {
      console.error('Ошибка получения заказа:', error);
      return next(createError(500, 'Ошибка получения заказа'));
    }
  }

  /**
   * Обновление статуса заказа
   * PATCH /api/business/orders/:id/status
   */
  static async updateOrderStatus(req: BusinessAuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.business) {
        return next(createError(401, 'Требуется авторизация бизнеса'));
      }

      const order_id = parseInt(req.params.id);
      const business_id = req.business.business_id;
      const { status } = req.body;

      if (isNaN(order_id)) {
        return next(createError(400, 'Некорректный ID заказа'));
      }

      if (!status || typeof status !== 'number') {
        return next(createError(400, 'Необходимо указать статус заказа'));
      }

      // Проверяем, принадлежит ли заказ данному бизнесу
      const order = await prisma.orders.findFirst({
        where: {
          order_id: order_id,
          business_id: business_id
        }
      });

      if (!order) {
        return next(createError(404, 'Заказ не найден или не принадлежит данному бизнесу'));
      }

      // Добавляем новый статус и при статусе 2 пересчитываем стоимость
      const result = await prisma.$transaction(async (tx) => {
        // Добавляем новый статус
        const newStatus = await tx.order_status.create({
          data: {
            order_id: order_id,
            status: status,
            isCanceled: status === 6 ? 1 : 0, // Статус 6 - отмена
            log_timestamp: new Date()
          }
        });

        return newStatus;
      });

      // Если статус 2 (Готов к выдаче), пересчитываем стоимость заказа и подтверждаем платеж
      if (status === 2) {
        try {
          await BusinessOrderController.recalculateOrderCostAndConfirmPayment(order.order_id);
        } catch (error: any) {
          console.error('Ошибка пересчета стоимости и подтверждения платежа заказа:', error);
          // Продолжаем выполнение, не останавливаем процесс смены статуса
        }
      }

      res.json({
        success: true,
        data: {
          order_id: order_id,
          new_status: {
            status: result.status,
            status_name: BusinessOrderController.getStatusName(result.status),
            timestamp: result.log_timestamp,
            isCanceled: result.isCanceled
          },
          business: {
            business_id: req.business.business_id,
            name: req.business.name
          }
        },
        message: `Статус заказа обновлен на "${BusinessOrderController.getStatusName(status)}"`
      });

    } catch (error) {
      console.error('Ошибка обновления статуса заказа:', error);
      return next(createError(500, 'Ошибка обновления статуса заказа'));
    }
  }

  /**
   * Редактирование количества товара в заказе
   * PATCH /api/business/orders/:id/items/:itemRelationId
   */
  static async updateOrderItemQuantity(req: BusinessAuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.business) {
        return next(createError(401, 'Требуется авторизация бизнеса'));
      }

      const order_id = parseInt(req.params.id);
      const item_relation_id = parseInt(req.params.itemRelationId);
      const business_id = req.business.business_id;
      const { amount } = req.body;

      if (isNaN(order_id)) {
        return next(createError(400, 'Некорректный ID заказа'));
      }

      if (isNaN(item_relation_id)) {
        return next(createError(400, 'Некорректный ID товара в заказе'));
      }

      if (!amount || typeof amount !== 'number' || amount <= 0) {
        return next(createError(400, 'Количество должно быть положительным числом'));
      }

      // Проверяем, принадлежит ли заказ данному бизнесу
      const order = await prisma.orders.findFirst({
        where: {
          order_id: order_id,
          business_id: business_id
        }
      });

      if (!order) {
        return next(createError(404, 'Заказ не найден или не принадлежит данному бизнесу'));
      }

      // Проверяем, существует ли товар в заказе
      const orderItem = await prisma.orders_items.findFirst({
        where: {
          relation_id: item_relation_id,
          order_id: order_id
        }
      });

      if (!orderItem) {
        return next(createError(404, 'Товар не найден в заказе'));
      }

      // Получаем информацию о товаре для проверки остатков
      const item = await prisma.items.findUnique({
        where: { item_id: orderItem.item_id },
        select: {
          item_id: true,
          name: true,
          amount: true // остаток на складе
        }
      });

      if (!item) {
        return next(createError(404, 'Товар не найден в системе'));
      }

      // Проверяем достаточность остатков (опционально, можно убрать если не нужно)
      const currentAmount = Number(orderItem.amount || 0);
      const newAmount = Number(amount);
      const difference = newAmount - currentAmount;
      
      if (difference > 0 && Number(item.amount || 0) < difference) {
        return next(createError(400, `Недостаточно товара на складе. Доступно: ${item.amount}`));
      }

      // Обновляем количество товара в заказе
      const updatedOrderItem = await prisma.orders_items.update({
        where: {
          relation_id: item_relation_id
        },
        data: {
          amount: newAmount
        }
      });

      // Пересчитываем общую стоимость заказа
      const allOrderItems = await prisma.orders_items.findMany({
        where: { order_id: order_id }
      });

      const totalItemsCost = allOrderItems.reduce((sum, item) => {
        return sum + (Number(item.amount) * Number(item.price));
      }, 0);

      // Обновляем стоимость заказа
      await prisma.orders_cost.updateMany({
        where: { order_id: order_id },
        data: {
          cost: totalItemsCost
        }
      });

      res.json({
        success: true,
        data: {
          order_id: order_id,
          item: {
            relation_id: updatedOrderItem.relation_id,
            item_id: updatedOrderItem.item_id,
            name: item.name,
            old_amount: currentAmount,
            new_amount: newAmount,
            price: Number(updatedOrderItem.price),
            total_cost: newAmount * Number(updatedOrderItem.price)
          },
          order_total_cost: totalItemsCost,
          business: {
            business_id: req.business.business_id,
            name: req.business.name
          }
        },
        message: `Количество товара "${item.name}" изменено с ${currentAmount} на ${newAmount}`
      });

    } catch (error) {
      console.error('Ошибка обновления количества товара:', error);
      return next(createError(500, 'Ошибка обновления количества товара'));
    }
  }

  /**
   * Получение статистики заказов бизнеса
   * GET /api/business/orders/stats
   */
  static async getOrderStats(req: BusinessAuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.business) {
        return next(createError(401, 'Требуется авторизация бизнеса'));
      }

      const business_id = req.business.business_id;
      const date_from = req.query.date_from as string;
      const date_to = req.query.date_to as string;

      // Базовое условие фильтрации
      let whereCondition: any = {
        business_id: business_id
      };

      // Фильтр по дате
      if (date_from || date_to) {
        whereCondition.log_timestamp = {};
        if (date_from) {
          whereCondition.log_timestamp.gte = new Date(date_from);
        }
        if (date_to) {
          whereCondition.log_timestamp.lte = new Date(date_to);
        }
      }

      // Получаем общую статистику
      const [
        totalOrders,
        totalRevenue,
        ordersWithStatus
      ] = await Promise.all([
        // Общее количество заказов
        prisma.orders.count({
          where: whereCondition
        }),
        // Общая выручка
        prisma.orders_cost.aggregate({
          where: {
            order_id: {
              in: (await prisma.orders.findMany({
                where: whereCondition,
                select: { order_id: true }
              })).map(o => o.order_id)
            }
          },
          _sum: {
            cost: true,
            service_fee: true
          }
        }),
        // Статистика по статусам
        business_id ? prisma.$queryRaw<Array<{
          status: number;
          count: number;
        }>>`
          SELECT os.status, COUNT(*) as count
          FROM orders o
          INNER JOIN (
            SELECT order_id, status, ROW_NUMBER() OVER (PARTITION BY order_id ORDER BY log_timestamp DESC) as rn
            FROM order_status
          ) os ON o.order_id = os.order_id AND os.rn = 1
          WHERE o.business_id = ${business_id}
          ${date_from ? `AND o.log_timestamp >= '${date_from}'` : ''}
          ${date_to ? `AND o.log_timestamp <= '${date_to}'` : ''}
          GROUP BY os.status
        ` : []
      ]);

      // Форматируем статистику по статусам
      const statusStats = ordersWithStatus.map(stat => ({
        status: stat.status,
        status_name: BusinessOrderController.getStatusName(stat.status),
        count: Number(stat.count)
      }));

      const stats = {
        total_orders: totalOrders,
        total_revenue: Number(totalRevenue._sum.cost || 0),
        total_service_fee: Number(totalRevenue._sum.service_fee || 0),
        by_status: statusStats,
        period: {
          from: date_from || 'начало',
          to: date_to || 'настоящее время'
        }
      };

      res.json({
        success: true,
        data: {
          stats,
          business: {
            business_id: req.business.business_id,
            name: req.business.name
          }
        },
        message: 'Статистика заказов получена'
      });

    } catch (error) {
      console.error('Ошибка получения статистики заказов:', error);
      return next(createError(500, 'Ошибка получения статистики заказов'));
    }
  }

  /**
   * Получение названия статуса по коду
   */
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

  /**
   * Получение токена авторизации Halyk Bank (использует учетные данные из OrderController)
   */
  private static async getHalykToken(): Promise<string> {
    try {
      const tokenUrl = 'https://epay-oauth.homebank.kz/oauth2/token';
      
      // Используем те же учетные данные, что и в OrderController
      const clientId = 'NALIV.KZ';
      const clientSecret = 'B5Y56*Hw9hxcvwwY';
      const auth = '050052bf-1761-11ee-8376-088fc3787894';

      const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'AUTH': auth,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'grant_type=client_credentials&scope=payment'
      });

      if (!response.ok) {
        const responseText = await response.text();
        console.error('Ошибка получения токена Halyk:', {
          status: response.status,
          statusText: response.statusText,
          response: responseText
        });
        throw new Error(`Ошибка получения токена: ${response.status} ${responseText}`);
      }

      const tokenData = await response.json() as HalykTokenResponse;
      console.log('Токен Halyk Bank получен успешно');
      return tokenData.access_token;
    } catch (error) {
      console.error('Ошибка получения токена Halyk Bank:', error);
      throw error;
    }
  }

  /**
   * Подтверждение операции в Halyk Bank (частичное или полное списание)
   */
  private static async confirmHalykOperation(operationId: string, amount?: number): Promise<HalykChargeResponse> {
    try {
      const token = await BusinessOrderController.getHalykToken();
      const baseUrl = 'https://epay-api.homebank.kz';
      
      // Формируем URL для подтверждения операции
      let chargeUrl = `${baseUrl}/operation/${operationId}/charge`;
      
      const requestOptions: RequestInit = {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      };

      // Если указана сумма для частичного списания
      if (amount && amount > 0) {
        // Добавляем сумму в URL параметр
        chargeUrl += `?amount=${amount}`;
        // И также в body для надежности
        requestOptions.body = JSON.stringify({ amount });
      }

      console.log(`Подтверждение операции Halyk Bank: ${chargeUrl}`, { amount });

      const response = await fetch(chargeUrl, requestOptions);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Ошибка подтверждения операции ${operationId}:`, {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        });
        throw new Error(`Ошибка подтверждения операции: ${response.status} ${errorText}`);
      }

      const result = await response.json() as HalykChargeResponse;
      console.log(`Операция ${operationId} подтверждена:`, result);
      
      return result;
    } catch (error) {
      console.error(`Ошибка подтверждения операции ${operationId}:`, error);
      throw error;
    }
  }

  /**
   * Пересчет стоимости заказа и подтверждение операции в Halyk Bank
   */
  private static async recalculateOrderCostAndConfirmPayment(orderId: number): Promise<void> {
    try {
      // Получаем заказ с payment_id
      const order = await prisma.orders.findUnique({
        where: { order_id: orderId },
        select: {
          order_id: true,
          payment_id: true,
          user_id: true,
          order_uuid: true,
          extra: true,
          delivery_price: true,
          bonus: true
        }
      });

      if (!order) {
        throw new Error(`Заказ ${orderId} не найден`);
      }

      // Используем метод расчета стоимости из OrderController
      const orderTotals = await OrderController.calculateOrderCostPublic(orderId);
      
      // Обновляем стоимость в orders_cost используя рассчитанную сумму
      await prisma.orders_cost.updateMany({
        where: { order_id: orderId },
        data: {
          cost: orderTotals.sum_before_delivery
        }
      });

      // Рассчитываем финальную сумму к списанию
      const itemsCost = orderTotals.sum_before_delivery;
      const deliveryPrice = Number(order.delivery_price || 0);
      const bonusUsed = Number(order.bonus || 0);
      
      // Получаем service_fee из orders_cost
      const orderCost = await prisma.orders_cost.findFirst({
        where: { order_id: orderId }
      });
      const serviceFee = Number(orderCost?.service_fee || 0);
      
      // Итоговая сумма к списанию (с учетом использованных бонусов)
      const finalAmount = itemsCost + deliveryPrice + serviceFee - bonusUsed;

      console.log(`Пересчет стоимости заказа ${orderId} через OrderController:`, {
        itemsCost,
        deliveryPrice,
        serviceFee,
        bonusUsed,
        finalAmount,
        orderTotals
      });

      // Если есть payment_id, подтверждаем операцию в Halyk Bank
      if (order.payment_id && finalAmount > 0 && order.order_uuid) {
        try {
          const confirmationResult = await BusinessOrderController.confirmHalykOperation(
            order.payment_id,
            Math.round(finalAmount) // Округляем до целых тенге
          );

          // Логируем результат подтверждения
          console.log(`Операция ${order.payment_id} подтверждена для заказа ${orderId}:`, {
            finalAmount: Math.round(finalAmount),
            result: confirmationResult
          });

          // Обновляем статус платежа в заказе (можно добавить поле confirmed_payment_amount)
          await prisma.orders.update({
            where: { order_id: orderId },
            data: {
              // Можно добавить поле для хранения подтвержденной суммы
              extra: JSON.stringify({
                ...JSON.parse(order.extra || '{}'),
                confirmed_payment: {
                  amount: Math.round(finalAmount),
                  confirmed_at: new Date().toISOString(),
                  halyk_response: confirmationResult,
                  calculation_details: {
                    items_cost: itemsCost,
                    delivery_price: deliveryPrice,
                    service_fee: serviceFee,
                    bonus_used: bonusUsed,
                    order_totals: orderTotals
                  }
                }
              })
            }
          });

        } catch (paymentError: any) {
          console.error(`Ошибка подтверждения платежа для заказа ${orderId}:`, paymentError);
          
          // Логируем ошибку в статус заказа
          await prisma.order_status.create({
            data: {
              order_id: orderId,
              status: 6, // Ошибка платежа
              isCanceled: 0,
              log_timestamp: new Date()
            }
          });

          throw new Error(`Ошибка подтверждения платежа: ${paymentError?.message || 'Неизвестная ошибка'}`);
        }
      } else if (!order.payment_id) {
        console.log(`Заказ ${orderId} не имеет payment_id, пропускаем подтверждение платежа`);
      } else if (finalAmount <= 0) {
        console.log(`Заказ ${orderId} имеет нулевую или отрицательную сумму к списанию: ${finalAmount}`);
      }

    } catch (error) {
      console.error(`Ошибка пересчета и подтверждения платежа заказа ${orderId}:`, error);
      throw error;
    }
  }

  /**
   * Пересчет стоимости заказа (использует OrderController для точного расчета)
   */
  private static async recalculateOrderCost(orderId: number): Promise<void> {
    try {
      // Используем метод расчета стоимости из OrderController
      const orderTotals = await OrderController.calculateOrderCostPublic(orderId);

      // Обновляем стоимость в orders_cost
      await prisma.orders_cost.updateMany({
        where: { order_id: orderId },
        data: {
          cost: orderTotals.sum_before_delivery
        }
      });

      console.log(`Пересчитана стоимость заказа ${orderId} через OrderController: ${orderTotals.sum_before_delivery} (до доставки), ${orderTotals.total_sum} (итого)`);
    } catch (error) {
      console.error(`Ошибка пересчета стоимости заказа ${orderId}:`, error);
      throw error;
    }
  }
}

export default BusinessOrderController;