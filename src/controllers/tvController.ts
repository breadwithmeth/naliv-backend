import { Response, NextFunction } from 'express';
import prisma from '../database';
import { createError } from '../middleware/errorHandler';
import { BusinessAuthRequest } from '../middleware/businessAuth';

interface TvPromotionDetail {
  detail_id: number;
  item_id: number;
  item_name: string | null;
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

      const itemIds = Array.from(
        new Set(details.map(detail => detail.item_id).filter((id): id is number => typeof id === 'number'))
      );

      const items = itemIds.length
        ? await prisma.items.findMany({
            where: { item_id: { in: itemIds } },
            select: { item_id: true, name: true, code: true, price: true }
          })
        : [];

      const itemMap = new Map(items.map(item => [item.item_id, item]));

      const detailsByPromotion = new Map<number, TvPromotionDetail[]>();
      for (const detail of details) {
        const itemInfo = itemMap.get(detail.item_id);
        const normalized: TvPromotionDetail = {
          detail_id: detail.detail_id,
          item_id: detail.item_id,
          item_name: itemInfo?.name ?? null,
          item_code: itemInfo?.code ? itemInfo.code.toString() : null,
          price: itemInfo?.price !== undefined && itemInfo?.price !== null ? Number(itemInfo.price) : null,
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

      const payload: TvPromotionsPayload = {
        business: {
          business_id: businessId,
          name: req.business.name,
          uuid: req.business.uuid
        },
        promotions: promotions.map(promotion => ({
          marketing_promotion_id: promotion.marketing_promotion_id,
          name: promotion.public_name ?? promotion.name ?? null,
          internal_name: promotion.name,
          cover: promotion.cover ?? null,
          start_promotion_date: promotion.start_promotion_date,
          end_promotion_date: promotion.end_promotion_date,
          details: detailsByPromotion.get(promotion.marketing_promotion_id) ?? []
        })),
        promotions_count: promotions.length
      };

      res.json({
        success: true,
        data: payload,
        message: promotions.length > 0
          ? 'Активные скидки и акции для бизнеса получены'
          : 'Для бизнеса нет активных акций'
      });
    } catch (error) {
      next(error);
    }
  }
}
