import { Router } from 'express';
import { CategoryController } from '../controllers/categoryController';

const router = Router();

// GET /api/categories - Получить все категории с подкатегориями
// Query params: ?business_id=1 (опционально, для получения количества товаров)
router.get('/', CategoryController.getAllCategories);

// GET /api/categories/root - Получить только корневые категории  
// Query params: ?business_id=1 (опционально, для получения количества товаров)
router.get('/root', CategoryController.getRootCategories);

// GET /api/categories/:id - Получить категорию по ID с подкатегориями
// Query params: ?business_id=1 (опционально, для получения количества товаров)
router.get('/:id', CategoryController.getCategoryById);

export default router;
