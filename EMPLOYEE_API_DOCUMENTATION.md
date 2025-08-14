# Employee API Documentation

Документация API для сотрудников системы Naliv Backend.

## Описание

Employee API предоставляет сотрудникам возможность просматривать и анализировать заказы в системе. API включает функции для получения списка заказов, детальной информации о заказах и статистики.

## Аутентификация

Все эндпоинты Employee API требуют аутентификации сотрудника.

### Заголовки запроса

```
Authorization: Bearer YOUR_EMPLOYEE_TOKEN
Content-Type: application/json
```

### Получение токена

Токен получается через эндпоинт авторизации сотрудника:

```bash
POST /api/employee/auth/login
{
  "login": "employee_login",
  "password": "employee_password"
}
```

## Базовый URL

```
http://localhost:3000/api/employee
```

## Эндпоинты

### 1. Получить список заказов

Получение списка всех заказов с возможностью фильтрации и пагинации.

**GET** `/api/employee/orders`

#### Параметры запроса (Query Parameters)

| Параметр | Тип | Обязательный | Описание |
|----------|-----|--------------|----------|
| `page` | number | Нет | Номер страницы (по умолчанию: 1) |
| `limit` | number | Нет | Количество записей на странице (по умолчанию: 20, максимум: 100) |
| `status` | number | Нет | Фильтр по статусу заказа (0-66) |
| `business_id` | number | Нет | Фильтр по ID бизнеса |
| `start_date` | string | Нет | Дата начала периода (YYYY-MM-DD или YYYY-MM-DD HH:mm:ss) |
| `end_date` | string | Нет | Дата окончания периода (YYYY-MM-DD или YYYY-MM-DD HH:mm:ss) |
| `search` | string | Нет | Поиск по UUID заказа, имени клиента, курьера, бизнеса или адресу |

#### Статусы заказов

| Статус | Описание |
|--------|----------|
| 0 | Новый заказ |
| 1 | Принят магазином |
| 2 | Готов к выдаче |
| 3 | Доставляется |
| 4 | Доставлен |
| 5 | Отменен |
| 6 | Ошибка платежа |
| 66 | Не оплачен |

#### Пример запроса

```bash
GET /api/employee/orders?page=1&limit=20&status=4&start_date=2024-01-01&end_date=2024-01-31
Authorization: Bearer your_employee_token
```

#### Пример ответа

```json
{
  "success": true,
  "data": {
    "orders": [
      {
        "order_id": 123,
        "order_uuid": "550e8400-e29b-41d4-a716-446655440000",
        "total_sum": 5500,
        "delivery_price": 500,
        "order_created": "2024-01-15T10:30:00.000Z",
        "current_status": 4,
        "status_updated": "2024-01-15T11:45:00.000Z",
        "customer": {
          "user_id": 456,
          "name": "Иван Иванов",
          "login": "+77071234567"
        },
        "business": {
          "business_id": 789,
          "name": "Супермаркет ABC",
          "address": "ул. Абая 123, Алматы"
        },
        "courier": {
          "courier_id": 321,
          "login": "courier123",
          "name": "Петр Петров"
        },
        "delivery_address": {
          "address_id": 654,
          "address": "ул. Назарбаева 456, кв. 10",
          "lat": 43.2220,
          "lon": 76.8512
        },
        "status_name": "Доставлен"
      }
    ],
    "statistics": {
      "total_orders": 150,
      "by_status": [
        {
          "status": 4,
          "status_name": "Доставлен",
          "count": 120
        },
        {
          "status": 5,
          "status_name": "Отменен",
          "count": 30
        }
      ]
    },
    "pagination": {
      "current_page": 1,
      "per_page": 20,
      "total": 150,
      "total_pages": 8,
      "has_next": true,
      "has_prev": false
    },
    "filters": {
      "status": 4,
      "business_id": null,
      "start_date": "2024-01-01",
      "end_date": "2024-01-31",
      "search": null
    }
  },
  "message": "Найдено 150 заказов"
}
```

### 2. Получить детали заказа

Получение подробной информации о конкретном заказе, включая список товаров, историю статусов и детали стоимости.

**GET** `/api/employee/orders/{orderId}`

#### Параметры пути

| Параметр | Тип | Обязательный | Описание |
|----------|-----|--------------|----------|
| `orderId` | number | Да | ID заказа |

#### Пример запроса

```bash
GET /api/employee/orders/123
Authorization: Bearer your_employee_token
```

#### Пример ответа

```json
{
  "success": true,
  "data": {
    "order": {
      "order_id": 123,
      "order_uuid": "550e8400-e29b-41d4-a716-446655440000",
      "total_sum": 5500,
      "delivery_price": 500,
      "order_created": "2024-01-15T10:30:00.000Z",
      "current_status": 4,
      "status_updated": "2024-01-15T11:45:00.000Z",
      "status_name": "Доставлен",
      "customer": {
        "user_id": 456,
        "name": "Иван Иванов",
        "login": "+77071234567"
      },
      "business": {
        "business_id": 789,
        "name": "Супермаркет ABC",
        "address": "ул. Абая 123, Алматы",
        "phone": "+77012345678"
      },
      "courier": {
        "courier_id": 321,
        "login": "courier123",
        "name": "Петр Петров"
      },
      "delivery_address": {
        "address_id": 654,
        "address": "ул. Назарбаева 456, кв. 10",
        "lat": 43.2220,
        "lon": 76.8512,
        "apartment": "10",
        "entrance": "2",
        "floor": "3",
        "comment": "Домофон не работает"
      }
    },
    "items": [
      {
        "order_item_id": 1001,
        "item_id": 2001,
        "name": "Хлеб белый",
        "description": "Свежий белый хлеб",
        "image": "bread.jpg",
        "unit": "шт",
        "amount": 2,
        "price": 200,
        "subtotal": 400
      },
      {
        "order_item_id": 1002,
        "item_id": 2002,
        "name": "Молоко",
        "description": "Молоко 3.2% жирности",
        "image": "milk.jpg",
        "unit": "л",
        "amount": 1,
        "price": 350,
        "subtotal": 350
      }
    ],
    "cost_breakdown": {
      "cost": 5000,
      "delivery": 500,
      "service_fee": 0,
      "total_cost": 5500
    },
    "status_history": [
      {
        "status": 4,
        "status_name": "Доставлен",
        "timestamp": "2024-01-15T11:45:00.000Z",
        "is_canceled": false
      },
      {
        "status": 3,
        "status_name": "Доставляется",
        "timestamp": "2024-01-15T11:00:00.000Z",
        "is_canceled": false
      },
      {
        "status": 2,
        "status_name": "Готов к выдаче",
        "timestamp": "2024-01-15T10:45:00.000Z",
        "is_canceled": false
      },
      {
        "status": 1,
        "status_name": "Принят магазином",
        "timestamp": "2024-01-15T10:35:00.000Z",
        "is_canceled": false
      },
      {
        "status": 0,
        "status_name": "Новый заказ",
        "timestamp": "2024-01-15T10:30:00.000Z",
        "is_canceled": false
      }
    ]
  },
  "message": "Детали заказа #550e8400-e29b-41d4-a716-446655440000"
}
```

### 3. Получить статистику заказов

Получение аналитических данных по заказам за определенный период.

**GET** `/api/employee/orders/statistics`

#### Параметры запроса (Query Parameters)

| Параметр | Тип | Обязательный | Описание |
|----------|-----|--------------|----------|
| `start_date` | string | Нет | Дата начала периода (YYYY-MM-DD или YYYY-MM-DD HH:mm:ss) |
| `end_date` | string | Нет | Дата окончания периода (YYYY-MM-DD или YYYY-MM-DD HH:mm:ss) |
| `business_id` | number | Нет | Фильтр по ID бизнеса |

#### Пример запроса

```bash
GET /api/employee/orders/statistics?start_date=2024-01-01&end_date=2024-01-31
Authorization: Bearer your_employee_token
```

#### Пример ответа

```json
{
  "success": true,
  "data": {
    "period": {
      "start_date": "2024-01-01",
      "end_date": "2024-01-31",
      "business_id": null
    },
    "general": {
      "total_orders": 1250,
      "delivered_orders": 1100,
      "canceled_orders": 50,
      "pending_orders": 100,
      "total_revenue": 2750000,
      "delivery_revenue": 125000,
      "avg_order_value": 2200,
      "success_rate": 88
    },
    "by_status": [
      {
        "status": 0,
        "status_name": "Новый заказ",
        "count": 25,
        "percentage": 2.0
      },
      {
        "status": 1,
        "status_name": "Принят магазином",
        "count": 30,
        "percentage": 2.4
      },
      {
        "status": 2,
        "status_name": "Готов к выдаче",
        "count": 20,
        "percentage": 1.6
      },
      {
        "status": 3,
        "status_name": "Доставляется",
        "count": 25,
        "percentage": 2.0
      },
      {
        "status": 4,
        "status_name": "Доставлен",
        "count": 1100,
        "percentage": 88.0
      },
      {
        "status": 5,
        "status_name": "Отменен",
        "count": 50,
        "percentage": 4.0
      }
    ],
    "top_businesses": [
      {
        "business_id": 789,
        "business_name": "Супермаркет ABC",
        "orders_count": 250,
        "revenue": 550000
      },
      {
        "business_id": 790,
        "business_name": "Магазин XYZ",
        "orders_count": 200,
        "revenue": 440000
      }
    ]
  },
  "message": "Статистика заказов получена"
}
```

## Коды ошибок

| Код | Описание |
|-----|----------|
| 200 | Успешный запрос |
| 400 | Неверные параметры запроса |
| 401 | Не авторизован (отсутствует или недействительный токен) |
| 403 | Доступ запрещен (недостаточно прав) |
| 404 | Ресурс не найден |
| 500 | Внутренняя ошибка сервера |

### Пример ошибки

```json
{
  "success": false,
  "error": {
    "message": "Сотрудник не авторизован",
    "statusCode": 401,
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

## Примеры использования

### JavaScript/Node.js

```javascript
const API_BASE_URL = 'http://localhost:3000';
const token = 'your_employee_token';

// Получить список заказов
async function getOrders() {
  const response = await fetch(`${API_BASE_URL}/api/employee/orders?page=1&limit=20`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  
  const data = await response.json();
  return data;
}

// Получить детали заказа
async function getOrderDetails(orderId) {
  const response = await fetch(`${API_BASE_URL}/api/employee/orders/${orderId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  
  const data = await response.json();
  return data;
}

// Получить статистику
async function getStatistics() {
  const response = await fetch(`${API_BASE_URL}/api/employee/orders/statistics`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  
  const data = await response.json();
  return data;
}
```

### cURL

```bash
# Получить список заказов
curl -X GET "http://localhost:3000/api/employee/orders?page=1&limit=20" \
  -H "Authorization: Bearer your_employee_token" \
  -H "Content-Type: application/json"

# Получить детали заказа
curl -X GET "http://localhost:3000/api/employee/orders/123" \
  -H "Authorization: Bearer your_employee_token" \
  -H "Content-Type: application/json"

# Получить статистику
curl -X GET "http://localhost:3000/api/employee/orders/statistics?start_date=2024-01-01&end_date=2024-01-31" \
  -H "Authorization: Bearer your_employee_token" \
  -H "Content-Type: application/json"
```

### Python

```python
import requests

API_BASE_URL = 'http://localhost:3000'
token = 'your_employee_token'

headers = {
    'Authorization': f'Bearer {token}',
    'Content-Type': 'application/json'
}

# Получить список заказов
def get_orders(page=1, limit=20, status=None):
    params = {'page': page, 'limit': limit}
    if status:
        params['status'] = status
    
    response = requests.get(
        f'{API_BASE_URL}/api/employee/orders',
        headers=headers,
        params=params
    )
    return response.json()

# Получить детали заказа
def get_order_details(order_id):
    response = requests.get(
        f'{API_BASE_URL}/api/employee/orders/{order_id}',
        headers=headers
    )
    return response.json()

# Получить статистику
def get_statistics(start_date=None, end_date=None):
    params = {}
    if start_date:
        params['start_date'] = start_date
    if end_date:
        params['end_date'] = end_date
    
    response = requests.get(
        f'{API_BASE_URL}/api/employee/orders/statistics',
        headers=headers,
        params=params
    )
    return response.json()
```

## Тестирование

Для тестирования API можно использовать прилагаемый HTML файл `test-employee-api.html`, который предоставляет удобный интерфейс для всех эндпоинтов.

### Запуск тестов

1. Откройте файл `test-employee-api.html` в браузере
2. Введите токен сотрудника
3. Настройте параметры фильтрации
4. Нажмите соответствующие кнопки для тестирования

## Безопасность

- Все запросы должны содержать действительный JWT токен сотрудника
- Токены имеют ограниченное время жизни
- API логирует все запросы для аудита
- Чувствительные данные не передаются в логах

## Ограничения

- Максимальный лимит записей на странице: 100
- Максимальная длина поискового запроса: 255 символов
- Период для фильтрации не может превышать 1 год
- Токен сотрудника действителен в течение 24 часов

## Поддержка

Для получения поддержки или сообщения об ошибках обратитесь к администратору системы.

## Изменения версий

### Версия 1.0.0 (текущая)
- Первый релиз Employee API
- Базовые функции просмотра заказов
- Детальная информация о заказах
- Статистика и аналитика
- Полная фильтрация и поиск
