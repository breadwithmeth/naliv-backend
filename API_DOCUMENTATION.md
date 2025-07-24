# Naliv Backend API Documentation

## Обзор
Документация API для бэкенда системы Naliv - платформы для заказа товаров с доставкой.

**Base URL:** `http://localhost:3000/api`

## Аутентификация

### 1. Регистрация пользователя
```http
POST /auth/register
```

**Body:**
```json
{
  "phone": "+77077707600",
  "password": "password123",
  "name": "Имя пользователя"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "user_id": 123,
      "name": "Имя пользователя",
      "phone": "+77077707600"
    },
    "token": "jwt_token_here"
  }
}
```

### 2. Авторизация пользователя
```http
POST /auth/login
```

**Body:**
```json
{
  "phone": "+77077707600",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "user_id": 123,
      "name": "Имя пользователя",
      "phone": "+77077707600"
    },
    "token": "jwt_token_here"
  }
}
```

### 3. Получение профиля
```http
GET /auth/profile
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user_id": 123,
    "name": "Имя пользователя",
    "phone": "+77077707600",
    "first_name": "Имя",
    "last_name": "Фамилия"
  }
}
```

## Бизнесы

### 1. Получение списка бизнесов
```http
GET /businesses
```

**Query Parameters:**
- `page` (optional): Номер страницы (по умолчанию 1)
- `limit` (optional): Количество элементов на странице (по умолчанию 10)

**Response:**
```json
{
  "success": true,
  "data": {
    "businesses": [
      {
        "business_id": 1,
        "name": "Название магазина",
        "address": "Адрес магазина",
        "description": "Описание",
        "logo": "logo_url",
        "city_id": 1
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 50,
      "totalPages": 5
    }
  }
}
```

### 2. Получение товаров бизнеса
```http
GET /businesses/{business_id}/items
Authorization: Bearer {token}
```

**Query Parameters:**
- `category_id` (optional): Фильтр по категории
- `page` (optional): Номер страницы
- `limit` (optional): Количество элементов на странице

**Response:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "item_id": 100,
        "name": "Название товара",
        "description": "Описание товара",
        "price": 1500.00,
        "img": "image_url",
        "category_id": 5,
        "is_active": 1
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 100,
      "totalPages": 10
    }
  }
}
```

## Категории

### 1. Получение категорий с подкатегориями
```http
GET /categories
```

**Query Parameters:**
- `business_id` (optional): Фильтр по бизнесу

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "category_id": 1,
      "name": "Алкоголь",
      "parent_id": null,
      "items_count": 150,
      "subcategories": [
        {
          "category_id": 2,
          "name": "Пиво",
          "parent_id": 1,
          "items_count": 50,
          "subcategories": []
        }
      ]
    }
  ]
}
```

## Заказы

### 1. Создание заказа
```http
POST /orders
Authorization: Bearer {token}
```

**Body:**
```json
{
  "user_id": 123,
  "business_id": 2,
  "address_id": 456,
  "payment_type_id": 1,
  "items": [
    {
      "item_id": 100,
      "amount": 2,
      "options": [
        {
          "option_item_relation_id": 10,
          "price": 100.00,
          "amount": 1
        }
      ]
    }
  ],
  "bonus": 50,
  "extra": "Комментарий к заказу",
  "delivery_type": "DELIVERY",
  "delivery_date": "2025-07-24T14:00:00.000Z"
}
```

**Delivery Types:**
- `DELIVERY` - Доставка
- `PICKUP` - Самовывоз
- `SCHEDULED` - Запланированная доставка (требует delivery_date)

**Response:**
```json
{
  "success": true,
  "data": {
    "order": {
      "order_id": 789,
      "user_id": 123,
      "business_id": 2,
      "address_id": 456,
      "delivery_price": 500,
      "total_cost": 3500,
      "delivery_type": "DELIVERY",
      "log_timestamp": "2025-07-24T10:30:00.000Z"
    },
    "items": [
      {
        "relation_id": 1001,
        "order_id": 789,
        "item_id": 100,
        "amount": 2,
        "price": 1500.00,
        "marketing_promotion_detail_id": 5
      }
    ],
    "delivery_calculation": {
      "type": "DISTANCE",
      "distance": 2.5,
      "delivery_cost": 500,
      "coordinates": {
        "lat": 52.271643,
        "lon": 76.950011
      }
    },
    "promotions_applied": [
      {
        "item_id": 100,
        "promotion_type": "SUBTRACT",
        "original_amount": 2,
        "charged_amount": 1,
        "discount_amount": 1500.00
      }
    ]
  }
}
```

### 2. Получение заказа по ID
```http
GET /orders/{order_id}
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "order": {
      "order_id": 789,
      "user_id": 123,
      "business_id": 2,
      "delivery_price": 500,
      "delivery_type": "DELIVERY",
      "log_timestamp": "2025-07-24T10:30:00.000Z"
    },
    "items": [
      {
        "relation_id": 1001,
        "item_id": 100,
        "amount": 2,
        "price": 1500.00,
        "item_name": "Название товара",
        "item_code": "ITEM100",
        "marketing_promotion_detail_id": 5,
        "promotion_detail": {
          "detail_id": 5,
          "type": "SUBTRACT",
          "base_amount": 2,
          "add_amount": 1,
          "name": "Акция 2+1"
        }
      }
    ],
    "business": {
      "id": 2,
      "name": "Название магазина",
      "address": "Адрес магазина"
    },
    "user": {
      "id": 123,
      "name": "Имя пользователя",
      "phone": "+77077707600"
    },
    "status": {
      "status": 1,
      "isCanceled": 0,
      "log_timestamp": "2025-07-24T10:35:00.000Z"
    },
    "cost": {
      "cost": 3000,
      "service_fee": 0,
      "delivery": 500
    }
  }
}
```

### 3. Получение заказов пользователя
```http
GET /orders
Authorization: Bearer {token}
```

**Query Parameters:**
- `page` (optional): Номер страницы
- `limit` (optional): Количество элементов на странице

**Response:**
```json
{
  "success": true,
  "data": {
    "orders": [
      {
        "order_id": 789,
        "business_id": 2,
        "delivery_price": 500,
        "log_timestamp": "2025-07-24T10:30:00.000Z",
        "business": {
          "id": 2,
          "name": "Название магазина",
          "address": "Адрес магазина",
          "logo": "logo_url"
        },
        "status": {
          "status": 1,
          "isCanceled": 0,
          "log_timestamp": "2025-07-24T10:35:00.000Z"
        },
        "cost": {
          "cost": 3000,
          "service_fee": 0,
          "delivery": 500
        },
        "itemsCount": 2
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 25,
      "totalPages": 3
    }
  }
}
```

### 4. Обновление статуса заказа
```http
PATCH /orders/{order_id}/status
Authorization: Bearer {employee_token}
```

**Body:**
```json
{
  "status": 1,
  "isCanceled": false
}
```

**Order Statuses:**
- `0` - Новый
- `1` - Принят магазином
- `2` - Собран
- `3` - Отдан курьеру
- `4` - Доставлен
- `7` - Отменен
- `66` - Не оплачен

## Пользователи

### 1. Поиск пользователей (только для сотрудников)
```http
GET /users/search
Authorization: Bearer {employee_token}
```

**Query Parameters:**
- `phone`: Номер телефона для поиска (обязательный)

**Response:**
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "user_id": 123,
        "name": "Имя пользователя",
        "phone": "+77077707600",
        "first_name": "Имя",
        "last_name": "Фамилия"
      }
    ]
  }
}
```

## Сотрудники

### 1. Авторизация сотрудника
```http
POST /employee/auth/login
```

**Body:**
```json
{
  "login": "employee_login",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "employee": {
      "employee_id": 456,
      "name": "Имя сотрудника",
      "login": "employee_login",
      "role": "OPERATOR",
      "business_id": 2
    },
    "token": "jwt_token_here"
  }
}
```

**Employee Roles:**
- `OPERATOR` - Оператор
- `MANAGER` - Менеджер  
- `ADMIN` - Администратор

### 2. Получение заказов для сотрудника
```http
GET /employee/orders
Authorization: Bearer {employee_token}
```

**Query Parameters:**
- `status` (optional): Фильтр по статусу заказа
- `page` (optional): Номер страницы
- `limit` (optional): Количество элементов на странице

## Доставка

### 1. Расчет стоимости доставки
```http
POST /delivery/calculate
```

**Body:**
```json
{
  "business_id": 2,
  "lat": 52.271643,
  "lon": 76.950011
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "delivery_type": "DISTANCE",
    "distance": 2.5,
    "delivery_cost": 500,
    "zone_name": "Зона 1",
    "coordinates": {
      "lat": 52.271643,
      "lon": 76.950011
    }
  }
}
```

**Delivery Types:**
- `DISTANCE` - Расчет по расстоянию
- `AREA` - Расчет по зонам доставки
- `YANDEX` - Расчет через Яндекс API (fallback)

## Коды ошибок

### HTTP Status Codes
- `200` - Успешный запрос
- `201` - Ресурс создан
- `400` - Неверный запрос
- `401` - Не авторизован
- `403` - Доступ запрещен
- `404` - Ресурс не найден
- `409` - Конфликт (например, пользователь уже существует)
- `500` - Внутренняя ошибка сервера

### Формат ошибок
```json
{
  "error": {
    "message": "Описание ошибки",
    "statusCode": 400,
    "timestamp": "2025-07-24T10:30:00.000Z",
    "path": "/api/orders",
    "method": "POST"
  }
}
```

## Особенности

### Аутентификация
- Используется JWT токены
- Токен передается в заголовке `Authorization: Bearer {token}`
- Время жизни токена: 24 часа

### Пагинация
Стандартные параметры для всех списков:
- `page` - номер страницы (начинается с 1)
- `limit` - количество элементов (по умолчанию 10, максимум 100)

### Акции и скидки
- Акции применяются автоматически при создании заказа
- Поддерживаются типы: `SUBTRACT` (N+M) и `DISCOUNT` (процентная скидка)
- ID примененной акции сохраняется в `marketing_promotion_detail_id`

### Координаты для доставки
- Координаты берутся из таблицы `user_addresses` по `address_id`
- Пользователь не может задать стоимость доставки вручную
- Стоимость рассчитывается автоматически по координатам адреса

### Валидация
- Все даты в формате ISO 8601
- Номера телефонов в международном формате (+7...)
- Денежные суммы в копейках (для избежания проблем с плавающей точкой)
