import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { createError } from '../middleware/errorHandler';

const prisma = new PrismaClient();

export class PromotionController {
  /**
   * Получение всех активных акций
   * GET /api/promotions/active?business_id={id}&limit={limit}&offset={offset}
   */
  static async getActivePromotions(req: Request, res: Response, next: NextFunction) {
    try {
      const { business_id, limit = '50', offset = '0' } = req.query;
      const now = new Date();
      const whereConditions: any = {
        visible: 1,
        start_promotion_date: { lte: now },
        end_promotion_date: { gte: now }
      };
      if (business_id) {
        whereConditions.business_id = parseInt(business_id as string);
      }
      console.log('🔍 Поиск активных акций:', whereConditions);
      const promotions = await prisma.marketing_promotions.findMany({
        where: whereConditions,
        orderBy: [
          { start_promotion_date: 'desc' },
          { marketing_promotion_id: 'desc' }
        ],
        take: parseInt(limit as string),
        skip: parseInt(offset as string)
      });
      console.log(`✅ Найдено ${promotions.length} акций`);
      res.json({
        success: true,
        data: promotions,
        message: 'Активные акции получены'
      });
    } catch (error: any) {
      console.error('Ошибка получения активных акций:', error);
      next(createError(500, `Ошибка получения активных акций: ${error.message}`));
    }
  }
  /**
   * Получение товаров конкретной акции
   * GET /api/promotions/:promotionId/items?business_id={id}&page={page}&limit={limit}
   */
  static async getPromotionItems(req: Request, res: Response, next: NextFunction) {
    try {
      const promotionId = parseInt(req.params.promotionId);
      const { business_id, page = '1', limit = '20' } = req.query;

      if (isNaN(promotionId)) {
        return next(createError(400, 'Неверный ID акции'));
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

      // Проверяем что акция существует и активна
      const promotion = await prisma.marketing_promotions.findUnique({
        where: { marketing_promotion_id: promotionId }
      });

      if (!promotion || promotion.visible !== 1) {
        return next(createError(404, 'Акция не найдена или недоступна'));
      }

      // Получаем ID товаров из деталей акции
      const allPromotionDetails = await prisma.marketing_promotion_details.findMany({
        where: { marketing_promotion_id: promotionId },
        select: { item_id: true }
      });

      const itemIds = allPromotionDetails.map(detail => detail.item_id);

      if (itemIds.length === 0) {
        return res.json({
          success: true,
          data: {
            promotion: {
              marketing_promotion_id: promotion.marketing_promotion_id,
              name: promotion.name,
              start_promotion_date: promotion.start_promotion_date,
              end_promotion_date: promotion.end_promotion_date
            },
            business: null,
            items: [],
            pagination: {
              page: pageNum,
              limit: limitNum,
              total: 0,
              totalPages: 0
            }
          },
          message: 'Товары акции получены успешно'
        });
      }

      // Получаем товары из акции с пагинацией
      const [items, totalCount] = await Promise.all([
        prisma.items.findMany({
          where: {
            item_id: {
              in: itemIds
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
            item_id: {
              in: itemIds
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

      // Получаем детали акций для каждого товара
      const promotionDetailsMap = new Map();
      const promotionDetails = await prisma.marketing_promotion_details.findMany({
        where: {
          marketing_promotion_id: promotionId,
          item_id: { in: items.map(item => item.item_id) }
        }
      });

      for (const detail of promotionDetails) {
        promotionDetailsMap.set(detail.item_id, {
          detail_id: detail.detail_id,
          type: detail.type,
          base_amount: detail.base_amount !== null ? Number(detail.base_amount) : null,
          add_amount: detail.add_amount !== null ? Number(detail.add_amount) : null,
          discount: detail.discount !== null ? Number(detail.discount) : null,
          name: detail.name,
          promotion: {
            marketing_promotion_id: promotion.marketing_promotion_id,
            name: promotion.name,
            start_promotion_date: promotion.start_promotion_date,
            end_promotion_date: promotion.end_promotion_date
          }
        });
      }

      // Получаем опции для всех товаров
      const itemOptionsMap = new Map();
      if (items.length > 0) {
        const itemOptions = await prisma.options.findMany({
          where: {
            item_id: { in: items.map(item => item.item_id) }
          },
          orderBy: { name: 'asc' }
        });

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
          promotion: {
            marketing_promotion_id: promotion.marketing_promotion_id,
            name: promotion.name,
            start_promotion_date: promotion.start_promotion_date,
            end_promotion_date: promotion.end_promotion_date
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
            promotions: promotionDetailsMap.get(item.item_id) ? [promotionDetailsMap.get(item.item_id)] : []
          })),
          pagination: {
            page: pageNum,
            limit: limitNum,
            total: totalCount,
            totalPages: Math.ceil(totalCount / limitNum)
          }
        },
        message: 'Товары акции получены успешно'
      });

    } catch (error: any) {
      console.error('Ошибка получения товаров акции:', error);
      next(createError(500, `Ошибка получения товаров акции: ${error.message}`));
    }
  }
  /**
   * Вспомогательный метод для получения опций товара
   */
  private static async getItemOptions(itemId: number) {
    try {
      const options = await prisma.options.findMany({ where: { item_id: itemId }, orderBy: { option_id: 'asc' } });
      const result = await Promise.all(options.map(async opt => {
        const items = await prisma.option_items.findMany({ where: { option_id: opt.option_id }, orderBy: { relation_id: 'asc' } });
        return {
          option_id: opt.option_id,
          name: opt.name,
          required: opt.required,
          selection: opt.selection,
          option_items: items.map(it => ({
            relation_id: it.relation_id,
            item_id: it.item_id,
            price_type: it.price_type,
            price: Number(it.price),
            parent_item_amount: Number(it.parent_item_amount)
          }))
        };
      }));
      return result;
    } catch (err) {
      console.error(`Ошибка получения опций товара ${itemId}:`, err);
      return [];
    }
  }

}