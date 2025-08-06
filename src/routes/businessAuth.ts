import { Router } from 'express';
import { authenticateBusiness, BusinessAuthRequest } from '../middleware/businessAuth';
import { Response } from 'express';

const router = Router();

/**
 * Тестовый endpoint для проверки авторизации бизнеса
 * GET /api/test-business-auth
 */
router.get('/test-business-auth', authenticateBusiness, (req: BusinessAuthRequest, res: Response) => {
  res.json({
    success: true,
    message: 'Авторизация бизнеса прошла успешно',
    business: req.business,
    timestamp: new Date().toISOString()
  });
});

/**
 * Тестовый endpoint для проверки опциональной авторизации
 * GET /api/test-optional-business-auth
 */
router.get('/test-optional-business-auth', authenticateBusiness, (req: BusinessAuthRequest, res: Response) => {
  if (req.business) {
    res.json({
      success: true,
      message: 'Бизнес авторизован',
      business: req.business,
      timestamp: new Date().toISOString()
    });
  } else {
    res.json({
      success: true,
      message: 'Запрос без авторизации бизнеса',
      business: null,
      timestamp: new Date().toISOString()
    });
  }
});

export default router;
