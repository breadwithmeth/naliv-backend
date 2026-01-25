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
  static async getOrders(req: DeveloperAuthRequest, res: Response, next: NextFunction): Promise<void> {
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

      const businessIdRaw = req.query.business_id as string | undefined;
      if (businessIdRaw) {
        const businessId = Number(businessIdRaw);
        if (!Number.isFinite(businessId) || businessId <= 0) {
          throw createError(400, 'business_id должен быть положительным числом');
        }
        where.business_id = businessId;
      }

      const userIdRaw = req.query.user_id as string | undefined;
      if (userIdRaw) {
        const userId = Number(userIdRaw);
        if (!Number.isFinite(userId) || userId <= 0) {
          throw createError(400, 'user_id должен быть положительным числом');
        }
        where.user_id = userId;
      }

      const deliveryTypeRaw = req.query.delivery_type as string | undefined;
      if (deliveryTypeRaw) {
        const allowed = ['DELIVERY', 'PICKUP', 'SCHEDULED'];
        if (!allowed.includes(deliveryTypeRaw)) {
          throw createError(400, 'delivery_type должен быть одним из: DELIVERY, PICKUP, SCHEDULED');
        }
        where.delivery_type = deliveryTypeRaw;
      }

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

      const statusFilterRaw = req.query.status as string | undefined;
      const statusFilter = statusFilterRaw ? Number(statusFilterRaw) : null;
      if (statusFilterRaw && (!Number.isFinite(statusFilter) || statusFilter! < 0)) {
        throw createError(400, 'status должен быть числом');
      }

      const data = orders
        .map(order => {
          const currentStatus = statusMap.get(order.order_id) || null;
          return {
            order_id: order.order_id,
            order_uuid: order.order_uuid,
            user_id: order.user_id,
            business_id: order.business_id,
            log_timestamp: order.log_timestamp,
            delivery_type: order.delivery_type,
            delivery_date: order.delivery_date,
            address_id: order.address_id,
            delivery_price: Number(order.delivery_price || 0),
            bonus_used: Number(order.bonus || 0),
            is_canceled: order.is_canceled,
            current_status: currentStatus
              ? {
                  status: currentStatus.status,
                  is_canceled: currentStatus.isCanceled,
                  log_timestamp: currentStatus.log_timestamp
                }
              : null
          };
        })
        .filter(row => (statusFilter === null ? true : row.current_status?.status === statusFilter));

      res.json({
        success: true,
        data: {
          orders: data,
          pagination: {
            page,
            limit,
            total: statusFilter !== null ? data.length : total,
            total_pages: Math.ceil((statusFilter !== null ? data.length : total) / limit)
          },
          filters_applied: {
            start_date: startDateRaw,
            end_date: endDateRaw,
            business_id: businessIdRaw || null,
            user_id: userIdRaw || null,
            status: statusFilterRaw || null,
            delivery_type: deliveryTypeRaw || null
          }
        },
        message: `Найдено ${data.length} заказов`
      });
    } catch (error) {
      next(error);
    }
  }
}
