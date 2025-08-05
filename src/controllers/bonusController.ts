import { Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { createError } from '../middleware/errorHandler';
import { AuthRequest } from './authController';

const prisma = new PrismaClient();

/**
 * Получить бонусы пользователя и код бонусной карты
 */
export const getUserBonuses = async (req: AuthRequest, res: Response) => {
  try {
    const { user_id: userId } = req.user!;

    // Получаем бонусную карту пользователя
    const bonusCard = await prisma.bonus_cards.findFirst({
      where: { user_id: userId }
    });

    // Получаем последнюю запись бонусов пользователя (текущий баланс)
    const lastBonusRecord = await prisma.bonuses.findFirst({
      where: { user_id: userId },
      orderBy: { bonus_id: 'desc' }
    });

    // Получаем детализированную историю бонусов
    const bonusHistory = await prisma.bonuses.findMany({
      where: { user_id: userId },
      orderBy: { log_timestamp: 'desc' },
      take: 20 // Последние 20 операций
    });

    const totalBonuses = lastBonusRecord ? lastBonusRecord.amount : 0;

    res.json({
      success: true,
      data: {
        totalBonuses,
        bonusCard: bonusCard ? {
          cardUuid: bonusCard.card_uuid,
          createdAt: bonusCard.log_timestamp
        } : null,
        bonusHistory: bonusHistory.map(bonus => ({
          bonusId: bonus.bonus_id,
          organizationId: bonus.organization_id,
          amount: bonus.amount,
          timestamp: bonus.log_timestamp
        }))
      },
      message: 'Данные о бонусах успешно получены'
    });

  } catch (error) {
    console.error('Ошибка при получении бонусов пользователя:', error);
    throw createError(500, 'Ошибка при получении данных о бонусах');
  }
};

/**
 * Создать бонусную карту для пользователя (если её нет)
 */
export const createBonusCard = async (req: AuthRequest, res: Response) => {
  try {
    const { user_id: userId } = req.user!;

    // Проверяем, есть ли уже бонусная карта
    const existingCard = await prisma.bonus_cards.findFirst({
      where: { user_id: userId }
    });

    if (existingCard) {
      res.json({
        success: false,
        message: 'У пользователя уже есть бонусная карта',
        data: {
          cardUuid: existingCard.card_uuid,
          createdAt: existingCard.log_timestamp
        }
      });
      return;
    }

    // Генерируем UUID для новой карты
    const { v4: uuidv4 } = require('uuid');
    const cardUuid = uuidv4();

    // Создаем новую бонусную карту
    const newBonusCard = await prisma.bonus_cards.create({
      data: {
        user_id: userId,
        card_uuid: cardUuid
      }
    });

    res.json({
      success: true,
      data: {
        cardUuid: newBonusCard.card_uuid,
        createdAt: newBonusCard.log_timestamp
      },
      message: 'Бонусная карта успешно создана'
    });

  } catch (error) {
    console.error('Ошибка при создании бонусной карты:', error);
    throw createError(500, 'Ошибка при создании бонусной карты');
  }
};

/**
 * Добавить бонусы пользователю
 */
export const addBonuses = async (req: AuthRequest, res: Response) => {
  try {
    const { user_id: userId } = req.user!;
    const { organizationId, amount } = req.body;

    // Валидация входных данных
    if (!organizationId || !amount || amount <= 0) {
      throw createError(400, 'Некорректные данные для добавления бонусов');
    }

    // Добавляем бонусы
    const newBonus = await prisma.bonuses.create({
      data: {
        user_id: userId,
        organization_id: organizationId,
        amount: amount
      }
    });

    // Получаем последнюю запись бонусов (текущий баланс)
    const lastBonusRecord = await prisma.bonuses.findFirst({
      where: { user_id: userId },
      orderBy: { bonus_id: 'desc' }
    });

    res.json({
      success: true,
      data: {
        bonusId: newBonus.bonus_id,
        addedAmount: newBonus.amount,
        totalBonuses: lastBonusRecord ? lastBonusRecord.amount : 0,
        timestamp: newBonus.log_timestamp
      },
      message: 'Бонусы успешно добавлены'
    });

  } catch (error: any) {
    console.error('Ошибка при добавлении бонусов:', error);
    if (error.statusCode) {
      throw error;
    }
    throw createError(500, 'Ошибка при добавлении бонусов');
  }
};

/**
 * Получить детализированную историю бонусов
 */
export const getBonusHistory = async (req: AuthRequest, res: Response) => {
  try {
    const { user_id: userId } = req.user!;
    const { page = 1, limit = 20 } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Получаем историю бонусов с пагинацией
    const bonusHistory = await prisma.bonuses.findMany({
      where: { user_id: userId },
      orderBy: { log_timestamp: 'desc' },
      skip,
      take: limitNum
    });

    // Считаем общее количество записей
    const totalCount = await prisma.bonuses.count({
      where: { user_id: userId }
    });

    res.json({
      success: true,
      data: {
        bonuses: bonusHistory.map(bonus => ({
          bonusId: bonus.bonus_id,
          organizationId: bonus.organization_id,
          amount: bonus.amount,
          timestamp: bonus.log_timestamp
        })),
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: totalCount,
          pages: Math.ceil(totalCount / limitNum)
        }
      },
      message: 'История бонусов успешно получена'
    });

  } catch (error) {
    console.error('Ошибка при получении истории бонусов:', error);
    throw createError(500, 'Ошибка при получении истории бонусов');
  }
};
