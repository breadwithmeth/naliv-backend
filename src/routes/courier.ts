import { Router } from 'express';
import { CourierController } from '../controllers/courierController';
import { authenticateCourier } from '../middleware/courierAuth';

const router = Router();

// ===== МЕТОДЫ ДЛЯ КУРЬЕРОВ =====

// GET /api/courier/cities - Получение списка городов
// Headers: { "Authorization": "Bearer <courier_token>" }
router.get('/cities', authenticateCourier, CourierController.getCities);

// GET /api/courier/location - Получение текущей геолокации курьера
// Headers: { "Authorization": "Bearer <courier_token>" }
router.get('/location', authenticateCourier, CourierController.getLocation);

// POST /api/courier/location - Сохранение геолокации курьера
// Headers: { "Authorization": "Bearer <courier_token>" }
// Body: { "lat": number, "lon": number }
router.post('/location', authenticateCourier, CourierController.updateLocation);

// GET /api/courier/orders/my-deliveries - Получение заказов курьера в процессе доставки
// Headers: { "Authorization": "Bearer <courier_token>" }
// Query: ?page=1&limit=20
router.get('/orders/my-deliveries', authenticateCourier, CourierController.getMyDeliveries);


// GET /api/courier/orders/available - Получение доступных заказов для доставки по городу
// Headers: { "Authorization": "Bearer <courier_token>" }
// Query: ?city=Almaty&page=1&limit=20
router.get('/orders/available', authenticateCourier, CourierController.getAvailableOrders);

// GET /api/courier/orders/delivered - Получение доставленных заказов курьера за период
// Headers: { "Authorization": "Bearer <courier_token>" }
// Query: ?start_date=2024-01-01&end_date=2024-01-31&page=1&limit=20
router.get('/orders/delivered', authenticateCourier, CourierController.getDeliveredOrders);

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


export default router;
