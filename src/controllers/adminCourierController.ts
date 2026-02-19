import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import prisma from '../database';
import { createError } from '../middleware/errorHandler';

interface PaginationQuery {
  page?: string;
  limit?: string;
  search?: string;
}

const parsePagination = (query: PaginationQuery) => {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  const skip = (page - 1) * limit;
  const search = query.search?.trim();
  return { page, limit, skip, search };
};

export const listCouriers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { limit, skip, search } = parsePagination(req.query as PaginationQuery);
    const where = search
      ? {
          OR: [
            { login: { contains: search, mode: 'insensitive' } },
            { name: { contains: search, mode: 'insensitive' } },
            { full_name: { contains: search, mode: 'insensitive' } }
          ]
        }
      : undefined;

    const [couriers, total] = await Promise.all([
      prisma.couriers.findMany({
        where,
        skip,
        take: limit,
        orderBy: { courier_id: 'desc' },
        select: {
          courier_id: true,
          login: true,
          name: true,
          full_name: true,
          courier_type: true
        }
      }),
      prisma.couriers.count({ where })
    ]);

    res.json({ success: true, data: { couriers, total } });
  } catch (error) {
    console.error('Failed to list couriers', error);
    next(createError(500, 'Не удалось получить список курьеров'));
  }
};

export const createCourier = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const login = (req.body.login as string | undefined)?.trim();
    const password = (req.body.password as string | undefined)?.trim();
    const name = (req.body.name as string | undefined)?.trim();
    const full_name = (req.body.full_name as string | undefined)?.trim();
    const courier_type = Number(req.body.courier_type) || 1;

    if (!login || !password) {
      return next(createError(400, 'login и password обязательны'));
    }
    if (password.length < 6 || !/[0-9]/.test(password) || !/[A-Za-zА-Яа-я]/.test(password)) {
      return next(createError(400, 'Пароль должен содержать минимум 6 символов, буквы и цифры'));
    }

    const exists = await prisma.couriers.findFirst({ where: { login } });
    if (exists) {
      return next(createError(409, 'Курьер с таким login уже существует'));
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const courier = await prisma.couriers.create({
      data: { login, password: hashedPassword, name, full_name, courier_type }
    });

    res.status(201).json({ success: true, data: { courier_id: courier.courier_id, login, courier_type }, message: 'Курьер создан' });
  } catch (error) {
    console.error('Failed to create courier', error);
    next(createError(500, 'Не удалось создать курьера'));
  }
};

export const updateCourierType = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const courierId = Number(req.params.courierId);
    const targetType = Number(req.body.courier_type);

    if (!courierId || Number.isNaN(courierId)) {
      return next(createError(400, 'Некорректный courier_id'));
    }

    if (Number.isNaN(targetType) || targetType < 1) {
      return next(createError(400, 'Некорректный courier_type'));
    }

    const updated = await prisma.couriers.update({
      where: { courier_id: courierId },
      data: { courier_type: targetType }
    });

    res.json({ success: true, data: { courier_id: updated.courier_id, courier_type: updated.courier_type } });
  } catch (error) {
    console.error('Failed to update courier type', error, { courierId: req.params.courierId });
    next(createError(500, 'Не удалось изменить тип курьера'));
  }
};

export const changeCourierPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const courierId = Number(req.params.courierId);
    const newPassword = (req.body.password as string | undefined)?.trim();

    if (!courierId || Number.isNaN(courierId)) {
      return next(createError(400, 'Некорректный courier_id'));
    }

    if (!newPassword || newPassword.length < 6 || !/[0-9]/.test(newPassword) || !/[A-Za-zА-Яа-я]/.test(newPassword)) {
      return next(createError(400, 'Пароль должен содержать минимум 6 символов, буквы и цифры'));
    }

    const courier = await prisma.couriers.findUnique({ where: { courier_id: courierId }, select: { courier_id: true } });
    if (!courier) {
      return next(createError(404, 'Курьер не найден'));
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    const [, revoked] = await prisma.$transaction([
      prisma.couriers.update({ where: { courier_id: courierId }, data: { password: hashedPassword } }),
      prisma.courier_token.deleteMany({ where: { courier_id: courierId } })
    ]);

    res.json({ success: true, data: { courier_id: courierId, revoked_tokens: revoked.count }, message: 'Пароль обновлен, токены отозваны' });
  } catch (error) {
    console.error('Failed to change courier password', error, { courierId: req.params.courierId });
    next(createError(500, 'Не удалось обновить пароль курьера'));
  }
};

export const revokeCourierTokens = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const courierId = Number(req.params.courierId);
    if (!courierId || Number.isNaN(courierId)) {
      return next(createError(400, 'Некорректный courier_id'));
    }

    const deleted = await prisma.courier_token.deleteMany({ where: { courier_id: courierId } });

    res.json({ success: true, data: { revoked: deleted.count } });
  } catch (error) {
    console.error('Failed to revoke courier tokens', error, { courierId: req.params.courierId });
    next(createError(500, 'Не удалось отозвать токены курьера'));
  }
};

export const getCourierLocation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const courierId = Number(req.params.courierId);
    if (!courierId || Number.isNaN(courierId)) {
      return next(createError(400, 'Некорректный courier_id'));
    }

    const location = await prisma.$queryRaw<any[]>`
      SELECT lat, lon, updated_at
      FROM courier_location
      WHERE courier_id = ${courierId}
      LIMIT 1
    `;

    if (!location || location.length === 0) {
      return res.json({ success: true, data: { courier_id: courierId, location: null }, message: 'Локация не найдена' });
    }

    const current = location[0];

    res.json({
      success: true,
      data: {
        courier_id: courierId,
        location: {
          lat: Number(current.lat),
          lon: Number(current.lon),
          updated_at: current.updated_at
        }
      },
      message: 'Текущая геолокация курьера'
    });
  } catch (error) {
    console.error('Failed to fetch courier location', error, { courierId: req.params.courierId });
    next(createError(500, 'Не удалось получить геолокацию курьера'));
  }
};

export const listCourierLocations = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { limit, skip, search } = parsePagination(req.query as PaginationQuery);
    const searchLike = search ? `%${search}%` : null;
    const whereClause = searchLike
      ? Prisma.sql`WHERE (c.login LIKE ${searchLike})`
      : Prisma.sql``;

    const locations = await prisma.$queryRaw<any[]>(
      Prisma.sql`
        SELECT c.courier_id, c.login, c.courier_type, cl.lat, cl.lon, cl.updated_at
        FROM courier_location cl
        INNER JOIN couriers c ON c.courier_id = cl.courier_id
        ${whereClause}
        ORDER BY cl.updated_at DESC
        LIMIT ${limit} OFFSET ${skip}
      `
    );

    const totalResult = await prisma.$queryRaw<any[]>(
      Prisma.sql`
        SELECT COUNT(*) as total
        FROM courier_location cl
        INNER JOIN couriers c ON c.courier_id = cl.courier_id
        ${whereClause}
      `
    );

    const total = Number(totalResult?.[0]?.total || 0);

    res.json({
      success: true,
      data: {
        locations: locations.map((item) => ({
          courier_id: Number(item.courier_id),
          login: item.login,
          courier_type: item.courier_type,
          location: item.lat === null || item.lon === null
            ? null
            : { lat: Number(item.lat), lon: Number(item.lon), updated_at: item.updated_at }
        })),
        total
      }
    });
  } catch (error) {
    console.error('Failed to list courier locations', error);
    next(createError(500, 'Не удалось получить локации курьеров'));
  }
};

export const getCourierSummary = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [totalCouriers, adminCouriers] = await Promise.all([
      prisma.couriers.count(),
      prisma.couriers.count({ where: { courier_type: 10 } })
    ]);

    res.json({
      success: true,
      data: {
        totalCouriers,
        adminCouriers
      }
    });
  } catch (error) {
    console.error('Failed to get courier summary', error);
    next(createError(500, 'Не удалось получить статистику по курьерам'));
  }
};
