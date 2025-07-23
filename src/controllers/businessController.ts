import { Request, Response, NextFunction } from 'express';
import prisma from '../database';
import { createError } from '../middleware/errorHandler';

export class BusinessController {
  
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

      // Получаем бизнесы с пагинацией
      const [businesses, totalCount] = await Promise.all([
        prisma.businesses.findMany({
          where: whereConditions,
          orderBy: {
            log_timestamp: 'desc'
          },
          skip: (page - 1) * limit,
          take: limit
        }),
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
            address: business.address,
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

      const business = await prisma.businesses.findUnique({
        where: { business_id: id }
      });

      if (!business) {
        throw createError(404, 'Бизнес не найден');
      }

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
            id: business.business_id,
            name: business.name,
            description: business.description,
            address: business.address,
            lat: business.lat,
            lon: business.lon,
            logo: business.logo,
            img: business.img,
            city_id: business.city,
            enabled: business.enabled,
            created_at: business.log_timestamp,
            organization_id: business.organization_id
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
      const business = await prisma.businesses.findUnique({
        where: { business_id: businessId }
      });

      if (!business) {
        throw createError(404, 'Бизнес не найден');
      }

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
            address: business.address,
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
      const business = await prisma.businesses.findUnique({
        where: { business_id: businessId }
      });

      if (!business) {
        throw createError(404, 'Бизнес не найден');
      }

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
}
