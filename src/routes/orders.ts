import { Router, Request, Response } from 'express';
import { OrderController } from '../controllers/orderController';
import { authenticateToken } from '../middleware/auth';
import { authenticateEmployee, optionalEmployeeAuth } from '../middleware/employeeAuth';
import optionalAuth from '../middleware/optionalAuth';

const router = Router();

// ===== СОЗДАНИЕ ЗАКАЗОВ =====
// POST /api/orders/user - Создать новый заказ для пользователей (только in_app оплата)
router.post('/user', authenticateToken, OrderController.createUserOrder);

// POST /api/orders/create-user-order - Создать новый заказ с автоматическим списанием
router.post('/create-user-order', authenticateToken, OrderController.createUserOrder);

// POST /api/orders - Создать новый заказ (пользователи, совместимость)
router.post('/', authenticateToken, OrderController.createOrder);

// POST /api/orders/employee - Создать новый заказ (сотрудники)
router.post('/employee', authenticateEmployee, OrderController.createOrder);

// ===== ТЕСТОВЫЕ ENDPOINTS =====
// GET /api/orders/test-php-uuid - Тестирование генерации PHP-style UUID
router.get('/test-php-uuid', async (req: Request, res: Response) => {
  try {
    // Симулируем создание записи с log_timestamp
    const mockTimestamp = new Date();
    const mockOrderId = 12345;
    
    // Генерируем UUID как в PHP: CONCAT(UNIX_TIMESTAMP(log_timestamp), order_id)
    const unixTimestamp = Math.floor(mockTimestamp.getTime() / 1000);
    const phpStyleUuid = `${unixTimestamp}${mockOrderId}`;
    
    res.json({
      success: true,
      data: {
        mock_timestamp: mockTimestamp.toISOString(),
        mock_order_id: mockOrderId,
        unix_timestamp: unixTimestamp,
        php_style_uuid: phpStyleUuid,
        explanation: 'PHP генерирует UUID как CONCAT(UNIX_TIMESTAMP(log_timestamp), order_id)'
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/orders/test-uuid - Тестирование генерации числового UUID (legacy)
router.get('/test-uuid', OrderController.testNumericUuid);

// ===== ПОЛУЧЕНИЕ ЗАКАЗОВ =====
// GET /api/orders/active - Получить активные заказы (пользователи и сотрудники)
router.get('/active', optionalAuth, OrderController.getActiveOrders);

// GET /api/orders/active/summary - Получить сводку активных заказов (дашборд)
router.get('/active/summary', optionalAuth, OrderController.getActiveOrdersSummary);

// GET /api/orders/business/:businessId/active - Получить активные заказы бизнеса (сотрудники)
router.get('/business/:businessId/active', authenticateEmployee, OrderController.getBusinessActiveOrders);

// GET /api/orders/:id - Получить заказ по ID (доступно всем)
router.get('/:id', OrderController.getOrderById);

// GET /api/orders/:id/status - Отследить статус заказа (пользователи)
router.get('/:id/status', authenticateToken, OrderController.trackOrderStatus);

// GET /api/orders/user/:userId - Получить заказы пользователя (пользователи)
router.get('/user/:userId', authenticateToken, OrderController.getUserOrders);

// GET /api/orders/employee/user/:userId - Получить заказы пользователя (сотрудники)
router.get('/employee/user/:userId', authenticateEmployee, OrderController.getUserOrders);

// ===== УПРАВЛЕНИЕ ЗАКАЗАМИ =====
// POST /api/orders/:id/pay - Оплатить заказ картой (пользователи)
router.post('/:id/pay', authenticateToken, OrderController.payOrder);

// PUT /api/orders/:id/status - Обновить статус заказа (только сотрудники)
router.put('/:id/status', authenticateEmployee, OrderController.updateOrderStatus);

// DELETE /api/orders/:id - Отменить заказ (пользователи)
router.delete('/:id', authenticateToken, OrderController.cancelOrder);

// DELETE /api/orders/employee/:id - Отменить заказ (сотрудники)
router.delete('/employee/:id', authenticateEmployee, OrderController.cancelOrder);

export default router;
