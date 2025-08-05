import { Router } from 'express';
import { ItemController } from '../controllers/itemController';

const router = Router();

// GET /api/items/search - Поиск товаров по названию
// Query params: name (string)
router.get('/search', ItemController.searchByName);

export default router;
