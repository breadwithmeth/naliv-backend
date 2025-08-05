import { Router } from 'express';
import { OrderController } from '../controllers/orderController';
import { authenticateToken } from '../middleware/auth';
import { authenticateEmployee, optionalEmployeeAuth } from '../middleware/employeeAuth';

const router = Router();

// ===== СОЗДАНИЕ ЗАКАЗОВ =====
// POST /api/orders/user - Создать новый заказ для пользователей (только in_app оплата)
router.post('/user', authenticateToken, OrderController.createUserOrder);

// POST /api/orders/create-user-order - Создать новый заказ с автоматическим списанием
router.post('/create-user-order', authenticateToken, OrderController.createUserOrder);

// POST /api/orders/create-order-no-payment - Создать новый заказ без оплаты
router.post('/create-order-no-payment', authenticateToken, OrderController.createOrderNoPayment);

// POST /api/orders - Создать новый заказ (пользователи, совместимость)
router.post('/', authenticateToken, OrderController.createOrder);

// POST /api/orders/employee - Создать новый заказ (сотрудники)
router.post('/employee', authenticateEmployee, OrderController.createOrder);

// ===== ОПЛАТА ЗАКАЗОВ =====
// POST /api/orders/:id/pay - Оплатить заказ сохраненной картой или создать ссылку для оплаты
router.post('/:id/pay', authenticateToken, OrderController.payOrder);

// ===== ТЕСТОВЫЕ ENDPOINTS =====
// GET /api/orders/test-uuid - Тестирование генерации числового UUID
router.get('/test-uuid', OrderController.testNumericUuid);

// ===== ПОЛУЧЕНИЕ ЗАКАЗОВ =====
// GET /api/orders/my-orders - Получить все заказы авторизованного пользователя
router.get('/my-orders', authenticateToken, OrderController.getUserOrders);

// GET /api/orders/my-active-orders - Получить активные заказы авторизованного пользователя
router.get('/my-active-orders', authenticateToken, OrderController.getActiveOrders);

// GET /api/orders/:id - Получить заказ по ID (доступно всем)
router.get('/:id', OrderController.getOrderById);

// GET /api/orders/user/:userId - Получить заказы пользователя (пользователи, для совместимости)
router.get('/user/:userId', authenticateToken, OrderController.getUserOrders);

// GET /api/orders/employee/user/:userId - Получить заказы пользователя (сотрудники)
router.get('/employee/user/:userId', authenticateEmployee, OrderController.getUserOrders);

// ===== УПРАВЛЕНИЕ ЗАКАЗАМИ =====
// PUT /api/orders/:id/status - Обновить статус заказа (только сотрудники)
router.put('/:id/status', authenticateEmployee, OrderController.updateOrderStatus);

// DELETE /api/orders/:id - Отменить заказ (пользователи)
router.delete('/:id', authenticateToken, OrderController.cancelOrder);

// DELETE /api/orders/employee/:id - Отменить заказ (сотрудники)
router.delete('/employee/:id', authenticateEmployee, OrderController.cancelOrder);

export default router;
