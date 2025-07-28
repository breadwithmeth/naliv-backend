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
   * Вспомогательный метод для получения количества товаров в категории (оптимизированный)
   */
  private static async getItemsCountInCategory(categoryId: number, businessId: number, includeSubcategories: boolean = false): Promise<number> {
    let categoryIds = [categoryId];
    
    if (includeSubcategories) {
      // Получаем все подкатегории одним запросом
      const subcategories = await prisma.categories.findMany({
        where: {
          parent_category: categoryId,
          visible: 1
        },
        select: { category_id: true }
      });
      categoryIds = categoryIds.concat(subcategories.map(sub => sub.category_id));
    }

    // Используем сырой SQL для лучшей производительности
    const result = await prisma.$queryRaw<{count: bigint}[]>`
      SELECT COUNT(*) as count
      FROM items 
      WHERE category_id IN (${categoryIds.join(',')}) 
        AND business_id = ${businessId} 
        AND visible = 1
    `;

    return Number(result[0]?.count || 0);
  }

  /**
   * Вспомогательный метод для добавления количества товаров к категориям (оптимизированный)
   */
  private static async addItemCountsToCategories(categories: any[], businessId: number): Promise<void> {
    // Собираем все ID категорий и подкатегорий в один массив
    const getAllCategoryIds = (cats: any[]): number[] => {
      let ids: number[] = [];
      for (const cat of cats) {
        ids.push(cat.category_id);
        if (cat.subcategories && cat.subcategories.length > 0) {
          ids = ids.concat(getAllCategoryIds(cat.subcategories));
        }
      }
      return ids;
    };

    const allCategoryIds = getAllCategoryIds(categories);

    // Получаем количество товаров для всех категорий одним запросом
    const itemCounts = await prisma.$queryRaw<{category_id: number, count: bigint}[]>`
      SELECT category_id, COUNT(*) as count
      FROM items 
      WHERE category_id IN (${allCategoryIds.join(',')}) 
        AND business_id = ${businessId} 
        AND visible = 1
      GROUP BY category_id
    `;

    // Создаем карту для быстрого поиска
    const countMap = new Map<number, number>();
    for (const item of itemCounts) {
      countMap.set(item.category_id, Number(item.count));
    }

    // Рекурсивно присваиваем количество товаров
    const assignCounts = (cats: any[]) => {
      for (const category of cats) {
        category.items_count = countMap.get(category.category_id) || 0;
        
        if (category.subcategories && category.subcategories.length > 0) {
          assignCounts(category.subcategories);
        }
      }
    };

    assignCounts(categories);
  }

  /**
   * Получение товаров по категории и бизнесу (включая подкатегории)
   * GET /api/categories/:id/items
   */
  static async getItemsByCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const categoryId = parseInt(req.params.id);
      const { business_id, page = '1', limit = '20' } = req.query;

      if (isNaN(categoryId)) {
        return next(createError(400, 'Неверный ID категории'));
      }

      if (!business_id) {
        return next(createError(400, 'Необходимо указать business_id'));
      }

      const businessIdNum = parseInt(business_id as string);
      if (isNaN(businessIdNum)) {
        return next(createError(400, 'Неверный ID бизнеса'));
      }

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const offset = (pageNum - 1) * limitNum;

      // Проверяем что категория существует и видима
      const category = await prisma.categories.findUnique({
        where: { category_id: categoryId }
      });

      if (!category || category.visible !== 1) {
        return next(createError(404, 'Категория не найдена или недоступна'));
      }

      // Собираем ID категории и всех её подкатегорий
      let categoryIds = [categoryId];

      // Получаем все подкатегории рекурсивно
      const getSubcategoryIds = async (parentId: number): Promise<number[]> => {
        const subcategories = await prisma.categories.findMany({
          where: {
            parent_category: parentId,
            visible: 1
          },
          select: { category_id: true }
        });

        let allIds: number[] = [];
        for (const subcat of subcategories) {
          allIds.push(subcat.category_id);
          // Рекурсивно получаем подкатегории подкатегорий
          const subSubcatIds = await getSubcategoryIds(subcat.category_id);
          allIds = allIds.concat(subSubcatIds);
        }
        return allIds;
      };

      const subcategoryIds = await getSubcategoryIds(categoryId);
      categoryIds = categoryIds.concat(subcategoryIds);

      // Получаем товары из всех категорий и подкатегорий
      const [items, totalCount] = await Promise.all([
        prisma.items.findMany({
          where: {
            category_id: {
              in: categoryIds
            },
            business_id: businessIdNum,
            visible: 1
          },
          orderBy: [
            { name: 'asc' }
          ],
          skip: offset,
          take: limitNum
        }),
        prisma.items.count({
          where: {
            category_id: {
              in: categoryIds
            },
            business_id: businessIdNum,
            visible: 1
          }
        })
      ]);

      // Получаем информацию о категориях для товаров
      const categoryInfoMap = new Map();
      if (items.length > 0) {
        const itemCategoryIds = [...new Set(items.map(item => item.category_id).filter(id => id !== null))] as number[];
        const categoriesInfo = await prisma.categories.findMany({
          where: {
            category_id: {
              in: itemCategoryIds
            }
          },
          select: {
            category_id: true,
            name: true,
            parent_category: true
          }
        });

        for (const cat of categoriesInfo) {
          categoryInfoMap.set(cat.category_id, cat);
        }
      }

      // Получаем информацию о бизнесе
      const business = await prisma.businesses.findUnique({
        where: { business_id: businessIdNum },
        select: {
          business_id: true,
          name: true,
          address: true
        }
      });

      // Получаем активные акции для товаров
      const itemIds = items.map(item => item.item_id);
      const activePromotions = new Map();
      
      if (itemIds.length > 0) {
        // Сначала получаем активные промо-кампании для бизнеса
        const currentDate = new Date();
        const activePromoCampaigns = await prisma.marketing_promotions.findMany({
          where: {
            business_id: businessIdNum,
            start_promotion_date: {
              lte: currentDate
            },
            end_promotion_date: {
              gte: currentDate
            },
            visible: 1
          },
          select: {
            marketing_promotion_id: true,
            name: true,
            start_promotion_date: true,
            end_promotion_date: true
          }
        });

        const activePromoIds = activePromoCampaigns.map(p => p.marketing_promotion_id);

        if (activePromoIds.length > 0) {
          // Затем получаем детали акций для товаров
          const promotionDetails = await prisma.marketing_promotion_details.findMany({
            where: {
              item_id: {
                in: itemIds
              },
              marketing_promotion_id: {
                in: activePromoIds
              }
            }
          });

          // Создаем карту промо-кампаний
          const promoMap = new Map();
          for (const promo of activePromoCampaigns) {
            promoMap.set(promo.marketing_promotion_id, promo);
          }

          // Группируем акции по товарам
          for (const detail of promotionDetails) {
            const promoInfo = promoMap.get(detail.marketing_promotion_id);
            if (!activePromotions.has(detail.item_id)) {
              activePromotions.set(detail.item_id, []);
            }
            activePromotions.get(detail.item_id).push({
              detail_id: detail.detail_id,
              type: detail.type,
              base_amount: detail.base_amount ? Number(detail.base_amount) : null,
              add_amount: detail.add_amount ? Number(detail.add_amount) : null,
              discount: detail.discount ? Number(detail.discount) : null,
              name: detail.name,
              promotion: promoInfo
            });
          }
        }
      }

      // Получаем опции для всех товаров
      const itemOptionsMap = new Map();
      if (itemIds.length > 0) {
        // Получаем все опции для товаров
        const itemOptions = await prisma.options.findMany({
          where: {
            item_id: { in: itemIds }
          },
          orderBy: { name: 'asc' }
        });

        // Для каждой опции получаем её варианты
        for (const option of itemOptions) {
          const variants = await prisma.option_items.findMany({
            where: { option_id: option.option_id },
            orderBy: { relation_id: 'asc' }
          });

          const optionWithVariants = {
            option_id: option.option_id,
            name: option.name,
            required: option.required,
            selection: option.selection,
            variants: variants.map((variant: any) => ({
              relation_id: variant.relation_id,
              item_id: variant.item_id,
              price_type: variant.price_type,
              price: variant.price ? Number(variant.price) : 0,
              parent_item_amount: variant.parent_item_amount
            }))
          };

          if (!itemOptionsMap.has(option.item_id)) {
            itemOptionsMap.set(option.item_id, []);
          }
          itemOptionsMap.get(option.item_id).push(optionWithVariants);
        }
      }

      res.json({
        success: true,
        data: {
          category: {
            category_id: category.category_id,
            name: category.name,
            photo: category.photo,
            img: category.img
          },
          business: business,
          items: items.map(item => ({
            item_id: item.item_id,
            name: item.name,
            description: item.description,
            price: item.price ? Number(item.price) : null,
            amount: item.amount ? Number(item.amount) : 0,
            quantity: item.quantity ? Number(item.quantity) : 1,
            unit: item.unit || 'шт',
            img: item.img,
            code: item.code,
            category: categoryInfoMap.get(item.category_id) || null,
            visible: item.visible,
            options: itemOptionsMap.get(item.item_id) || [],
            promotions: activePromotions.get(item.item_id) || []
          })),
          pagination: {
            page: pageNum,
            limit: limitNum,
            total: totalCount,
            totalPages: Math.ceil(totalCount / limitNum)
          },
          categories_included: categoryIds,
          subcategories_count: subcategoryIds.length
        },
        message: 'Товары категории получены успешно'
      });

    } catch (error: any) {
      console.error('Ошибка получения товаров категории:', error);
      next(createError(500, `Ошибка получения товаров категории: ${error.message}`));
    }
  }

  /**
   * Получение товара по ID с опциями и акциями
   * GET /api/categories/items/:id
   */
  static async getItemById(req: Request, res: Response, next: NextFunction) {
    try {
      const itemId = parseInt(req.params.itemId);
      const { business_id } = req.query;

      if (isNaN(itemId)) {
        return next(createError(400, 'Неверный ID товара'));
      }

      if (!business_id) {
        return next(createError(400, 'Необходимо указать business_id'));
      }

      const businessIdNum = parseInt(business_id as string);
      if (isNaN(businessIdNum)) {
        return next(createError(400, 'Неверный ID бизнеса'));
      }

      // Получаем товар
      const item = await prisma.items.findUnique({
        where: { item_id: itemId }
      });

      if (!item) {
        return next(createError(404, 'Товар не найден'));
      }

      if (item.visible !== 1) {
        return next(createError(404, 'Товар недоступен'));
      }

      if (item.business_id !== businessIdNum) {
        return next(createError(404, 'Товар не принадлежит данному бизнесу'));
      }

      // Получаем информацию о категории товара
      let categoryInfo = null;
      if (item.category_id) {
        categoryInfo = await prisma.categories.findUnique({
          where: { category_id: item.category_id },
          select: {
            category_id: true,
            name: true,
            parent_category: true,
            photo: true,
            img: true
          }
        });
      }

      // Получаем информацию о бизнесе
      const business = await prisma.businesses.findUnique({
        where: { business_id: businessIdNum },
        select: {
          business_id: true,
          name: true,
          address: true
        }
      });

      // Получаем опции товара
      const itemOptions = await prisma.options.findMany({
        where: { item_id: itemId },
        orderBy: { name: 'asc' }
      });

      // Для каждой опции получаем её варианты
      const optionsWithVariants = [];
      for (const option of itemOptions) {
        const variants = await prisma.option_items.findMany({
          where: { option_id: option.option_id },
          orderBy: { relation_id: 'asc' }
        });

        optionsWithVariants.push({
          option_id: option.option_id,
          name: option.name,
          required: option.required,
          selection: option.selection,
          variants: variants.map((variant: any) => ({
            relation_id: variant.relation_id,
            item_id: variant.item_id,
            price_type: variant.price_type,
            price: variant.price ? Number(variant.price) : 0,
            parent_item_amount: variant.parent_item_amount
          }))
        });
      }

      // Получаем активные акции для товара
      const currentDate = new Date();
      const activePromoCampaigns = await prisma.marketing_promotions.findMany({
        where: {
          business_id: businessIdNum,
          start_promotion_date: {
            lte: currentDate
          },
          end_promotion_date: {
            gte: currentDate
          },
          visible: 1
        },
        select: {
          marketing_promotion_id: true,
          name: true,
          start_promotion_date: true,
          end_promotion_date: true
        }
      });

      const activePromoIds = activePromoCampaigns.map(p => p.marketing_promotion_id);
      const promotions = [];

      if (activePromoIds.length > 0) {
        const promotionDetails = await prisma.marketing_promotion_details.findMany({
          where: {
            item_id: itemId,
            marketing_promotion_id: {
              in: activePromoIds
            }
          }
        });

        const promoMap = new Map();
        for (const promo of activePromoCampaigns) {
          promoMap.set(promo.marketing_promotion_id, promo);
        }

        for (const detail of promotionDetails) {
          const promoInfo = promoMap.get(detail.marketing_promotion_id);
          promotions.push({
            detail_id: detail.detail_id,
            type: detail.type,
            base_amount: detail.base_amount ? Number(detail.base_amount) : null,
            add_amount: detail.add_amount ? Number(detail.add_amount) : null,
            discount: detail.discount ? Number(detail.discount) : null,
            name: detail.name,
            promotion: promoInfo
          });
        }
      }

      res.json({
        success: true,
        data: {
          item: {
            item_id: item.item_id,
            name: item.name,
            description: item.description,
            price: item.price ? Number(item.price) : null,
            amount: item.amount ? Number(item.amount) : 0,
            quantity: item.quantity ? Number(item.quantity) : 1,
            unit: item.unit || 'шт',
            img: item.img,
            code: item.code,
            visible: item.visible,
            business_id: item.business_id,
            category: categoryInfo
          },
          business: business,
          options: optionsWithVariants,
          promotions: promotions
        },
        message: 'Товар получен успешно'
      });

    } catch (error: any) {
      console.error('Ошибка получения товара:', error);
      next(createError(500, `Ошибка получения товара: ${error.message}`));
    }
  }
}
