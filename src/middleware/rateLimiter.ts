import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import { Request, Response, NextFunction } from 'express';

/**
 * Жесткое ограничение для критически важных эндпоинтов с доставкой
 * Максимум 10 запросов за 5 минут с IP
 */
export const deliveryRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 минут
  max: 10, // максимум 10 запросов с IP за 5 минут
  message: {
    success: false,
    error: {
      message: 'Слишком много запросов. Попробуйте через 5 минут.',
      statusCode: 429,
      timestamp: new Date().toISOString()
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Пропускаем ограничения для админов в development
    return process.env.NODE_ENV === 'development' && req.headers['x-admin'] === 'true';
  }
});

/**
 * Ограничение для обычных API адресов
 * Максимум 30 запросов за 10 минут с IP
 */
export const addressRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 минут
  max: 30, // максимум 30 запросов с IP за 10 минут
  message: {
    success: false,
    error: {
      message: 'Слишком много запросов к API адресов. Попробуйте через 10 минут.',
      statusCode: 429,
      timestamp: new Date().toISOString()
    }
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Общее ограничение для всех API
 * Максимум 100 запросов за 15 минут с IP
 */
export const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 100, // максимум 100 запросов с IP за 15 минут
  message: {
    success: false,
    error: {
      message: 'Слишком много запросов. Попробуйте позже.',
      statusCode: 429,
      timestamp: new Date().toISOString()
    }
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Постепенное замедление запросов при превышении лимита
 * Начинает замедлять после 5 запросов за минуту
 */
export const speedLimiter: any = slowDown({
  windowMs: 1 * 60 * 1000, // 1 минута
  delayAfter: 5, // начинать замедление после 5 запросов
  delayMs: () => 500, // добавлять 500мс задержки за каждый запрос свыше лимита (новый синтаксис)
  maxDelayMs: 5000, // максимальная задержка 5 секунд
  skipFailedRequests: false,
  skipSuccessfulRequests: false,
  validate: { delayMs: false } // отключаем предупреждение
});

/**
 * Middleware для логирования подозрительной активности
 */
export const suspiciousActivityLogger = (req: any, res: any, next: any) => {
  const ip = req.ip || req.connection.remoteAddress;
  const userAgent = req.get('User-Agent');
  const timestamp = new Date().toISOString();
  
  // Логируем подозрительные паттерны
  if (req.path.includes('/addresses') && req.method === 'GET') {
    console.log(`🚨 Address API Request: ${timestamp} | IP: ${ip} | UA: ${userAgent} | Path: ${req.path}`);
    
    // Проверяем на ботов или автоматизированные запросы
    if (!userAgent || 
        userAgent.includes('bot') || 
        userAgent.includes('crawler') || 
        userAgent.includes('spider') ||
        userAgent.length < 10) {
      console.log(`🤖 Подозрительный User-Agent: ${userAgent}`);
    }
  }
  
  next();
};

/**
 * Middleware для кеширования на уровне HTTP заголовков
 */
export const cacheHeaders = (maxAge: number = 60) => {
  return (req: any, res: any, next: any) => {
    // Кешируем только GET запросы
    if (req.method === 'GET') {
      res.set({
        'Cache-Control': `public, max-age=${maxAge}`,
        'ETag': `W/"${Date.now()}"`,
        'Last-Modified': new Date().toUTCString()
      });
    }
    next();
  };
};
