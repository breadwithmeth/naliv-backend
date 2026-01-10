import { Request, Response, NextFunction } from 'express';
import { BusinessAuthRequest } from '../middleware/businessAuth';
import prisma from '../database';
import { createError } from '../middleware/errorHandler';
import axios from 'axios';
import bcrypt from 'bcryptjs';

export class BusinessController {

  private static normalizeUserLoginPhone(login: unknown): string {
    const raw = String(login ?? '').trim();
    if (!raw) {
      throw createError(400, 'Login обязателен');
    }

    // В БД логин обычно хранится как "+77077707600".
    // Принимаем также "77077707600".
    const withoutSpaces = raw.replace(/\s+/g, '');
    const withPlus = withoutSpaces.startsWith('+') ? withoutSpaces : `+${withoutSpaces}`;

    const loginRegex = /^\+7\d{10}$/;
    if (!loginRegex.test(withPlus)) {
      throw createError(400, 'Неверный формат login. Используйте +77077707600 или 77077707600');
    }

    return withPlus;
  }

  private static normalizePhoneForWhatsApp(phone: unknown): string {
    const raw = String(phone ?? '').trim();
    if (!raw) {
      throw createError(400, 'Номер телефона обязателен');
    }

    // Принимаем: +77077707600 или 77077707600
    const cleaned = raw.replace(/\s+/g, '').replace(/^\+/, '');
    const phoneRegex = /^7\d{10}$/;
    if (!phoneRegex.test(cleaned)) {
      throw createError(400, 'Неверный формат номера телефона. Используйте +77077707600 или 77077707600');
    }

    return cleaned;
  }

  private static normalizeWhatsAppCode(code: unknown): string {
    const value = String(code ?? '').trim();
    if (!value) {
      throw createError(400, 'Код обязателен');
    }
    if (!/^\d{4,8}$/.test(value)) {
      throw createError(400, 'Код должен состоять из 4-8 цифр');
    }
    return value;
  }

  private static async sendWhatsAppTemplateCode(phoneNumber: string, code: string): Promise<{ ok: boolean; messageId?: string; error?: string }> {
    try {
      const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
      const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || '958088394044701';

      if (!accessToken) {
        return { ok: false, error: 'WHATSAPP_ACCESS_TOKEN не установлен' };
      }

      const response = await axios.post(
        `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          to: phoneNumber,
          type: 'template',
          template: {
            name: 'r2',
            language: { code: 'ru' },
            components: [
              {
                type: 'body',
                parameters: [{ type: 'text', text: code }]
              }
            ]
          }
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const messageId = response?.data?.messages?.[0]?.id;
      return { ok: true, messageId };
    } catch (err: any) {
      const error = err?.response?.data ? JSON.stringify(err.response.data) : (err?.message || 'Unknown error');
      return { ok: false, error };
    }
  }

  private static toNumber(value: unknown, fieldName: string): number {
    const parsed = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
    if (!Number.isFinite(parsed)) {
      throw createError(400, `Неверное числовое значение поля "${fieldName}"`);
    }
    return parsed;
  }
  
  /**
   * Валидация и парсинг даты с поддержкой времени
   */
  private static validateAndParseDate(dateString: string, isEndDate = false): Date {
    if (!dateString) {
      throw createError(400, 'Дата не может быть пустой');
    }

    // Поддерживаемые форматы:
    // YYYY-MM-DD
    // YYYY-MM-DD HH:mm
    // YYYY-MM-DD HH:mm:ss
    // YYYY-MM-DDTHH:mm:ss
    // YYYY-MM-DDTHH:mm:ss.sssZ (ISO)
    
    const date = new Date(dateString);
    
    if (isNaN(date.getTime())) {
      throw createError(400, 'Неверный формат даты. Поддерживаемые форматы: YYYY-MM-DD, YYYY-MM-DD HH:mm:ss, ISO 8601');
    }

    // Если передана только дата без времени (длина 10 символов), устанавливаем время
    if (dateString.length === 10) {
      if (isEndDate) {
        date.setHours(23, 59, 59, 999); // Конец дня
      } else {
        date.setHours(0, 0, 0, 0); // Начало дня
      }
    }

    return date;
  }

  /**
   * Получить все бизнесы
   */
  static async getAllBusinesses(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const cityId = req.query.city_id ? parseInt(req.query.city_id as string) : undefined;
      const search = req.query.search as string;

      // Строим условия для фильтрации
      const whereConditions: any = {
        enabled: 1
      };

      if (cityId) {
        whereConditions.city = cityId;
      }

      if (search) {
        whereConditions.OR = [
          { name: { contains: search } },
          { description: { contains: search } },
          { address: { contains: search } }
        ];
      }

      // Построим динамический SQL запрос
      let sqlQuery = `
        SELECT 
          b.business_id,
          b.name,
          b.description,
          b.address,
          b.lat,
          b.lon,
          b.logo,
          b.img,
          b.city,
          b.enabled,
          b.log_timestamp,
          c.name as city_name
        FROM businesses b
        LEFT JOIN cities c ON c.city_id = b.city
        WHERE b.enabled = 1
      `;

      const queryParams: any[] = [];

      if (cityId) {
        sqlQuery += ` AND b.city = ?`;
        queryParams.push(cityId);
      }

      if (search) {
        sqlQuery += ` AND (b.name LIKE ? OR b.description LIKE ? OR b.address LIKE ?)`;
        queryParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
      }

      sqlQuery += ` ORDER BY b.log_timestamp DESC LIMIT ? OFFSET ?`;
      queryParams.push(limit, (page - 1) * limit);

      // Получаем бизнесы с пагинацией
      const [businesses, totalCount] = await Promise.all([
        prisma.$queryRawUnsafe<any[]>(sqlQuery, ...queryParams),
        prisma.businesses.count({
          where: whereConditions
        })
      ]);

      res.json({
        success: true,
        data: {
          businesses: businesses.map(business => ({
            id: business.business_id,
            name: business.name,
            description: business.description,
            address: business.city_name ? `${business.address}, ${business.city_name}` : business.address,
            lat: business.lat,
            lon: business.lon,
            logo: business.logo,
            img: business.img,
            city_id: business.city,
            enabled: business.enabled,
            created_at: business.log_timestamp
          })),
          pagination: {
            current_page: page,
            per_page: limit,
            total: totalCount,
            total_pages: Math.ceil(totalCount / limit)
          },
          filters: {
            city_id: cityId,
            search: search
          }
        },
        message: `Найдено ${totalCount} бизнесов`
      });
    } catch (error) {
      next(createError(500, 'Ошибка получения бизнесов'));
    }
  }

  /**
   * Получить бизнес по ID
   */
  static async getBusinessById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        throw createError(400, 'Неверный ID бизнеса');
      }

      const business = await prisma.$queryRaw<any[]>`
        SELECT 
          b.business_id,
          b.name,
          b.description,
          b.address,
          b.lat,
          b.lon,
          b.logo,
          b.img,
          b.city,
          b.enabled,
          b.log_timestamp,
          b.organization_id,
          c.name as city_name
        FROM businesses b
        LEFT JOIN cities c ON c.city_id = b.city
        WHERE b.business_id = ${id}
      `;

      if (!business || business.length === 0) {
        throw createError(404, 'Бизнес не найден');
      }

      const businessData = business[0];

      // Получаем статистику товаров
      const itemsCount = await prisma.items.count({
        where: {
          business_id: id,
          visible: 1
        }
      });

      // Получаем категории товаров этого бизнеса
      const itemsWithCategories = await prisma.items.findMany({
        where: {
          business_id: id,
          visible: 1,
          category_id: { not: null }
        },
        select: { category_id: true },
        distinct: ['category_id']
      });

      const categoryIds = itemsWithCategories
        .map(item => item.category_id)
        .filter((id): id is number => id !== null);

      const categories = await prisma.categories.findMany({
        where: {
          category_id: { in: categoryIds }
        }
      });

      res.json({
        success: true,
        data: {
          business: {
            id: businessData.business_id,
            name: businessData.name,
            description: businessData.description,
            address: businessData.city_name ? `${businessData.address}, ${businessData.city_name}` : businessData.address,
            lat: businessData.lat,
            lon: businessData.lon,
            logo: businessData.logo,
            img: businessData.img,
            city_id: businessData.city,
            enabled: businessData.enabled,
            created_at: businessData.log_timestamp,
            organization_id: businessData.organization_id
          },
          statistics: {
            total_items: itemsCount,
            categories_count: categories.length
          },
          categories: categories.map(cat => ({
            id: cat.category_id,
            name: cat.name,
            img: cat.img,
            visible: cat.visible
          }))
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Получить товары бизнеса
   */
  static async getBusinessItems(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const businessId = parseInt(req.params.businessId);
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const categoryId = req.query.categoryId ? parseInt(req.query.categoryId as string) : undefined;
      const search = req.query.search as string;
      const inStock = req.query.inStock === 'true';

      if (isNaN(businessId)) {
        throw createError(400, 'Неверный ID бизнеса');
      }

      // Проверяем существование бизнеса
      const businessResult = await prisma.$queryRaw<any[]>`
        SELECT 
          b.business_id,
          b.name,
          b.address,
          b.logo,
          b.enabled,
          c.name as city_name
        FROM businesses b
        LEFT JOIN cities c ON c.city_id = b.city
        WHERE b.business_id = ${businessId}
      `;

      if (!businessResult || businessResult.length === 0) {
        throw createError(404, 'Бизнес не найден');
      }

      const business = businessResult[0];

      if (!business.enabled) {
        throw createError(403, 'Бизнес временно недоступен');
      }

      // Строим условия для фильтрации
      const whereConditions: any = {
        business_id: businessId,
        visible: 1
      };

      if (categoryId) {
        whereConditions.category_id = categoryId;
      }

      if (search) {
        whereConditions.OR = [
          { name: { contains: search } },
          { description: { contains: search } },
          { code: { contains: search } },
          { barcode: { contains: search } }
        ];
      }

      // Получаем товары с пагинацией
      const [items, totalCount] = await Promise.all([
        prisma.items.findMany({
          where: whereConditions,
          orderBy: {
            log_timestamp: 'desc'
          },
          skip: (page - 1) * limit,
          take: limit
        }),
        prisma.items.count({
          where: whereConditions
        })
      ]);

      // Получаем последние цены для товаров
      const itemIds = items.map(item => item.item_id);
      const latestPrices = await prisma.prices.findMany({
        where: {
          item_id: { in: itemIds }
        },
        orderBy: {
          log_timestamp: 'desc'
        },
        distinct: ['item_id']
      });

      // Получаем остатки товаров
      const stockData = await prisma.items_in_stock.findMany({
        where: {
          item_id: { in: itemIds }
        },
        orderBy: {
          log_timestamp: 'desc'
        },
        distinct: ['item_id']
      });

      // Фильтруем по наличию если нужно
      let filteredItems = items;
      if (inStock) {
        const inStockItemIds = stockData
          .filter(stock => stock.amount > 0)
          .map(stock => stock.item_id);
        filteredItems = items.filter(item => inStockItemIds.includes(item.item_id));
      }

      // Объединяем данные
      const itemsWithDetails = filteredItems.map(item => {
        const price = latestPrices.find(p => p.item_id === item.item_id);
        const stock = stockData.find(s => s.item_id === item.item_id);
        
        return {
          item_id: item.item_id,
          name: item.name,
          description: item.description,
          code: item.code,
          barcode: item.barcode,
          thumb: item.thumb,
          img: item.img,
          quantity: item.quantity,
          unit: item.unit,
          by_weight: item.by_weight,
          visible: item.visible,
          category_id: item.category_id,
          current_price: price?.price || item.price || 0,
          base_price: item.price,
          amount: item.amount,
          in_stock: stock?.amount || 0,
          price_updated_at: price?.log_timestamp,
          stock_updated_at: stock?.log_timestamp,
          created_at: item.log_timestamp
        };
      });

      res.json({
        success: true,
        data: {
          items: itemsWithDetails,
          business: {
            id: business.business_id,
            name: business.name,
            address: business.city_name ? `${business.address}, ${business.city_name}` : business.address,
            logo: business.logo
          },
          pagination: {
            current_page: page,
            per_page: limit,
            total: inStock ? filteredItems.length : totalCount,
            total_pages: Math.ceil((inStock ? filteredItems.length : totalCount) / limit)
          },
          filters: {
            category_id: categoryId,
            search: search,
            in_stock: inStock
          }
        },
        message: `Найдено ${inStock ? filteredItems.length : totalCount} товаров`
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Получить категории товаров бизнеса
   */
  static async getBusinessCategories(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const businessId = parseInt(req.params.businessId);

      if (isNaN(businessId)) {
        throw createError(400, 'Неверный ID бизнеса');
      }

      // Проверяем существование бизнеса
      const businessResult = await prisma.$queryRaw<any[]>`
        SELECT 
          b.business_id,
          b.name,
          c.name as city_name
        FROM businesses b
        LEFT JOIN cities c ON c.city_id = b.city
        WHERE b.business_id = ${businessId}
      `;

      if (!businessResult || businessResult.length === 0) {
        throw createError(404, 'Бизнес не найден');
      }

      const business = businessResult[0];

      // Получаем уникальные категории товаров этого бизнеса
      const categoryIds = await prisma.items.findMany({
        where: {
          business_id: businessId,
          visible: 1,
          category_id: { not: null }
        },
        select: { category_id: true },
        distinct: ['category_id']
      });

      const uniqueCategoryIds = categoryIds
        .map(item => item.category_id)
        .filter((id): id is number => id !== null);

      if (uniqueCategoryIds.length === 0) {
        res.json({
          success: true,
          data: {
            categories: [],
            business: {
              id: business.business_id,
              name: business.name
            }
          },
          message: 'В данном бизнесе нет товаров с категориями'
        });
        return;
      }

      // Получаем детали категорий с количеством товаров
      const categories = await prisma.categories.findMany({
        where: {
          category_id: { in: uniqueCategoryIds },
          visible: 1
        }
      });

      // Получаем количество товаров в каждой категории
      const categoriesWithCounts = await Promise.all(
        categories.map(async (category) => {
          const itemsCount = await prisma.items.count({
            where: {
              business_id: businessId,
              category_id: category.category_id,
              visible: 1
            }
          });

          return {
            id: category.category_id,
            name: category.name,
            img: category.img,
            parent_category: category.parent_category,
            visible: category.visible,
            items_count: itemsCount
          };
        })
      );

      res.json({
        success: true,
        data: {
          categories: categoriesWithCounts.sort((a, b) => a.name.localeCompare(b.name)),
          business: {
            id: business.business_id,
            name: business.name
          }
        },
        message: `Найдено ${categories.length} категорий товаров`
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Отчет по курьерам и доставкам за период
   * Использует последнюю запись из таблицы order_status для определения статуса заказа
   */
  static async getCouriersDeliveryReport(req: BusinessAuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const startDate = req.query.start_date as string;
      const endDate = req.query.end_date as string;
      const businessId = req.business?.business_id;

      if (!startDate || !endDate) {
        throw createError(400, 'Необходимо указать start_date и end_date');
      }

      // Валидация и парсинг дат с поддержкой времени
      const start = BusinessController.validateAndParseDate(startDate, false);
      const end = BusinessController.validateAndParseDate(endDate, true);
      
      if (start > end) {
        throw createError(400, 'Дата начала не может быть больше даты окончания');
      }

      // Запрос для получения доставленных заказов с использованием последней записи из order_status
      let sqlQuery = `
        SELECT 
          o.order_id,
          o.order_uuid,
          o.delivery_price,
          o.log_timestamp as order_created,
          o.courier_id,
          c.login as courier_login,
          c.full_name as courier_name,
          b.name as business_name,
          u.name as customer_name,
          da.address as delivery_address,
          os.status as current_status
        FROM orders o
        LEFT JOIN couriers c ON c.courier_id = o.courier_id
        LEFT JOIN businesses b ON b.business_id = o.business_id
        LEFT JOIN users u ON u.user_id = o.user_id
        LEFT JOIN user_addreses da ON da.address_id = o.address_id
        LEFT JOIN (
          SELECT 
            order_id, 
            status,
            ROW_NUMBER() OVER (PARTITION BY order_id ORDER BY log_timestamp DESC) as rn
          FROM order_status
        ) os ON o.order_id = os.order_id AND os.rn = 1
        WHERE os.status = 4 
          AND o.log_timestamp BETWEEN ? AND ?
      `;

      const queryParams: any[] = [start, end];

      if (businessId) {
        sqlQuery += ` AND o.business_id = ?`;
        queryParams.push(businessId);
      }

      sqlQuery += ` ORDER BY o.log_timestamp DESC`;

      const deliveredOrders = await prisma.$queryRawUnsafe<any[]>(sqlQuery, ...queryParams);

      // Простая статистика
      const totalOrders = deliveredOrders.length;
      const ordersWithCourier = deliveredOrders.filter(order => order.courier_id).length;
      const totalRevenue = deliveredOrders.reduce((sum, order) => sum + Number(order.total_sum), 0);
      const totalDeliveryRevenue = deliveredOrders.reduce((sum, order) => sum + Number(order.delivery_price), 0);

      res.json({
        success: true,
        data: {
          period: {
            start_date: startDate,
            end_date: endDate
          },
          summary: {
            total_delivered_orders: totalOrders,
            orders_with_courier: ordersWithCourier,
            orders_without_courier: totalOrders - ordersWithCourier,
            total_revenue: totalRevenue,
            total_delivery_revenue: totalDeliveryRevenue
          },
          orders: deliveredOrders.map(order => ({
            order_id: order.order_id,
            order_uuid: order.order_uuid,
            delivery_price: Number(order.delivery_price),
            total_sum: Number(order.total_sum),
            order_created: order.order_created,
            courier: order.courier_id ? {
              courier_id: order.courier_id,
              login: order.courier_login,
              name: order.courier_name
            } : null,
            business_name: order.business_name,
            customer_name: order.customer_name,
            delivery_address: order.delivery_address
          }))
        },
        message: `Найдено ${totalOrders} доставленных заказов за период с ${startDate} по ${endDate}`
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Детальный отчет по конкретному курьеру за период
   * Использует последнюю запись из таблицы order_status для определения статуса заказа
   */
  static async getCourierDetailedReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const courierId = parseInt(req.params.courierId);
      const startDate = req.query.start_date as string;
      const endDate = req.query.end_date as string;

      if (isNaN(courierId)) {
        throw createError(400, 'Неверный ID курьера');
      }

      if (!startDate || !endDate) {
        throw createError(400, 'Необходимо указать start_date и end_date');
      }

      // Валидация и парсинг дат с поддержкой времени
      const start = BusinessController.validateAndParseDate(startDate, false);
      const end = BusinessController.validateAndParseDate(endDate, true);
      
      if (start > end) {
        throw createError(400, 'Дата начала не может быть больше даты окончания');
      }

      // Получаем информацию о курьере
      const courierInfo = await prisma.$queryRaw<any[]>`
        SELECT 
          c.courier_id,
          c.login,
          c.full_name,
          c.name,
          c.courier_type,
          ct.name as city_name,
          c.created_at
        FROM couriers c
        LEFT JOIN cities ct ON ct.city_id = c.city_id
        WHERE c.courier_id = ${courierId}
      `;

      if (!courierInfo || courierInfo.length === 0) {
        throw createError(404, 'Курьер не найден');
      }

      const courier = courierInfo[0];

      // Получаем все заказы курьера со статусом 4 (доставлен) из последней записи order_status
      let ordersQuery = `
        SELECT 
          o.order_id,
          o.order_uuid,
          o.delivery_price,
          o.total_sum,
          o.log_timestamp as order_created,
          b.name as business_name,
          b.address as business_address,
          u.name as customer_name,
          da.address as delivery_address,
          os.status as current_status
        FROM orders o
        LEFT JOIN businesses b ON b.business_id = o.business_id
        LEFT JOIN users u ON u.user_id = o.user_id
        LEFT JOIN user_addresses da ON da.address_id = o.address_id
        LEFT JOIN (
          SELECT 
            order_id, 
            status,
            ROW_NUMBER() OVER (PARTITION BY order_id ORDER BY log_timestamp DESC) as rn
          FROM order_status
        ) os ON o.order_id = os.order_id AND os.rn = 1
        WHERE o.courier_id = ? 
          AND os.status = 4
          AND o.log_timestamp BETWEEN ? AND ?
      `;

      const orderQueryParams: any[] = [courierId, start, end];

      

      ordersQuery += ` ORDER BY o.log_timestamp DESC`;

      const courierOrders = await prisma.$queryRawUnsafe<any[]>(
        ordersQuery, 
        ...orderQueryParams
      );

      // Простая статистика
      const totalDelivered = courierOrders.length;
      const totalEarnings = courierOrders.reduce((sum, order) => sum + Number(order.delivery_price), 0);
      const totalOrderValue = courierOrders.reduce((sum, order) => sum + Number(order.total_sum), 0);

      res.json({
        success: true,
        data: {
          courier_info: {
            courier_id: courier.courier_id,
            login: courier.login,
            full_name: courier.full_name,
            name: courier.name,
            courier_type: courier.courier_type,
            city_name: courier.city_name,
            member_since: courier.created_at
          },
          period: {
            start_date: startDate,
            end_date: endDate
          },
          statistics: {
            total_delivered_orders: totalDelivered,
            total_earnings: totalEarnings,
            total_order_value: totalOrderValue,
            avg_delivery_price: totalDelivered > 0 ? Math.round(totalEarnings / totalDelivered) : 0
          },
          orders: courierOrders.map(order => ({
            order_id: order.order_id,
            order_uuid: order.order_uuid,
            delivery_price: Number(order.delivery_price),
            total_sum: Number(order.total_sum),
            business_name: order.business_name,
            business_address: order.business_address,
            customer_name: order.customer_name,
            delivery_address: order.delivery_address,
            order_created: order.order_created
          }))
        },
        message: `Курьер ${courier.full_name} доставил ${totalDelivered} заказов за период с ${startDate} по ${endDate}`
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Получить дисконтные карты пользователей, созданные за последнюю неделю
   * GET /api/business/discount-cards
   */
  static async getDiscountCards(req: BusinessAuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 2000);
      const search = req.query.search as string;
      const offset = (page - 1) * limit;

      // Базовый SQL запрос для пользователей с картами, созданными за последнюю неделю
      let sqlQuery = `
        SELECT 
          u.user_id,
          u.login, 
          CONCAT('disc', u.user_id) AS name, 
          bc.card_uuid,
          bc.log_timestamp as card_created,
          u.name as user_name,
          u.first_name,
          u.last_name
        FROM users u 
        INNER JOIN bonus_cards bc ON bc.bonus_card_id = ( 
          SELECT MAX(bonus_card_id) 
          FROM bonus_cards 
          WHERE bonus_cards.user_id = u.user_id 
        ) 
        WHERE u.user_id > 1
          AND u.is_app_user = 1
          
      `;

      const queryParams: any[] = [];

      // Добавляем поиск если указан
      if (search) {
        sqlQuery += ` AND (
          u.login LIKE ? OR 
          u.name LIKE ? OR 
          u.first_name LIKE ? OR 
          u.last_name LIKE ? OR
          bc.card_uuid LIKE ?
        )`;
        const searchPattern = `%${search}%`;
        queryParams.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
      }

      sqlQuery += ` ORDER BY u.user_id ASC`;

      // Для подсчета общего количества
      const countQuery = sqlQuery.replace(
        'SELECT u.user_id, u.login, CONCAT(\'disc\', u.user_id) AS name, bc.card_uuid, bc.log_timestamp as card_created, u.name as user_name, u.first_name, u.last_name',
        'SELECT COUNT(*) as total'
      ).replace('ORDER BY u.user_id ASC', '');

      // Добавляем пагинацию
      sqlQuery += ` LIMIT ? OFFSET ?`;
      queryParams.push(limit, offset);

      // Выполняем запросы параллельно
      const [discountCards, totalCountResult] = await Promise.all([
        prisma.$queryRawUnsafe<any[]>(sqlQuery, ...queryParams),
        prisma.$queryRawUnsafe<any[]>(countQuery, ...queryParams.slice(0, -2)) // убираем limit и offset для подсчета
      ]);

      const totalCount = Number(totalCountResult[0]?.total || 0);

      // Форматируем результат
      const formattedCards = discountCards.map(card => ({
        user_id: card.user_id,
        login: card.login,
        discount_name: card.name, // 'disc' + user_id
        card_uuid: card.card_uuid,
        card_created: card.card_created,
        user_info: {
          name: card.user_name,
          first_name: card.first_name,
          last_name: card.last_name,
          full_name: card.user_name || `${card.first_name || ''} ${card.last_name || ''}`.trim() || card.login || `Пользователь ${card.user_id}`
        },
        has_card: !!card.card_uuid
      }));

      // Статистика
      const cardsWithDiscount = formattedCards.filter(card => card.has_card).length;
      const cardsWithoutDiscount = formattedCards.length - cardsWithDiscount;

      res.json({
        success: true,
        data: {
          discount_cards: formattedCards,
          statistics: {
            total_users: totalCount,
            users_with_cards: cardsWithDiscount,
            users_without_cards: cardsWithoutDiscount,
            cards_coverage: totalCount > 0 ? Math.round((cardsWithDiscount / totalCount) * 100) : 0
          },
          pagination: {
            current_page: page,
            per_page: limit,
            total: totalCount,
            total_pages: Math.ceil(totalCount / limit),
            has_next: page < Math.ceil(totalCount / limit),
            has_prev: page > 1
          },
          filters: {
            search: search || null
          }
        },
        message: `Найдено ${totalCount} пользователей с картами за последнюю неделю${search ? ` по запросу "${search}"` : ''}`
      });
    } catch (error) {
      console.error('Ошибка получения дисконтных карт:', error);
      next(createError(500, 'Ошибка получения дисконтных карт'));
    }
  }

  /**
   * Получить акции бизнеса и их содержимое (товары)
   * GET /api/businesses/:businessId/promotions?active=true&page=1&limit=20&item_limit=50&search=...
   */
  static async getBusinessPromotions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const businessId = parseInt(req.params.businessId);
      if (isNaN(businessId)) {
        throw createError(400, 'Неверный ID бизнеса');
      }

      const page = parseInt((req.query.page as string) || '1');
      const limit = Math.min(parseInt((req.query.limit as string) || '20'), 100);
      const itemLimit = Math.min(parseInt((req.query.item_limit as string) || '50'), 200);
      const onlyActive = (req.query.active ?? 'true') === 'true';
      const search = (req.query.search as string) || undefined;

      // Проверяем существование бизнеса
      const business = await prisma.businesses.findUnique({
        where: { business_id: businessId },
        select: { business_id: true, name: true, address: true }
      });

      if (!business) {
        throw createError(404, 'Бизнес не найден');
      }

      const now = new Date();
      const where: any = {
        business_id: businessId,
        visible: 1
      };
      if (onlyActive) {
        where.start_promotion_date = { lte: now };
        where.end_promotion_date = { gte: now };
      }
      if (search) {
        where.name = { contains: search };
      }

      // Получаем акции с пагинацией
      const [promotions, total] = await Promise.all([
        prisma.marketing_promotions.findMany({
          where,
          orderBy: [
            { start_promotion_date: 'desc' },
            { marketing_promotion_id: 'desc' }
          ],
          skip: (page - 1) * limit,
          take: limit
        }),
        prisma.marketing_promotions.count({ where })
      ]);

      if (promotions.length === 0) {
        res.json({
          success: true,
          data: {
            business,
            promotions: [],
            pagination: {
              current_page: page,
              per_page: limit,
              total: 0,
              total_pages: 0,
              has_next: false,
              has_prev: false
            },
            filters: {
              active: onlyActive,
              search: search || null,
              item_limit: itemLimit
            }
          },
          message: 'Акции не найдены'
        });
        return;
      }

      const promotionIds = promotions.map(p => p.marketing_promotion_id);

      // Детали акций (содержат item_id и параметры акции)
      const details = await prisma.marketing_promotion_details.findMany({
        where: { marketing_promotion_id: { in: promotionIds } }
      });

      // Карта: акция -> список item_id
      const itemsByPromotion = new Map<number, number[]>();
      for (const d of details as any[]) {
        const list = itemsByPromotion.get(d.marketing_promotion_id) || [];
        list.push(d.item_id);
        itemsByPromotion.set(d.marketing_promotion_id, list);
      }

      const allItemIds = Array.from(new Set(details.map((d: any) => d.item_id)));

      // Получаем товары всех акций одним запросом
      const items = allItemIds.length > 0 ? await prisma.items.findMany({
        where: { item_id: { in: allItemIds }, business_id: businessId, visible: 1 },
        orderBy: { name: 'asc' }
      }) : [];

      // Категории
      const categoryIds = Array.from(new Set(items.map((it: any) => it.category_id).filter((id: any) => id !== null))) as number[];
      const categories = categoryIds.length ? await prisma.categories.findMany({
        where: { category_id: { in: categoryIds } },
        select: { category_id: true, name: true, parent_category: true }
      }) : [];
      const categoryMap = new Map(categories.map((c: any) => [c.category_id, c]));

      // Опции и варианты
      const itemIds = items.map((it: any) => it.item_id);
      const options = itemIds.length ? await prisma.options.findMany({
        where: { item_id: { in: itemIds } },
        orderBy: { option_id: 'asc' }
      }) : [];
      const optionIds = options.map((o: any) => o.option_id);
      const optionItems = optionIds.length ? await prisma.option_items.findMany({
        where: { option_id: { in: optionIds } },
        orderBy: { relation_id: 'asc' }
      }) : [];

      const optionsByItem = new Map<number, any[]>();
      for (const opt of options as any[]) {
        const variants = optionItems
          .filter((v: any) => v.option_id === opt.option_id)
          .map((v: any) => ({
            relation_id: v.relation_id,
            item_id: v.item_id,
            price_type: v.price_type,
            price: v.price ? Number(v.price) : 0,
            parent_item_amount: v.parent_item_amount
          }));
        const optObj = {
          option_id: opt.option_id,
          name: opt.name,
          required: opt.required,
          selection: opt.selection,
          variants
        };
        const arr = optionsByItem.get(opt.item_id) || [];
        arr.push(optObj);
        optionsByItem.set(opt.item_id, arr);
      }

      // Карта деталей по ключу "promotionId:itemId"
      const detailByItemByPromo = new Map<string, any>();
      for (const d of details as any[]) {
        detailByItemByPromo.set(`${d.marketing_promotion_id}:${d.item_id}`, {
          detail_id: d.detail_id,
          type: d.type,
          base_amount: d.base_amount !== null ? Number(d.base_amount) : null,
          add_amount: d.add_amount !== null ? Number(d.add_amount) : null,
          discount: d.discount !== null ? Number(d.discount) : null,
          name: d.name
        });
      }

      const itemsMap = new Map(items.map((it: any) => [it.item_id, it]));

      const promotionsWithItems = promotions.map(promo => {
        const itemIdsForPromo = itemsByPromotion.get(promo.marketing_promotion_id) || [];
        const promoItems = itemIdsForPromo
          .map(id => itemsMap.get(id))
          .filter(Boolean)
          .slice(0, itemLimit)
          .map((item: any) => ({
            item_id: item.item_id,
            name: item.name,
            price: item.price ? Number(item.price) : null,
            amount: item.amount ? Number(item.amount) : 0,
            unit: item.unit || 'шт',
            img: item.img,
            code: item.code,
            category: categoryMap.get(item.category_id) || null,
            visible: item.visible,
            promotion_detail: detailByItemByPromo.get(`${promo.marketing_promotion_id}:${item.item_id}`) || null
          }));

        return {
          marketing_promotion_id: promo.marketing_promotion_id,
          name: ((promo as any).public_name ?? promo.name) ?? null,
          start_promotion_date: promo.start_promotion_date,
          end_promotion_date: promo.end_promotion_date,
          visible: promo.visible,
          active: promo.start_promotion_date <= now && promo.end_promotion_date >= now,
          items_count: itemIdsForPromo.length,
          items: promoItems
        };
      });

      res.json({
        success: true,
        data: {
          business,
          promotions: promotionsWithItems,
          pagination: {
            current_page: page,
            per_page: limit,
            total: total,
            total_pages: Math.ceil(total / limit),
            has_next: page < Math.ceil(total / limit),
            has_prev: page > 1
          },
          filters: {
            active: onlyActive,
            search: search || null,
            item_limit: itemLimit
          }
        },
        message: `Найдено ${promotions.length} акций`
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Вспомогательный метод для получения названия статуса
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

  /**
   * Пометить всех пользователей приложения (массовое обновление)
   * POST /api/business/mark-app-users
   */
  static async markAppUsers(req: BusinessAuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      // Выполняем массовое обновление через raw query
      const updateResult = await prisma.$executeRaw`
        UPDATE users u
        INNER JOIN bonus_cards bc ON bc.user_id = u.user_id
        INNER JOIN phone_number_verify pv ON pv.phone_number = u.login
        SET u.is_app_user = 1
        WHERE u.user_id > 1
          AND u.login IS NOT NULL
          AND u.is_app_user = 0
      `;

      // Получаем статистику после обновления
      const stats = await prisma.$queryRaw<Array<{
        total_users: bigint;
        app_users: bigint;
        non_app_users: bigint;
      }>>`
        SELECT 
          COUNT(*) as total_users,
          SUM(CASE WHEN is_app_user = 1 THEN 1 ELSE 0 END) as app_users,
          SUM(CASE WHEN is_app_user = 0 THEN 1 ELSE 0 END) as non_app_users
        FROM users
        WHERE user_id > 1
      `;

      const statsResult = stats[0];

      res.json({
        success: true,
        data: {
          updated_count: updateResult,
          statistics: {
            total_users: Number(statsResult.total_users),
            app_users: Number(statsResult.app_users),
            non_app_users: Number(statsResult.non_app_users)
          }
        },
        message: `Успешно помечено ${updateResult} пользователей приложения`
      });

    } catch (error: any) {
      console.error('Ошибка при пометке пользователей приложения:', error);
      next(createError(500, 'Ошибка при массовом обновлении пользователей'));
    }
  }

  /**
   * Получить пользователей не из приложения (is_app_user = 0)
   * GET /api/businesses/non-app-users
   */
  static async getNonAppUsers(req: BusinessAuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const search = req.query.search as string;
      const offset = (page - 1) * limit;

      let sqlQuery = `
        SELECT 
          u.user_id,
          u.login,
          u.name,
          u.first_name,
          u.last_name,
          u.log_timestamp as created_at,
          u.is_app_user,
          bc.card_uuid,
          bc.log_timestamp as card_created_at
        FROM users u
        LEFT JOIN bonus_cards bc ON bc.bonus_card_id = (
          SELECT MAX(bonus_card_id)
          FROM bonus_cards
          WHERE bonus_cards.user_id = u.user_id
        )
        WHERE u.user_id > 1
          AND u.is_app_user = 0
      `;

      const queryParams: any[] = [];

      if (search) {
        sqlQuery += ` AND (
          u.login LIKE ? OR
          u.name LIKE ? OR
          u.first_name LIKE ? OR
          u.last_name LIKE ?
        )`;
        const searchPattern = `%${search}%`;
        queryParams.push(searchPattern, searchPattern, searchPattern, searchPattern);
      }

      sqlQuery += ` ORDER BY u.user_id DESC`;

      const countQuery = sqlQuery.replace(
        /SELECT[\s\S]*?FROM/,
        'SELECT COUNT(DISTINCT u.user_id) as total FROM'
      ).replace('ORDER BY u.user_id DESC', '');

      sqlQuery += ` LIMIT ? OFFSET ?`;
      queryParams.push(limit, offset);

      const [users, totalCountResult] = await Promise.all([
        prisma.$queryRawUnsafe<any[]>(sqlQuery, ...queryParams),
        prisma.$queryRawUnsafe<any[]>(countQuery, ...queryParams.slice(0, -2))
      ]);

      const totalCount = Number(totalCountResult[0]?.total || 0);

      const formattedUsers = users.map(user => ({
        user_id: user.user_id,
        login: user.login,
        name: user.name,
        first_name: user.first_name,
        last_name: user.last_name,
        full_name: user.name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.login || `Пользователь ${user.user_id}`,
        created_at: user.created_at,
        is_app_user: user.is_app_user,
        bonus_card: user.card_uuid ? {
          card_uuid: user.card_uuid,
          created_at: user.card_created_at
        } : null
      }));

      res.json({
        success: true,
        data: {
          users: formattedUsers,
          statistics: {
            total_non_app_users: totalCount,
            users_with_cards: formattedUsers.filter(u => u.bonus_card).length,
            users_without_cards: formattedUsers.filter(u => !u.bonus_card).length
          },
          pagination: {
            current_page: page,
            per_page: limit,
            total_items: totalCount,
            total_pages: Math.ceil(totalCount / limit)
          }
        },
        message: 'Список пользователей не из приложения получен'
      });

    } catch (error: any) {
      console.error('Ошибка при получении пользователей не из приложения:', error);
      next(createError(500, 'Ошибка при получении списка пользователей'));
    }
  }

  /**
   * Загрузка/обновление справочника товаров бизнеса по коду
   * Аналог upload_items из legacy PHP
   * POST /api/businesses/upload-items
   * Auth: Authorization: Bearer <business_token>
   * Body: { items: [{ code: string, name: string, barcode?: string|null }] }
   */
  static async uploadItems(req: BusinessAuthRequest, res: Response, next: NextFunction): Promise<void> {
    const now = new Date();
      const currentHour = now.getHours();
      
      if (currentHour < 11 || currentHour >= 18) {
        throw createError(503, 'Функция доступна только с 11:00 до 18:00');
      } 
    try {
      if (!req.business) {
        throw createError(401, 'Требуется авторизация бизнеса');
      }

      const businessId = req.business.business_id;
      const itemsRaw = (req.body as any)?.items;

      if (!Array.isArray(itemsRaw)) {
        throw createError(400, 'Поле "items" обязательно и должно быть массивом');
      }

      const normalized = itemsRaw
        .map((it: any) => ({
          code: typeof it?.code === 'string' ? it.code.trim() : String(it?.code ?? '').trim(),
          name: typeof it?.name === 'string' ? it.name.trim() : String(it?.name ?? '').trim(),
          barcode: it?.barcode === null || it?.barcode === undefined ? null : String(it.barcode).trim()
        }))
        .filter((it: { code: string; name: string; barcode: string | null }) => it.code.length > 0 && it.name.length > 0);

      if (normalized.length === 0) {
        throw createError(400, 'Список товаров пуст или имеет неверный формат');
      }

      const codes = Array.from(new Set(normalized.map(i => i.code)));

      const existing = await prisma.items.findMany({
        where: {
          business_id: businessId,
          code: { in: codes }
        },
        select: { code: true }
      });
      const existingCodes = new Set((existing || []).map(r => (r.code ?? '').toString()));

      const toCreate = normalized
        .filter(i => !existingCodes.has(i.code))
        .map(i => ({
          business_id: businessId,
          code: i.code,
          name: i.name,
          visible: 1,
          barcode: i.barcode
        }));

      const createResult = toCreate.length > 0
        ? await prisma.items.createMany({ data: toCreate })
        : { count: 0 };

      // Обновляем название и видимость для существующих товаров
      let nameUpdated = 0;
      for (const item of normalized) {
        if (existingCodes.has(item.code)) {
          const result = await prisma.items.updateMany({
            where: {
              business_id: businessId,
              code: item.code
            },
            data: { 
              name: item.name,
              visible: 1 
            }
          });
          nameUpdated += result.count;
        }
      }

      const codesByBarcode = new Map<string, string[]>();
      for (const it of normalized) {
        if (!it.barcode) continue;
        const list = codesByBarcode.get(it.barcode) ?? [];
        list.push(it.code);
        codesByBarcode.set(it.barcode, list);
      }

      let barcodeUpdated = 0;
      for (const [barcode, barcodeCodes] of codesByBarcode.entries()) {
        const r = await prisma.items.updateMany({
          where: {
            business_id: businessId,
            code: { in: Array.from(new Set(barcodeCodes)) }
          },
          data: { barcode }
        });
        barcodeUpdated += r.count;
      }

      res.json({
        success: true,
        data: {
          received: itemsRaw.length,
          normalized: normalized.length,
          created: createResult.count,
          name_updated: nameUpdated,
          barcode_updated: barcodeUpdated
        },
        message: 'Товары успешно загружены'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Загрузка/обновление цен и остатков товаров бизнеса по коду
   * Аналог upload_prices из legacy PHP
   * POST /api/businesses/upload-prices
   * Auth: Authorization: Bearer <business_token>
   * Body: { items: [{ KodTMC: string, Cena: number|string, Kol: number|string } ] }
   * Также поддерживает: { items: [{ code, price, amount }] }
   */
  static async uploadPrices(req: BusinessAuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.business) {
        throw createError(401, 'Требуется авторизация бизнеса');
      }

      const businessId = req.business.business_id;
      const itemsRaw = (req.body as any)?.items;

      if (!Array.isArray(itemsRaw)) {
        throw createError(400, 'Поле "items" обязательно и должно быть массивом');
      }

      const normalized = itemsRaw
        .map((it: any) => {
          const code = (it?.KodTMC ?? it?.code ?? '').toString().trim();
          const price = it?.Cena ?? it?.price;
          const amount = it?.Kol ?? it?.amount;
          return { code, price, amount };
        })
        .filter((it: { code: string }) => it.code.length > 0);

      if (normalized.length === 0) {
        throw createError(400, 'Список цен пуст или имеет неверный формат');
      }

      // Дедупликация по code: если код встречается несколько раз, берём последнее значение
      const byCode = new Map<string, { price: number; amount: number }>();
      for (const it of normalized) {
        const price = BusinessController.toNumber(it.price, 'Cena/price');
        const amount = BusinessController.toNumber(it.amount, 'Kol/amount');
        byCode.set(it.code, { price, amount });
      }

      const codes = Array.from(byCode.keys());
      const syncTimestamp = new Date();

      // Быстрое обновление по чанкам через один UPDATE на чанк:
      // UPDATE items JOIN (SELECT ... UNION ALL SELECT ...) v ON v.code = items.code
      const CHUNK_SIZE = 300;
      let updated = 0;

      for (let i = 0; i < codes.length; i += CHUNK_SIZE) {
        const chunkCodes = codes.slice(i, i + CHUNK_SIZE);

        const selectParts: string[] = [];
        const values: any[] = [];

        for (let idx = 0; idx < chunkCodes.length; idx += 1) {
          const code = chunkCodes[idx];
          const v = byCode.get(code);
          if (!v) continue;

          if (idx === 0) {
            selectParts.push('SELECT ? AS code, ? AS price, ? AS amount');
          } else {
            selectParts.push('UNION ALL SELECT ?, ?, ?');
          }
          values.push(code, v.price, v.amount);
        }

        if (selectParts.length === 0) continue;

        const updateSql = `
          UPDATE items i
          INNER JOIN (
            ${selectParts.join('\n')}
          ) v ON v.code = i.code
          SET
            i.price = v.price,
            i.amount = v.amount,
            i.visible = 1,
            i.log_timestamp = ?
          WHERE i.business_id = ?
        `;

        const affected = await prisma.$executeRawUnsafe<number>(
          updateSql,
          ...values,
          syncTimestamp,
          businessId
        );
        updated += Number(affected || 0);
      }

      res.json({
        success: true,
        data: {
          received: itemsRaw.length,
          normalized: normalized.length,
          updated
        },
        message: 'Цены и остатки успешно загружены'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Отправка кода через WhatsApp от имени бизнеса (WhatsApp Cloud API)
   * POST /api/businesses/whatsapp/send-code
   * Auth: Authorization: Bearer <business_token>
   * Body: { phone: string, code: string } где phone = login пользователя
   * Также поддерживает alias: { login: string, code: string }
   */
  static async sendWhatsAppCode(req: BusinessAuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      // Проверка времени: функция работает только с 11:00 до 18:00
      

      const businessId = req.business?.business_id;
      if (!businessId) {
        throw createError(401, 'Требуется авторизация бизнеса');
      }

      const body: any = req.body ?? {};
      const code = BusinessController.normalizeWhatsAppCode(body.code);

      let userId: number | null = null;
      let userLogin: string | null = null;
      let phone: string;

      // Номер телефона = login в users. Принимаем поле phone (основное) или login (alias).
      const incomingLogin = body.phone ?? body.login;
      const normalizedLogin = BusinessController.normalizeUserLoginPhone(incomingLogin);

      const user = await prisma.user.findFirst({
        where: { login: normalizedLogin },
        select: { user_id: true, login: true }
      });

      if (!user?.login) {
        throw createError(404, 'Пользователь с таким номером телефона (login) не найден');
      }

      userId = user.user_id;
      userLogin = user.login;
      phone = BusinessController.normalizePhoneForWhatsApp(user.login);

      const codeHash = await bcrypt.hash(code, 10);

      const sendResult = await BusinessController.sendWhatsAppTemplateCode(phone, code);
      const status = sendResult.ok ? 'sent' : 'failed';

      await prisma.business_whatsapp_codes.create({
        data: {
          business_id: businessId,
          user_id: userId,
          user_login: userLogin,
          phone_number: phone,
          code_hash: codeHash,
          template_name: 'r2',
          status,
          message_id: sendResult.messageId ?? null,
          error_message: sendResult.error ?? null
        }
      });

      if (!sendResult.ok) {
        throw createError(502, 'Не удалось отправить код через WhatsApp');
      }

      res.json({
        success: true,
        data: {
          user_id: userId,
          login: userLogin,
          phone,
          status,
          message_id: sendResult.messageId ?? null
        },
        message: 'Код отправлен через WhatsApp'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Получить список заказов за сутки со статусом 0
   * GET /api/businesses/orders/daily-pending
   * Auth: Authorization: Bearer <business_token>
   * Query params:
   *   - date (optional): дата в формате YYYY-MM-DD (по умолчанию текущая дата)
   */
  static async getDailyPendingOrders(req: BusinessAuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const businessId = req.business?.business_id;
      if (!businessId) {
        throw createError(401, 'Требуется авторизация бизнеса');
      }

      // Получаем дату из query параметра или используем текущую дату
      const dateParam = (req.query.date as string) || new Date().toISOString().split('T')[0];
      
      // Валидация и парсинг даты
      const startOfDay = BusinessController.validateAndParseDate(dateParam, false);
      const endOfDay = BusinessController.validateAndParseDate(dateParam, true);

      // Запрос для получения заказов со статусом 0 за указанные сутки
      const sqlQuery = `
        SELECT 
          o.order_id,
          o.order_uuid,
          o.user_id,
          o.business_id,
          o.address_id,
          o.delivery_price,
          o.log_timestamp as order_created,
          u.name as customer_name,
          u.login as customer_phone,
          da.address as delivery_address,
          os.status as current_status,
          os.log_timestamp as status_timestamp
        FROM orders o
        LEFT JOIN users u ON u.user_id = o.user_id
        LEFT JOIN user_addreses da ON da.address_id = o.address_id
        LEFT JOIN (
          SELECT 
            order_id, 
            status,
            log_timestamp,
            ROW_NUMBER() OVER (PARTITION BY order_id ORDER BY log_timestamp DESC) as rn
          FROM order_status
        ) os ON o.order_id = os.order_id AND os.rn = 1
        WHERE o.business_id = ?
          AND os.status = 0
          AND o.log_timestamp BETWEEN ? AND ?
        ORDER BY o.log_timestamp DESC
      `;

      const orders = await prisma.$queryRawUnsafe<any[]>(
        sqlQuery,
        businessId,
        startOfDay,
        endOfDay
      );

      // Получаем items для каждого заказа
      const ordersWithItems = await Promise.all(
        orders.map(async (order) => {
          const orderItems = await prisma.orders_items.findMany({
            where: { order_id: order.order_id }
          });

          // Получаем информацию о товарах
          const itemsDetails = await Promise.all(
            orderItems.map(async (orderItem) => {
              const item = await prisma.items.findUnique({
                where: { item_id: orderItem.item_id },
                select: {
                  item_id: true,
                  name: true,
                  code: true,
                  price: true
                }
              });

              return {
                item_id: item?.item_id,
                name: item?.name,
                code: item?.code,
                price: Number(item?.price || 0),
                amount: Number(orderItem.amount)
              };
            })
          );

          return {
            order_id: order.order_id,
            order_uuid: order.order_uuid,
            user_id: order.user_id,
            order_created: order.order_created,
            status: order.current_status,
            status_timestamp: order.status_timestamp,
            delivery_price: Number(order.delivery_price),
            customer: {
              name: order.customer_name,
              phone: order.customer_phone
            },
            delivery_address: order.delivery_address,
            items: itemsDetails
          };
        })
      );

      res.json({
        success: true,
        data: {
          date: dateParam,
          total_orders: ordersWithItems.length,
          orders: ordersWithItems
        },
        message: `Найдено ${ordersWithItems.length} заказов со статусом 0 за ${dateParam}`
      });
    } catch (error) {
      next(error);
    }
  }
}
