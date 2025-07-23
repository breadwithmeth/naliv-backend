# Naliv Backend API

TypeScript backend API для системы доставки товаров с поддержкой MySQL через Prisma ORM.

## 🚀 Быстрый старт

### Предварительные требования
- Node.js 18+
- MySQL 8.0+
- npm или yarn

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
