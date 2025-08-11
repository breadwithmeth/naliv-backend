import { Router } from 'express';
import { CourierController } from '../controllers/courierController';
import { authenticateCourier } from '../middleware/courierAuth';

const router = Router();

// ===== МЕТОДЫ ДЛЯ КУРЬЕРОВ =====

// GET /api/courier/cities - Получение списка городов
// Headers: { "Authorization": "Bearer <courier_token>" }
router.get('/cities', authenticateCourier, CourierController.getCities);
router.get('/orders/my-deliveries', authenticateCourier, CourierController.getMyDeliveries);

// GET /api/courier/orders/:id - Поиск заказа по ID
// Headers: { "Authorization": "Bearer <courier_token>" }
router.get('/orders/:id', authenticateCourier, CourierController.getOrderById);

// POST /api/courier/orders/:id/take - Взять заказ на доставку
// Headers: { "Authorization": "Bearer <courier_token>" }
router.post('/orders/:id/take', authenticateCourier, CourierController.takeOrderForDelivery);

// POST /api/courier/orders/:id/deliver - Выдать заказ (завершить доставку)
// Headers: { "Authorization": "Bearer <courier_token>" }
router.post('/orders/:id/deliver', authenticateCourier, CourierController.deliverOrder);

// GET /api/courier/orders/my-deliveries - Получение заказов курьера в процессе доставки
// Headers: { "Authorization": "Bearer <courier_token>" }
// Query: ?page=1&limit=20

// GET /api/courier/orders/available - Получение доступных заказов для доставки по городу
// Headers: { "Authorization": "Bearer <courier_token>" }
// Query: ?city=Almaty&page=1&limit=20
router.get('/orders/available', authenticateCourier, CourierController.getAvailableOrders);

export default router;
