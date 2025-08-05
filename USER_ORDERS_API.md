# User Orders API Documentation

Документация для эндпоинтов получения заказов пользователя.

## 📋 Обзор

Данные эндпоинты позволяют авторизованным пользователям получать информацию о своих заказах:
- Все заказы пользователя с пагинацией и фильтрацией
- Активные заказы пользователя (в процессе обработки)

## 🔐 Авторизация

Все эндпоинты требуют авторизации:
```
Authorization: Bearer <your_jwt_token>
```

## 📖 Эндпоинты

### 1. Получение всех заказов пользователя

**GET** `/api/orders/my-orders`

Возвращает все заказы авторизованного пользователя с подробной информацией.

#### Query Parameters

| Параметр | Тип | Обязательный | Описание |
|----------|-----|--------------|----------|
| `page` | number | Нет | Номер страницы (по умолчанию: 1) |
| `limit` | number | Нет | Количество заказов на странице (по умолчанию: 20, максимум: 50) |
| `status` | number | Нет | Фильтр по статусу заказа |
| `business_id` | number | Нет | Фильтр по ID бизнеса |
| `delivery_type` | string | Нет | Фильтр по типу доставки (DELIVERY, PICKUP, SCHEDULED) |

#### Возможные статусы заказов

- `66` - Ожидает оплаты
- `0` - Оплачен
- `1` - Принят в работу
- `2` - Готовится
- `3` - Готов к выдаче
- `4` - В доставке
- `5` - Доставлен

#### Пример запроса

```bash
curl -X GET "http://localhost:3000/api/orders/my-orders?page=1&limit=10&status=0" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### Пример ответа

```json
{
  "success": true,
  "data": {
    "orders": [
      {
        "order_id": 123,
        "order_uuid": "1723456789123456",
        "business": {
          "business_id": 2,
          "name": "Магазин алкоголя",
          "address": "ул. Пушкина, 10",
          "logo": "logo.png",
          "img": "business.jpg"
        },
        "delivery_type": "DELIVERY",
        "delivery_date": null,
        "delivery_price": 500,
        "bonus_used": 0,
        "extra": "",
        "log_timestamp": "2024-08-05T10:30:00.000Z",
        "is_canceled": 0,
        "current_status": {
          "status": 0,
          "status_description": "Оплачен",
          "is_canceled": 0,
          "log_timestamp": "2024-08-05T10:35:00.000Z"
        },
        "delivery_address": {
          "address_id": 45,
          "address": "ул. Ленина, 25",
          "name": "Дом",
          "apartment": "15",
          "entrance": "2",
          "floor": "3",
          "other": "Код домофона 1234",
          "lat": 52.271643,
          "lon": 76.950011
        },
        "items": [
          {
            "relation_id": 789,
            "item_id": 100,
            "name": "Водка Premium",
            "description": "Премиум водка 40%",
            "img": "vodka.jpg",
            "amount": 2,
            "price": 3500,
            "unit": "шт",
            "total_cost": 7000
          }
        ],
        "cost_summary": {
          "items_total": 7000,
          "delivery_price": 500,
          "bonus_used": 0,
          "total_sum": 7500
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 25,
      "total_pages": 3
    },
    "filters_applied": {
      "status": 0,
      "business_id": null,
      "delivery_type": null
    }
  },
  "message": "Найдено 25 заказов"
}
```

### 2. Получение активных заказов пользователя

**GET** `/api/orders/my-active-orders`

Возвращает только активные заказы пользователя (статусы 0-5, 66), исключая завершенные и отмененные.

#### Query Parameters

| Параметр | Тип | Обязательный | Описание |
|----------|-----|--------------|----------|
| `business_id` | number | Нет | Фильтр по ID бизнеса |
| `delivery_type` | string | Нет | Фильтр по типу доставки (DELIVERY, PICKUP, SCHEDULED) |

#### Пример запроса

```bash
curl -X GET "http://localhost:3000/api/orders/my-active-orders" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### Пример ответа

```json
{
  "success": true,
  "data": {
    "active_orders": [
      {
        "order_id": 124,
        "order_uuid": "1723456789124456",
        "business": {
          "business_id": 2,
          "name": "Магазин алкоголя",
          "address": "ул. Пушкина, 10",
          "logo": "logo.png",
          "img": "business.jpg"
        },
        "delivery_type": "DELIVERY",
        "delivery_date": null,
        "log_timestamp": "2024-08-05T11:00:00.000Z",
        "current_status": {
          "status": 2,
          "status_description": "Готовится",
          "status_color": "#9c27b0",
          "priority": 4,
          "is_canceled": 0,
          "log_timestamp": "2024-08-05T11:15:00.000Z"
        },
        "delivery_address": {
          "address_id": 45,
          "address": "ул. Ленина, 25",
          "name": "Дом",
          "apartment": "15",
          "entrance": "2",
          "floor": "3",
          "other": "Код домофона 1234",
          "lat": 52.271643,
          "lon": 76.950011
        },
        "items_summary": {
          "items_count": 3,
          "total_amount": 5,
          "items_preview": [
            {
              "name": "Водка Premium",
              "img": "vodka.jpg",
              "amount": 2
            },
            {
              "name": "Пиво светлое",
              "img": "beer.jpg",
              "amount": 3
            }
          ]
        },
        "cost_summary": {
          "total_sum": 8500,
          "delivery_price": 500,
          "bonus_used": 0
        }
      }
    ],
    "total_active": 1,
    "filters_applied": {
      "business_id": null,
      "delivery_type": null
    }
  },
  "message": "Найдено 1 активных заказов"
}
```

## 🎯 Особенности

### Активные заказы
- Показываются заказы со статусами: 66 (ожидает оплаты), 0-4 (в обработке/доставке)
- Исключаются доставленные (статус 5) и отмененные заказы
- Сортируются по приоритету статуса и времени создания

### Пагинация
- Доступна только для эндпоинта всех заказов
- Максимальный лимит: 50 заказов на странице
- Фильтр по статусу применяется после получения данных

### Фильтрация
- По статусу заказа (точное совпадение)
- По ID бизнеса
- По типу доставки

## ❌ Ошибки

### 401 Unauthorized
```json
{
  "success": false,
  "error": {
    "message": "Необходима авторизация",
    "statusCode": 401,
    "timestamp": "2024-08-05T12:00:00.000Z"
  }
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "error": {
    "message": "Ошибка получения заказов: Database connection failed",
    "statusCode": 500,
    "timestamp": "2024-08-05T12:00:00.000Z"
  }
}
```

## 🔄 Использование в приложении

### React/JavaScript пример

```javascript
// Получение всех заказов с фильтрацией
const fetchUserOrders = async (filters = {}) => {
  const params = new URLSearchParams(filters);
  
  const response = await fetch(`/api/orders/my-orders?${params}`, {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    }
  });
  
  const data = await response.json();
  
  if (data.success) {
    return data.data.orders;
  } else {
    throw new Error(data.error?.message || 'Ошибка получения заказов');
  }
};

// Получение активных заказов
const fetchActiveOrders = async () => {
  const response = await fetch('/api/orders/my-active-orders', {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    }
  });
  
  const data = await response.json();
  
  if (data.success) {
    return data.data.active_orders;
  } else {
    throw new Error(data.error?.message || 'Ошибка получения активных заказов');
  }
};

// Использование
try {
  const orders = await fetchUserOrders({ status: 0, page: 1 });
  const activeOrders = await fetchActiveOrders();
  
  console.log('Все оплаченные заказы:', orders);
  console.log('Активные заказы:', activeOrders);
} catch (error) {
  console.error('Ошибка:', error.message);
}
```

## 📝 Примечания

1. **Производительность**: Эндпоинты оптимизированы для работы с большим количеством заказов
2. **Безопасность**: Пользователи видят только свои заказы
3. **Кэширование**: Рекомендуется кэшировать результаты на клиенте для улучшения UX
4. **Обновления**: Для получения актуальных статусов используйте периодический рефреш или WebSocket соединения
