/**
 * КРИТИЧЕСКИ ВАЖНЫЕ ОПТИМИЗАЦИИ ДЛЯ УСТРАНЕНИЯ СПАМА ЗАПРОСОВ
 * Этот файл содержит документацию об оптимизациях производительности
 * адресного API для предотвращения серверной перегрузки
 */

# Проблема производительности API адресов

## Обнаруженная проблема
Из логов сервера видно МАССОВЫЙ спам запросов к `/api/addresses`:
- Тысячи GET /api/addresses запросов в минуту
- Запросы идут с интервалом в несколько миллисекунд
- Сервер перегружен и не справляется с нагрузкой
- Время ответа `/api/addresses/user/with-delivery` критически медленное

## Реализованные решения

### 1. Rate Limiting (Ограничение запросов)

```typescript
// src/middleware/rateLimiter.ts
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
  }
});

export const addressRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 минут
  max: 30, // максимум 30 запросов с IP за 10 минут
});

export const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 100, // максимум 100 запросов с IP за 15 минут
});
```

### 2. Прогрессивное замедление

```typescript
export const speedLimiter = slowDown({
  windowMs: 1 * 60 * 1000, // 1 минута
  delayAfter: 5, // начинать замедление после 5 запросов
  delayMs: 500, // добавлять 500мс задержки за каждый запрос свыше лимита
  maxDelayMs: 5000, // максимальная задержка 5 секунд
});
```

### 3. Многоуровневое кеширование

```typescript
// В addressController.ts
const deliveryCache = new Map<string, any>();
const addressCache = new Map<string, any>(); 
const CACHE_TTL = 5 * 60 * 1000; // 5 минут
const ADDRESS_CACHE_TTL = 2 * 60 * 1000; // 2 минуты

// HTTP кеширование
export const cacheHeaders = (maxAge: number = 60) => {
  return (req: any, res: any, next: any) => {
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
```

### 4. Контроль одновременных запросов

```typescript
let activeDeliveryRequests = 0;
const MAX_CONCURRENT_DELIVERY_REQUESTS = 5;

// В getUserAddressesWithDelivery
if (activeDeliveryRequests >= MAX_CONCURRENT_DELIVERY_REQUESTS) {
  return next(createError(503, 'Сервер перегружен запросами доставки.'));
}
```

### 5. Мониторинг подозрительной активности

```typescript
export const suspiciousActivityLogger = (req: any, res: any, next: any) => {
  const ip = req.ip || req.connection.remoteAddress;
  const userAgent = req.get('User-Agent');
  
  if (req.path.includes('/addresses') && req.method === 'GET') {
    console.log(`🚨 Address API Request: ${timestamp} | IP: ${ip} | UA: ${userAgent}`);
    
    // Проверяем на ботов или автоматизированные запросы
    if (!userAgent || 
        userAgent.includes('bot') || 
        userAgent.includes('crawler') || 
        userAgent.length < 10) {
      console.log(`🤖 Подозрительный User-Agent: ${userAgent}`);
    }
  }
  
  next();
};
```

## Применение middleware к маршрутам

```typescript
// src/routes/addresses.ts
router.get('/user/with-delivery', 
  deliveryRateLimit, // жесткое ограничение 10 запросов за 5 минут
  speedLimiter, 
  authenticateToken, 
  cacheHeaders(120), // кеш на 2 минуты
  AddressController.getUserAddressesWithDelivery
);

router.get('/user', 
  addressRateLimit, 
  speedLimiter, 
  authenticateToken, 
  cacheHeaders(60), // кеш на 1 минуту
  AddressController.getUserAddresses
);
```

## Ожидаемые результаты

1. **Защита от спама**: Максимум 10 запросов к критическому эндпоинту за 5 минут
2. **Кеширование**: Повторные запросы отвечают из кеша за 1-2мс
3. **Контроль нагрузки**: Максимум 5 одновременных расчетов доставки
4. **Мониторинг**: Логирование подозрительных паттернов запросов
5. **Производительность**: Время ответа снижено с секунд до миллисекунд

## Мониторинг

Для отслеживания эффективности добавлены логи:
- `🚨 Address API Request` - каждый запрос к адресам
- `🤖 Подозрительный User-Agent` - автоматизированные запросы
- `🚀 Используем кеш` - попадания в кеш
- `⚡ Запрос выполнен за Xмс` - время выполнения
- `🚫 Превышен лимит` - блокированные запросы

## Следующие шаги

1. Мониторинг логов на предмет снижения спама
2. Настройка алертов при превышении лимитов
3. Анализ источников спама (возможно, зацикленный frontend код)
4. Дополнительная оптимизация запросов к базе данных
