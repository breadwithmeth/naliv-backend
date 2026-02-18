import { Router } from 'express';
import { 
  getUserBonuses, 
  createBonusCard, 
  addBonuses, 
  getBonusHistory
} from '../controllers/bonusController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

/**
 * @route GET /bonuses
 * @desc Получить бонусы пользователя и код бонусной карты
 * @access Private
 */
router.get('/', authenticateToken, getUserBonuses);

/**
 * @route POST /bonuses/card
 * @desc Создать бонусную карту для пользователя
 * @access Private
 */
//router.post('/card', authenticateToken, createBonusCard);

/**
 * @route POST /bonuses/add
 * @desc Добавить бонусы пользователю
 * @access Private
 */
//router.post('/add', authenticateToken, addBonuses);

/**
 * @route GET /bonuses/history
 * @desc Получить историю бонусных операций
 * @access Private
 */
router.get('/history', authenticateToken, getBonusHistory);

export default router;
