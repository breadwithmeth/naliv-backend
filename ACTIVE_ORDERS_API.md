# API для получения активных заказов

## Описание
API предоставляет различные способы получения активных заказов в системе. Активными считаются заказы со статусами: 66 (новый), 0 (оплачен), 1 (в обработке), 2 (собран), 3 (передан курьеру), 4 (в пути).

## Endpoints

### 1. Получение активных заказов
**GET** `/api/orders/active`

Получение списка активных заказов с фильтрацией по правам доступа.

#### Авторизация
- Пользователи: видят только свои заказы
- Сотрудники: видят все активные заказы

#### Query параметры
- `page` (optional): Номер страницы (по умолчанию: 1)
- `limit` (optional): Количество заказов на странице (макс: 100, по умолчанию: 20)
- `business_id` (optional): ID бизнеса для фильтрации

#### Пример запроса
```bash
curl -X GET "https://api.naliv.kz/api/orders/active?page=1&limit=10&business_id=1" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### Пример ответа
```json
{
  "success": true,
  "data": {
    "orders": [
      {
        "order_id": 123,
        "order_uuid": "1234567890123",
        "user_id": 456,
        "business_id": 1,
        "delivery_type": "DELIVERY",
        "current_status": {
          "status": 0,
          "name": "Оплачен",
          "color": "#4caf50",
          "icon": "paid",
          "time_ago": "5 мин назад"
        },
        "business": {
          "business_id": 1,
          "name": "Алкомаркет №1",
          "address": "ул. Абая 123",
          "logo": "logo.jpg"
        },
        "user": {
          "user_id": 456,
          "name": "Иван Иванов",
          "login": "+77017777777"
        },
        "cost": {
          "total": 5500,
          "delivery": 500,
          "service_fee": 0
        },
        "items_count": 3,
        "time_since_created": "10 мин назад"
      }
    ],
    "pagination": {
      "current_page": 1,
      "per_page": 10,
      "total": 25,
      "total_pages": 3,
      "total_all_orders": 150
    },
    "filters": {
      "business_id": 1,
      "only_user_orders": null
    }
  },
  "message": "Найдено 25 активных заказов"
}
```

### 2. Сводка активных заказов
**GET** `/api/orders/active/summary`

Получение сводной информации по активным заказам для дашборда.

#### Query параметры
- `business_id` (optional): ID бизнеса для фильтрации

#### Пример запроса
```bash
curl -X GET "https://api.naliv.kz/api/orders/active/summary?business_id=1" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### Пример ответа
```json
{
  "success": true,
  "data": {
    "summary": {
      "new_orders": 5,
      "paid_orders": 12,
      "processing_orders": 8,
      "ready_orders": 3,
      "courier_orders": 4,
      "delivery_orders": 2,
      "urgent_orders": 3,
      "total_active": 34,
      "total_amount": 125500
    },
    "business_id": 1,
    "timestamp": "2025-07-29T12:00:00.000Z"
  },
  "message": "Сводка активных заказов получена"
}
```

### 3. Активные заказы конкретного бизнеса
**GET** `/api/orders/business/:businessId/active`

Получение активных заказов для конкретного бизнеса (только для сотрудников).

#### Path параметры
- `businessId`: ID бизнеса

#### Query параметры
- `page` (optional): Номер страницы (по умолчанию: 1)
- `limit` (optional): Количество заказов на странице (макс: 100, по умолчанию: 50)

#### Пример запроса
```bash
curl -X GET "https://api.naliv.kz/api/orders/business/1/active?page=1&limit=20" \
  -H "Authorization: Bearer EMPLOYEE_TOKEN"
```

#### Пример ответа
```json
{
  "success": true,
  "data": {
    "business": {
      "business_id": 1,
      "name": "Алкомаркет №1",
      "address": "ул. Абая 123"
    },
    "total_active_orders": 15,
    "urgent_orders": 3,
    "orders": [
      {
        "order_id": 123,
        "order_uuid": "1234567890123",
        "current_status": {
          "status": 66,
          "name": "Новый заказ",
          "color": "#ffa500",
          "icon": "pending",
          "priority": 1,
          "time_ago": "2 мин назад"
        },
        "user": {
          "user_id": 456,
          "name": "Иван Иванов",
          "login": "+77017777777"
        },
        "delivery_address": {
          "address_id": 789,
          "address": "ул. Кенесары 45, кв. 12",
          "name": "Дом",
          "lat": 43.238949,
          "lon": 76.889709
        },
        "cost": {
          "total": 5500,
          "delivery": 500,
          "service_fee": 0
        },
        "items_count": 3,
        "time_since_created": "5 мин назад",
        "requires_urgent_attention": true
      }
    ],
    "orders_by_status": {
      "66": {
        "status_info": {
          "status": 66,
          "name": "Новый заказ",
          "color": "#ffa500",
          "icon": "pending"
        },
        "orders": [...]
      },
      "0": {
        "status_info": {
          "status": 0,
          "name": "Оплачен",
          "color": "#4caf50",
          "icon": "paid"
        },
        "orders": [...]
      }
    },
    "pagination": {
      "current_page": 1,
      "per_page": 20,
      "total": 15,
      "total_pages": 1
    }
  },
  "message": "Найдено 15 активных заказов для бизнеса \"Алкомаркет №1\""
}
```

## Статусы заказов

| Код | Название | Описание | Цвет |
|-----|----------|----------|------|
| 66 | Новый заказ | Заказ создан, ожидает оплаты | #ffa500 |
| 0 | Оплачен | Заказ оплачен, передан в обработку | #4caf50 |
| 1 | В обработке | Заказ принят в обработку | #2196f3 |
| 2 | Собран | Заказ собран, готов к доставке | #9c27b0 |
| 3 | Передан курьеру | Заказ передан курьеру | #ff9800 |
| 4 | В пути | Курьер направляется к клиенту | #607d8b |
| 5 | Доставлен | Заказ доставлен (неактивный) | #4caf50 |
| 99 | Отменен | Заказ отменен (неактивный) | #ff4444 |

## Критерии срочности

Заказ считается требующим срочного внимания в следующих случаях:
- Новый заказ (статус 66) - требует оплаты
- Оплаченный заказ (статус 0) простаивает более 15 минут
- Заказ в обработке (статус 1) простаивает более 30 минут

## Коды ошибок

| Код | Описание |
|-----|----------|
| 400 | Неверные параметры запроса |
| 401 | Требуется авторизация |
| 403 | Доступ запрещен |
| 404 | Бизнес не найден |
| 500 | Внутренняя ошибка сервера |

## Примеры использования

### JavaScript/Frontend
```javascript
// Получение активных заказов пользователя
async function getMyActiveOrders() {
  const response = await fetch('/api/orders/active', {
    headers: {
      'Authorization': `Bearer ${userToken}`
    }
  });
  const data = await response.json();
  return data.data.orders;
}

// Сводка для дашборда сотрудника
async function getDashboardSummary(businessId) {
  const response = await fetch(`/api/orders/active/summary?business_id=${businessId}`, {
    headers: {
      'Authorization': `Bearer ${employeeToken}`
    }
  });
  const data = await response.json();
  return data.data.summary;
}

// Активные заказы бизнеса для операторов
async function getBusinessActiveOrders(businessId, page = 1) {
  const response = await fetch(`/api/orders/business/${businessId}/active?page=${page}`, {
    headers: {
      'Authorization': `Bearer ${employeeToken}`
    }
  });
  const data = await response.json();
  return data.data;
}
```

### React Hook пример
```jsx
import { useState, useEffect } from 'react';

function useActiveOrders(businessId) {
  const [orders, setOrders] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [ordersRes, summaryRes] = await Promise.all([
          fetch(`/api/orders/business/${businessId}/active`),
          fetch(`/api/orders/active/summary?business_id=${businessId}`)
        ]);
        
        const ordersData = await ordersRes.json();
        const summaryData = await summaryRes.json();
        
        setOrders(ordersData.data.orders);
        setSummary(summaryData.data.summary);
      } catch (error) {
        console.error('Ошибка загрузки активных заказов:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 30000); // Обновляем каждые 30 секунд
    
    return () => clearInterval(interval);
  }, [businessId]);

  return { orders, summary, loading };
}
```
