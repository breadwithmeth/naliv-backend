import { Router } from 'express';
import { PromotionController } from '../controllers/promotionController';

const router = Router();

// Получение активных акций
// GET /api/promotions/active?business_id={id}&limit={limit}&offset={offset}
router.get('/active', PromotionController.getActivePromotions);

// Получение товаров акции
// GET /api/promotions/:promotionId/items
router.get('/:promotionId/items', PromotionController.getPromotionItems);

export default router;