import { Router } from 'express';
import { OrderController } from '../controllers/orderController';
import { authenticateToken } from '../middleware/auth';
import { authenticateEmployee, optionalEmployeeAuth } from '../middleware/employeeAuth';

const router = Router();

// ===== СОЗДАНИЕ ЗАКАЗОВ =====
// POST /api/orders - Создать новый заказ (пользователи)
router.post('/', authenticateToken, OrderController.createOrder);

// POST /api/orders/employee - Создать новый заказ (сотрудники)
router.post('/employee', authenticateEmployee, OrderController.createOrder);

// ===== ПОЛУЧЕНИЕ ЗАКАЗОВ =====
// GET /api/orders/:id - Получить заказ по ID (доступно всем)
router.get('/:id', OrderController.getOrderById);

// GET /api/orders/user/:userId - Получить заказы пользователя (пользователи)
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
