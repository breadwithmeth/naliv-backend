import { Router } from 'express';
import { UserController as UserItemsController } from '../controllers/userItemsController';
import { UserController } from '../controllers/userController';
import { authenticateToken, optionalAuth } from '../middleware/auth';
import { authenticateEmployee } from '../middleware/employeeAuth';

const router = Router();

// ===== ПОИСК ПОЛЬЗОВАТЕЛЕЙ ДЛЯ СОТРУДНИКОВ =====
// GET /api/users/search?phone=+77077707777 - Поиск пользователей по номеру телефона (только для сотрудников)
router.get('/search', authenticateEmployee, UserController.searchUsersByPhone);

// GET /api/users/details/:userId - Получить детальную информацию о пользователе (только для сотрудников)
router.get('/details/:userId', authenticateEmployee, UserController.getUserById);

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
// GET /api/users/:userId/liked-items - Получить избранные товары пользователя
// Query params: ?page=1&limit=20
router.get('/:userId/liked-items', authenticateToken, UserItemsController.getUserLikedItems);

// POST /api/users/:userId/liked-items - Добавить товар в избранное
// Body: { "item_id": 123 }
router.post('/:userId/liked-items', authenticateToken, UserItemsController.addItemToLiked);

// DELETE /api/users/:userId/liked-items/:itemId - Удалить товар из избранного
router.delete('/:userId/liked-items/:itemId', authenticateToken, UserItemsController.removeItemFromLiked);

export default router;
