import { Router } from 'express';
import { CourierAuthController } from '../controllers/courierAuthController';
import { authenticateCourier } from '../middleware/courierAuth';

const router = Router();

// POST /api/courier/auth/register - Регистрация курьера
router.post('/register', CourierAuthController.register);

// POST /api/courier/auth/login - Логин курьера
router.post('/login', CourierAuthController.login);

// POST /api/courier/auth/logout - Выход курьера
router.post('/logout', authenticateCourier, CourierAuthController.logout);

// GET /api/courier/auth/profile - Профиль курьера
router.get('/profile', authenticateCourier, CourierAuthController.getProfile);

// PUT /api/courier/auth/change-password - Смена пароля курьера
router.put('/change-password', authenticateCourier, CourierAuthController.changePassword);

export default router;
