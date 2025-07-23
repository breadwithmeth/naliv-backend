import { Request, Response, NextFunction } from 'express';
import prisma from '../database';
import { createError } from '../middleware/errorHandler';

export class UserController {
  
  /**
   * Получить всех пользователей
   */
  static async getAllUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const users = await prisma.user.findMany({
        orderBy: {
          log_timestamp: 'desc'
        }
      });

      res.json({
        success: true,
        data: users,
        count: users.length
      });
    } catch (error) {
      next(createError(500, 'Ошибка получения пользователей'));
    }
  }

  /**
   * Получить пользователя по ID
   */
  static async getUserById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        throw createError(400, 'Неверный ID пользователя');
      }

      const user = await prisma.user.findUnique({
        where: { user_id: id }
      });

      if (!user) {
        throw createError(404, 'Пользователь не найден');
      }

      res.json({
        success: true,
        data: user
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Создать нового пользователя
   */
  static async createUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name, first_name, last_name, login, password, sex, date_of_birth } = req.body;

      if (!login) {
        throw createError(400, 'Логин обязателен');
      }

      // Проверка на уникальность логина
      const existingUser = await prisma.user.findFirst({
        where: { login }
      });

      if (existingUser) {
        throw createError(409, 'Пользователь с таким логином уже существует');
      }

      const newUser = await prisma.user.create({
        data: {
          name,
          first_name,
          last_name,
          login,
          password,
          sex,
          date_of_birth: date_of_birth ? new Date(date_of_birth) : null
        }
      });

      res.status(201).json({
        success: true,
        data: newUser,
        message: 'Пользователь успешно создан'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Получить товары для пользователя по business_id
   */
  static async getUserItemsByBusiness(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = parseInt(req.params.userId);
      const businessId = parseInt(req.params.businessId);
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const categoryId = req.query.categoryId ? parseInt(req.query.categoryId as string) : undefined;
      const search = req.query.search as string;

      if (isNaN(userId) || isNaN(businessId)) {
        throw createError(400, 'Неверный ID пользователя или бизнеса');
      }

      // Проверяем существование пользователя
      const user = await prisma.user.findUnique({
        where: { user_id: userId }
      });

      if (!user) {
        throw createError(404, 'Пользователь не найден');
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

      // Получаем информацию о категориях
      const categoryIds = [...new Set(items.map(item => item.category_id).filter((id): id is number => id !== null))];
      const categories = await prisma.categories.findMany({
        where: {
          category_id: { in: categoryIds }
        }
      });

      // Объединяем данные
      const itemsWithDetails = items.map(item => {
        const price = latestPrices.find(p => p.item_id === item.item_id);
        const stock = stockData.find(s => s.item_id === item.item_id);
        const category = categories.find(c => c.category_id === item.category_id);
        
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
          category: category ? {
            id: category.category_id,
            name: category.name,
            img: category.img
          } : null,
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
            logo: business.logo,
            img: business.img,
            description: business.description,
            lat: business.lat,
            lon: business.lon,
            enabled: business.enabled
          },
          pagination: {
            current_page: page,
            per_page: limit,
            total: totalCount,
            total_pages: Math.ceil(totalCount / limit)
          },
          filters: {
            category_id: categoryId,
            search: search
          }
        },
        message: `Найдено ${totalCount} товаров в магазине "${business.name}"`
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Получить избранные товары пользователя
   */
  static async getUserLikedItems(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = parseInt(req.params.userId);
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      if (isNaN(userId)) {
        throw createError(400, 'Неверный ID пользователя');
      }

      // Проверяем существование пользователя
      const user = await prisma.user.findUnique({
        where: { user_id: userId }
      });

      if (!user) {
        throw createError(404, 'Пользователь не найден');
      }

      // Получаем избранные товары с деталями
      const [likedItemsData, totalCount] = await Promise.all([
        prisma.liked_items.findMany({
          where: { user_id: userId },
          orderBy: {
            log_timestamp: 'desc'
          },
          skip: (page - 1) * limit,
          take: limit
        }),
        prisma.liked_items.count({
          where: { user_id: userId }
        })
      ]);

      // Получаем детали товаров
      const itemIds = likedItemsData.map(like => like.item_id);
      const items = await prisma.items.findMany({
        where: {
          item_id: { in: itemIds },
          visible: 1
        }
      });

      // Получаем последние цены
      const latestPrices = await prisma.prices.findMany({
        where: {
          item_id: { in: itemIds }
        },
        orderBy: {
          log_timestamp: 'desc'
        },
        distinct: ['item_id']
      });

      // Объединяем данные
      const likedItemsWithDetails = likedItemsData.map(like => {
        const item = items.find(i => i.item_id === like.item_id);
        const price = latestPrices.find(p => p.item_id === like.item_id);
        
        return {
          like_id: like.like_id,
          liked_at: like.log_timestamp,
          item: item ? {
            item_id: item.item_id,
            name: item.name,
            description: item.description,
            thumb: item.thumb,
            img: item.img,
            current_price: price?.price || item.price || 0,
            unit: item.unit,
            business_id: item.business_id
          } : null
        };
      }).filter(like => like.item !== null);

      res.json({
        success: true,
        data: {
          liked_items: likedItemsWithDetails,
          pagination: {
            current_page: page,
            per_page: limit,
            total: totalCount,
            total_pages: Math.ceil(totalCount / limit)
          }
        },
        message: `Найдено ${totalCount} избранных товаров`
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Добавить товар в избранное
   */
  static async addItemToLiked(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = parseInt(req.params.userId);
      const { item_id } = req.body;

      if (isNaN(userId) || !item_id) {
        throw createError(400, 'Неверный ID пользователя или товара');
      }

      // Проверяем существование пользователя
      const user = await prisma.user.findUnique({
        where: { user_id: userId }
      });

      if (!user) {
        throw createError(404, 'Пользователь не найден');
      }

      // Проверяем существование товара
      const item = await prisma.items.findUnique({
        where: { item_id: parseInt(item_id) }
      });

      if (!item) {
        throw createError(404, 'Товар не найден');
      }

      // Проверяем, не добавлен ли уже товар в избранное
      const existingLike = await prisma.liked_items.findFirst({
        where: {
          user_id: userId,
          item_id: parseInt(item_id)
        }
      });

      if (existingLike) {
        throw createError(409, 'Товар уже добавлен в избранное');
      }

      const likedItem = await prisma.liked_items.create({
        data: {
          user_id: userId,
          item_id: parseInt(item_id)
        }
      });

      res.status(201).json({
        success: true,
        data: likedItem,
        message: 'Товар добавлен в избранное'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Удалить товар из избранного
   */
  static async removeItemFromLiked(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = parseInt(req.params.userId);
      const itemId = parseInt(req.params.itemId);

      if (isNaN(userId) || isNaN(itemId)) {
        throw createError(400, 'Неверный ID пользователя или товара');
      }

      // Проверяем существование записи в избранном
      const likedItem = await prisma.liked_items.findFirst({
        where: {
          user_id: userId,
          item_id: itemId
        }
      });

      if (!likedItem) {
        throw createError(404, 'Товар не найден в избранном');
      }

      await prisma.liked_items.delete({
        where: {
          like_id: likedItem.like_id
        }
      });

      res.json({
        success: true,
        message: 'Товар удален из избранного'
      });
    } catch (error) {
      next(error);
    }
  }
}
