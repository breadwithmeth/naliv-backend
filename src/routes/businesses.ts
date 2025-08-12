import { Router } from 'express';
import { BusinessController } from '../controllers/businessController';
import { authenticateBusiness } from '../middleware/businessAuth';

const router = Router();

// GET /api/businesses - Получить все бизнесы
// Query params: ?page=1&limit=20&city_id=1&search=магазин
router.get('/', BusinessController.getAllBusinesses);
router.get('/discount-cards', BusinessController.getDiscountCards);

// GET /api/businesses/:id - Получить бизнес по ID
router.get('/:id', BusinessController.getBusinessById);

// GET /api/businesses/:businessId/items - Получить все товары бизнеса
// Query params: ?page=1&limit=20&categoryId=123&search=молоко&inStock=true
router.get('/:businessId/items', BusinessController.getBusinessItems);

// GET /api/businesses/:businessId/categories - Получить категории товаров бизнеса
router.get('/:businessId/categories', BusinessController.getBusinessCategories);

// GET /api/businesses/reports/couriers - Отчет по курьерам и доставкам за период
// Query params: ?start_date=2025-08-01&end_date=2025-08-10&city_id=1&courier_id=5
// Требует авторизации бизнеса, business_id берется из middleware
router.get('/reports/couriers', authenticateBusiness, BusinessController.getCouriersDeliveryReport);

// GET /api/businesses/reports/courier/:courierId - Детальный отчет по конкретному курьеру
// Query params: ?start_date=2025-08-01&end_date=2025-08-10
// Требует авторизации бизнеса, business_id берется из middleware
router.get('/reports/courier/:courierId', authenticateBusiness, BusinessController.getCourierDetailedReport);

// GET /api/businesses/discount-cards - Получить все дисконтные карты пользователей
// Query params: ?page=1&limit=50&search=user123
// Требует авторизации бизнеса

export default router;
