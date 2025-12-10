import { Router } from 'express';
import { EmployeeController } from '../controllers/employeeController';
import { authenticateEmployee, requireAccessLevel } from '../middleware/employeeAuth';

const router = Router();

// ===== МАРШРУТЫ ДЛЯ СОТРУДНИКОВ =====

// Применяем аутентификацию ко всем маршрутам
router.use(authenticateEmployee);

// ============================
// Управление заказами
// ============================

// POST /api/employee/create-order - Создать заказ от лица сотрудника (call-center)
router.post('/create-order', EmployeeController.createOrder);

// GET /api/employee/orders - Получить список заказов
router.get('/orders', EmployeeController.getOrders);

// GET /api/employee/orders/:orderId - Получить детали конкретного заказа
router.get('/orders/:orderId', EmployeeController.getOrderById);

// ============================
// Управление категориями (только SUPERVISOR и ADMIN)
// ============================

// GET /api/employee/categories/structure - Получить полную структуру категорий
router.get('/categories/structure', 
  requireAccessLevel('SUPERVISOR'), 
  EmployeeController.getCategoriesStructure
);

// POST /api/employee/categories - Создать категорию
router.post('/categories', 
  requireAccessLevel('SUPERVISOR'), 
  EmployeeController.createCategory
);

// PUT /api/employee/categories/:id - Обновить категорию
router.put('/categories/:id', 
  requireAccessLevel('SUPERVISOR'), 
  EmployeeController.updateCategory
);

// DELETE /api/employee/categories/:id - Удалить категорию
router.delete('/categories/:id', 
  requireAccessLevel('SUPERVISOR'), 
  EmployeeController.deleteCategory
);

// ============================
// Управление суперкатегориями (только SUPERVISOR и ADMIN)
// ============================

// POST /api/employee/supercategories - Создать суперкатегорию
router.post('/supercategories', 
  requireAccessLevel('SUPERVISOR'), 
  EmployeeController.createSupercategory
);

// PUT /api/employee/supercategories/:id - Обновить суперкатегорию
router.put('/supercategories/:id', 
  requireAccessLevel('SUPERVISOR'), 
  EmployeeController.updateSupercategory
);

// DELETE /api/employee/supercategories/:id - Удалить суперкатегорию
router.delete('/supercategories/:id', 
  requireAccessLevel('SUPERVISOR'), 
  EmployeeController.deleteSupercategory
);

// ============================
// Управление акциями (только SUPERVISOR и ADMIN)
// ============================

// GET /api/employee/promotions - Получить список акций
router.get('/promotions', 
  requireAccessLevel('SUPERVISOR'), 
  EmployeeController.getPromotions
);

// GET /api/employee/promotions/:id - Получить акцию по ID
router.get('/promotions/:id', 
  requireAccessLevel('SUPERVISOR'), 
  EmployeeController.getPromotionById
);

// POST /api/employee/promotions - Создать акцию
router.post('/promotions', 
  requireAccessLevel('SUPERVISOR'), 
  EmployeeController.createPromotion
);

// PUT /api/employee/promotions/:id - Обновить акцию
router.put('/promotions/:id', 
  requireAccessLevel('SUPERVISOR'), 
  EmployeeController.updatePromotion
);

// DELETE /api/employee/promotions/:id - Удалить акцию
router.delete('/promotions/:id', 
  requireAccessLevel('SUPERVISOR'), 
  EmployeeController.deletePromotion
);

// ============================
// Управление деталями акций (только SUPERVISOR и ADMIN)
// ============================

// POST /api/employee/promotions/:id/details - Добавить деталь к акции
router.post('/promotions/:id/details', 
  requireAccessLevel('SUPERVISOR'), 
  EmployeeController.addPromotionDetail
);

// PUT /api/employee/promotions/details/:detailId - Обновить деталь акции
router.put('/promotions/details/:detailId', 
  requireAccessLevel('SUPERVISOR'), 
  EmployeeController.updatePromotionDetail
);

// DELETE /api/employee/promotions/details/:detailId - Удалить деталь акции
router.delete('/promotions/details/:detailId', 
  requireAccessLevel('SUPERVISOR'), 
  EmployeeController.deletePromotionDetail
);

// ============================
// Управление историями акций (только SUPERVISOR и ADMIN)
// ============================

// POST /api/employee/promotions/:id/stories - Добавить историю к акции
router.post('/promotions/:id/stories', 
  requireAccessLevel('SUPERVISOR'), 
  EmployeeController.addPromotionStory
);

// PUT /api/employee/promotions/stories/:storyId - Обновить историю акции
router.put('/promotions/stories/:storyId', 
  requireAccessLevel('SUPERVISOR'), 
  EmployeeController.updatePromotionStory
);

// DELETE /api/employee/promotions/stories/:storyId - Удалить историю акции
router.delete('/promotions/stories/:storyId', 
  requireAccessLevel('SUPERVISOR'), 
  EmployeeController.deletePromotionStory
);

export default router;
