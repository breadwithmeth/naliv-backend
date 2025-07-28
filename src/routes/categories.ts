import { Router } from 'express';
import { CategoryController } from '../controllers/categoryController';

const router = Router();

// GET /api/categories - Получить все категории с подкатегориями
// Query params: ?business_id=1 (опционально, для получения количества товаров)
router.get('/', CategoryController.getAllCategories);

// GET /api/categories/root - Получить только корневые категории  
// Query params: ?business_id=1 (опционально, для получения количества товаров)
router.get('/root', CategoryController.getRootCategories);

// GET /api/categories/:id/items - Получить товары категории (включая подкатегории)
// Query params: business_id (обязательно), page, limit
router.get('/:id/items', CategoryController.getItemsByCategory);

// GET /api/categories/items/:itemId - Получить товар по ID с опциями и акциями
// Query params: business_id (опционально, для проверки доступности акций)
router.get('/items/:itemId', CategoryController.getItemById);

// GET /api/categories/:id - Получить категорию по ID с подкатегориями
// Query params: ?business_id=1 (опционально, для получения количества товаров)
router.get('/:id', CategoryController.getCategoryById);

export default router;
