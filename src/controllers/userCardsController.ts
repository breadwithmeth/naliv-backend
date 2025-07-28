import { Request, Response, NextFunction } from 'express';
import prisma from '../database';
import { createError } from '../middleware/errorHandler';

interface AuthRequest extends Request {
  user?: {
    user_id: number;
    login: string;
  };
}

export class UserCardsController {

  /**
   * Получить сохраненные карты пользователя
   * GET /api/user/cards
   */
  static async getSavedCards(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      // Проверяем авторизацию пользователя
      if (!req.user) {
        return next(createError(401, 'Необходима авторизация'));
      }

      const userId = req.user.user_id;

      // Получаем сохраненные карты пользователя
      // Группируем по card_mask и берем MAX(card_id) для получения последней карты с таким же номером
      const cards = await prisma.$queryRaw<any[]>`
        SELECT 
          MAX(card_id) as card_id, 
          CONCAT('**** **** **** ', RIGHT(card_mask, 4)) as mask,
          card_mask
        FROM halyk_saved_cards 
        WHERE user_id = ${userId}
        GROUP BY card_mask
        ORDER BY MAX(card_id) DESC
      `;

      // Форматируем результат
      const formattedCards = cards.map(card => ({
        card_id: card.card_id,
        mask: card.mask
      }));

      res.json({
        success: true,
        data: {
          cards: formattedCards,
          total: formattedCards.length
        },
        message: `Найдено ${formattedCards.length} сохраненных карт`
      });

    } catch (error: any) {
      console.error('Ошибка получения сохраненных карт:', error);
      next(createError(500, `Ошибка получения карт: ${error.message}`));
    }
  }

  /**
   * Получить карту по ID
   * GET /api/user/cards/:cardId
   */
  static async getCardById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      // Проверяем авторизацию пользователя
      if (!req.user) {
        return next(createError(401, 'Необходима авторизация'));
      }

      const cardId = parseInt(req.params.cardId);
      const userId = req.user.user_id;

      if (isNaN(cardId)) {
        return next(createError(400, 'Неверный ID карты'));
      }

      // Получаем карту пользователя
      const card = await prisma.halyk_saved_cards.findFirst({
        where: {
          card_id: cardId,
          user_id: userId
        }
      });

      if (!card) {
        return next(createError(404, 'Карта не найдена или не принадлежит пользователю'));
      }

      // Форматируем маску карты
      const formattedCard = {
        card_id: card.card_id,
        mask: `**** **** **** ${card.card_mask.slice(-4)}`,
        halyk_card_id: card.halyk_card_id
      };

      res.json({
        success: true,
        data: {
          card: formattedCard
        },
        message: 'Карта найдена'
      });

    } catch (error: any) {
      console.error('Ошибка получения карты:', error);
      next(createError(500, `Ошибка получения карты: ${error.message}`));
    }
  }

  /**
   * Удалить сохраненную карту
   * DELETE /api/user/cards/:cardId
   */
  static async deleteCard(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      // Проверяем авторизацию пользователя
      if (!req.user) {
        return next(createError(401, 'Необходима авторизация'));
      }

      const cardId = parseInt(req.params.cardId);
      const userId = req.user.user_id;

      if (isNaN(cardId)) {
        return next(createError(400, 'Неверный ID карты'));
      }

      // Проверяем существование карты и принадлежность пользователю
      const card = await prisma.halyk_saved_cards.findFirst({
        where: {
          card_id: cardId,
          user_id: userId
        }
      });

      if (!card) {
        return next(createError(404, 'Карта не найдена или не принадлежит пользователю'));
      }

      // Удаляем карту
      await prisma.halyk_saved_cards.delete({
        where: {
          card_id: cardId
        }
      });

      res.json({
        success: true,
        data: {
          card_id: cardId
        },
        message: 'Карта успешно удалена'
      });

    } catch (error: any) {
      console.error('Ошибка удаления карты:', error);
      next(createError(500, `Ошибка удаления карты: ${error.message}`));
    }
  }

  /**
   * Проверка верификации пользователя (заглушка)
   * В оригинальном коде есть checkVerification, но пока оставим как заглушку
   */
  private static async checkVerification(userId: number): Promise<void> {
    // TODO: Реализовать проверку верификации пользователя
    // В оригинальном коде есть try-catch блок для этой проверки
    try {
      // Здесь может быть логика проверки верификации пользователя
      // Например, проверка статуса верификации в таблице users
      const user = await prisma.user.findUnique({
        where: { user_id: userId }
      });

      if (!user) {
        throw new Error('Пользователь не найден');
      }

      // Можно добавить дополнительные проверки верификации
      // if (!user.is_verified) {
      //   throw new Error('Пользователь не верифицирован');
      // }
    } catch (error) {
      // В оригинальном коде ошибка игнорируется
      // Возможно, это сделано намеренно для fallback логики
      console.warn('Ошибка проверки верификации:', error);
    }
  }
}
