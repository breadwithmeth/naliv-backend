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
      log_timestamp: {
        gte: start,
        lte: end
      }
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

    // ---------------- ПОЛУЧАЕМ ПОЗИЦИИ ----------------
    const orderItems = orderIds.length
      ? await prisma.orders_items.findMany({
          where: { order_id: { in: orderIds } }
        })
      : [];

    // Собираем уникальные item_id
    const itemIds = [
      ...new Set(
        orderItems
          .map(i => i.item_id)
          .filter(id => typeof id === 'number')
      )
    ];

    // ---------------- ПОЛУЧАЕМ ТОВАРЫ ----------------
    const itemsData = itemIds.length
      ? await prisma.items.findMany({
          where: { item_id: { in: itemIds } },
          select: {
            item_id: true,
            name: true,
            barcode: true
          }
        })
      : [];

    const itemsInfoMap = new Map<number, typeof itemsData[number]>();
    for (const item of itemsData) {
      itemsInfoMap.set(item.item_id, item);
    }

    // ---------------- ГРУППИРУЕМ ПОЗИЦИИ ПО ЗАКАЗУ ----------------
    const itemsMap = new Map<number, typeof orderItems>();

    for (const item of orderItems) {
      if (!itemsMap.has(item.order_id)) {
        itemsMap.set(item.order_id, []);
      }
      itemsMap.get(item.order_id)!.push(item);
    }

    // ---------------- СТАТУСЫ ----------------
    const lastStatuses = orderIds.length
      ? await prisma.order_status.findMany({
          where: { order_id: { in: orderIds } },
          orderBy: { log_timestamp: 'desc' },
          distinct: ['order_id']
        })
      : [];

    const statusMap = new Map<number, typeof lastStatuses[number]>();
    for (const st of lastStatuses) {
      statusMap.set(st.order_id, st);
    }

    // ---------------- ФОРМИРОВАНИЕ ОТВЕТА ----------------
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

      const orderTotal = formattedItems.reduce(
        (sum, i) => sum + i.total,
        0
      );

      const currentStatus = statusMap.get(order.order_id) || null;

      return {
        order_id: order.order_id,
        order_uuid: order.order_uuid,
        user_id: order.user_id,
        business_id: order.business_id,
        delivery_type: order.delivery_type,
        delivery_date: order.delivery_date,
        log_timestamp: order.log_timestamp,
        is_canceled: order.is_canceled,

        items_count: formattedItems.length,
        order_total: +orderTotal.toFixed(2),

        items: formattedItems,

        current_status: currentStatus
          ? {
              status: currentStatus.status,
              is_canceled: currentStatus.isCanceled,
              log_timestamp: currentStatus.log_timestamp
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
        },
        filters_applied: {
          start_date: startDateRaw,
          end_date: endDateRaw
        }
      },
      message: `Найдено ${data.length} заказов`
    });

  } catch (error) {
    next(error);
  }
}

}
