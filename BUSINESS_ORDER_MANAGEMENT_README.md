# Business Order Management System

## Обзор

Система управления заказами для бизнеса предоставляет API для просмотра, управления и анализа заказов. Система включает аутентификацию через токены бизнеса и полный набор функций для работы с заказами.

## Архитектура

### Компоненты системы

1. **Middleware аутентификации** (`businessAuth.ts`)
2. **Контроллер заказов** (`businessOrderController.ts`) 
3. **Маршруты API** (`businessOrderRoutes.ts`)
4. **Документация и тесты**

### Структура файлов

```
src/
├── middleware/
│   └── businessAuth.ts           # Аутентификация бизнеса
├── controllers/
│   └── businessOrderController.ts # Логика управления заказами
├── routes/
│   └── businessOrderRoutes.ts    # API маршруты
└── types/                        # TypeScript типы
```

## Аутентификация

### Middleware аутентификации

Система использует токены из таблицы `businesses.token` для аутентификации.

**Файл:** `src/middleware/businessAuth.ts`

#### Функции:

1. **`authenticateBusinessToken`** - Основная функция аутентификации
   - Проверяет наличие токена в заголовке `Authorization`
   - Ищет бизнес по токену в БД
   - Добавляет информацию о бизнесе в `req.business`

2. **`authenticateBusiness`** - Альтернативная аутентификация по ID
3. **`optionalBusinessAuth`** - Опциональная аутентификация
4. **`requireBusinessAccess`** - Проверка доступа к конкретному бизнесу

#### Пример использования:

```typescript
import { authenticateBusinessToken } from '../middleware/businessAuth';

// Применение ко всем маршрутам
router.use(authenticateBusinessToken);
```

### Интерфейс запроса

```typescript
interface BusinessAuthRequest extends Request {
  business?: {
    business_id: number;
    name: string;
    city_id: number;
    token: string;
    // ... другие поля
  };
}
```

## API Контроллер

### Файл: `src/controllers/businessOrderController.ts`

#### Основные методы:

### 1. `getBusinessOrders`
**Назначение:** Получение списка заказов бизнеса с пагинацией и фильтрацией

**Параметры запроса:**
- `page` (number) - номер страницы (по умолчанию: 1)
- `limit` (number) - количество заказов на странице (максимум: 100, по умолчанию: 20)
- `date_from` (string) - дата начала фильтра (ISO format)
- `date_to` (string) - дата окончания фильтра (ISO format)

**Логика работы:**
1. Проверка аутентификации бизнеса
2. Валидация и обработка параметров запроса
3. Формирование условий фильтрации
4. Параллельное получение данных:
   - Основная информация о заказах
   - Данные пользователей
   - Адреса доставки
   - Статусы заказов (последние)
   - Товары заказов
   - Стоимость заказов
   - Типы оплаты
5. Формирование ответа с полной информацией

**Особенности реализации:**
- Использует Map для быстрого доступа к связанным данным
- Применяет raw SQL для получения последних статусов заказов
- Обрабатывает Decimal типы из Prisma

### 2. `updateOrderStatus`
**Назначение:** Обновление статуса заказа

**Параметры:**
- `id` (path parameter) - ID заказа
- `status` (body) - новый статус (число от 1 до 7)

**Статусы заказов:**
- `1` - Новый заказ
- `2` - Принят
- `3` - Готовится
- `4` - Готов к доставке
- `5` - Доставляется
- `6` - Отменен
- `7` - Доставлен

**Логика работы:**
1. Валидация параметров
2. Проверка принадлежности заказа бизнесу
3. Создание новой записи в `order_status`
4. Автоматическая установка флага `isCanceled` для статуса 6

### 3. `getOrderStats`
**Назначение:** Получение статистики заказов

**Параметры запроса:**
- `date_from` (string) - дата начала периода
- `date_to` (string) - дата окончания периода

**Возвращаемые данные:**
- Общее количество заказов
- Общая выручка
- Сумма сервисных сборов
- Статистика по статусам
- Информация о периоде

**Логика работы:**
1. Формирование условий фильтрации по дате
2. Параллельное выполнение запросов:
   - Подсчет общего количества заказов
   - Агрегация выручки из `orders_cost`
   - Группировка по статусам с использованием оконных функций SQL
3. Форматирование результатов

### 4. `getStatusName`
**Назначение:** Получение человекочитаемого названия статуса

**Параметры:**
- `status` (number) - код статуса

**Возвращает:** Строку с названием статуса на русском языке

## Маршруты API

### Файл: `src/routes/businessOrderRoutes.ts`

#### Структура маршрутов:

```typescript
// Базовый путь: /api/business

// Применение аутентификации ко всем маршрутам
router.use(authenticateBusinessToken);

// GET /api/business/orders/stats - Статистика (должно быть выше :id)
router.get('/orders/stats', BusinessOrderController.getOrderStats);

// GET /api/business/orders - Список заказов
router.get('/orders', BusinessOrderController.getBusinessOrders);

// PATCH /api/business/orders/:id/status - Обновление статуса
router.patch('/orders/:id/status', BusinessOrderController.updateOrderStatus);
```

#### Подключение к основному приложению:

В файле `src/routes/api.ts`:
```typescript
import { businessOrderRoutes } from './businessOrderRoutes';

router.use('/business', businessOrderRoutes);
```

## База данных

### Используемые таблицы:

#### 1. `businesses`
- **Назначение:** Хранение информации о бизнесах
- **Ключевые поля:**
  - `business_id` - ID бизнеса
  - `name` - название бизнеса
  - `token` - токен для аутентификации
  - `city_id` - ID города

#### 2. `orders`
- **Назначение:** Основная информация о заказах
- **Ключевые поля:**
  - `order_id` - ID заказа
  - `order_uuid` - UUID заказа
  - `business_id` - ID бизнеса
  - `user_id` - ID пользователя
  - `address_id` - ID адреса доставки
  - `delivery_type` - тип доставки
  - `delivery_price` - стоимость доставки
  - `payment_type_id` - ID типа оплаты
  - `log_timestamp` - время создания заказа

#### 3. `order_status`
- **Назначение:** История статусов заказов
- **Ключевые поля:**
  - `order_id` - ID заказа
  - `status` - код статуса
  - `isCanceled` - флаг отмены
  - `log_timestamp` - время установки статуса

#### 4. `orders_cost`
- **Назначение:** Стоимость заказов
- **Ключевые поля:**
  - `order_id` - ID заказа
  - `cost` - стоимость товаров (Decimal)
  - `service_fee` - сервисный сбор (Decimal)

#### 5. `orders_items`
- **Назначение:** Товары в заказах
- **Ключевые поля:**
  - `order_item_id` - ID позиции
  - `order_id` - ID заказа
  - `item_id` - ID товара
  - `amount` - количество
  - `price` - цена (Decimal)

#### 6. `user`
- **Назначение:** Информация о пользователях
- **Ключевые поля:**
  - `user_id` - ID пользователя
  - `name` - имя
  - `first_name` - имя
  - `last_name` - фамилия
  - `phone` - телефон

#### 7. `user_addreses`
- **Назначение:** Адреса пользователей
- **Ключевые поля:**
  - `address_id` - ID адреса
  - `name` - название адреса
  - `address` - текст адреса
  - `lat`, `lon` - координаты
  - `apartment`, `entrance`, `floor` - детали
  - `other` - комментарий

#### 8. `payment_types`
- **Назначение:** Типы оплаты
- **Ключевые поля:**
  - `payment_type_id` - ID типа
  - `name` - название типа оплаты

### Особенности работы с БД:

#### Prisma без отношений
В схеме Prisma отсутствуют определенные отношения между таблицами, поэтому:
- Используются отдельные запросы вместо `include`
- Применяются Map структуры для объединения данных
- Raw SQL запросы для сложных операций

#### Обработка типов Decimal
```typescript
// Преобразование Decimal в number
cost: cost ? Number(cost.cost) : 0,
service_fee: cost ? Number(cost.service_fee) : 0,
```

## API Документация

### Базовый URL
```
/api/business
```

### Аутентификация
Все запросы требуют заголовок:
```
Authorization: Bearer <business_token>
```

### Эндпоинты

#### 1. GET `/orders`
**Описание:** Получение списка заказов бизнеса

**Query параметры:**
- `page` (number, optional) - номер страницы
- `limit` (number, optional) - размер страницы (макс. 100)
- `date_from` (string, optional) - дата начала (ISO)
- `date_to` (string, optional) - дата окончания (ISO)

**Пример запроса:**
```bash
GET /api/business/orders?page=1&limit=10&date_from=2024-01-01
Authorization: Bearer business_token_here
```

**Пример ответа:**
```json
{
  "success": true,
  "data": {
    "orders": [
      {
        "order_id": 123,
        "order_uuid": "123456789",
        "user": {
          "user_id": 252,
          "name": "Иван Иванов"
        },
        "delivery_address": {
          "address_id": 45,
          "name": "Дом",
          "address": "ул. Пушкина, 12",
          "coordinates": { "lat": 43.2220, "lon": 76.8512 },
          "details": {
            "apartment": "25",
            "entrance": "2",
            "floor": "5",
            "comment": "Код домофона 123"
          }
        },
        "delivery_type": "delivery",
        "delivery_price": 500,
        "cost": 2500,
        "service_fee": 250,
        "total_cost": 3250,
        "payment_type": {
          "payment_type_id": 1,
          "name": "Наличные"
        },
        "current_status": {
          "status": 2,
          "status_name": "Принят",
          "timestamp": "2024-01-15T10:30:00.000Z",
          "isCanceled": 0
        },
        "items_count": 5,
        "extra": null,
        "delivery_date": "2024-01-15T15:00:00.000Z",
        "log_timestamp": "2024-01-15T10:00:00.000Z",
        "bonus": 0
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 25,
      "totalPages": 3,
      "hasNext": true,
      "hasPrev": false
    },
    "business": {
      "business_id": 1,
      "name": "Магазин продуктов"
    }
  },
  "message": "Найдено 25 заказов для бизнеса"
}
```

#### 2. PATCH `/orders/:id/status`
**Описание:** Обновление статуса заказа

**Path параметры:**
- `id` (number) - ID заказа

**Body:**
```json
{
  "status": 3
}
```

**Пример запроса:**
```bash
PATCH /api/business/orders/123/status
Authorization: Bearer business_token_here
Content-Type: application/json

{
  "status": 3
}
```

**Пример ответа:**
```json
{
  "success": true,
  "data": {
    "order_id": 123,
    "new_status": {
      "status": 3,
      "status_name": "Готовится",
      "timestamp": "2024-01-15T11:00:00.000Z",
      "isCanceled": 0
    },
    "business": {
      "business_id": 1,
      "name": "Магазин продуктов"
    }
  },
  "message": "Статус заказа обновлен на \"Готовится\""
}
```

#### 3. GET `/orders/stats`
**Описание:** Получение статистики заказов

**Query параметры:**
- `date_from` (string, optional) - дата начала периода
- `date_to` (string, optional) - дата окончания периода

**Пример запроса:**
```bash
GET /api/business/orders/stats?date_from=2024-01-01&date_to=2024-01-31
Authorization: Bearer business_token_here
```

**Пример ответа:**
```json
{
  "success": true,
  "data": {
    "stats": {
      "total_orders": 150,
      "total_revenue": 450000,
      "total_service_fee": 45000,
      "by_status": [
        {
          "status": 7,
          "status_name": "Доставлен",
          "count": 120
        },
        {
          "status": 6,
          "status_name": "Отменен",
          "count": 15
        }
      ],
      "period": {
        "from": "2024-01-01",
        "to": "2024-01-31"
      }
    },
    "business": {
      "business_id": 1,
      "name": "Магазин продуктов"
    }
  },
  "message": "Статистика заказов получена"
}
```

## Обработка ошибок

### Стандартный формат ошибок
```json
{
  "success": false,
  "error": {
    "message": "Описание ошибки",
    "statusCode": 400,
    "timestamp": "2024-01-15T10:00:00.000Z"
  }
}
```

### Типы ошибок

#### 401 Unauthorized
```json
{
  "success": false,
  "error": "Требуется авторизация бизнеса"
}
```

#### 404 Not Found
```json
{
  "success": false,
  "error": "Заказ не найден или не принадлежит данному бизнесу"
}
```

#### 400 Bad Request
```json
{
  "success": false,
  "error": "Некорректный ID заказа"
}
```

#### 500 Internal Server Error
```json
{
  "success": false,
  "error": "Ошибка сервера"
}
```

## Тестирование

### Тестовый HTML интерфейс
Файл: `test-business-order-api.html`

**Функциональность:**
- Настройка подключения к API
- Тестирование аутентификации
- Получение списка заказов с фильтрацией
- Обновление статусов заказов
- Просмотр статистики
- Интерактивное управление статусами

**Запуск:**
1. Откройте файл в браузере
2. Введите URL API и токен бизнеса
3. Используйте кнопки для тестирования функций

### Примеры использования

#### JavaScript/Fetch
```javascript
// Получение заказов
const getOrders = async (token, page = 1) => {
  const response = await fetch(`/api/business/orders?page=${page}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return await response.json();
};

// Обновление статуса
const updateStatus = async (token, orderId, status) => {
  const response = await fetch(`/api/business/orders/${orderId}/status`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ status })
  });
  return await response.json();
};
```

#### Python/Requests
```python
import requests

def get_orders(token, page=1):
    headers = {'Authorization': f'Bearer {token}'}
    response = requests.get(f'/api/business/orders?page={page}', headers=headers)
    return response.json()

def update_order_status(token, order_id, status):
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }
    data = {'status': status}
    response = requests.patch(f'/api/business/orders/{order_id}/status', 
                            headers=headers, json=data)
    return response.json()
```

## Производительность

### Оптимизации

1. **Параллельные запросы**
   - Использование `Promise.all()` для одновременного получения данных
   - Уменьшение времени ответа API

2. **Map структуры**
   - Быстрый поиск связанных данных
   - O(1) доступ к элементам

3. **Пагинация**
   - Ограничение количества записей
   - Максимум 100 заказов за запрос

4. **SQL оптимизации**
   - Использование оконных функций для получения последних статусов
   - Индексы на часто используемых полях

### Рекомендации по масштабированию

1. **Кэширование**
   - Redis для кэширования статистики
   - Кэширование справочников (статусы, типы оплаты)

2. **Индексы БД**
   ```sql
   -- Индексы для производительности
   CREATE INDEX idx_orders_business_timestamp ON orders(business_id, log_timestamp);
   CREATE INDEX idx_order_status_order_timestamp ON order_status(order_id, log_timestamp);
   CREATE INDEX idx_orders_cost_order_id ON orders_cost(order_id);
   ```

3. **Пагинация cursor-based**
   - Для больших объемов данных
   - Более стабильная пагинация

## Безопасность

### Аутентификация
- Токены хранятся в БД в зашифрованном виде
- Проверка принадлежности ресурсов бизнесу
- Автоматический logout при некорректном токене

### Валидация данных
- Проверка типов и диапазонов параметров
- Санитизация входных данных
- Защита от SQL инъекций через Prisma

### Логирование
- Логирование всех действий с заказами
- Сохранение истории изменений статусов
- Мониторинг подозрительной активности

## Развертывание

### Требования
- Node.js 18+
- TypeScript 4.9+
- MySQL 8.0+
- Prisma ORM

### Переменные окружения
```env
DATABASE_URL="mysql://user:password@localhost:3306/naliv"
PORT=3000
NODE_ENV=production
```

### Установка
```bash
# Установка зависимостей
npm install

# Генерация Prisma клиента
npx prisma generate

# Запуск в разработке
npm run dev

# Сборка для продакшена
npm run build

# Запуск в продакшене
npm start
```

## Мониторинг

### Метрики для отслеживания
- Время ответа API
- Количество запросов по эндпоинтам
- Ошибки аутентификации
- Производительность запросов к БД

### Логирование
```typescript
// Пример логирования в контроллере
console.log(`Business ${business_id} requested orders: page=${page}, limit=${limit}`);
console.error('Ошибка получения заказов бизнеса:', error);
```

### Health Check
```typescript
// GET /health
{
  "status": "OK",
  "timestamp": "2024-01-15T10:00:00.000Z",
  "uptime": 3600,
  "database": "connected"
}
```

## Расширения и улучшения

### Планируемый функционал
1. **Фильтрация по статусам**
2. **Экспорт данных в CSV/Excel**
3. **Webhook уведомления о изменении статусов**
4. **Детальная информация о заказе**
5. **Массовое обновление статусов**
6. **Аналитика и отчеты**

### Интеграции
- Push уведомления для мобильных приложений
- Email уведомления
- SMS уведомления
- Интеграция с курьерскими службами

---

**Автор:** Business Order Management System  
**Версия:** 1.0.0  
**Дата:** Август 2025
