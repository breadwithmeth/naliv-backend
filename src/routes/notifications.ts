import { Router } from 'express';
import { NotificationController } from '../controllers/notificationController';
import { authenticateToken } from '../middleware/auth';
import { authenticateEmployee } from '../middleware/employeeAuth';

const router = Router();

// ===== ОТПРАВКА УВЕДОМЛЕНИЙ (для сотрудников) =====
// POST /api/notifications/send - Отправить уведомление одному пользователю
// Body: { "userId": 123, "title": "Заголовок", "body": "Текст", "data": {...} }
router.post('/send', authenticateEmployee, NotificationController.sendNotificationToUser);

// POST /api/notifications/send-bulk - Отправить уведомление группе пользователей
// Body: { "userIds": [1, 2, 3], "title": "Заголовок", "body": "Текст", "data": {...} }
router.post('/send-bulk', authenticateEmployee, NotificationController.sendBulkNotification);

// ===== УПРАВЛЕНИЕ УВЕДОМЛЕНИЯМИ ПОЛЬЗОВАТЕЛЯ (требует авторизации) =====
// GET /api/notifications/my - Получить уведомления текущего пользователя
// Query params: ?page=1&limit=20
router.get('/my', authenticateToken, NotificationController.getUserNotifications);

// PUT /api/notifications/:notificationId/read - Отметить уведомление как прочитанное
router.put('/:notificationId/read', authenticateToken, NotificationController.markNotificationAsRead);

// PUT /api/notifications/mark-all-read - Отметить все уведомления как прочитанные
router.put('/mark-all-read', authenticateToken, NotificationController.markAllNotificationsAsRead);

// ===== ДИАГНОСТИКА FCM ТОКЕНОВ =====
// POST /api/notifications/test-token - Тест FCM токена (авторизованные пользователи для себя, сотрудники для любого)
// Body: { "userId": 123 } (только для сотрудников)
router.post('/test-token', authenticateToken, NotificationController.testFcmToken);

// DELETE /api/notifications/cleanup-token - Очистить недействительный FCM токен
// Body: { "userId": 123 } (только для сотрудников)  
router.delete('/cleanup-token', authenticateToken, NotificationController.cleanupFcmToken);

export default router;
