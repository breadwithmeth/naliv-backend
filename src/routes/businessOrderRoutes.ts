import { Router } from 'express';
import { BusinessOrderController } from '../controllers/businessOrderController';
import { BusinessPromotionController } from '../controllers/businessPromotionController';
import { authenticateBusinessToken } from '../middleware/businessAuth';

const router = Router();

// Применяем аутентификацию бизнеса ко всем маршрутам
router.use(authenticateBusinessToken);

// Получение статистики заказов (должно быть выше маршрута :id)
router.get('/orders/stats', BusinessOrderController.getOrderStats);

// Получение списка заказов бизнеса
router.get('/orders', BusinessOrderController.getBusinessOrders);

// Получение заказа по ID
router.get('/orders/:id', BusinessOrderController.getOrderById);

// Обновление статуса заказа
// Обновление статуса заказа
router.patch('/orders/:id/status', BusinessOrderController.updateOrderStatus);

// Обновление количества товара в заказе
router.patch('/orders/:id/items/:itemRelationId', BusinessOrderController.updateOrderItemQuantity);

// Автоматическое создание акции/скидки
router.post('/promotions/auto', BusinessPromotionController.createPromotionAuto);
export { router as businessOrderRoutes };
