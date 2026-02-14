import { Router } from 'express';
import { TvController } from '../controllers/tvController';
import { authenticateBusiness } from '../middleware/businessAuth';

const router = Router();

// GET /api/tv/promotions - активные акции по токену магазина (Bearer)
router.get('/promotions', authenticateBusiness, TvController.getBusinessPromotions);

export default router;
