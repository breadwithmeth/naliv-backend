import { Router } from 'express';
import { EmployeeController } from '../controllers/employeeController';
import { authenticateEmployee, requireAccessLevel } from '../middleware/employeeAuth';

const router = Router();

// ===== МАРШРУТЫ ДЛЯ СОТРУДНИКОВ =====

// Применяем аутентификацию ко всем маршрутам
router.use(authenticateEmployee);

// GET /api/employee/orders - Получить список заказов
router.get('/orders', EmployeeController.getOrders);

// // GET /api/employee/orders/statistics - Получить статистику заказов
// router.get('/orders/statistics', EmployeeController.getOrdersStatistics);

// // GET /api/employee/business-orders/:businessId - Получить заказы конкретного бизнеса
// router.get('/business-orders/:businessId', EmployeeController.getBusinessOrders);

// GET /api/employee/orders/:orderId - Получить детали конкретного заказа
router.get('/orders/:orderId', EmployeeController.getOrderById);

export default router;
