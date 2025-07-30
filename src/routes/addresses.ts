import { Router } from 'express';
import { AddressController } from '../controllers/addressController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// ===== ПОИСК АДРЕСОВ =====
// GET /api/addresses/search?query=улица+пушкина - Поиск адресов через Яндекс.Карты
// Query: query (string) - строка поиска
router.get('/search', 
  AddressController.searchAddresses
);

// ===== ПРОВЕРКА ДОСТАВКИ =====
// POST /api/addresses/check-delivery - Проверить возможность доставки по координатам
// Body: { "lat": 43.2220, "lon": 76.8512, "business_id": 1 }
router.post('/check-delivery', 
  AddressController.checkDeliveryAvailability
);

// ===== CRUD ОПЕРАЦИИ С АДРЕСАМИ ПОЛЬЗОВАТЕЛЯ =====
// Все эндпоинты требуют авторизации

// GET /api/addresses/user - Получить все адреса пользователя
// Headers: { "Authorization": "Bearer <token>" }
router.get('/user', 
  authenticateToken, 
  AddressController.getUserAddresses
);

// GET /api/addresses/user/with-delivery?business_id=1 - Получить адреса с информацией о доставке
// Headers: { "Authorization": "Bearer <token>" }
// Query: business_id (optional) - ID бизнеса для проверки доставки
router.get('/user/with-delivery', 
  authenticateToken, 
  AddressController.getUserAddressesWithDelivery
);

// GET /api/addresses/user/selected - Получить выбранный адрес пользователя
// Headers: { "Authorization": "Bearer <token>" }
// Query: business_id (optional) - ID бизнеса для проверки доставки
router.get('/user/selected', 
  authenticateToken, 
  AddressController.getSelectedAddress
);

// GET /api/addresses/user/:id - Получить конкретный адрес пользователя
// Headers: { "Authorization": "Bearer <token>" }
// Params: id (number) - ID адреса
// Query: business_id (optional) - ID бизнеса для проверки доставки
router.get('/user/:id', 
  authenticateToken, 
  AddressController.getUserAddressById
);

// POST /api/addresses/user/select - Установить выбранный адрес
// Headers: { "Authorization": "Bearer <token>" }
// Body: { "address_id": number }
router.post('/user/select', 
  authenticateToken, 
  AddressController.selectAddress
);

// POST /api/addresses/user - Добавить новый адрес
// Headers: { "Authorization": "Bearer <token>" }
// Body: { "name": "Дом", "address": "ул. Пушкина, 12", "lat": 43.2220, "lon": 76.8512, "apartment": "25", "entrance": "2", "floor": "5", "other": "Код домофона 123" }
router.post('/user', 
  authenticateToken, 
  AddressController.createUserAddress
);

// PUT /api/addresses/user/:id - Обновить адрес
// Headers: { "Authorization": "Bearer <token>" }
// Params: id (number) - ID адреса
// Body: { "name": "Новое название", "apartment": "26" } (любые поля для обновления)
router.put('/user/:id', 
  authenticateToken, 
  AddressController.updateUserAddress
);

// DELETE /api/addresses/user/:id - Удалить адрес (мягкое удаление)
// Headers: { "Authorization": "Bearer <token>" }
// Params: id (number) - ID адреса
router.delete('/user/:id', 
  authenticateToken, 
  AddressController.deleteUserAddress
);

// ===== LEGACY ENDPOINTS (совместимость) =====
// GET /api/addresses - Получить все адреса пользователя (legacy)
router.get('/', 
  authenticateToken, 
  AddressController.getUserAddresses
);

// GET /api/addresses/:id - Получить конкретный адрес пользователя (legacy)
router.get('/:id', 
  authenticateToken, 
  AddressController.getAddress
);

// POST /api/addresses - Добавить новый адрес (legacy)
router.post('/', 
  authenticateToken, 
  AddressController.addAddress
);

// PUT /api/addresses/:id - Обновить адрес (legacy)
router.put('/:id', 
  authenticateToken, 
  AddressController.updateAddress
);

// DELETE /api/addresses/:id - Удалить адрес (legacy)
router.delete('/:id', 
  authenticateToken, 
  AddressController.deleteAddress
);

export default router;
