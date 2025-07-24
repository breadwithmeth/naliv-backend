# Naliv Backend

TypeScript backend для системы заказа товаров с доставкой.

## Технологии

- **Node.js** + **TypeScript**
- **Express.js** - веб-фреймворк
- **Prisma ORM** - работа с базой данных
- **MySQL** - база данных
- **JWT** - аутентификация
- **bcryptjs** - хеширование паролей

## Быстрый старт

### Установка зависимостей
```bash
npm install
```

### Настройка окружения
Создайте файл `.env`:
```env
DATABASE_URL="mysql://username:password@host:port/database"
JWT_SECRET="your-secret-key"
PORT=3000
```

### Генерация Prisma клиента
```bash
npx prisma generate
```

### Запуск в режиме разработки
```bash
npm run dev
```

### Сборка для продакшена
```bash
npm run build
npm start
```

## Документация API

- **[Полная документация API](./API_DOCUMENTATION.md)** - подробное описание всех эндпоинтов
- **[Примеры использования](./API_EXAMPLES.md)** - curl команды и примеры запросов

## Основные возможности

### Пользователи
- ✅ Регистрация и авторизация по номеру телефона
- ✅ JWT аутентификация
- ✅ Профиль пользователя

### Заказы
- ✅ Создание заказов с товарами и опциями
- ✅ Автоматический расчет стоимости доставки
- ✅ Применение маркетинговых акций (SUBTRACT, DISCOUNT)
- ✅ Типы доставки: обычная, запланированная, самовывоз
- ✅ Статусы заказов и их отслеживание
- ✅ Сохранение ID примененных акций

### Сотрудники
- ✅ Отдельная система авторизации для сотрудников
- ✅ Роли: OPERATOR, MANAGER, ADMIN
- ✅ Управление заказами
- ✅ Поиск клиентов по номеру телефона

### Бизнес-логика
- ✅ Управление бизнесами и их товарами
- ✅ Иерархические категории товаров
- ✅ Система доставки с зонами и расчетом по расстоянию
- ✅ Интеграция с Yandex API для расчета доставки
- ✅ Маркетинговые акции с автоматическим применением

## Структура проекта

```
src/
├── controllers/        # Контроллеры (бизнес-логика)
│   ├── authController.ts
│   ├── businessController.ts
│   ├── categoryController.ts
│   ├── deliveryController.ts
│   ├── employeeAuthController.ts
│   ├── orderController.ts
│   ├── userController.ts
│   └── userItemsController.ts
├── middleware/         # Middleware функции
│   ├── auth.ts
│   ├── employeeAuth.ts
│   └── errorHandler.ts
├── routes/            # Маршруты API
│   ├── api.ts
│   ├── auth.ts
│   ├── businesses.ts
│   ├── categories.ts
│   ├── delivery.ts
│   ├── employeeAuth.ts
│   ├── orders.ts
│   └── users.ts
├── types/             # TypeScript типы
│   └── orders.ts
├── app.ts             # Настройка Express приложения
├── database.ts        # Подключение к БД
└── server.ts          # Точка входа
```

## API Endpoints

### Пользователи
- `POST /api/auth/register` - Регистрация
- `POST /api/auth/login` - Авторизация
- `GET /api/auth/profile` - Профиль пользователя

### Бизнесы и товары
- `GET /api/businesses` - Список бизнесов
- `GET /api/businesses/:id/items` - Товары бизнеса
- `GET /api/categories` - Категории с подкатегориями

### Заказы
- `POST /api/orders` - Создание заказа
- `GET /api/orders` - Заказы пользователя
- `GET /api/orders/:id` - Детали заказа
- `PATCH /api/orders/:id/status` - Обновление статуса (для сотрудников)

### Сотрудники
- `POST /api/employee/auth/login` - Авторизация сотрудника
- `GET /api/employee/orders` - Заказы для обработки
- `GET /api/users/search` - Поиск клиентов

### Доставка
- `POST /api/delivery/calculate` - Расчет стоимости доставки

## Особенности системы

### Акции и скидки
Система автоматически применяет маркетинговые акции:
- **SUBTRACT** - акции типа "2+1", "3+2"
- **DISCOUNT** - процентные скидки

ID примененной акции сохраняется в поле `marketing_promotion_detail_id` таблицы `orders_items`.

### Доставка
- Автоматический расчет стоимости по координатам адреса
- Поддержка зон доставки и расчета по расстоянию
- Fallback на Yandex API для расчета маршрутов
- Пользователь не может задать стоимость доставки вручную

### Безопасность
- JWT токены для аутентификации
- Хеширование паролей с bcrypt
- Валидация всех входных данных
- Разделение доступа для пользователей и сотрудников

## Статусы заказов

| Код | Название | Описание |
|-----|----------|----------|
| 0 | Новый | Заказ только создан |
| 1 | Принят | Магазин принял заказ |
| 2 | Собран | Заказ собран |
| 3 | У курьера | Передан курьеру |
| 4 | Доставлен | Заказ доставлен |
| 7 | Отменен | Заказ отменен |
| 66 | Не оплачен | Ожидает оплаты |

## Типы доставки

- **DELIVERY** - Обычная доставка
- **PICKUP** - Самовывоз (стоимость доставки = 0)
- **SCHEDULED** - Запланированная доставка (требует указания времени)

## Разработка

### Добавление новых эндпоинтов
1. Создайте контроллер в `src/controllers/`
2. Добавьте маршруты в `src/routes/`
3. Подключите маршруты в `src/routes/api.ts`
4. Обновите типы в `src/types/`

### Работа с базой данных
Используйте Prisma для работы с БД:
```typescript
import { prisma } from '../database';

const user = await prisma.user.findUnique({
  where: { user_id: 123 }
});
```

### Обработка ошибок
Используйте функцию `createError` для создания ошибок:
```typescript
import { createError } from '../middleware/errorHandler';

if (!user) {
  return next(createError(404, 'Пользователь не найден'));
}
```

### Установка и настройка
```bash
# Установка зависимостей
npm install

# Настройка переменных окружения
cp .env.example .env
# Отредактируйте .env с вашими настройками БД

# Генерация Prisma Client
npm run db:generate

# Синхронизация схемы с БД (для разработки)
npm run db:push

# Запуск в режиме разработки
npm run dev
```

## 📁 Структура проекта

```
src/
├── app.ts                    # Основное приложение Express
├── server.ts                 # Точка входа сервера
├── database.ts               # Конфигурация Prisma
├── controllers/              # Контроллеры API
│   ├── userItemsController.ts # Пользователи и товары
│   └── businessController.ts  # Бизнесы и магазины
├── middleware/               # Middleware функции
│   └── errorHandler.ts      # Обработка ошибок
├── routes/                  # API маршруты
│   ├── api.ts              # Главный API router
│   ├── users.ts           # Маршруты пользователей
│   └── businesses.ts      # Маршруты бизнесов
└── types/                 # TypeScript типы
```

## 🛠 Доступные команды

```bash
# Разработка
npm run dev          # Запуск с автоперезагрузкой
npm run build        # Сборка проекта
npm run build:watch  # Сборка с отслеживанием изменений

# Продакшн
npm start            # Запуск собранного приложения
npm run clean        # Очистка папки dist

# База данных
npm run db:generate  # Генерация Prisma Client
npm run db:push      # Отправка схемы в БД
npm run db:migrate   # Создание миграций
npm run db:studio    # Открытие Prisma Studio

# Утилиты
npm run lint         # Линтинг кода (TODO)
npm test            # Запуск тестов (TODO)
```

## 🌐 API Endpoints

### Базовые маршруты
- `GET /health` - Проверка состояния сервера
- `GET /api` - Информация об API

### Пользователи (`/api/users`)

#### Основные операции с пользователями
- `GET /api/users` - Получить всех пользователей
- `GET /api/users/:id` - Получить пользователя по ID
- `POST /api/users` - Создать нового пользователя

#### Товары для пользователей
- `GET /api/users/:userId/items/business/:businessId` - Получить товары пользователя по бизнесу
  - Query параметры: `?page=1&limit=20&categoryId=123&search=молоко`

#### Избранные товары
- `GET /api/users/:userId/liked-items` - Получить избранные товары пользователя
  - Query параметры: `?page=1&limit=20`
- `POST /api/users/:userId/liked-items` - Добавить товар в избранное
  - Body: `{ "item_id": 123 }`
- `DELETE /api/users/:userId/liked-items/:itemId` - Удалить товар из избранного

### Бизнесы (`/api/businesses`)

#### Операции с бизнесами
- `GET /api/businesses` - Получить все бизнесы
  - Query параметры: `?page=1&limit=20&city_id=1&search=магазин`
- `GET /api/businesses/:id` - Получить бизнес по ID

#### Товары и категории бизнеса
- `GET /api/businesses/:businessId/items` - Получить все товары бизнеса
  - Query параметры: `?page=1&limit=20&categoryId=123&search=молоко&inStock=true`
- `GET /api/businesses/:businessId/categories` - Получить категории товаров бизнеса

## 📊 Структура ответов API

### Успешный ответ
```json
{
  "success": true,
  "data": {
    // Данные
  },
  "message": "Описание операции",
  "pagination": {  // Для списков с пагинацией
    "current_page": 1,
    "per_page": 20,
    "total": 100,
    "total_pages": 5
  }
}
```

### Ошибка
```json
{
  "error": {
    "message": "Описание ошибки",
    "statusCode": 400,
    "timestamp": "2025-01-01T00:00:00.000Z",
    "path": "/api/users",
    "method": "GET"
  }
}
```

## �️ База данных

Проект использует MySQL с Prisma ORM на основе существующей схемы базы данных системы доставки.

### Примеры запросов

#### Получить товары магазина с фильтрацией
```bash
GET /api/users/1/items/business/5?page=1&limit=10&categoryId=2&search=молоко
```

#### Добавить товар в избранное
```bash
POST /api/users/1/liked-items
Content-Type: application/json

{
  "item_id": 123
}
```

#### Получить бизнесы в городе
```bash
GET /api/businesses?city_id=1&page=1&limit=20
```

## � Конфигурация

### Переменные окружения (.env)
```env
# Сервер
PORT=3000
NODE_ENV=development

# База данных MySQL
DATABASE_URL="mysql://shrvsets:0T86663dju35@67.205.143.36:3306/naliv"

# CORS
CORS_ORIGIN=http://localhost:3000
```
