import { Router } from 'express';
import { NotificationController } from '../controllers/notificationController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

/**
 * @route POST /api/notifications/register-token
 * @description Регистрация FCM токена пользователя
 * @access Private
 */
router.post('/register-token', authenticateToken, NotificationController.registerFCMToken);

/**
 * @route DELETE /api/notifications/unregister-token
 * @description Удаление FCM токена пользователя
 * @access Private
 */
router.delete('/unregister-token', authenticateToken, NotificationController.unregisterFCMToken);

/**
 * @route POST /api/notifications/send-to-user
 * @description Отправка уведомления конкретному пользователю (для админов)
 * @access Private
 */
router.post('/send-to-user', NotificationController.sendNotificationToUser);

/**
 * @route GET /api/notifications/history
 * @description Получение истории уведомлений пользователя
 * @access Private
 */
router.get('/history', authenticateToken, NotificationController.getNotificationHistory);

/**
 * @route POST /api/notifications/mark-as-read
 * @description Отметка уведомлений как прочитанных
 * @access Private
 */
router.post('/mark-as-read', authenticateToken, NotificationController.markAsRead);

/**
 * @route POST /api/notifications/test
 * @description Отправка тестового уведомления
 * @access Private
 */
router.post('/test', authenticateToken, NotificationController.sendTestNotification);

export default router;
