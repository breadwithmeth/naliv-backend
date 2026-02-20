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
      const { source = 'combined' } = req.query; // 'local', 'halyk', 'combined'
if (source === 'halyk') {
        // Получаем карты только из Halyk Bank API
        try {
          const { PaymentController } = require('./paymentController');
          const authToken = await PaymentController.getHalykToken('0', undefined, 'KZT');
          const apiUrl = `https://epay-api.homebank.kz/cards/${userId}`;
          
          const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${authToken.access_token}`,
              'Content-Type': 'application/json'
            }
          });

          if (response.ok) {
            const cardsData = await response.json();
            
            if (Array.isArray(cardsData)) {
              const formattedCards = cardsData
                .filter(card => card.PaymentAvailable !== false)
                .map(card => ({
                  halyk_id: card.ID,
                  card_mask: card.CardMask,
                  payer_name: card.PayerName,
                  created_date: card.CreatedDate,
                  payment_available: card.PaymentAvailable
                }));

              return res.json({
                success: true,
                data: {
                  cards: formattedCards,
                  total: formattedCards.length,
                  source: 'halyk_api'
                },
                message: `Найдено ${formattedCards.length} сохраненных карт в Halyk Bank`
              });
            } else if ((cardsData as any).code === 1373) {
              return res.json({
                success: true,
                data: {
                  cards: [],
                  total: 0,
                  source: 'halyk_api'
                },
                message: 'Сохраненные карты не найдены в Halyk Bank'
              });
            }
          }
          
          throw new Error(`Ошибка API Halyk Bank: ${response.status}`);
          
        } catch (halykError: any) {
          console.error('Ошибка получения карт из Halyk Bank:', halykError);
          return next(createError(500, `Ошибка Halyk Bank API: ${halykError.message}`));
        }
      }

      if (source === 'local') {
        // Получаем карты только из локальной БД (оригинальная логика)
        const cards = await prisma.$queryRaw<any[]>`
          SELECT 
            MAX(card_id) as card_id, 
            CONCAT('**** **** **** ', RIGHT(card_mask, 4)) as mask,
            card_mask,
            halyk_card_id
          FROM halyk_saved_cards 
          WHERE user_id = ${userId}
          GROUP BY card_mask
          ORDER BY MAX(card_id) DESC
        `;

        const formattedCards = cards.map(card => ({
          card_id: card.card_id,
          mask: card.mask,
          halyk_card_id: card.halyk_card_id
        }));

        return res.json({
          success: true,
          data: {
            cards: formattedCards,
            total: formattedCards.length,
            source: 'local_db'
          },
          message: `Найдено ${formattedCards.length} сохраненных карт в локальной БД`
        });
      }

      // source === 'combined' - объединенные данные (по умолчанию)
      try {
        // Получаем локальные карты
        const localCards = await prisma.$queryRaw<any[]>`
          SELECT 
            MAX(card_id) as card_id, 
            CONCAT('**** **** **** ', RIGHT(card_mask, 4)) as mask,
            card_mask,
            halyk_card_id
          FROM halyk_saved_cards 
          WHERE user_id = ${userId}
          GROUP BY card_mask
          ORDER BY MAX(card_id) DESC
        `;

        // Получаем карты из Halyk Bank API
        let halykCards: any[] = [];
        try {
          const { PaymentController } = require('./paymentController');
          const authToken = await PaymentController.getHalykToken('0', undefined, 'KZT');
          const apiUrl = `https://epay-api.homebank.kz/cards/${userId}`;
          
          const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${authToken.access_token}`,
              'Content-Type': 'application/json'
            }
          });

          if (response.ok) {
            const cardsData = await response.json();
            if (Array.isArray(cardsData)) {
              halykCards = cardsData.filter(card => card.PaymentAvailable !== false);
            }
          }
        } catch (halykError) {
          console.warn('Не удалось получить карты из Halyk Bank API, используем только локальные:', halykError);
        }

        // Объединяем карты
        const combinedCards = [];
        const processedHalykIds = new Set();

        // Добавляем карты из Halyk Bank API с дополнительной информацией
        for (const halykCard of halykCards) {
          processedHalykIds.add(halykCard.ID);
          
          // Ищем соответствующую локальную карту
          const localCard = localCards.find(lc => lc.halyk_card_id === halykCard.ID);
          
          combinedCards.push({
            card_id: localCard?.card_id || null,
            mask: halykCard.CardMask,
            halyk_card_id: halykCard.ID,
            payer_name: halykCard.PayerName,
            created_date: halykCard.CreatedDate,
            payment_available: halykCard.PaymentAvailable,
            source: 'halyk_api',
            local_record: !!localCard
          });
        }

        // Добавляем локальные карты, которых нет в Halyk Bank
        for (const localCard of localCards) {
          if (!processedHalykIds.has(localCard.halyk_card_id)) {
            combinedCards.push({
              card_id: localCard.card_id,
              mask: localCard.mask,
              halyk_card_id: localCard.halyk_card_id,
              payer_name: null,
              created_date: null,
              payment_available: null,
              source: 'local_db',
              local_record: true
            });
          }
        }

        res.json({
          success: true,
          data: {
            cards: combinedCards,
            total: combinedCards.length,
            sources: {
              halyk_api: halykCards.length,
              local_db: localCards.length,
              combined: combinedCards.length
            }
          },
          message: `Найдено ${combinedCards.length} сохраненных карт (${halykCards.length} из Halyk API + ${localCards.length} локальных)`
        });

      } catch (error: any) {
        console.error('Ошибка объединения карт:', error);
        return next(createError(500, `Ошибка объединения данных: ${error.message}`));
      }

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
