import { Request, Response, NextFunction } from 'express';
import prisma from '../database';
import { createError } from '../middleware/errorHandler';
import { OrderController } from './orderController';

interface CourierAuthRequest extends Request {
  courier?: {
    courier_id: number;
    login: string;
    courier_type: number;
  };
}

export class CourierController {

  /**
   * Получение списка городов
   * GET /api/courier/cities
   */
  static async getCities(req: CourierAuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.courier) {
        return next(createError(401, 'Требуется авторизация курьера'));
      }

      // Получаем уникальные города из таблицы cities
      const cities = await prisma.cities.findMany({
        select: {
          city_id: true,
          name: true
        },
        orderBy: {
          name: 'asc'
        }
      });

      res.json({
        success: true,
        data: {
          cities: cities,
          total: cities.length
        },
        message: `Найдено ${cities.length} городов`
      });

    } catch (error) {
      console.error('Ошибка получения списка городов:', error);
      return next(createError(500, 'Ошибка получения списка городов'));
    }
  }

  /**
   * Поиск заказа по ID
   * GET /api/courier/orders/:id
   */
  static async getOrderById(req: CourierAuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.courier) {
        return next(createError(401, 'Требуется авторизация курьера'));
      }

      const order_id = parseInt(req.params.id);

      if (isNaN(order_id)) {
        return next(createError(400, 'Некорректный ID заказа'));
      }

      // Получаем заказ
      const order = await prisma.orders.findUnique({
        where: {
          order_id: order_id
        }
      });

      if (!order) {
        return next(createError(404, 'Заказ не найден'));
      }

      // Получаем дополнительные данные параллельно
      const [
        user,
        business,
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
        // Бизнес
        order.business_id ? prisma.businesses.findUnique({
          where: { business_id: order.business_id },
          select: {
            business_id: true,
            name: true,
            address: true,
            city: true,
            lat: true,
            lon: true
          }
        }) : null,
        // Адрес доставки
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
        status_name: CourierController.getStatusName(status.status),
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
        business: business ? {
          business_id: business.business_id,
          name: business.name,
          address: business.address,
          city: business.city,
          coordinates: {
            lat: business.lat,
            lon: business.lon
          }
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
          status_name: CourierController.getStatusName(currentStatus.status),
          timestamp: currentStatus.log_timestamp,
          isCanceled: currentStatus.isCanceled
        } : {
          status: 0,
          status_name: CourierController.getStatusName(0),
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
          order: formattedOrder
        },
        message: `Заказ #${order_id} получен`
      });

    } catch (error) {
      console.error('Ошибка получения заказа:', error);
      return next(createError(500, 'Ошибка получения заказа'));
    }
  }

  /**
   * Взять заказ на доставку
   * POST /api/courier/orders/:id/take
   */
  static async takeOrderForDelivery(req: CourierAuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.courier) {
        return next(createError(401, 'Требуется авторизация курьера'));
      }

      const order_id = parseInt(req.params.id);

      if (isNaN(order_id)) {
        return next(createError(400, 'Некорректный ID заказа'));
      }

      const courier_id = req.courier.courier_id;

      // Проверяем существование заказа
      const order = await prisma.orders.findUnique({
        where: {
          order_id: order_id
        }
      });

      if (!order) {
        return next(createError(404, 'Заказ не найден'));
      }

      // Проверяем текущий статус заказа
      const currentStatus = await prisma.order_status.findFirst({
        where: { order_id: order_id },
        orderBy: { log_timestamp: 'desc' }
      });

    //   if (!currentStatus || currentStatus.status !== 2) {
    //     return next(createError(400, 'Заказ не готов к выдаче или уже взят другим курьером'));
    //   }

      // Проверяем, что у заказа еще нет назначенного курьера
      if (order.courier_id && order.courier_id !== 0) {
        return next(createError(400, 'Заказ уже назначен другому курьеру'));
      }

      // Начинаем транзакцию для атомарного обновления
      const result = await prisma.$transaction(async (tx) => {
        // Обновляем заказ, устанавливая courier_id
        await tx.orders.update({
          where: { order_id: order_id },
          data: { courier_id: courier_id }
        });

        // Добавляем новый статус "Доставляется" (статус 3)
        await tx.order_status.create({
          data: {
            order_id: order_id,
            status: 3,
            log_timestamp: new Date(),
            isCanceled: 0
          }
        });

        return { success: true };
      });

      // Получаем информацию о курьере для ответа
      const courier = await prisma.couriers.findUnique({
        where: { courier_id: courier_id },
        select: {
          courier_id: true,
          login: true,
          name: true,
          full_name: true
        }
      });

      res.json({
        success: true,
        data: {
          order_id: order_id,
          courier: courier ? {
            courier_id: courier.courier_id,
            login: courier.login,
            name: courier.full_name || courier.name || courier.login || 'Курьер'
          } : null,
          new_status: {
            status: 3,
            status_name: 'Доставляется',
            timestamp: new Date()
          }
        },
        message: `Заказ #${order_id} успешно взят на доставку`
      });

    } catch (error) {
      console.error('Ошибка взятия заказа на доставку:', error);
      return next(createError(500, 'Ошибка взятия заказа на доставку'));
    }
  }

  /**
   * Выдать заказ (завершить доставку)
   * POST /api/courier/orders/:id/deliver
   */
  static async deliverOrder(req: CourierAuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.courier) {
        return next(createError(401, 'Требуется авторизация курьера'));
      }

      const order_id = parseInt(req.params.id);

      if (isNaN(order_id)) {
        return next(createError(400, 'Некорректный ID заказа'));
      }

      const courier_id = req.courier.courier_id;

      // Проверяем существование заказа
      const order = await prisma.orders.findUnique({
        where: {
          order_id: order_id
        }
      });

      if (!order) {
        return next(createError(404, 'Заказ не найден'));
      }

      // Проверяем, что заказ назначен текущему курьеру
      if (!order.courier_id || order.courier_id !== courier_id) {
        return next(createError(403, 'Заказ не назначен вам или уже выполнен другим курьером'));
      }

      // Проверяем текущий статус заказа (должен быть "Доставляется" - статус 3)
      const currentStatus = await prisma.order_status.findFirst({
        where: { order_id: order_id },
        orderBy: { log_timestamp: 'desc' }
      });

      if (!currentStatus || currentStatus.status !== 3) {
        return next(createError(400, 'Заказ не находится в процессе доставки'));
      }

      // Добавляем новый статус "Доставлен" (статус 4)
      await prisma.order_status.create({
        data: {
          order_id: order_id,
          status: 4,
          log_timestamp: new Date(),
          isCanceled: 0
        }
      });

      // Получаем информацию о курьере для ответа
      const courier = await prisma.couriers.findUnique({
        where: { courier_id: courier_id },
        select: {
          courier_id: true,
          login: true,
          name: true,
          full_name: true
        }
      });

      // Получаем информацию о заказе для ответа
      const [user, business] = await Promise.all([
        prisma.user.findUnique({
          where: { user_id: order.user_id },
          select: {
            user_id: true,
            name: true,
            first_name: true,
            last_name: true
          }
        }),
        order.business_id ? prisma.businesses.findUnique({
          where: { business_id: order.business_id },
          select: {
            business_id: true,
            name: true
          }
        }) : null
      ]);

      res.json({
        success: true,
        data: {
          order_id: order_id,
          order_uuid: order.order_uuid,
          courier: courier ? {
            courier_id: courier.courier_id,
            login: courier.login,
            name: courier.full_name || courier.name || courier.login || 'Курьер'
          } : null,
          user: user ? {
            user_id: user.user_id,
            name: user.name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Пользователь'
          } : null,
          business: business ? {
            business_id: business.business_id,
            name: business.name
          } : null,
          new_status: {
            status: 4,
            status_name: 'Доставлен',
            timestamp: new Date()
          },
          delivery_completed_at: new Date()
        },
        message: `Заказ #${order_id} успешно доставлен`
      });

    } catch (error) {
      console.error('Ошибка выдачи заказа:', error);
      return next(createError(500, 'Ошибка выдачи заказа'));
    }
  }

  /**
   * Получение заказов курьера в процессе доставки
   * GET /api/courier/orders/my-deliveries
   */
  static async getMyDeliveries(req: CourierAuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.courier) {
        return next(createError(401, 'Требуется авторизация курьера'));
      }

      const courier_id = req.courier.courier_id;
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const offset = (page - 1) * limit;

      // Ищем заказы со статусом "Доставляется" (status: 3), назначенные текущему курьеру
      const [orders, totalCount] = await Promise.all([
        prisma.$queryRaw<any[]>`
          SELECT DISTINCT o.* 
          FROM orders o
          INNER JOIN (
            SELECT order_id, status, ROW_NUMBER() OVER (PARTITION BY order_id ORDER BY log_timestamp DESC) as rn
            FROM order_status
          ) os ON o.order_id = os.order_id AND os.rn = 1
          WHERE o.courier_id = ${courier_id}
          AND os.status = 3
          ORDER BY o.log_timestamp DESC
          LIMIT ${limit} OFFSET ${offset}
        `,
        prisma.$queryRaw<{count: bigint}[]>`
          SELECT COUNT(DISTINCT o.order_id) as count
          FROM orders o
          INNER JOIN (
            SELECT order_id, status, ROW_NUMBER() OVER (PARTITION BY order_id ORDER BY log_timestamp DESC) as rn
            FROM order_status
          ) os ON o.order_id = os.order_id AND os.rn = 1
          WHERE o.courier_id = ${courier_id}
          AND os.status = 3
        `
      ]);

      const total = Number(totalCount[0]?.count || 0);

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
            }
          },
          message: `У вас нет заказов в процессе доставки`
        });
      }

      // Получаем дополнительную информацию для каждого заказа
      const orderIds = orders.map(order => order.order_id);

      const [businesses, users, addresses, orderCosts] = await Promise.all([
        prisma.businesses.findMany({
          where: { business_id: { in: orders.map(o => o.business_id) } },
          select: {
            business_id: true,
            name: true,
            address: true,
            city: true,
            lat: true,
            lon: true
          }
        }),
        prisma.user.findMany({
          where: { user_id: { in: orders.map(o => o.user_id) } },
          select: {
            user_id: true,
            name: true,
            first_name: true,
            last_name: true
          }
        }),
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
        prisma.orders_cost.findMany({
          where: { order_id: { in: orderIds } }
        })
      ]);

      // Создаем мапы для быстрого доступа
      const businessesMap = new Map(businesses.map(b => [b.business_id, b]));
      const usersMap = new Map(users.map(u => [u.user_id, u]));
      const addressesMap = new Map(addresses.map(a => [a.address_id, a]));
      const orderCostsMap = new Map(orderCosts.map(c => [Number(c.order_id), c]));

      // Форматируем заказы
      const formattedOrders = orders.map(order => {
        const business = businessesMap.get(order.business_id);
        const user = usersMap.get(order.user_id);
        const address = addressesMap.get(order.address_id);
        const cost = orderCostsMap.get(order.order_id);

        return {
          order_id: order.order_id,
          order_uuid: order.order_uuid,
          business: business ? {
            business_id: business.business_id,
            name: business.name,
            address: business.address,
            coordinates: {
              lat: business.lat,
              lon: business.lon
            }
          } : null,
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
          delivery_price: order.delivery_price,
          total_cost: (cost ? Number(cost.cost) : 0) + order.delivery_price + (cost ? Number(cost.service_fee) : 0),
          delivery_date: order.delivery_date,
          created_at: order.log_timestamp,
          status: {
            status: 3,
            status_name: 'Доставляется'
          }
        };
      });

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
          }
        },
        message: `Найдено ${total} заказов в процессе доставки`
      });

    } catch (error) {
      console.error('Ошибка получения заказов курьера:', error);
      return next(createError(500, 'Ошибка получения заказов курьера'));
    }
  }

  /**
   * Поиск заказов для доставки по городу
   * GET /api/courier/orders/available?city=Almaty
   */
  static async getAvailableOrders(req: CourierAuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.courier) {
        return next(createError(401, 'Требуется авторизация курьера'));
      }

      const city = req.query.city as string;
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

      if (!city) {
        return next(createError(400, 'Необходимо указать город'));
      }

      const cityId = parseInt(city);
      if (isNaN(cityId)) {
        return next(createError(400, 'Некорректный ID города'));
      }

      const offset = (page - 1) * limit;

      // Ищем заказы со статусом "Готов к выдаче" (status: 2) в указанном городе
      const [orders, totalCount] = await Promise.all([
        prisma.$queryRaw<any[]>`
          SELECT DISTINCT o.* 
          FROM orders o
          INNER JOIN businesses b ON o.business_id = b.business_id
          INNER JOIN (
            SELECT order_id, status, ROW_NUMBER() OVER (PARTITION BY order_id ORDER BY log_timestamp DESC) as rn
            FROM order_status
          ) os ON o.order_id = os.order_id AND os.rn = 1
          WHERE b.city = ${cityId} 
          AND os.status = 2
          AND o.delivery_type = 1
          ORDER BY o.log_timestamp DESC
          LIMIT ${limit} OFFSET ${offset}
        `,
        prisma.$queryRaw<{count: bigint}[]>`
          SELECT COUNT(DISTINCT o.order_id) as count
          FROM orders o
          INNER JOIN businesses b ON o.business_id = b.business_id
          INNER JOIN (
            SELECT order_id, status, ROW_NUMBER() OVER (PARTITION BY order_id ORDER BY log_timestamp DESC) as rn
            FROM order_status
          ) os ON o.order_id = os.order_id AND os.rn = 1
          WHERE b.city = ${cityId} 
          AND os.status = 2
          AND o.delivery_type = 1
        `
      ]);

      const total = Number(totalCount[0]?.count || 0);

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
            }
          },
          message: `Нет доступных заказов для доставки в городе с ID ${cityId}`
        });
      }

      // Получаем дополнительную информацию для каждого заказа
      const orderIds = orders.map(order => order.order_id);

      const [businesses, users, addresses, orderCosts] = await Promise.all([
        prisma.businesses.findMany({
          where: { business_id: { in: orders.map(o => o.business_id) } },
          select: {
            business_id: true,
            name: true,
            address: true,
            city: true,
            lat: true,
            lon: true
          }
        }),
        prisma.user.findMany({
          where: { user_id: { in: orders.map(o => o.user_id) } },
          select: {
            user_id: true,
            name: true,
            first_name: true,
            last_name: true
          }
        }),
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
        prisma.orders_cost.findMany({
          where: { order_id: { in: orderIds } }
        })
      ]);

      // Создаем мапы для быстрого доступа
      const businessesMap = new Map(businesses.map(b => [b.business_id, b]));
      const usersMap = new Map(users.map(u => [u.user_id, u]));
      const addressesMap = new Map(addresses.map(a => [a.address_id, a]));
      const orderCostsMap = new Map(orderCosts.map(c => [Number(c.order_id), c]));

      // Форматируем заказы
      const formattedOrders = orders.map(order => {
        const business = businessesMap.get(order.business_id);
        const user = usersMap.get(order.user_id);
        const address = addressesMap.get(order.address_id);
        const cost = orderCostsMap.get(order.order_id);

        return {
          order_id: order.order_id,
          order_uuid: order.order_uuid,
          business: business ? {
            business_id: business.business_id,
            name: business.name,
            address: business.address,
            coordinates: {
              lat: business.lat,
              lon: business.lon
            }
          } : null,
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
          delivery_price: order.delivery_price,
          total_cost: (cost ? Number(cost.cost) : 0) + order.delivery_price + (cost ? Number(cost.service_fee) : 0),
          delivery_date: order.delivery_date,
          created_at: order.log_timestamp
        };
      });

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
          city: cityId
        },
        message: `Найдено ${total} доступных заказов для доставки в городе с ID ${cityId}`
      });

    } catch (error) {
      console.error('Ошибка получения доступных заказов:', error);
      return next(createError(500, 'Ошибка получения доступных заказов'));
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
      5: 'Отменен',
      6: 'Ошибка платежа',
      66: 'Не оплачен'
    };
    
    return statusNames[status] || 'Неизвестный статус';
  }
}

export default CourierController;
