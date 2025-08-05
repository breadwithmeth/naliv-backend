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

### 2. Получение товаров акции
```http
GET /api/promotions/{promotionId}/items?limit={limit}&offset={offset}
```
**Path Parameters:**
- `promotionId` (required): ID акции для получения товаров

**Query Parameters:**
- `limit` (optional): Количество записей (по умолчанию 50)
- `offset` (optional): Сдвиг для пагинации (по умолчанию 0)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "item_id": 100,
      "name": "Название товара",
      "description": "Описание товара",
      "price": 1500.00,
      "img": "image_url",
      "category_id": 5,
      "business_id": 2,
      "amount": 10,
      "options": [
        {
          "option_id": 1,
          "name": "Дополнение",
          "required": 0,
          "selection": "multiple",
          "option_items": [
            {
              "relation_id": 10,
              "item_id": 50,
              "price_type": "ABS",
              "price": 100.00,
              "parent_item_amount": 1
            }
          ]
        }
      ],
      "promotion_detail": {
        "detail_id": 5,
        "type": "SUBTRACT",
        "base_amount": 2,
        "add_amount": 1,
        "discount": null
      }
    }
  ],
  "message": "Товары акции получены"
}
```  
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

### 2. Получение товаров категории (включая подкатегории)
```http
GET /categories/{category_id}/items
```

**Query Parameters:**
- `business_id` (обязательный): ID бизнеса

### 3. Получение суперкатегорий с вложенными категориями
```http
GET /categories/supercategories
```

**Response:**
```json
{
  "success": true,
  "data": {
    "supercategories": [
      {
        "supercategory_id": 1,
        "name": "Напитки",
        "description": "Различные напитки",
        "log_timestamp": "2025-08-01T12:00:00Z",
        "categories": [
          {
            "category_id": 10,
            "name": "Соки",
            "photo": null,
            "img": "sok.jpg",
            "visible": 1,
            "subcategories": [
              {
                "category_id": 11,
                "name": "Фруктовые",
                "photo": null,
                "img": "fruit.jpg",
                "visible": 1
              }
            ]
          }
        ]
      }
    ]
  },
  "message": "Суперкатегории получены успешно"
}
``` 
- `page` (optional): Номер страницы (по умолчанию 1)
- `limit` (optional): Количество товаров на странице (по умолчанию 20)

**Response:**
```json
{
  "success": true,
  "data": {
    "category": {
      "category_id": 37,
      "name": "Вино",
      "photo": "https://example.com/wine.png",
      "img": "https://example.com/wine.jpg"
    },
    "business": {
      "business_id": 2,
      "name": "Название магазина",
      "address": "Адрес магазина"
    },
    "items": [
      {
        "item_id": 100,
        "name": "Название товара",
        "description": "Описание товара",
        "price": 1500,
        "img": "https://example.com/item.jpg",
        "code": "ITEM100",
        "category": {
          "category_id": 64,
          "name": "Подкатегория",
          "parent_category": 37
        },
        "visible": 1
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 185,
      "totalPages": 10
    },
    "categories_included": [37, 58, 59, 60, 61, 62, 63, 64, 186],
    "subcategories_count": 8
  },
  "message": "Товары категории получены успешно"
}
```

## Заказы

### 1. Создание заказа для пользователей (с автоматическим списанием)
```http
POST /orders/create-user-order
Authorization: Bearer {token}
```

**Описание:** Создает новый заказ для авторизованного пользователя с автоматическим списанием средств с сохраненной карты. Автоматически создает новый адрес доставки из переданных адресных полей.

**Body:**
```json
{
  "business_id": 2,
  "street": "ул. Пушкина",
  "house": "10",
  "apartment": "15",
  "entrance": "2",
  "floor": "3", 
  "comment": "Код домофона 1234",
  "lat": 52.271643,
  "lon": 76.950011,
  "items": [
    {
      "item_id": 100,
      "amount": 2,
      "options": [
        {
          "option_item_relation_id": 10,
          "amount": 1
        }
      ]
    }
  ],
  "bonus": 50,
  "extra": "Комментарий к заказу",
  "delivery_type": "DELIVERY",
  "scheduled_delivery": {
    "type": "TODAY",
    "time_slot": "14:00-16:00"
  },
  "saved_card_id": 123
}
```

**Обязательные поля:**
- `business_id` (number) - ID бизнеса
- `items` (array) - Массив товаров заказа
- `delivery_type` (string) - Тип доставки: DELIVERY, PICKUP, SCHEDULED
- `saved_card_id` (number) - ID сохраненной карты для автоплатежа

**Для доставки обязательно:**
- `street` (string) - Название улицы
- `house` (string) - Номер дома
- `lat` (number) - Широта адреса
- `lon` (number) - Долгота адреса

**Опциональные поля для адреса:**
- `apartment` (string) - Номер квартиры
- `entrance` (string) - Номер подъезда
- `floor` (string) - Этаж
- `comment` (string) - Комментарий к адресу

**Запланированная доставка:**
- `scheduled_delivery.type` (string): ASAP, TODAY, SCHEDULED
- `scheduled_delivery.date` (string): Дата в формате YYYY-MM-DD (для SCHEDULED)
- `scheduled_delivery.time_slot` (string): Временной слот (для TODAY и SCHEDULED)

**Response:**
```json
{
  "success": true,
  "data": {
    "order_id": 789,
    "order_uuid": "17536241476979123",
    "total_cost": 3500,
    "delivery_price": 500,
    "total_discount": 150,
    "items_count": 2,
    "promotions_applied": 1,
    "payment_type": "Оплата через приложение",
    "status": "PAYMENT_INITIATED",
    "payment_info": {
      "saved_card_id": 123,
      "card_mask": "**** **** **** 1234",
      "auto_payment": true,
      "message": "Платеж автоматически инициирован"
    },
    "delivery_calculation": {
      "delivery_type": "DISTANCE",
      "message": "Доставка возможна",
      "max_distance": 5,
      "current_distance": 2.5,
      "address": {
        "address_id": 456,
        "address": "ул. Пушкина, 10, кв. 15, подъезд 2, этаж 3",
        "name": "Адрес доставки",
        "lat": 52.271643,
        "lon": 76.950011
      }
    },
    "items": [
      {
        "item_id": 100,
        "name": "Название товара",
        "amount": 2,
        "base_amount": 2,
        "option_multiplier": 0,
        "price": 1500,
        "charged_amount": 1,
        "original_cost": 3000,
        "discounted_cost": 1500,
        "promotion": {
          "name": "Акция 2+1",
          "type": "SUBTRACT"
        },
        "options": [
          {
            "option_item_relation_id": 10,
            "name": "Дополнение",
            "amount": 1,
            "price": 100,
            "parent_item_amount": 1
          }
        ]
      }
    ]
  },
  "message": "Заказ создан и оплата автоматически инициирована"
}
```

**Возможные ошибки:**
- `400` - Не указаны обязательные поля
- `401` - Необходима авторизация
- `404` - Сохраненная карта не найдена или бизнес не найден
- `500` - Ошибка создания заказа или платежа

### 2. Создание заказа (стандартный метод)
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
  "delivery_date": "2025-07-24T14:00:00.000Z",
  "scheduled_delivery": {
    "type": "ASAP",
    "date": null,
    "time_slot": null
  }
}
```

**Delivery Types:**
- `DELIVERY` - Доставка
- `PICKUP` - Самовывоз

**Scheduled Delivery Types:**
- `ASAP` - Как можно скорее (по умолчанию)
- `TODAY` - Сегодня в определенное время
- `SCHEDULED` - Запланированная доставка на конкретную дату

**Примеры запланированной доставки:**

1. **Доставка как можно скорее:**
```json
{
  "scheduled_delivery": {
    "type": "ASAP"
  }
}
```

2. **Доставка сегодня в определенное время:**
```json
{
  "scheduled_delivery": {
    "type": "TODAY",
    "time_slot": "14:00-16:00"
  }
}
```

3. **Запланированная доставка:**
```json
{
  "scheduled_delivery": {
    "type": "SCHEDULED",
    "date": "2025-08-10",
    "time_slot": "10:00-12:00"
  }
}
```

**Time Slots (временные интервалы):**
- `09:00-11:00`
- `11:00-13:00` 
- `13:00-15:00`
- `15:00-17:00`
- `17:00-19:00`
- `19:00-21:00`
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
      "log_timestamp": "2025-07-24T10:30:00.000Z",
      "scheduled_delivery": {
        "type": "SCHEDULED",
        "date": "2025-08-10",
        "time_slot": "14:00-16:00",
        "formatted_delivery_time": "10 августа, 14:00-16:00"
      }
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

### 1. Поиск адресов по строке
```http
GET /api/addresses/search?query={строка}
```
Ответ:
```json
{
  "success": true,
  "data": [
    {
      "place_id": 1327480,
      "name": "52, проспект Шахтёров, Караганда, Казахстан",
      "point": { "lat": 49.7883058, "lon": 73.1455389 },
      "type": "apartments",
      "category": "building",
      "address": {
        "house_number": "52",
        "road": "проспект Шахтёров",
        "suburb": "Юго-восток",
        "city": "Караганда",
        "state": "Карагандинская область",
        "postcode": "100024",
        "country": "Казахстан",
        "country_code": "kz"
      },
      "boundingbox": ["49.7875569","49.7890497","73.1441074","73.1463608"]
    }
  ],
  "message": "Найдено 1 адресов"
}
```

### 2. Обратный геокодинг по координатам
```http
GET /api/addresses/reverse?lat={lat}&lon={lon}
```
Ответ:
```json
{
  "success": true,
  "data": {
    "place_id": 1327480,
    "display_name": "52, проспект Шахтёров, Караганда, Казахстан",
    "point": { "lat": 49.7883058, "lon": 73.1455389 },
    "address": {
      "house_number": "52",
      "road": "проспект Шахтёров",
      "suburb": "Юго-восток",
      "city": "Караганда",
      "state": "Карагандинская область",
      "postcode": "100024",
      "country": "Казахстан",
      "country_code": "kz"
    }
  },
  "message": "Адрес получен по координатам"
}
```

### 3. CRUD операций с адресами пользователя
Все методы требуют заголовок `Authorization: Bearer {token}`

#### Получить все адреса
```http
GET /api/addresses
```
Ответ: массив записей из таблицы `user_addresses` с параметрами `{ address_id, name, address, lat, lon, apartment, entrance, floor, other }`

#### Получить адрес по ID
```http
GET /api/addresses/{id}
```

#### Добавить адрес
```http
POST /api/addresses
```
Body: `{ name, address, lat, lon, apartment?, entrance?, floor?, other? }`

#### Обновить адрес
```http
PUT /api/addresses/{id}
```
Body: любые поля для обновления

#### Удалить адрес
```http
DELETE /api/addresses/{id}
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
      "log_timestamp": "2025-07-24T10:30:00.000Z",
      "scheduled_delivery": {
        "type": "TODAY",
        "date": "2025-07-24",
        "time_slot": "14:00-16:00",
        "formatted_delivery_time": "Сегодня, 14:00-16:00"
      }
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

### 3. Получение доступных временных слотов для доставки
```http
GET /delivery/time-slots
```

**Query Parameters:**
- `business_id` (обязательный): ID бизнеса
- `date` (optional): Дата в формате YYYY-MM-DD (по умолчанию сегодня)

**Response:**
```json
{
  "success": true,
  "data": {
    "business_id": 2,
    "date": "2025-08-04",
    "available_slots": [
      {
        "slot": "09:00-11:00",
        "available": true,
        "orders_count": 2,
        "max_orders": 10
      },
      {
        "slot": "11:00-13:00", 
        "available": true,
        "orders_count": 5,
        "max_orders": 10
      },
      {
        "slot": "13:00-15:00",
        "available": false,
        "orders_count": 10,
        "max_orders": 10,
        "reason": "Слот полностью занят"
      },
      {
        "slot": "15:00-17:00",
        "available": true,
        "orders_count": 1,
        "max_orders": 10
      },
      {
        "slot": "17:00-19:00",
        "available": true,
        "orders_count": 3,
        "max_orders": 10
      },
      {
        "slot": "19:00-21:00",
        "available": false,
        "orders_count": 0,
        "max_orders": 10,
        "reason": "Рабочий день закончен"
      }
    ],
    "today": true,
    "cutoff_time": "20:00",
    "message": "Доступные временные слоты получены"
  },
  "message": "Временные слоты для доставки получены"
}
```

### 4. Получение настроек доставки бизнеса
```http
GET /businesses/{business_id}/delivery-settings
```

**Response:**
```json
{
  "success": true,
  "data": {
    "business_id": 2,
    "delivery_settings": {
      "asap_delivery": true,
      "scheduled_delivery": true,
      "working_hours": {
        "monday": { "start": "09:00", "end": "21:00", "enabled": true },
        "tuesday": { "start": "09:00", "end": "21:00", "enabled": true },
        "wednesday": { "start": "09:00", "end": "21:00", "enabled": true },
        "thursday": { "start": "09:00", "end": "21:00", "enabled": true },
        "friday": { "start": "09:00", "end": "21:00", "enabled": true },
        "saturday": { "start": "10:00", "end": "20:00", "enabled": true },
        "sunday": { "start": "10:00", "end": "20:00", "enabled": true }
      },
      "time_slots": [
        "09:00-11:00",
        "11:00-13:00",
        "13:00-15:00", 
        "15:00-17:00",
        "17:00-19:00",
        "19:00-21:00"
      ],
      "max_orders_per_slot": 10,
      "advance_booking_days": 7,
      "cutoff_time": "20:00",
      "min_delivery_time_minutes": 60
    }
  },
  "message": "Настройки доставки получены"
}
```

## Адреса
### 5. Получение заказов пользователя
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
        "scheduled_delivery": {
          "type": "ASAP",
          "formatted_delivery_time": "Как можно скорее"
        },
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

### 6. Обновление статуса заказа
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

### 1. Расчет стоимости доставки по координатам
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

### 2. Расчет стоимости доставки по координатам
```http
GET /delivery/calculate-by-address
```

**Query Parameters:**
- `business_id`: ID бизнеса (обязательный)
- `lat`: Широта местоположения (обязательный, от -90 до 90)
- `lon`: Долгота местоположения (обязательный, от -180 до 180)

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
  },
  "message": "Доставка возможна"
}
```

**Delivery Types:**
- `DISTANCE` - Расчет по расстоянию
- `AREA` - Расчет по зонам доставки
- `YANDEX` - Расчет через Яндекс API (fallback)

## Сохраненные карты пользователя

### 1. Получение списка сохраненных карт
```http
GET /user/cards
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "cards": [
      {
        "card_id": 123,
        "mask": "**** **** **** 1234"
      },
      {
        "card_id": 124,
        "mask": "**** **** **** 5678"
      }
    ],
    "total": 2
  },
  "message": "Найдено 2 сохраненных карт"
}
```

### 2. Получение карты по ID
```http
GET /user/cards/{card_id}
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "card": {
      "card_id": 123,
      "mask": "**** **** **** 1234",
      "halyk_card_id": "halyk_123456789"
    }
  },
  "message": "Карта найдена"
}
```

### 3. Удаление сохраненной карты
```http
DELETE /user/cards/{card_id}
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "card_id": 123
  },
  "message": "Карта успешно удалена"
}
```

## Сохранение банковских карт (Halyk Bank)

### ⚡ Улучшенная система генерации Invoice ID

С версии от 27.01.2025 внедрена новая система генерации Invoice ID для карт:

**Формат нового Invoice ID:**
- Шаблон: `CARD{timestamp}{userID}{random}{refresh}`
- Максимальная длина: 20 символов
- Пример: `CARD1753624147697910` (для первичного сохранения)
- Пример: `CARD1753624147697911` (для обновления карты)

**Преимущества новой системы:**
- ✅ **Уникальность**: Проверка в базе данных (таблицы `orders` и `halyk_saved_cards`)
- ✅ **Повторные попытки**: До 5 попыток генерации с задержкой 10мс
- ✅ **Fallback механизм**: Автоматическое использование UUID при неудаче
- ✅ **Логирование**: Детальные логи процесса генерации
- ✅ **Совместимость**: Полная совместимость с Halyk Bank API

**Структура ID:**
- `CARD` - префикс (4 символа)
- `17536241476` - timestamp с усечением (11 символов)
- `979` - padded user ID (3 символа)
- `1` - случайное число (1 символ)
- `0/1` - refresh флаг (1 символ): 0 = новая карта, 1 = обновление

### 1. Инициализация сохранения карты
```http
POST /payments/save-card/init
Authorization: Bearer {token}
```

**Body:**
```json
{
  "backLink": "https://your-app.com/success",
  "failureBackLink": "https://your-app.com/failure", 
  "postLink": "https://your-backend.com/api/payments/save-card/postlink",
  "description": "Регистрация карты",
  "language": "rus"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "paymentObject": {
      "invoiceId": "CARD1753624147697910",
      "backLink": "https://your-app.com/success",
      "failureBackLink": "https://your-app.com/failure",
      "postLink": "https://your-backend.com/api/payments/save-card/postlink",
      "language": "rus",
      "description": "Регистрация карты",
      "accountId": "123",
      "terminal": "bb4dec49-6e30-41d0-b16b-8ba1831a854b",
      "amount": 0,
      "currency": "KZT",
      "cardSave": true,
      "paymentType": "cardVerification",
      "auth": "DCEB8O_ZM5U7SO_T_U5EJQ"
    },
    "jsLibraryUrl": "https://epay.homebank.kz/payform/payment-api.js",
    "invoiceId": "CARD1753624147697910",
    "instructions": {
      "frontend": "Подключите JS-библиотеку и вызовите halyk.pay(paymentObject)",
      "jsLibrary": "https://epay.homebank.kz/payform/payment-api.js",
      "method": "halyk.pay()"
    }
  },
  "message": "Токен получен, готов для сохранения карты"
}
```

### 2. Обновление токена при истечении времени
```http
POST /payments/save-card/refresh-init
Authorization: Bearer {token}
```

**Body:**
```json
{
  "backLink": "https://your-app.com/success",
  "failureBackLink": "https://your-app.com/failure", 
  "postLink": "https://your-backend.com/api/payments/save-card/postlink",
  "description": "Регистрация карты (обновлено)",
  "language": "rus"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "paymentObject": {
      "invoiceId": "CARD1753624147697911",
      "backLink": "https://your-app.com/success",
      "failureBackLink": "https://your-app.com/failure",
      "postLink": "https://your-backend.com/api/payments/save-card/postlink",
      "language": "rus",
      "description": "Регистрация карты (обновлено)",
      "accountId": "123",
      "terminal": "bb4dec49-6e30-41d0-b16b-8ba1831a854b",
      "amount": 0,
      "currency": "KZT",
      "cardSave": true,
      "paymentType": "cardVerification",
      "auth": "NEW_FRESH_TOKEN_HERE",
      "timestamp": 1753617672668
    },
    "jsLibraryUrl": "https://epay.homebank.kz/payform/payment-api.js",
    "invoiceId": "CARD1753624147697911",
    "refreshed": true,
    "instructions": {
      "frontend": "Токен обновлен. Подключите JS-библиотеку и вызовите halyk.pay(paymentObject)",
      "jsLibrary": "https://epay.homebank.kz/payform/payment-api.js",
      "method": "halyk.pay()",
      "note": "Это обновленная сессия с новым токеном"
    }
  },
  "message": "Токен обновлен, готов для сохранения карты"
}
```

### 3. Обработка статуса платежа и ошибок
```http
POST /payments/status
Authorization: Bearer {token}
```

**Body:**
```json
{
  "invoiceId": "CARD1690456789123",
  "error": "timeout",
  "errorMessage": "Время оплаты истекло"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "invoiceId": "CARD1753624147697910",
    "status": "error",
    "canRetry": true,
    "errorType": "timeout",
    "userMessage": "Время сеанса истекло. Попробуйте создать новую сессию.",
    "recommendation": "refresh_token"
  },
  "message": "Статус платежа обработан"
}
```

**Error Types:**
- `timeout` - Истечение времени сессии
- `cancelled` - Отмена пользователем  
- `card_error` - Ошибка с картой
- `unknown` - Неизвестная ошибка

**Recommendations:**
- `refresh_token` - Обновить токен и повторить
- `user_cancelled` - Пользователь отменил операцию
- `check_card_data` - Проверить данные карты
- `retry` - Повторить операцию

### 4. Обработка PostLink (Webhook от Halyk Bank)
```http
POST /payments/save-card/postlink
```

**Body (автоматически отправляется Halyk Bank):**
```json
{
  "accountId": "123",
  "amount": 0,
  "approvalCode": "178644",
  "cardId": "4cd44b44-4445-14a6-e063-1b01040a44c4",
  "cardMask": "440043...0128",
  "cardType": "VISA",
  "code": "ok",
  "currency": "USD",
  "dateTime": "2025-02-12T09:42:51.960781107+05:00",
  "description": "Регистрация карты",
  "invoiceId": "CARD1690456789123",
  "reason": "success",
  "reasonCode": 0,
  "terminal": "67e34d63-102f-4bd1-898e-370781d0074d"
}
```

**Response:**
```json
{
  "success": true,
  "message": "PostLink обработан"
}
```

### 5. Интеграция на фронтенде (исправленная версия)

**Правильная реализация без использования process.env:**

```javascript
// Пример React компонента для добавления карты
const AddCardComponent = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [canRetry, setCanRetry] = useState(true);

  const initCardSave = async (isRefresh = false) => {
    try {
      setLoading(true);
      setError(null);
      
      const endpoint = isRefresh 
        ? '/api/payments/save-card/refresh-init' 
        : '/api/payments/save-card/init';
      
      // Получаем текущий домен динамически
      const baseUrl = window.location.origin;
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          backLink: `${baseUrl}/cards/success`,
          failureBackLink: `${baseUrl}/cards/failure`,
          // Используем статический URL бэкенда или конфиг
          postLink: `${window.API_BASE_URL || 'http://localhost:3000'}/api/payments/save-card/postlink`
        })
      });

      const data = await response.json();
      
      if (data.success) {
        await loadHalykScript(data.data.jsLibraryUrl);
        setupHalykCallbacks(data.data.invoiceId);
        window.halyk.pay(data.data.paymentObject);
      } else {
        throw new Error(data.message);
      }
      
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const loadHalykScript = (url) => {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${url}"]`)) {
        resolve();
        return;
      }
      
      const script = document.createElement('script');
      script.src = url;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  };

  const setupHalykCallbacks = (invoiceId) => {
    // Callback для успешного завершения
    window.halykPaymentSuccess = (result) => {
      setLoading(false);
      console.log('Карта успешно добавлена:', result);
      // Обновить список карт
      refreshCardsList();
    };

    // Callback для ошибок
    window.halykPaymentError = (error) => {
      handlePaymentError(invoiceId, error.code, error.message);
    };

    // Callback для отмены
    window.halykPaymentCancel = () => {
      handlePaymentError(invoiceId, 'cancelled', 'Операция отменена пользователем');
    };

    // Callback для таймаута
    window.halykPaymentTimeout = () => {
      handlePaymentError(invoiceId, 'timeout', 'Время сеанса истекло');
    };
  };

  const handlePaymentError = async (invoiceId, error, errorMessage) => {
    try {
      const response = await fetch('/api/payments/status', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ invoiceId, error, errorMessage })
      });

      const statusData = await response.json();
      
      if (statusData.success) {
        const { userMessage, recommendation, canRetry } = statusData.data;
        setError(userMessage);
        setCanRetry(canRetry);
        setLoading(false);

        // Автоматическое обновление токена при timeout
        if (recommendation === 'refresh_token') {
          setTimeout(() => {
            initCardSave(true); // Обновляем токен
          }, 2000);
        }
      }
    } catch (err) {
      setError('Произошла неизвестная ошибка');
      setLoading(false);
    }
  };

  const refreshCardsList = async () => {
    try {
      const response = await fetch('/api/user/cards', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      const data = await response.json();
      if (data.success) {
        // Обновить состояние списка карт
        console.log('Список карт обновлен:', data.data.cards);
      }
    } catch (error) {
      console.error('Ошибка обновления списка карт:', error);
    }
  };

  return (
    <div className="add-card-component">
      <h3>Добавление банковской карты</h3>
      <p>Для сохранения карты будет произведена верификация на сумму 0 ₸</p>
      
      {loading && (
        <div className="loading">
          <p>Инициализация платежной сессии...</p>
        </div>
      )}
      
      {error && (
        <div className="error">
          <p>{error}</p>
          {canRetry && (
            <div className="retry-buttons">
              <button onClick={() => initCardSave()}>
                Попробовать снова
              </button>
              <button onClick={() => initCardSave(true)}>
                Обновить сессию
              </button>
            </div>
          )}
        </div>
      )}
      
      {!loading && !error && (
        <button onClick={() => initCardSave()}>
          Добавить карту
        </button>
      )}
    </div>
  );
};
```

**Конфигурация для разных окружений:**

```javascript
// В index.html или в начале приложения
window.API_BASE_URL = 'http://localhost:3000'; // для разработки
// window.API_BASE_URL = 'https://api.naliv.kz'; // для продакшена
```

**Альтернативный способ через конфигурационный файл:**

```javascript
// config.js
const config = {
  development: {
    API_BASE_URL: 'http://localhost:3000'
  },
  production: {
    API_BASE_URL: 'https://api.naliv.kz'
  }
};

export default config[process.env.NODE_ENV || 'development'];
```

**Обработка переходов:**

```javascript
// Success page (/cards/success)
useEffect(() => {
  if (window.opener) {
    window.opener.postMessage({ 
      type: 'CARD_SAVE_SUCCESS',
      timestamp: Date.now()
    }, window.location.origin);
    window.close();
  }
}, []);

// Failure page (/cards/failure)  
useEffect(() => {
  const urlParams = new URLSearchParams(window.location.search);
  const error = urlParams.get('error');
  const message = urlParams.get('message');
  
  if (window.opener) {
    window.opener.postMessage({
      type: 'CARD_SAVE_ERROR',
      error,
      message,
      timestamp: Date.now()
    }, window.location.origin);
    window.close();
  }
}, []);
```

**Процесс сохранения карты:**
1. Пользователь инициирует сохранение карты через `/payments/save-card/init`
2. Получаем `paymentObject` и `jsLibraryUrl` 
3. На фронтенде подключаем JS-библиотеку Halyk Bank
4. Вызываем `halyk.pay(paymentObject)` для открытия формы ввода карты
5. Пользователь вводит данные карты (сумма = 0 ₸ для верификации)
6. Halyk Bank отправляет PostLink на наш webhook
7. Карта сохраняется в таблице `halyk_saved_cards`

**Важные замечания:**
- Используется production API Halyk Bank (`https://epay.homebank.kz`)
- Валюта: KZT (казахстанские тенге)
- Сумма верификации: 0 ₸ (деньги не списываются)
- Токен действует 20 минут (1200 секунд)
- При истечении токена используйте `/payments/save-card/refresh-init`
- Не используйте `process.env` на фронтенде - используйте `window.API_BASE_URL`
- Автоматическое восстановление при timeout через 2 секунды

**Обработка ошибок:**
- `timeout` → автоматическое обновление токена
- `cancelled` → показать кнопку "Попробовать снова"  
- `card_error` → показать сообщение "Проверьте данные карты"
- `unknown` → показать общее сообщение об ошибке

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

## Бонусная система

### 1. Получение бонусов пользователя
```http
GET /bonuses
Authorization: Bearer {token}
```

**Описание:** Возвращает текущий баланс бонусов пользователя и историю операций с детализацией по организациям.

**Response:**
```json
{
  "success": true,
  "data": {
    "totalBonuses": 1250,
    "bonusCard": {
      "cardUuid": "550e8400-e29b-41d4-a716-446655440000",
      "createdAt": "2025-07-24T10:00:00.000Z"
    },
    "bonusHistory": [
      {
        "bonusId": 123,
        "organizationId": 1,
        "amount": 500,
        "timestamp": "2025-07-24T10:30:00.000Z"
      },
      {
        "bonusId": 122,
        "organizationId": 2,
        "amount": 750,
        "timestamp": "2025-07-23T15:20:00.000Z"
      }
    ]
  },
  "message": "Данные о бонусах успешно получены"
}
```

**Структура ответа:**
- `totalBonuses` (number) - Текущий баланс бонусов пользователя (значение amount из последней записи)
- `bonusCard` (object|null) - Информация о бонусной карте
  - `cardUuid` (string) - UUID бонусной карты
  - `createdAt` (string) - Дата создания карты
- `bonusHistory` (array) - Последние 20 операций с бонусами
  - `bonusId` (number) - ID операции
  - `organizationId` (number) - ID организации, начислившей бонусы
  - `amount` (number) - Сумма бонусов
  - `timestamp` (string) - Дата и время операции

### 2. Создание бонусной карты
```http
POST /bonuses/card
Authorization: Bearer {token}
```

**Описание:** Создает бонусную карту для пользователя, если у него её еще нет.

**Response (новая карта):**
```json
{
  "success": true,
  "data": {
    "cardUuid": "550e8400-e29b-41d4-a716-446655440000",
    "createdAt": "2025-07-24T10:30:00.000Z"
  },
  "message": "Бонусная карта успешно создана"
}
```

**Response (карта уже существует):**
```json
{
  "success": false,
  "message": "У пользователя уже есть бонусная карта",
  "data": {
    "cardUuid": "550e8400-e29b-41d4-a716-446655440000",
    "createdAt": "2025-07-20T08:15:00.000Z"
  }
}
```

### 3. Добавление бонусов пользователю
```http
POST /bonuses/add
Authorization: Bearer {token}
```

**Описание:** Добавляет бонусы пользователю от определенной организации.

**Body:**
```json
{
  "organizationId": 1,
  "amount": 100
}
```

**Параметры:**
- `organizationId` (number, required) - ID организации, начисляющей бонусы
- `amount` (number, required) - Сумма бонусов для начисления (должно быть больше 0)

**Response:**
```json
{
  "success": true,
  "data": {
    "bonusId": 124,
    "addedAmount": 100,
    "totalBonuses": 100,
    "timestamp": "2025-07-24T11:00:00.000Z"
  },
  "message": "Бонусы успешно добавлены"
}
```

### 4. Получение детализированной истории бонусов
```http
GET /bonuses/history
Authorization: Bearer {token}
```

**Описание:** Возвращает полную историю бонусных операций с пагинацией.

**Query Parameters:**
- `page` (optional) - Номер страницы (по умолчанию 1)
- `limit` (optional) - Количество записей на странице (по умолчанию 20, максимум 100)

**Response:**
```json
{
  "success": true,
  "data": {
    "bonuses": [
      {
        "bonusId": 124,
        "organizationId": 1,
        "amount": 100,
        "timestamp": "2025-07-24T11:00:00.000Z"
      },
      {
        "bonusId": 123,
        "organizationId": 1,
        "amount": 500,
        "timestamp": "2025-07-24T10:30:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "pages": 3
    }
  },
  "message": "История бонусов успешно получена"
}
```

### Коды ошибок для бонусной системы

**401 Unauthorized**
```json
{
  "error": {
    "message": "Необходима авторизация",
    "statusCode": 401,
    "timestamp": "2025-07-24T12:00:00.000Z"
  }
}
```

**400 Bad Request (при добавлении бонусов)**
```json
{
  "error": {
    "message": "Некорректные данные для добавления бонусов",
    "statusCode": 400,
    "timestamp": "2025-07-24T12:00:00.000Z"
  }
}
```

**500 Internal Server Error**
```json
{
  "error": {
    "message": "Ошибка при получении данных о бонусах",
    "statusCode": 500,
    "timestamp": "2025-07-24T12:00:00.000Z"
  }
}
```

### Особенности бонусной системы

**Логика работы с балансом:**
- `totalBonuses` представляет текущий баланс пользователя (значение amount из последней записи в таблице)
- Каждая новая запись в таблице `bonuses` обновляет текущий баланс
- История операций показывает все изменения баланса в хронологическом порядке
- При начислении бонусов в таблицу добавляется новая запись с новым балансом

**Типы операций:**
- Начисление бонусов производится организациями через API
- История операций сохраняется с указанием организации-источника
- Бонусная карта создается автоматически при первом запросе или вручную

**Ограничения:**
- У каждого пользователя может быть только одна активная бонусная карта
- Сумма начисляемых бонусов должна быть положительной
- История операций сортируется по убыванию даты

**Использование в заказах:**
- Бонусы можно использовать при создании заказа (поле `bonus` в `/orders`)
- Максимальная сумма списания бонусов может ограничиваться бизнес-логикой
- Списание бонусов происходит после создания заказа

**UUID бонусной карты:**
- Генерируется автоматически при создании карты
- Используется для идентификации карты в партнерских системах
- Формат: стандартный UUID v4
