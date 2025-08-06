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
      const { business_id, page = '1', limit = '20' } = req.query;

      const { name } = req.query;
      if (!name || typeof name !== 'string') {
        return next(createError(400, 'Параметр name обязателен'));
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
      
      // Получаем товары из всех категорий и подкатегорий
      const [items, totalCount] = await Promise.all([
        prisma.items.findMany({
          where: {
            name: {
              contains: name as string
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
            name: {
              contains: name as string
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
          
          business: business,
          items: items.map(item => ({
            item_id: item.item_id,
            name: item.name,
            description: item.description,
            price: item.price ? Number(item.price) : null,
            amount: item.amount ? Number(item.amount) : 0,
            quantity_step: item.quantity ? Number(item.quantity) : 1,
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
         
        },
        message: 'Товары категории получены успешно'
      });

    } catch (error: any) {
      console.error('Ошибка получения товаров категории:', error);
      next(createError(500, `Ошибка получения товаров категории: ${error.message}`));
    }
    // try {
    //   const { name } = req.query;
    //   if (!name || typeof name !== 'string') {
    //     return next(createError(400, 'Параметр name обязателен'));
    //   }

    //   const items = await prisma.items.findMany({
    //     where: {
    //       name: { contains: name },
    //       visible: 1
    //     },
    //     orderBy: { name: 'asc' },
    //     take: 50
    //   });

    //   res.json({
    //     success: true,
    //     data: { items },
    //     message: `Найдено ${items.length} товаров`
    //   });
    // } catch (error: any) {
    //   console.error('Ошибка поиска товаров по имени:', error);
    //   next(createError(500, `Ошибка поиска: ${error.message}`));
    // }
  }
}
