import { Request, Response, NextFunction } from 'express';
import prisma from '../database';
import { createError } from '../middleware/errorHandler';

/**
 * Контроллер для работы с товарами
 */
export class ItemController {
  /**
   * Поиск товаров по имени
   * GET /api/items/search?name=...
   */
  static async searchByName(req: Request, res: Response, next: NextFunction) {
    try {
      const { name } = req.query;
      if (!name || typeof name !== 'string') {
        return next(createError(400, 'Параметр name обязателен'));
      }

      const items = await prisma.items.findMany({
        where: {
          name: { contains: name },
          visible: 1
        },
        orderBy: { name: 'asc' },
        take: 50
      });

      res.json({
        success: true,
        data: { items },
        message: `Найдено ${items.length} товаров`
      });
    } catch (error: any) {
      console.error('Ошибка поиска товаров по имени:', error);
      next(createError(500, `Ошибка поиска: ${error.message}`));
    }
  }
}
