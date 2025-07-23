import { Router } from 'express';
import { BusinessController } from '../controllers/businessController';

const router = Router();

// GET /api/businesses - Получить все бизнесы
// Query params: ?page=1&limit=20&city_id=1&search=магазин
router.get('/', BusinessController.getAllBusinesses);

// GET /api/businesses/:id - Получить бизнес по ID
router.get('/:id', BusinessController.getBusinessById);

// GET /api/businesses/:businessId/items - Получить все товары бизнеса
// Query params: ?page=1&limit=20&categoryId=123&search=молоко&inStock=true
router.get('/:businessId/items', BusinessController.getBusinessItems);

// GET /api/businesses/:businessId/categories - Получить категории товаров бизнеса
router.get('/:businessId/categories', BusinessController.getBusinessCategories);

export default router;
