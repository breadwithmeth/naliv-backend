import { Router } from 'express';
import { AuthController } from '../controllers/authController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// ===== РЕГИСТРАЦИЯ И АВТОРИЗАЦИЯ =====
// POST /api/auth/register - Регистрация нового пользователя
// Body: { "phone": "+77077707600", "password": "password123", "name": "Иван", "first_name": "Иван", "last_name": "Иванов" }
router.post('/register', AuthController.register);

// POST /api/auth/login - Авторизация пользователя
// Body: { "phone": "+77077707600", "password": "password123" }
router.post('/login', AuthController.login);

// POST /api/auth/logout - Выход из системы (требует авторизации)
// Headers: { "Authorization": "Bearer <token>" }
router.post('/logout', authenticateToken, AuthController.logout);

// ===== ПРОФИЛЬ ПОЛЬЗОВАТЕЛЯ =====
// GET /api/auth/profile - Получить профиль текущего пользователя
// Headers: { "Authorization": "Bearer <token>" }
router.get('/profile', authenticateToken, AuthController.getProfile);

// PUT /api/auth/profile - Обновить профиль пользователя
// Headers: { "Authorization": "Bearer <token>" }
// Body: { "name": "Новое имя", "first_name": "Имя", "last_name": "Фамилия", "date_of_birth": "1990-01-01", "sex": 1 }
router.put('/profile', authenticateToken, AuthController.updateProfile);

// ===== СМЕНА ПАРОЛЯ =====
// POST /api/auth/change-password - Смена пароля
// Headers: { "Authorization": "Bearer <token>" }
// Body: { "current_password": "old_password", "new_password": "new_password" }
router.post('/change-password', authenticateToken, AuthController.changePassword);

export default router;
