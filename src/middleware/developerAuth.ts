import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import prisma from '../database';
import { createError } from './errorHandler';

export interface DeveloperAuthRequest extends Request {
  developer?: {
    developer_key_id: number;
    name?: string;
    key_prefix: string;
  };
}

function extractDeveloperKey(req: Request): string | null {
  const headerKey = (req.headers['x-developer-key'] as string | undefined) || req.header('X-Developer-Key');
  if (headerKey && typeof headerKey === 'string') {
    return headerKey.trim();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader) return null;

  // Поддерживаем: Authorization: Developer <key>
  const match = authHeader.match(/^Developer\s+(.+)$/i);
  if (match?.[1]) return match[1].trim();

  return null;
}

/**
 * Middleware для developer-авторизации по ключу из БД.
 *
 * Заголовки:
 * - X-Developer-Key: <key>
 *   или
 * - Authorization: Developer <key>
 */
export const authenticateDeveloper = async (
  req: DeveloperAuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const developerKey = extractDeveloperKey(req);
    if (!developerKey) {
      throw createError(401, 'Developer key не предоставлен');
    }

    const keyHash = crypto.createHash('sha256').update(developerKey, 'utf8').digest('hex');

    const record = await prisma.developer_keys.findFirst({
      where: {
        key_hash: keyHash,
        revoked_at: null
      }
    });

    if (!record) {
      throw createError(401, 'Неверный developer key');
    }

    // best-effort обновление last_used_at
    await prisma.developer_keys.update({
      where: { developer_key_id: record.developer_key_id },
      data: { last_used_at: new Date() }
    }).catch(() => undefined);

    req.developer = {
      developer_key_id: record.developer_key_id,
      name: record.name || undefined,
      key_prefix: record.key_prefix
    };

    next();
  } catch (error) {
    next(error);
  }
};
