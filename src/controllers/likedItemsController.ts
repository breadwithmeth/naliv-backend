import { Response, NextFunction } from 'express';
import prisma from '../database';
import { createError } from '../middleware/errorHandler';
import { AuthRequest } from './authController';

export class LikedItemsController {
  /**
   * Получить избранные товары пользователя в формате, аналогичном выдаче категорий
   * GET /api/users/liked-items?business_id=1&page=1&limit=20
   */
  static async getUserLikedItems(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      // userId берём из middleware авторизации (req.user)
      if (!req.user) {
        return next(createError(401, 'Требуется авторизация'));
      }
      const userId = req.user.user_id;
      const { business_id, page = '1', limit = '20' } = req.query as Record<string, string>;

      if (!business_id) {
        return next(createError(400, 'Необходимо указать business_id'));
      }

      const businessIdNum = parseInt(business_id);
      if (isNaN(businessIdNum)) {
        return next(createError(400, 'Неверный ID бизнеса'));
      }

      const pageNum = Math.max(parseInt(page) || 1, 1);
      const limitNum = Math.min(Math.max(parseInt(limit) || 20, 1), 100);
      const offset = (pageNum - 1) * limitNum;

      // Список лайкнутых item_id пользователя (без пагинации, пагинация на уровне items)
      const likes = await prisma.liked_items.findMany({
        where: { user_id: userId },
        select: { item_id: true }
      });

      const likedItemIds = likes.map(l => l.item_id);

      if (likedItemIds.length === 0) {
        return res.json({
          success: true,
          data: {
            category: null,
            business: await prisma.businesses.findUnique({
              where: { business_id: businessIdNum },
              select: { business_id: true, name: true, address: true }
            }),
            items: [],
            pagination: { page: pageNum, limit: limitNum, total: 0, totalPages: 0 },
            categories_included: [],
            subcategories_count: 0
          },
          message: 'Избранных товаров нет'
        });
      }

      // Подтягиваем товары пользователя, принадлежащие бизнесу, и фильтры как в категории
      const [items, totalCount] = await Promise.all([
        prisma.items.findMany({
          where: {
            item_id: { in: likedItemIds },
            category_id: { not: null },
            price: { gt: 10 },
            amount: { gt: 1 },
            business_id: businessIdNum,
            visible: 1
          },
          orderBy: [{ name: 'asc' }],
          skip: offset,
          take: limitNum
        }),
        prisma.items.count({
          where: {
            item_id: { in: likedItemIds },
            category_id: { not: null },
            price: { gt: 10 },
            amount: { gt: 1 },
            business_id: businessIdNum,
            visible: 1
          }
        })
      ]);

      // Информация о категориях
      const categoryInfoMap = new Map<number, any>();
      if (items.length > 0) {
        const itemCategoryIds = Array.from(
          new Set(items.map(i => i.category_id).filter((id): id is number => id !== null))
        );
        if (itemCategoryIds.length > 0) {
          const categoriesInfo = await prisma.categories.findMany({
            where: { category_id: { in: itemCategoryIds } },
            select: { category_id: true, name: true, parent_category: true, photo: true, img: true }
          });
          for (const cat of categoriesInfo) {
            categoryInfoMap.set(cat.category_id, cat);
          }
        }
      }

      // Информация о бизнесе
      const business = await prisma.businesses.findUnique({
        where: { business_id: businessIdNum },
        select: { business_id: true, name: true, address: true }
      });

      // Активные акции по товарам
      const itemIds = items.map(item => item.item_id);
      const activePromotions = new Map<number, any[]>();
      if (itemIds.length > 0) {
        const currentDate = new Date();
        const activePromoCampaigns = await prisma.marketing_promotions.findMany({
          where: {
            business_id: businessIdNum,
            start_promotion_date: { lte: currentDate },
            end_promotion_date: { gte: currentDate },
            visible: 1
          },
          select: {
            marketing_promotion_id: true,
            name: true,
            public_name: true,
            start_promotion_date: true,
            end_promotion_date: true
          }
        });
        const activePromoIds = activePromoCampaigns.map(p => p.marketing_promotion_id);
        if (activePromoIds.length > 0) {
          const promotionDetails = await prisma.marketing_promotion_details.findMany({
            where: {
              item_id: { in: itemIds },
              marketing_promotion_id: { in: activePromoIds }
            }
          });

          const promoMap = new Map<number, any>();
          for (const promo of activePromoCampaigns) {
            promoMap.set(promo.marketing_promotion_id, promo);
          }

          for (const detail of promotionDetails) {
            const promoInfo = promoMap.get(detail.marketing_promotion_id);
            if (!activePromotions.has(detail.item_id)) {
              activePromotions.set(detail.item_id, []);
            }
            activePromotions.get(detail.item_id)!.push({
              detail_id: detail.detail_id,
              type: detail.type,
              base_amount: detail.base_amount ? Number(detail.base_amount) : null,
              add_amount: detail.add_amount ? Number(detail.add_amount) : null,
              discount: detail.discount ? Number(detail.discount) : null,
              name: detail.name,
              promotion: promoInfo ? (() => {
                const { public_name, ...rest } = promoInfo as any;
                return { ...rest, name: (public_name ?? rest.name) ?? null };
              })() : null
            });
          }
        }
      }

      // Опции для товаров (с вариантами)
      const itemOptionsMap = new Map<number, any[]>();
      if (itemIds.length > 0) {
        const itemOptions = await prisma.options.findMany({
          where: { item_id: { in: itemIds } },
          orderBy: { name: 'asc' }
        });

        for (const option of itemOptions) {
          const variants = await prisma.option_items.findMany({
            where: { option_id: option.option_id },
            orderBy: { relation_id: 'asc' }
          });

          const variantItemIds = Array.from(new Set(variants.map(v => v.item_id)));
          const variantItems = variantItemIds.length
            ? await prisma.items.findMany({
                where: { item_id: { in: variantItemIds } },
                select: { item_id: true, name: true }
              })
            : [];
          const itemMap = new Map(variantItems.map(i => [i.item_id, i.name] as const));

          const optionWithVariants = {
            option_id: option.option_id,
            name: option.name,
            required: option.required,
            selection: option.selection,
            variants: variants.map((variant: any) => ({
              item_name: itemMap.get(variant.item_id),
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
          itemOptionsMap.get(option.item_id)!.push(optionWithVariants);
        }
      }

      // is_liked флаг
      let likedSet: Set<number> | undefined = undefined;
      if (itemIds.length > 0) {
        const likedRows = await prisma.liked_items.findMany({
          where: { user_id: userId, item_id: { in: itemIds } },
          select: { item_id: true }
        });
        likedSet = new Set(likedRows.map(r => r.item_id));
      }

      return res.json({
        success: true,
        data: {
          category: null,
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
            category: item.category_id ? categoryInfoMap.get(item.category_id) || null : null,
            visible: item.visible,
            options: itemOptionsMap.get(item.item_id) || [],
            promotions: activePromotions.get(item.item_id) || [],
            is_liked: likedSet ? likedSet.has(item.item_id) : false
          })),
          pagination: {
            page: pageNum,
            limit: limitNum,
            total: totalCount,
            totalPages: Math.ceil(totalCount / limitNum)
          },
          categories_included: [],
          subcategories_count: 0
        },
        message: 'Избранные товары получены успешно'
      });
    } catch (error: any) {
      console.error('Ошибка получения избранных товаров:', error);
      return next(createError(500, `Ошибка получения избранных товаров: ${error.message}`));
    }
  }

  /**
   * Поставить или снять лайк (toggle)
   * POST /api/users/liked-items/toggle { item_id: number }
   * Возвращает текущее состояние is_liked после операции
   */
  static async toggleLike(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return next(createError(401, 'Требуется авторизация'));
      }
      const userId = req.user.user_id;
      const { item_id } = req.body as { item_id?: number | string };
      if (!item_id) {
        return next(createError(400, 'item_id обязателен'));
      }
      const itemIdNum = parseInt(item_id as string, 10);
      if (isNaN(itemIdNum) || itemIdNum <= 0) {
        return next(createError(400, 'Некорректный item_id'));
      }

      // Проверяем существование товара
      const item = await prisma.items.findUnique({ where: { item_id: itemIdNum }, select: { item_id: true } });
      if (!item) {
        return next(createError(404, 'Товар не найден'));
      }

      const existing = await prisma.liked_items.findFirst({
        where: { user_id: userId, item_id: itemIdNum },
        select: { like_id: true }
      });

      let isLiked: boolean;
      if (existing) {
        // Удаляем лайк
        await prisma.liked_items.delete({ where: { like_id: existing.like_id } });
        isLiked = false;
      } else {
        // Ставит лайк
        await prisma.liked_items.create({ data: { user_id: userId, item_id: itemIdNum } });
        isLiked = true;
      }

      return res.json({
        success: true,
        data: { item_id: itemIdNum, is_liked: isLiked },
        message: isLiked ? 'Лайк установлен' : 'Лайк снят'
      });
    } catch (error: any) {
      console.error('Ошибка toggle лайка:', error);
      return next(createError(500, `Ошибка обработки лайка: ${error.message}`));
    }
  }
}

export default LikedItemsController;
