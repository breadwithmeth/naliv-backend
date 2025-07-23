import { Request, Response, NextFunction } from 'express';
import prisma from '../database';
import { createError } from '../middleware/errorHandler';

export class CategoryController {
  
  /**
   * Получение всех категорий с подкатегориями
   * GET /api/categories
   */
  static async getAllCategories(req: Request, res: Response, next: NextFunction) {
    try {
      const { business_id } = req.query;

      // Получаем все видимые категории
      const allCategories = await prisma.categories.findMany({
        where: {
          visible: 1
        },
        orderBy: [
          { parent_category: 'asc' },
          { name: 'asc' }
        ]
      });

      // Группируем категории по родительским
      const categoryMap = new Map();
      const rootCategories = [];

      // Сначала создаем все категории в карте
      for (const category of allCategories) {
        categoryMap.set(category.category_id, {
          ...category,
          subcategories: []
        });
      }

      // Затем строим иерархию
      for (const category of allCategories) {
        if (category.parent_category === 0) {
          // Это корневая категория
          rootCategories.push(categoryMap.get(category.category_id));
        } else {
          // Это подкатегория
          const parentCategory = categoryMap.get(category.parent_category);
          if (parentCategory) {
            parentCategory.subcategories.push(categoryMap.get(category.category_id));
          }
        }
      }        // Если указан business_id, получаем количество товаров в каждой категории
        if (business_id) {
          const businessIdNum = parseInt(business_id as string);
          if (!isNaN(businessIdNum)) {
            await CategoryController.addItemCountsToCategories(rootCategories, businessIdNum);
          }
        }

      res.json({
        success: true,
        data: {
          categories: rootCategories,
          total_categories: allCategories.length,
          root_categories: rootCategories.length
        },
        message: 'Категории получены успешно'
      });

    } catch (error: any) {
      console.error('Ошибка получения категорий:', error);
      next(createError(500, `Ошибка получения категорий: ${error.message}`));
    }
  }

  /**
   * Получение категории по ID с подкатегориями
   * GET /api/categories/:id
   */
  static async getCategoryById(req: Request, res: Response, next: NextFunction) {
    try {
      const categoryId = parseInt(req.params.id);
      const { business_id } = req.query;

      if (isNaN(categoryId)) {
        return next(createError(400, 'Неверный ID категории'));
      }

      // Получаем основную категорию
      const category = await prisma.categories.findUnique({
        where: { category_id: categoryId }
      });

      if (!category) {
        return next(createError(404, 'Категория не найдена'));
      }

      if (category.visible !== 1) {
        return next(createError(404, 'Категория не доступна'));
      }

      // Получаем подкатегории
      const subcategories = await prisma.categories.findMany({
        where: {
          parent_category: categoryId,
          visible: 1
        },
        orderBy: { name: 'asc' }
      });

      // Получаем родительскую категорию (если есть)
      let parentCategory = null;
      if (category.parent_category !== 0) {
        parentCategory = await prisma.categories.findUnique({
          where: { category_id: category.parent_category },
          select: {
            category_id: true,
            name: true,
            photo: true,
            img: true
          }
        });
      }

      const result: any = {
        ...category,
        subcategories,
        parent: parentCategory
      };

      // Если указан business_id, получаем количество товаров
      if (business_id) {
        const businessIdNum = parseInt(business_id as string);
        if (!isNaN(businessIdNum)) {
          result.items_count = await CategoryController.getItemsCountInCategory(categoryId, businessIdNum);
          
          // Добавляем количество товаров для подкатегорий
          for (const subcat of result.subcategories) {
            (subcat as any).items_count = await CategoryController.getItemsCountInCategory(subcat.category_id, businessIdNum);
          }
        }
      }

      res.json({
        success: true,
        data: {
          category: result
        },
        message: 'Категория найдена'
      });

    } catch (error: any) {
      console.error('Ошибка получения категории:', error);
      next(createError(500, `Ошибка получения категории: ${error.message}`));
    }
  }

  /**
   * Получение только корневых категорий
   * GET /api/categories/root
   */
  static async getRootCategories(req: Request, res: Response, next: NextFunction) {
    try {
      const { business_id } = req.query;

      const rootCategories = await prisma.categories.findMany({
        where: {
          parent_category: 0,
          visible: 1
        },
        orderBy: { name: 'asc' }
      });

      // Для каждой корневой категории получаем количество подкатегорий
      const categoriesWithSubcount = [];
      for (const category of rootCategories) {
        const subcategoriesCount = await prisma.categories.count({
          where: {
            parent_category: category.category_id,
            visible: 1
          }
        });

        const categoryWithDetails: any = {
          ...category,
          subcategories_count: subcategoriesCount
        };

        // Если указан business_id, получаем количество товаров
        if (business_id) {
          const businessIdNum = parseInt(business_id as string);
          if (!isNaN(businessIdNum)) {
            categoryWithDetails.items_count = await CategoryController.getItemsCountInCategory(category.category_id, businessIdNum, true);
          }
        }

        categoriesWithSubcount.push(categoryWithDetails);
      }

      res.json({
        success: true,
        data: {
          categories: categoriesWithSubcount,
          total_found: rootCategories.length
        },
        message: 'Корневые категории получены успешно'
      });

    } catch (error: any) {
      console.error('Ошибка получения корневых категорий:', error);
      next(createError(500, `Ошибка получения корневых категорий: ${error.message}`));
    }
  }

  /**
   * Вспомогательный метод для получения количества товаров в категории
   */
  private static async getItemsCountInCategory(categoryId: number, businessId: number, includeSubcategories: boolean = false): Promise<number> {
    let categoryIds = [categoryId];
    
    if (includeSubcategories) {
      // Получаем все подкатегории
      const subcategories = await prisma.categories.findMany({
        where: {
          parent_category: categoryId,
          visible: 1
        },
        select: { category_id: true }
      });
      categoryIds = categoryIds.concat(subcategories.map(sub => sub.category_id));
    }

    const count = await prisma.items.count({
      where: {
        category_id: {
          in: categoryIds
        },
        business_id: businessId,
        visible: 1
      }
    });

    return count;
  }

  /**
   * Вспомогательный метод для добавления количества товаров к категориям
   */
  private static async addItemCountsToCategories(categories: any[], businessId: number): Promise<void> {
    for (const category of categories) {
      category.items_count = await CategoryController.getItemsCountInCategory(category.category_id, businessId, true);
      
      // Рекурсивно обрабатываем подкатегории
      if (category.subcategories && category.subcategories.length > 0) {
        await CategoryController.addItemCountsToCategories(category.subcategories, businessId);
      }
    }
  }
}
