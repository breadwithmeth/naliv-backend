import { Router } from 'express';
import { UserCardsController } from '../controllers/userCardsController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

/**
 * @route GET /api/user/cards
 * @desc Получить список сохраненных карт пользователя
 * @access Private (требует JWT токен)
 * @returns { success: boolean, data: { cards: array, total: number }, message: string }
 */
router.get('/cards', authenticateToken, UserCardsController.getSavedCards);

/**
 * @route GET /api/user/cards/:cardId
 * @desc Получить карту по ID
 * @access Private (требует JWT токен)
 * @param cardId - ID карты
 * @returns { success: boolean, data: { card: object }, message: string }
 */
router.get('/cards/:cardId', authenticateToken, UserCardsController.getCardById);

/**
 * @route DELETE /api/user/cards/:cardId
 * @desc Удалить сохраненную карту
 * @access Private (требует JWT токен)
 * @param cardId - ID карты
 * @returns { success: boolean, data: { card_id: number }, message: string }
 */
router.delete('/cards/:cardId', authenticateToken, UserCardsController.deleteCard);

export default router;
