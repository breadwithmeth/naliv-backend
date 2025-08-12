import { Request, Response, NextFunction } from 'express';
import { BusinessAuthRequest } from '../middleware/businessAuth';
import prisma from '../database';
import { createError } from '../middleware/errorHandler';

export class BusinessController {
  
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
          AND bc.log_timestamp >= DATE_SUB(NOW(), INTERVAL 7 DAY)
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
}
