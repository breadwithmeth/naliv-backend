import { Response, NextFunction } from 'express';
import prisma from '../database';
import { createError } from '../middleware/errorHandler';
import { BusinessAuthRequest } from '../middleware/businessAuth';

interface TvPromotionDetail {
  detail_id: number;
  item_id: number;
  item_name: string | null;
  item_img: string | null;
  item_code: string | null;
  price: number | null;
  type: string | null;
  name: string | null;
  discount: number | null;
  base_amount: number | null;
  add_amount: number | null;
}

interface TvPromotion {
  marketing_promotion_id: number;
  name: string | null;
  internal_name: string | null;
  cover: string | null;
  start_promotion_date: Date;
  end_promotion_date: Date;
  details: TvPromotionDetail[];
}

interface TvPromotionsPayload {
  business: {
    business_id: number;
    name: string;
    uuid: string;
  };
  promotions: TvPromotion[];
  promotions_count: number;
}

export class TvController {
  /**
   * Получение активных акций и скидок по токену магазина (Bearer <token>)
   * GET /api/tv/promotions
   */
  static async getBusinessPromotions(
    req: BusinessAuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.business) {
        throw createError(401, 'Требуется авторизация бизнеса');
      }

      const businessId = req.business.business_id;
      const now = new Date();

      const promotions = await prisma.marketing_promotions.findMany({
        where: {
          business_id: businessId,
          visible: 1,
          start_promotion_date: { lte: now },
          end_promotion_date: { gte: now }
        },
        orderBy: [
          { start_promotion_date: 'desc' },
          { marketing_promotion_id: 'desc' }
        ]
      });

      const promotionIds = promotions.map(p => p.marketing_promotion_id);

      const details = promotionIds.length
        ? await prisma.marketing_promotion_details.findMany({
            where: { marketing_promotion_id: { in: promotionIds } },
            orderBy: { detail_id: 'asc' }
          })
        : [];

      const subtractDetails = details.filter(detail => detail.type === 'SUBTRACT');

      const itemIds = Array.from(
        new Set(subtractDetails.map(detail => detail.item_id).filter((id): id is number => typeof id === 'number'))
      );

      const items = itemIds.length
        ? await prisma.items.findMany({
            where: { item_id: { in: itemIds } },
            select: { item_id: true, name: true, code: true, price: true, quantity: true, img: true }
          })
        : [];

      const itemMap = new Map<number, {
        item_id: number;
        name: string | null;
        code: string | null;
        price: number;
        quantity: number;
        img: string | null;
      }>();

      for (const item of items) {
        const price = item.price !== null && item.price !== undefined ? Number(item.price) : null;
        const quantity = item.quantity !== null && item.quantity !== undefined ? Number(item.quantity) : null;

        if (price === null || Number.isNaN(price) || price <= 0) continue;
        if (quantity === null || Number.isNaN(quantity) || quantity <= 0) continue;

        itemMap.set(item.item_id, {
          item_id: item.item_id,
          name: item.name ?? null,
          code: item.code ? item.code.toString() : null,
          price,
          quantity,
          img: item.img ?? null
        });
      }

      const detailsByPromotion = new Map<number, TvPromotionDetail[]>();
      for (const detail of subtractDetails) {
        const itemInfo = itemMap.get(detail.item_id);
        if (!itemInfo) {
          continue; // Пропускаем товары без цены или без остатка
        }
        const normalized: TvPromotionDetail = {
          detail_id: detail.detail_id,
          item_id: detail.item_id,
          item_name: itemInfo?.name ?? null,
          item_img: itemInfo?.img ?? null,
          item_code: itemInfo?.code ?? null,
          price: itemInfo?.price ?? null,
          type: detail.type,
          name: detail.name,
          discount: detail.discount !== null ? Number(detail.discount) : null,
          base_amount: detail.base_amount !== null ? Number(detail.base_amount) : null,
          add_amount: detail.add_amount !== null ? Number(detail.add_amount) : null
        };

        if (!detailsByPromotion.has(detail.marketing_promotion_id)) {
          detailsByPromotion.set(detail.marketing_promotion_id, []);
        }

        detailsByPromotion.get(detail.marketing_promotion_id)!.push(normalized);
      }

      const promotionsWithDetails = promotions.filter(p =>
        (detailsByPromotion.get(p.marketing_promotion_id)?.length ?? 0) > 0
      );

      const payload: TvPromotionsPayload = {
        business: {
          business_id: businessId,
          name: req.business.name,
          uuid: req.business.uuid
        },
        promotions: promotionsWithDetails.map(promotion => ({
          marketing_promotion_id: promotion.marketing_promotion_id,
          name: promotion.public_name ?? promotion.name ?? null,
          internal_name: promotion.name,
          cover: promotion.cover ?? null,
          start_promotion_date: promotion.start_promotion_date,
          end_promotion_date: promotion.end_promotion_date,
          details: detailsByPromotion.get(promotion.marketing_promotion_id) ?? []
        })),
        promotions_count: promotionsWithDetails.length
      };

      res.json({
        success: true,
        data: payload,
        message: promotionsWithDetails.length > 0
          ? 'Активные скидки и акции для бизнеса получены'
          : 'Для бизнеса нет активных акций'
      });
    } catch (error) {
      next(error);
    }
  }
}
