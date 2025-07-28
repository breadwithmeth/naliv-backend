import { Router } from 'express';
import { AddressController } from '../controllers/addressController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// ===== ПОИСК АДРЕСОВ =====
// GET /api/addresses/search?query=улица+пушкина - Поиск адресов через Яндекс.Карты
// Query: query (string) - строка поиска
router.get('/search', AddressController.searchAddresses);

// ===== CRUD ОПЕРАЦИИ С АДРЕСАМИ ПОЛЬЗОВАТЕЛЯ =====
// Все эндпоинты требуют авторизации

// GET /api/addresses - Получить все адреса пользователя
// Headers: { "Authorization": "Bearer <token>" }
router.get('/', authenticateToken, AddressController.getUserAddresses);

// GET /api/addresses/:id - Получить конкретный адрес пользователя
// Headers: { "Authorization": "Bearer <token>" }
// Params: id (number) - ID адреса
router.get('/:id', authenticateToken, AddressController.getAddress);

// POST /api/addresses - Добавить новый адрес
// Headers: { "Authorization": "Bearer <token>" }
// Body: { "name": "Дом", "address": "ул. Пушкина, 12", "lat": 43.2220, "lon": 76.8512, "apartment": "25", "entrance": "2", "floor": "5", "other": "Код домофона 123" }
router.post('/', authenticateToken, AddressController.addAddress);

// PUT /api/addresses/:id - Обновить адрес
// Headers: { "Authorization": "Bearer <token>" }
// Params: id (number) - ID адреса
// Body: { "name": "Новое название", "apartment": "26" } (любые поля для обновления)
router.put('/:id', authenticateToken, AddressController.updateAddress);

// DELETE /api/addresses/:id - Удалить адрес
// Headers: { "Authorization": "Bearer <token>" }
// Params: id (number) - ID адреса
router.delete('/:id', authenticateToken, AddressController.deleteAddress);

export default router;
