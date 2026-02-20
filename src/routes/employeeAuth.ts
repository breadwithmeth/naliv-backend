import { Router } from 'express';
import { EmployeeAuthController } from '../controllers/employeeAuthController';
import { authenticateEmployee } from '../middleware/employeeAuth';
import { authLimiter } from '../middleware/rateLimiter';

const router = Router();

// ===== АУТЕНТИФИКАЦИЯ СОТРУДНИКОВ =====

// POST /api/employee/auth/login - Вход сотрудника
router.post('/login', authLimiter, EmployeeAuthController.login);

// POST /api/employee/auth/logout - Выход сотрудника (требует авторизации)
router.post('/logout', authenticateEmployee, EmployeeAuthController.logout);

// GET /api/employee/auth/profile - Профиль сотрудника (требует авторизации)
router.get('/profile', authenticateEmployee, EmployeeAuthController.getProfile);

// PUT /api/employee/auth/change-password - Смена пароля (требует авторизации)
router.put('/change-password', authenticateEmployee, EmployeeAuthController.changePassword);

export default router;
