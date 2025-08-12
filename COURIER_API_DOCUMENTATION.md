# Courier API Documentation

## Базовая информация
- **Базовый URL**: `/api/courier`
- **Авторизация**: Bearer токен (получается через `/api/courier/auth/login`)
- **Формат ответов**: JSON

## Аутентификация

### Регистрация курьера
```http
POST /api/courier/auth/register
Content-Type: application/json

{
  "login": "courier_1",
  "password": "StrongPass123",
  "full_name": "Иван Петров",
  "name": "Иван",
  "courier_type": 1
}
```

**Ответ 201:**
```json
{
  "success": true,
  "data": {
    "courier": {
      "courier_id": 12,
      "login": "courier_1",
      "full_name": "Иван Петров",
      "name": "Иван",
      "courier_type": 1
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  },
  "message": "Курьер успешно зарегистрирован"
}
```

### Вход курьера
```http
POST /api/courier/auth/login
Content-Type: application/json

{
  "login": "courier_1",
  "password": "StrongPass123"
}
```

**Ответ 200:**
```json
{
  "success": true,
  "data": {
    "courier": {
      "courier_id": 12,
      "login": "courier_1",
      "full_name": "Иван Петров",
      "name": "Иван",
      "courier_type": 1
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  },
  "message": "Авторизация успешна"
}
```

### Профиль курьера
```http
GET /api/courier/auth/profile
Authorization: Bearer <token>
```

### Смена пароля
```http
PUT /api/courier/auth/change-password
Authorization: Bearer <token>
Content-Type: application/json

{
  "currentPassword": "OldPass123",
  "newPassword": "NewPass456"
}
```

### Выход
```http
POST /api/courier/auth/logout
Authorization: Bearer <token>
```

## Основные методы курьера

### Геолокация курьера

#### Сохранение геолокации курьера
```http
POST /api/courier/location
Authorization: Bearer <token>
Content-Type: application/json

{
  "lat": 43.256649,
  "lon": 76.945465
}
```

**Ответ 200:**
```json
{
  "success": true,
  "data": {
    "courier_id": 12,
    "location": {
      "lat": 43.256649,
      "lon": 76.945465
    },
    "updated_at": "2025-08-11T14:30:00Z"
  },
  "message": "Местоположение курьера обновлено"
}
```

**Возможные ошибки:**
- **400** - Некорректные координаты (широта: -90 до 90, долгота: -180 до 180)
- **401** - Требуется авторизация
- **500** - Ошибка сохранения в базе данных

#### Получение текущей геолокации курьера
```http
GET /api/courier/location
Authorization: Bearer <token>
```

**Ответ 200 (геолокация найдена):**
```json
{
  "success": true,
  "data": {
    "courier_id": 12,
    "location": {
      "lat": 43.256649,
      "lon": 76.945465
    },
    "last_updated": "2025-08-11T14:30:00Z"
  },
  "message": "Текущее местоположение курьера"
}
```

**Ответ 404 (геолокация не найдена):**
```json
{
  "success": false,
  "data": null,
  "message": "Местоположение курьера не найдено"
}
```

### Получение списка городов
```http
GET /api/courier/cities
Authorization: Bearer <token>
```

**Ответ 200:**
```json
{
  "success": true,
  "data": {
    "cities": [
      { "city_id": 1, "name": "Алматы" },
      { "city_id": 2, "name": "Нур-Султан" },
      { "city_id": 3, "name": "Шымкент" }
    ],
    "total": 3
  },
  "message": "Найдено 3 городов"
}
```

### Поиск заказа по ID
```http
GET /api/courier/orders/:id
Authorization: Bearer <token>
```

**Ответ 200:**
```json
{
  "success": true,
  "data": {
    "order": {
      "order_id": 123,
      "order_uuid": "uuid-string",
      "user": {
        "user_id": 1,
        "name": "Иван Иванов"
      },
      "business": {
        "business_id": 5,
        "name": "Магазин продуктов",
        "address": "ул. Абая 123",
        "city": 1,
        "coordinates": {
          "lat": 43.238949,
          "lon": 76.889709
        }
      },
      "delivery_address": {
        "address_id": 10,
        "name": "Дом",
        "address": "ул. Достык 456",
        "coordinates": {
          "lat": 43.238949,
          "lon": 76.889709
        },
        "details": {
          "apartment": "12",
          "entrance": "2",
          "floor": "3",
          "comment": "Домофон 12"
        }
      },
      "current_status": {
        "status": 2,
        "status_name": "Готов к выдаче",
        "timestamp": "2025-08-09T10:30:00Z",
        "isCanceled": 0
      },
      "status_history": [
        {
          "status_id": 1,
          "status": 2,
          "status_name": "Готов к выдаче",
          "timestamp": "2025-08-09T10:30:00Z",
          "isCanceled": 0
        },
        {
          "status_id": 2,
          "status": 1,
          "status_name": "Принят магазином",
          "timestamp": "2025-08-09T10:00:00Z",
          "isCanceled": 0
        }
      ],
      "items": [
        {
          "relation_id": 1,
          "item_id": 100,
          "name": "Хлеб белый",
          "description": "Свежий хлеб",
          "amount": 2,
          "price": 150,
          "unit": "шт",
          "total_cost": 300
        }
      ],
      "items_count": 2,
      "cost_summary": {
        "items_total": 300,
        "delivery_price": 500,
        "service_fee": 50,
        "bonus_used": 0,
        "subtotal": 300,
        "total_sum": 850
      },
      "delivery_type": 1,
      "delivery_date": "2025-08-09T15:00:00Z",
      "payment_type": {
        "payment_type_id": 1,
        "name": "Картой онлайн"
      },
      "created_at": "2025-08-09T09:00:00Z"
    }
  },
  "message": "Заказ #123 получен"
}
```

### Получение доступных заказов для доставки
```http
GET /api/courier/orders/available?city=1&page=1&limit=20
Authorization: Bearer <token>
```

**Параметры запроса:**
- `city` (обязательный) - ID города (из таблицы cities)
- `page` (опциональный) - номер страницы (по умолчанию 1)
- `limit` (опциональный) - количество заказов на страницу (по умолчанию 20, максимум 100)

**Ответ 200:**
```json
{
  "success": true,
  "data": {
    "orders": [
      {
        "order_id": 123,
        "order_uuid": "uuid-string",
        "business": {
          "business_id": 5,
          "name": "Магазин продуктов",
          "address": "ул. Абая 123",
          "coordinates": {
            "lat": 43.238949,
            "lon": 76.889709
          }
        },
        "user": {
          "user_id": 1,
          "name": "Иван Иванов"
        },
        "delivery_address": {
          "address_id": 10,
          "name": "Дом",
          "address": "ул. Достык 456",
          "coordinates": {
            "lat": 43.238949,
            "lon": 76.889709
          },
          "details": {
            "apartment": "12",
            "entrance": "2",
            "floor": "3",
            "comment": "Домофон 12"
          }
        },
        "delivery_price": 500,
        "total_cost": 850,
        "delivery_date": "2025-08-09T15:00:00Z",
        "created_at": "2025-08-09T09:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 5,
      "totalPages": 1,
      "hasNext": false,
      "hasPrev": false
    },
    "city": 1
  },
  "message": "Найдено 5 доступных заказов для доставки в городе 1"
}
```

### Взятие заказа на доставку
```http
POST /api/courier/orders/:id/take
Authorization: Bearer <token>
```

**Параметры URL:**
- `id` - ID заказа для взятия на доставку

**Ответ 200 (успешно взят):**
```json
{
  "success": true,
  "data": {
    "order_id": 123,
    "courier": {
      "courier_id": 5,
      "login": "courier_1",
      "name": "Иван Петров"
    },
    "new_status": {
      "status": 3,
      "status_name": "Доставляется",
      "timestamp": "2025-08-09T16:30:00Z"
    }
  },
  "message": "Заказ #123 успешно взят на доставку"
}
```

**Возможные ошибки:**
- **400** - Заказ не готов к выдаче или уже взят другим курьером
- **404** - Заказ не найден

### Выдача заказа (завершение доставки)
```http
POST /api/courier/orders/:id/deliver
Authorization: Bearer <token>
```

**Параметры URL:**
- `id` - ID заказа для завершения доставки

**Ответ 200 (успешно доставлен):**
```json
{
  "success": true,
  "data": {
    "order_id": 123,
    "order_uuid": "uuid-string",
    "courier": {
      "courier_id": 5,
      "login": "courier_1",
      "name": "Иван Петров"
    },
    "user": {
      "user_id": 1,
      "name": "Иван Иванов"
    },
    "business": {
      "business_id": 5,
      "name": "Магазин продуктов"
    },
    "new_status": {
      "status": 4,
      "status_name": "Доставлен",
      "timestamp": "2025-08-09T17:00:00Z"
    },
    "delivery_completed_at": "2025-08-09T17:00:00Z"
  },
  "message": "Заказ #123 успешно доставлен"
}
```

**Возможные ошибки:**
- **400** - Заказ не находится в процессе доставки
- **403** - Заказ не назначен вам или уже выполнен другим курьером
- **404** - Заказ не найден

### Получение заказов курьера в процессе доставки
```http
GET /api/courier/orders/my-deliveries?page=1&limit=20
Authorization: Bearer <token>
```

**Параметры запроса:**
- `page` (опциональный) - номер страницы (по умолчанию 1)
- `limit` (опциональный) - количество заказов на страницу (по умолчанию 20, максимум 100)

**Ответ 200:**
```json
{
  "success": true,
  "data": {
    "orders": [
      {
        "order_id": 123,
        "order_uuid": "uuid-string",
        "business": {
          "business_id": 5,
          "name": "Магазин продуктов",
          "address": "ул. Абая 123",
          "coordinates": {
            "lat": 43.238949,
            "lon": 76.889709
          }
        },
        "user": {
          "user_id": 1,
          "name": "Иван Иванов"
        },
        "delivery_address": {
          "address_id": 10,
          "name": "Дом",
          "address": "ул. Назарбаева 456",
          "coordinates": {
            "lat": 43.240000,
            "lon": 76.890000
          },
          "details": {
            "apartment": "12",
            "entrance": "2",
            "floor": "3",
            "comment": "Домофон 123"
          }
        },
        "delivery_price": 500,
        "total_cost": 850,
        "delivery_date": "2025-08-09T15:00:00Z",
        "created_at": "2025-08-09T09:00:00Z",
        "status": {
          "status": 3,
          "status_name": "Доставляется"
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1,
      "totalPages": 1,
      "hasNext": false,
      "hasPrev": false
    }
  },
  "message": "Найдено 1 заказов в процессе доставки"
}
```

## Статусы заказов

| Код | Название | Описание |
|-----|----------|----------|
| 0 | Новый заказ | Заказ только создан |
| 1 | Принят магазином | Магазин подтвердил заказ |
| 2 | Готов к выдаче | Заказ готов для передачи курьеру |
| 3 | Доставляется | Заказ передан курьеру, в процессе доставки |
| 4 | Доставлен | Заказ успешно доставлен |
| 5 | Отменен | Заказ отменен |
| 6 | Ошибка платежа | Проблемы с оплатой |
| 66 | Не оплачен | Заказ не оплачен |

## Коды ошибок

| Код | Описание |
|-----|----------|
| 400 | Некорректные данные запроса |
| 401 | Требуется авторизация курьера |
| 404 | Заказ или ресурс не найден |
| 409 | Конфликт (например, курьер уже существует) |
| 500 | Внутренняя ошибка сервера |

## Примеры использования

### Полный цикл работы курьера:

1. **Регистрация/Вход**
```bash
curl -X POST http://localhost:3000/api/courier/auth/login \
  -H "Content-Type: application/json" \
  -d '{"login":"courier_1","password":"StrongPass123"}'
```

2. **Сохранение геолокации курьера**
```bash
curl -X POST http://localhost:3000/api/courier/location \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"lat":43.256649,"lon":76.945465}'
```

3. **Получение текущей геолокации**
```bash
curl -H "Authorization: Bearer <token>" \
  http://localhost:3000/api/courier/location
```

4. **Получение списка городов**
```bash
curl -H "Authorization: Bearer <token>" \
  http://localhost:3000/api/courier/cities
```

5. **Получение доступных заказов в городе**
```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3000/api/courier/orders/available?city=1"
```

6. **Просмотр детальной информации о заказе**
```bash
curl -H "Authorization: Bearer <token>" \
  http://localhost:3000/api/courier/orders/123
```

7. **Взятие заказа на доставку**
```bash
curl -X POST -H "Authorization: Bearer <token>" \
  http://localhost:3000/api/courier/orders/123/take
```

8. **Выдача заказа (завершение доставки)**
```bash
curl -X POST -H "Authorization: Bearer <token>" \
  http://localhost:3000/api/courier/orders/123/deliver
```

9. **Получение заказов курьера в процессе доставки**
```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3000/api/courier/orders/my-deliveries"
```

## Требования к паролю

- Минимум 6 символов
- Должен содержать буквы и цифры
- Поддерживает кириллицу и латиницу

## Безопасность

- Все пароли хэшируются с помощью bcrypt
- Токены JWT с временем жизни 7 дней (по умолчанию)
- Автоматическая миграция старых паролей при входе
- Проверка токенов в базе данных

## Заметки

- Города загружаются из таблицы `cities` с полями `city_id` и `name`
- Доступные заказы показываются только со статусом "Готов к выдаче" (status: 2)
- Показываются только заказы с типом доставки 1 (доставка курьером)
- Все координаты в формате lat/lon (широта/долгота)
- При поиске заказов используется `city_id` из таблицы `cities`
- **Геолокация курьера:**
  - Координаты хранятся в таблице `courier_location`
  - Широта (lat): от -90 до 90 градусов
  - Долгота (lon): от -180 до 180 градусов
  - Каждый курьер может иметь только одну актуальную геолокацию
  - При сохранении новых координат предыдущие автоматически перезаписываются
  - Поле `updated_at` автоматически обновляется при каждом сохранении
