import { Response, NextFunction } from 'express';
import prisma from '../database';
import { createError } from '../middleware/errorHandler';
import { BusinessAuthRequest } from '../middleware/businessAuth';

export class BusinessPromotionController {
  /**
   * Автоматическое создание акции и ее деталей за один запрос
   * POST /api/business/promotions/auto
   *
   * business_id берется из business-token (req.business)
   */
  static async createPromotionAuto(req: BusinessAuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.business) {
        return next(createError(401, 'Требуется авторизация бизнеса'));
      }

      const businessId = req.business.business_id;

      const {
        type,
        name,
        public_name,
        start_promotion_date,
        end_promotion_date,
        duration_days,
        visible,
        cover,
        item_ids,
        item_codes,
        details,
        discount,
        base_amount,
        add_amount,
        apply_to_all_items
      } = req.body;

      if (item_ids !== undefined) {
        return next(createError(400, 'В business API нельзя передавать item_ids. Используйте item_codes (code товара)'));
      }

      if (!type) {
        return next(createError(400, 'Отсутствует обязательное поле: type'));
      }

      const normalizedType = type === 'DISCOUNT' ? 'PERCENT' : type;
      if (!['SUBTRACT', 'PERCENT'].includes(normalizedType)) {
        return next(createError(400, 'Неверный type. Допустимые значения: SUBTRACT, PERCENT'));
      }

      const startDate = start_promotion_date ? new Date(start_promotion_date) : new Date();
      if (isNaN(startDate.getTime())) {
        return next(createError(400, 'Неверный формат start_promotion_date'));
      }

      let endDate: Date | null = null;
      if (end_promotion_date) {
        endDate = new Date(end_promotion_date);
        if (isNaN(endDate.getTime())) {
          return next(createError(400, 'Неверный формат end_promotion_date'));
        }
      } else if (duration_days !== undefined && duration_days !== null) {
        const days = typeof duration_days === 'string' ? parseInt(duration_days) : Number(duration_days);
        if (!Number.isFinite(days) || days <= 0) {
          return next(createError(400, 'duration_days должен быть числом больше 0'));
        }
        endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + days);
      } else {
        endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 7);
      }

      if (!endDate || endDate <= startDate) {
        return next(createError(400, 'Дата окончания должна быть позже даты начала'));
      }

      type AutoDetailInput = {
        item_code: string;
        name?: string;
        discount?: number | string;
        base_amount?: number | string;
        add_amount?: number | string;
      };

      type AutoDetailResolved = {
        item_id: number;
        name?: string;
        discount?: number | string;
        base_amount?: number | string;
        add_amount?: number | string;
      };

      const detailsInput: AutoDetailInput[] = Array.isArray(details) ? details : [];
      if (detailsInput.some((d: any) => d?.item_id !== undefined)) {
        return next(createError(400, 'В business API нельзя передавать details.item_id. Используйте details.item_code'));
      }

      let resolvedDetails: AutoDetailResolved[] = [];

      if (detailsInput.length > 0) {
        const normalized = detailsInput.map((d) => ({
          ...d,
          item_code: (d?.item_code ?? '').toString().trim()
        }));

        const codes = Array.from(new Set(normalized.map(d => d.item_code).filter(c => c.length > 0)));
        if (codes.length !== normalized.length) {
          return next(createError(400, 'Каждый detail должен содержать item_code'));
        }

        const dbItems = await prisma.items.findMany({
          where: { business_id: businessId, code: { in: codes } },
          select: { item_id: true, code: true }
        });

        const countsByCode = new Map<string, number>();
        for (const row of dbItems) {
          const code = (row.code ?? '').toString();
          countsByCode.set(code, (countsByCode.get(code) ?? 0) + 1);
        }

        const duplicated = Array.from(countsByCode.entries()).filter(([, count]) => count > 1).map(([code]) => code);
        if (duplicated.length > 0) {
          return next(createError(400, `Найдено несколько товаров с одинаковым code: ${duplicated.join(', ')}`));
        }

        const itemIdByCode = new Map<string, number>();
        for (const row of dbItems) {
          if (!row.code) continue;
          itemIdByCode.set(row.code.toString(), row.item_id);
        }

        const missing = codes.filter(c => !itemIdByCode.has(c));
        if (missing.length > 0) {
          return next(createError(404, `Товары не найдены по code: ${missing.join(', ')}`));
        }

        resolvedDetails = normalized.map((d) => ({
          item_id: itemIdByCode.get(d.item_code) as number,
          name: d.name,
          discount: d.discount,
          base_amount: d.base_amount,
          add_amount: d.add_amount
        }));
      } else {
        let itemIds: number[] = [];

        if (apply_to_all_items) {
          const items = await prisma.items.findMany({
            where: { business_id: businessId, visible: 1 },
            select: { item_id: true }
          });
          itemIds = items.map(i => i.item_id);
        } else if (Array.isArray(item_codes)) {
          const codes = Array.from(
            new Set(
              item_codes
                .map((c: any) => (c ?? '').toString().trim())
                .filter((c: string) => c.length > 0)
            )
          );

          if (codes.length === 0) {
            return next(createError(400, 'Нужно передать details или item_codes, либо включить apply_to_all_items'));
          }

          const dbItems = await prisma.items.findMany({
            where: { business_id: businessId, code: { in: codes } },
            select: { item_id: true, code: true }
          });

          const countsByCode = new Map<string, number>();
          for (const row of dbItems) {
            const code = (row.code ?? '').toString();
            countsByCode.set(code, (countsByCode.get(code) ?? 0) + 1);
          }

          const duplicated = Array.from(countsByCode.entries()).filter(([, count]) => count > 1).map(([code]) => code);
          if (duplicated.length > 0) {
            return next(createError(400, `Найдено несколько товаров с одинаковым code: ${duplicated.join(', ')}`));
          }

          const itemIdByCode = new Map<string, number>();
          for (const row of dbItems) {
            if (!row.code) continue;
            itemIdByCode.set(row.code.toString(), row.item_id);
          }

          const missing = codes.filter(c => !itemIdByCode.has(c));
          if (missing.length > 0) {
            return next(createError(404, `Товары не найдены по code: ${missing.join(', ')}`));
          }

          itemIds = codes.map(c => itemIdByCode.get(c) as number);
        }

        if (itemIds.length === 0) {
          return next(createError(400, 'Нужно передать details или item_codes, либо включить apply_to_all_items'));
        }

        if (normalizedType === 'PERCENT') {
          const discountValue = discount !== undefined ? (typeof discount === 'string' ? parseFloat(discount) : Number(discount)) : NaN;
          if (!Number.isFinite(discountValue) || discountValue < 0 || discountValue > 100) {
            return next(createError(400, 'Для типа PERCENT требуется discount от 0 до 100'));
          }
          resolvedDetails = itemIds.map((item_id: number) => ({ item_id, discount: discountValue }));
        } else {
          const base = base_amount !== undefined ? (typeof base_amount === 'string' ? parseFloat(base_amount) : Number(base_amount)) : NaN;
          const add = add_amount !== undefined ? (typeof add_amount === 'string' ? parseFloat(add_amount) : Number(add_amount)) : NaN;
          if (!Number.isFinite(base) || !Number.isFinite(add) || base <= 0 || add <= 0) {
            return next(createError(400, 'Для типа SUBTRACT требуются base_amount и add_amount больше 0'));
          }
          resolvedDetails = itemIds.map((item_id: number) => ({ item_id, base_amount: base, add_amount: add }));
        }
      }

      for (const d of resolvedDetails) {
        if (normalizedType === 'PERCENT') {
          const discountValue = d.discount !== undefined ? (typeof d.discount === 'string' ? parseFloat(d.discount) : Number(d.discount)) : NaN;
          if (!Number.isFinite(discountValue) || discountValue < 0 || discountValue > 100) {
            return next(createError(400, 'Для типа PERCENT discount должен быть от 0 до 100'));
          }
        } else {
          const base = d.base_amount !== undefined ? (typeof d.base_amount === 'string' ? parseFloat(d.base_amount) : Number(d.base_amount)) : NaN;
          const add = d.add_amount !== undefined ? (typeof d.add_amount === 'string' ? parseFloat(d.add_amount) : Number(d.add_amount)) : NaN;
          if (!Number.isFinite(base) || !Number.isFinite(add) || base <= 0 || add <= 0) {
            return next(createError(400, 'Для типа SUBTRACT base_amount и add_amount должны быть больше 0'));
          }
        }
      }

      let promotionName = name;
      if (!promotionName) {
        if (normalizedType === 'PERCENT') {
          const anyDiscount = resolvedDetails[0]?.discount;
          promotionName = `Скидка ${anyDiscount ?? ''}%`;
        } else {
          const anyBase = resolvedDetails[0]?.base_amount;
          const anyAdd = resolvedDetails[0]?.add_amount;
          promotionName = `Акция ${anyBase ?? ''}+${anyAdd ?? ''}`;
        }
      }

      const result = await prisma.$transaction(async (tx) => {
        const promotion = await tx.marketing_promotions.create({
          data: {
            name: promotionName,
            public_name: (public_name ?? promotionName) || null,
            start_promotion_date: startDate,
            end_promotion_date: endDate,
            business_id: businessId,
            cover: cover || '',
            visible: visible !== undefined ? (visible ? 1 : 0) : 1
          }
        });

        await tx.marketing_promotion_details.createMany({
          data: resolvedDetails.map((d) => ({
            marketing_promotion_id: promotion.marketing_promotion_id,
            item_id: Number(d.item_id),
            type: normalizedType,
            name: d.name || promotionName,
            base_amount: normalizedType === 'SUBTRACT' ? (d.base_amount !== undefined ? Number(d.base_amount) : null) : null,
            add_amount: normalizedType === 'SUBTRACT' ? (d.add_amount !== undefined ? Number(d.add_amount) : null) : null,
            discount: normalizedType === 'PERCENT' ? (d.discount !== undefined ? Number(d.discount) : null) : null
          }))
        });

        const createdDetails = await tx.marketing_promotion_details.findMany({
          where: { marketing_promotion_id: promotion.marketing_promotion_id },
          orderBy: { detail_id: 'asc' }
        });

        return { promotion, details: createdDetails };
      });

      res.status(201).json({
        success: true,
        data: {
          promotion: result.promotion,
          details: result.details,
          created_details_count: result.details.length
        },
        message: 'Акция и детали успешно созданы'
      });
    } catch (error) {
      next(error);
    }
  }
}
