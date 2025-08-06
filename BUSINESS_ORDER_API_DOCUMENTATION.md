# Business Order Management API Documentation

## Аутентификация

Все эндпоинты требуют аутентификацию бизнеса через токен из таблицы `businesses.token`.

**Header:** `Authorization: Bearer <business_token>`

## Базовый URL

`/api/business`

---

## Получение заказов бизнеса

**GET** `/api/business/orders`

Получает список заказов для аутентифицированного бизнеса с пагинацией и фильтрацией.

### Query Parameters

| Параметр | Тип | Описание | По умолчанию |
|----------|-----|----------|--------------|
| `page` | number | Номер страницы | 1 |
| `limit` | number | Количество заказов на странице (макс. 100) | 20 |
| `date_from` | string | Дата начала фильтра (ISO format) | - |
| `date_to` | string | Дата окончания фильтра (ISO format) | - |

### Пример запроса

```bash
curl -X GET "http://localhost:3000/api/business/orders?page=1&limit=10&date_from=2024-01-01" \
  -H "Authorization: Bearer business_token_here"
```

### Пример ответа

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
          "coordinates": {
            "lat": 43.2220,
            "lon": 76.8512
          },
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

---

## Обновление статуса заказа

**PATCH** `/api/business/orders/:id/status`

Обновляет статус заказа для аутентифицированного бизнеса.

### Path Parameters

| Параметр | Тип | Описание |
|----------|-----|----------|
| `id` | number | ID заказа |

### Request Body

```json
{
  "status": 3
}
```

#### Доступные статусы:
- `1` - Новый заказ
- `2` - Принят
- `3` - Готовится
- `4` - Готов к доставке
- `5` - Доставляется
- `6` - Отменен
- `7` - Доставлен

### Пример запроса

```bash
curl -X PATCH "http://localhost:3000/api/business/orders/123/status" \
  -H "Authorization: Bearer business_token_here" \
  -H "Content-Type: application/json" \
  -d '{"status": 3}'
```

### Пример ответа

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

---

## Получение заказа по ID

**GET** `/api/business/orders/:id`

Получает детальную информацию о заказе по его ID для аутентифицированного бизнеса.

### Path Parameters

| Параметр | Тип | Описание |
|----------|-----|----------|
| `id` | number | ID заказа |

### Пример запроса

```bash
curl -X GET "http://localhost:3000/api/business/orders/65589" \
  -H "Authorization: Bearer business_token_here"
```

### Пример ответа

```json
{
  "success": true,
  "data": {
    "order": {
      "order_id": 65589,
      "order_uuid": null,
      "user": {
        "user_id": 9723,
        "name": "-"
      },
      "delivery_address": {
        "address_id": 65425,
        "name": "Адрес из call-центра.",
        "address": "Казахстан, Павлодар, улица Кривенко, 49",
        "coordinates": {
          "lat": 52.284745,
          "lon": 76.950963
        },
        "details": {
          "apartment": "",
          "entrance": "2",
          "floor": "",
          "comment": "по зв"
        }
      },
      "delivery_type": null,
      "delivery_price": 800,
      "subtotal": 5346.9,
      "service_fee": 0,
      "total_cost": 6146.9,
      "payment_type": {
        "payment_type_id": 5,
        "name": "Kaspi.kz"
      },
      "current_status": {
        "status": 1,
        "status_name": "Принят магазином",
        "timestamp": "2025-08-05T20:55:02.000Z",
        "isCanceled": 0
      },
      "status_history": [
        {
          "status_id": 41883,
          "status": 1,
          "status_name": "Принят магазином",
          "timestamp": "2025-08-05T20:55:02.000Z",
          "isCanceled": 0
        },
        {
          "status_id": 41882,
          "status": 0,
          "status_name": "Новый заказ",
          "timestamp": "2025-08-05T20:54:56.000Z",
          "isCanceled": 0
        }
      ],
      "items": [
        {
          "relation_id": 233452,
          "item_id": 1948,
          "quantity": 1,
          "price": 30,
          "total": 30
        },
        {
          "relation_id": 233453,
          "item_id": 2022,
          "quantity": 3,
          "price": 800,
          "total": 2400
        }
      ],
      "items_count": 7.19,
      "extra": "8 777 458 09 75 счет",
      "delivery_date": null,
      "created_at": "2025-08-05T20:54:56.000Z",
      "bonus": 0
    },
    "business": {
      "business_id": 2,
      "name": "Налив"
    }
  },
  "message": "Заказ #65589 получен"
}
```

---

## Получение статистики заказов

**GET** `/api/business/orders/stats`

Получает статистику заказов для аутентифицированного бизнеса.

### Query Parameters

| Параметр | Тип | Описание |
|----------|-----|----------|
| `date_from` | string | Дата начала периода (ISO format) |
| `date_to` | string | Дата окончания периода (ISO format) |

### Пример запроса

```bash
curl -X GET "http://localhost:3000/api/business/orders/stats?date_from=2024-01-01&date_to=2024-01-31" \
  -H "Authorization: Bearer business_token_here"
```

### Пример ответа

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
        },
        {
          "status": 3,
          "status_name": "Готовится",
          "count": 10
        },
        {
          "status": 2,
          "status_name": "Принят",
          "count": 5
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

---

## Ошибки

### 401 Unauthorized
```json
{
  "success": false,
  "error": "Требуется авторизация бизнеса"
}
```

### 404 Not Found
```json
{
  "success": false,
  "error": "Заказ не найден или не принадлежит данному бизнесу"
}
```

### 400 Bad Request
```json
{
  "success": false,
  "error": "Некорректный ID заказа"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "error": "Ошибка сервера"
}
```

---

## Примеры использования

### JavaScript/Fetch

```javascript
// Получение заказов
const getOrders = async (token, page = 1) => {
  const response = await fetch(`/api/business/orders?page=${page}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  return await response.json();
};

// Получение заказа по ID
const getOrderById = async (token, orderId) => {
  const response = await fetch(`/api/business/orders/${orderId}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  return await response.json();
};

// Обновление статуса заказа
const updateOrderStatus = async (token, orderId, status) => {
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

// Получение статистики
const getStats = async (token, dateFrom, dateTo) => {
  const params = new URLSearchParams();
  if (dateFrom) params.append('date_from', dateFrom);
  if (dateTo) params.append('date_to', dateTo);
  
  const response = await fetch(`/api/business/orders/stats?${params}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  return await response.json();
};
```

### Python/Requests

```python
import requests

def get_orders(token, page=1):
    headers = {'Authorization': f'Bearer {token}'}
    response = requests.get(f'/api/business/orders?page={page}', headers=headers)
    return response.json()

def get_order_by_id(token, order_id):
    headers = {'Authorization': f'Bearer {token}'}
    response = requests.get(f'/api/business/orders/{order_id}', headers=headers)
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

---

## Аутентификация бизнеса

Для получения токена бизнеса используйте токен из таблицы `businesses.token`. Этот токен должен передаваться в заголовке `Authorization` со всеми запросами к business API.

Пример токена: `business_abc123def456`

## База данных

### Используемые таблицы:
- `businesses` - информация о бизнесах и их токены
- `orders` - основная информация о заказах
- `order_status` - история статусов заказов
- `orders_cost` - информация о стоимости заказов
- `orders_items` - товары в заказах
- `user` - информация о пользователях
- `user_addreses` - адреса пользователей
- `payment_types` - типы оплаты
