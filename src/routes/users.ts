import { Router } from 'express';
import { UserController as UserItemsController } from '../controllers/userItemsController';
import { UserController } from '../controllers/userController';
import { authenticateToken, optionalAuth } from '../middleware/auth';
import { authenticateEmployee } from '../middleware/employeeAuth';
import { LikedItemsController } from '../controllers/likedItemsController';

const router = Router();

// ===== ПОИСК ПОЛЬЗОВАТЕЛЕЙ ДЛЯ СОТРУДНИКОВ =====
// GET /api/users/search?phone=+77077707777 - Поиск пользователей по номеру телефона (только для сотрудников)
router.get('/search', authenticateEmployee, UserController.searchUsersByPhone);

// GET /api/users/details/:userId - Получить детальную информацию о пользователе (только для сотрудников)
router.get('/details/:userId', authenticateEmployee, UserController.getUserById);
router.get('/liked-items', authenticateToken, LikedItemsController.getUserLikedItems);

// ===== ПОЛЬЗОВАТЕЛИ (административные) =====
// GET /api/users - Получить всех пользователей (без авторизации для админки)
router.get('/', UserItemsController.getAllUsers);

// GET /api/users/:id - Получить пользователя по ID (без авторизации для админки)
router.get('/:id', UserItemsController.getUserById);

// POST /api/users - Создать нового пользователя (без авторизации для админки)
router.post('/', UserItemsController.createUser);

// ===== ТОВАРЫ ДЛЯ ПОЛЬЗОВАТЕЛЕЙ =====
// GET /api/users/:userId/items/business/:businessId - Получить товары пользователя по бизнесу
// Query params: ?page=1&limit=20&categoryId=123&search=молоко
// Опциональная авторизация - с токеном покажет персонализированные данные
router.get('/:userId/items/business/:businessId', optionalAuth, UserItemsController.getUserItemsByBusiness);

// ===== ИЗБРАННЫЕ ТОВАРЫ (требуют авторизации) =====
// GET /api/users/liked-items - Получить избранные товары текущего пользователя
// Query params: ?business_id=1&page=1&limit=20

// POST /api/users/liked-items - Добавить товар в избранное (текущий пользователь)
// Body: { "item_id": 123 }
router.post('/liked-items', authenticateToken, UserItemsController.addItemToLiked);
router.post('/liked-items/toggle', authenticateToken, LikedItemsController.toggleLike);

// DELETE /api/users/liked-items/:itemId - Удалить товар из избранного (текущий пользователь)
router.delete('/liked-items/:itemId', authenticateToken, UserItemsController.removeItemFromLiked);

// ===== FCM ТОКЕНЫ =====
// POST /api/users/fcm-token - Сохранить FCM токен пользователя (требует авторизации)
// Body: { "fcmToken": "token_string" }
// userId определяется из JWT токена
router.post('/fcm-token', authenticateToken, UserController.saveFcmToken);

export default router;
