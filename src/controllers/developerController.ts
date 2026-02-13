import { Response, NextFunction } from 'express';
import prisma from '../database';
import { createError } from '../middleware/errorHandler';
import { DeveloperAuthRequest } from '../middleware/developerAuth';

export class DeveloperController {

  private static validateAndParseDate(dateString: string, isEndDate = false): Date {
    if (!dateString) {
      throw createError(400, 'Дата не может быть пустой');
    }

    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      throw createError(400, 'Неверный формат даты. Поддерживаемые форматы: YYYY-MM-DD, YYYY-MM-DD HH:mm:ss, ISO 8601');
    }

    // Если передана только дата без времени (длина 10 символов), устанавливаем время
    if (dateString.length === 10) {
      if (isEndDate) {
        date.setHours(23, 59, 59, 999);
      } else {
        date.setHours(0, 0, 0, 0);
      }
    }

    return date;
  }

  /**
   * GET /api/developer/me
   * Требует developer key (см. middleware authenticateDeveloper)
   */
  static async getMe(req: DeveloperAuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.developer) {
        throw createError(401, 'Developer не авторизован');
      }

      const record = await prisma.developer_keys.findUnique({
        where: { developer_key_id: req.developer.developer_key_id }
      });

      if (!record || record.revoked_at) {
        throw createError(401, 'Developer key недействителен');
      }

      res.json({
        success: true,
        data: {
          developer_key_id: record.developer_key_id,
          name: record.name,
          key_prefix: record.key_prefix,
          created_at: record.created_at,
          last_used_at: record.last_used_at
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/developer/ping
   * Требует developer key
   */
  static async ping(req: DeveloperAuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.developer) {
        throw createError(401, 'Developer не авторизован');
      }

      res.json({
        success: true,
        data: {
          ok: true,
          developer: req.developer
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/developer/orders
   * Требует developer key
   *
   * Query:
   * - start_date (required)
   * - end_date (required)
   * - business_id (optional)
   * - user_id (optional)
   * - status (optional) - статус из order_status.status (последний статус заказа)
   * - delivery_type (optional) - DELIVERY|PICKUP|SCHEDULED
   * - page (optional, default 1)
   * - limit (optional, default 50, max 100)
   */
  static async getOrders(
  req: DeveloperAuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.developer) {
      throw createError(401, 'Developer не авторизован');
    }

    const startDateRaw = req.query.start_date as string | undefined;
    const endDateRaw = req.query.end_date as string | undefined;

    if (!startDateRaw || !endDateRaw) {
      throw createError(400, 'Необходимо указать start_date и end_date');
    }

    const start = DeveloperController.validateAndParseDate(startDateRaw, false);
    const end = DeveloperController.validateAndParseDate(endDateRaw, true);

    if (start > end) {
      throw createError(400, 'start_date не может быть больше end_date');
    }

    const page = Math.max(parseInt(req.query.page as string) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 50, 1), 100);
    const offset = (page - 1) * limit;

    const where: any = {
      log_timestamp: { gte: start, lte: end }
    };

    const [orders, total] = await Promise.all([
      prisma.orders.findMany({
        where,
        orderBy: { log_timestamp: 'desc' },
        skip: offset,
        take: limit
      }),
      prisma.orders.count({ where })
    ]);

    const orderIds = orders.map(o => o.order_id);

    // ================= ПОЗИЦИИ =================
    const orderItems = orderIds.length
      ? await prisma.orders_items.findMany({
          where: { order_id: { in: orderIds } }
        })
      : [];

    const itemIds = [...new Set(orderItems.map(i => i.item_id))];

    const itemsData = itemIds.length
      ? await prisma.items.findMany({
          where: { item_id: { in: itemIds } },
          select: { item_id: true, name: true, barcode: true }
        })
      : [];

    const itemsMap = new Map<number, any[]>();
    for (const item of orderItems) {
      if (!itemsMap.has(item.order_id)) itemsMap.set(item.order_id, []);
      itemsMap.get(item.order_id)!.push(item);
    }

    const itemsInfoMap = new Map(itemsData.map(i => [i.item_id, i]));

    // ================= USERS =================
    const userIds = [...new Set(orders.map(o => o.user_id))];

    const users = userIds.length
      ? await prisma.user.findMany({
          where: { user_id: { in: userIds } },
          select: {
            user_id: true,
            name: true,
            first_name: true,
            last_name: true,
            login: true
          }
        })
      : [];

    const userMap = new Map(users.map(u => [u.user_id, u]));

    // ================= BUSINESSES =================
    const businessIds = [
      ...new Set(
        orders
          .map(o => o.business_id)
          .filter((id): id is number => typeof id === 'number')
      )
    ];

    const businesses = businessIds.length
      ? await prisma.businesses.findMany({
          where: { business_id: { in: businessIds } },
          select: {
            business_id: true,
            name: true,
            description: true,
            address: true,
            city: true,
            lat: true,
            lon: true,
            logo: true,
            img: true
          }
        })
      : [];

    const businessMap = new Map(
      businesses.map(b => [b.business_id, b])
    );

    // ================= AGGREGATORS =================
    const aggregatorNames = [
      ...new Set(
        orders
          .map(o => o.aggregator)
          .filter((name): name is string => !!name)
      )
    ];

    const aggregators = aggregatorNames.length
      ? await prisma.aggregators.findMany({
          where: { name: { in: aggregatorNames } }
        })
      : [];

    const aggregatorMap = new Map(
      aggregators.map(a => [a.name, a])
    );

    // ================= EMPLOYEE =================
    const employeeIds = [
      ...new Set(
        orders
          .map(o => o.employee_id)
          .filter((id): id is number => typeof id === 'number')
      )
    ];

    const employees = employeeIds.length
      ? await prisma.employee.findMany({
          where: { employee_id: { in: employeeIds } },
          select: {
            employee_id: true,
            name: true,
            login: true,
            access_level: true
          }
        })
      : [];

    const employeeMap = new Map(
      employees.map(e => [e.employee_id, e])
    );

    // ================= COURIERS =================
    const courierIds = [
      ...new Set(
        orders
          .map(o => o.courier_id)
          .filter((id): id is number => typeof id === 'number')
      )
    ];

    const couriers = courierIds.length
      ? await prisma.couriers.findMany({
          where: { courier_id: { in: courierIds } },
          select: {
            courier_id: true,
            name: true,
            full_name: true,
            login: true,
            courier_type: true
          }
        })
      : [];

    const courierMap = new Map(
      couriers.map(c => [c.courier_id, c])
    );

    // ================= STATUS =================
    const lastStatuses = orderIds.length
      ? await prisma.order_status.findMany({
          where: { order_id: { in: orderIds } },
          orderBy: { log_timestamp: 'desc' },
          distinct: ['order_id']
        })
      : [];

    const statusMap = new Map(
      lastStatuses.map(s => [s.order_id, s])
    );

    // ================= RESPONSE =================
    const data = orders.map(order => {
      const positions = itemsMap.get(order.order_id) || [];

      const formattedItems = positions.map(pos => {
        const itemInfo = itemsInfoMap.get(pos.item_id);
        const amount = Number(pos.amount);
        const price = pos.price ? Number(pos.price) : 0;

        return {
          item_id: pos.item_id,
          name: itemInfo?.name ?? null,
          barcode: itemInfo?.barcode ?? null,
          amount,
          price,
          total: +(amount * price).toFixed(2)
        };
      });

      const orderTotal = formattedItems.reduce((s, i) => s + i.total, 0);

      return {
        order_id: order.order_id,
        order_uuid: order.order_uuid,

        user: userMap.get(order.user_id) ?? null,
        business: order.business_id
          ? businessMap.get(order.business_id) ?? null
          : null,

        aggregator: order.aggregator
          ? aggregatorMap.get(order.aggregator) ?? null
          : null,

        employee: order.employee_id
          ? employeeMap.get(order.employee_id) ?? null
          : null,

        courier: order.courier_id
          ? courierMap.get(order.courier_id) ?? null
          : null,

        delivery_type: order.delivery_type,
        delivery_date: order.delivery_date,
        log_timestamp: order.log_timestamp,
        accepted_at: order.accepted_at,
        ready_at: order.ready_at,
        is_canceled: order.is_canceled,

        delivery_price: order.delivery_price,
        bonus_used: order.bonus,

        items_count: formattedItems.length,
        order_total: +orderTotal.toFixed(2),
        items: formattedItems,

        current_status: statusMap.get(order.order_id)
          ? {
              status: statusMap.get(order.order_id)!.status,
              is_canceled: statusMap.get(order.order_id)!.isCanceled,
              log_timestamp: statusMap.get(order.order_id)!.log_timestamp
            }
          : null
      };
    });

    res.json({
      success: true,
      data: {
        orders: data,
        pagination: {
          page,
          limit,
          total,
          total_pages: Math.ceil(total / limit)
        }
      },
      message: `Найдено ${data.length} заказов`
    });

  } catch (error) {
    next(error);
  }
}


}
