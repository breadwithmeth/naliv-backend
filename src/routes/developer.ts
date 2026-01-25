import { Router } from 'express';
import { DeveloperController } from '../controllers/developerController';
import { authenticateDeveloper } from '../middleware/developerAuth';

const router = Router();

// GET /api/developer/ping
router.get('/ping', authenticateDeveloper, DeveloperController.ping);

// GET /api/developer/me
router.get('/me', authenticateDeveloper, DeveloperController.getMe);

// GET /api/developer/orders
router.get('/orders', authenticateDeveloper, DeveloperController.getOrders);

export default router;
