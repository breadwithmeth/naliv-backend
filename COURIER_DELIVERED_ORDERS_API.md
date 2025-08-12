# 🚚 API доставленных заказов курьера

## Обзор

Новый API эндпоинт для получения доставленных заказов курьера за заданный период. Возвращает только заказы со статусом 4 (доставлен) с использованием последней записи из таблицы `order_status`.

## Эндпоинт

```
GET /api/courier/orders/delivered
```

### Авторизация
Требуется токен курьера в заголовке `Authorization: Bearer <token>`

### Параметры запроса

| Параметр | Тип | Обязательный | Описание |
|----------|-----|--------------|----------|
| `start_date` | string | ✅ | Дата начала периода (YYYY-MM-DD или YYYY-MM-DD HH:mm:ss) |
| `end_date` | string | ✅ | Дата окончания периода (YYYY-MM-DD или YYYY-MM-DD HH:mm:ss) |
| `page` | number | ❌ | Номер страницы (по умолчанию: 1) |
| `limit` | number | ❌ | Количество заказов на странице (по умолчанию: 20, максимум: 100) |

### Примеры запросов

#### Базовый запрос за период
```bash
curl -X GET "http://localhost:3000/api/courier/orders/delivered" \
  -H "Authorization: Bearer courier_token_here" \
  -G \
  -d "start_date=2024-01-01" \
  -d "end_date=2024-01-31"
```

#### Запрос с точным временем
```bash
curl -X GET "http://localhost:3000/api/courier/orders/delivered" \
  -H "Authorization: Bearer courier_token_here" \
  -G \
  -d "start_date=2024-01-01 00:00:00" \
  -d "end_date=2024-01-31 23:59:59" \
  -d "page=1" \
  -d "limit=10"
```

## Ответ API

### Успешный ответ (200 OK)

```json
{
  "success": true,
  "data": {
    "orders": [
      {
        "order_id": 12345,
        "order_uuid": "ORDER-1234567890-ABC123",
        "business": {
          "business_id": 1,
          "name": "Магазин продуктов",
          "address": "ул. Абая 123",
          "coordinates": {
            "lat": 43.2220,
            "lon": 76.8512
          }
        },
        "user": {
          "user_id": 252,
          "name": "Иван Иванов"
        },
        "delivery_address": {
          "address_id": 45,
          "name": "Дом",
          "address": "ул. Назарбаева 456",
          "coordinates": {
            "lat": 43.2330,
            "lon": 76.8622
          },
          "details": {
            "apartment": "25",
            "entrance": "2",
            "floor": "5",
            "comment": "Домофон 123"
          }
        },
        "delivery_price": 500,
        "total_order_cost": 2750,
        "delivery_date": "2024-01-15T15:00:00.000Z",
        "order_created": "2024-01-15T10:00:00.000Z",
        "status": {
          "status": 4,
          "status_name": "Доставлен"
        }
      }
    ],
    "period": {
      "start_date": "2024-01-01",
      "end_date": "2024-01-31"
    },
    "statistics": {
      "total_delivered": 25,
      "total_earnings": 12500,
      "avg_delivery_price": 500
    },
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 25,
      "totalPages": 2,
      "hasNext": true,
      "hasPrev": false
    }
  },
  "message": "Найдено 25 доставленных заказов за период с 2024-01-01 по 2024-01-31"
}
```

### Ответ без заказов (200 OK)

```json
{
  "success": true,
  "data": {
    "orders": [],
    "period": {
      "start_date": "2024-01-01",
      "end_date": "2024-01-31"
    },
    "statistics": {
      "total_delivered": 0,
      "total_earnings": 0,
      "avg_delivery_price": 0
    },
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 0,
      "totalPages": 0,
      "hasNext": false,
      "hasPrev": false
    }
  },
  "message": "Нет доставленных заказов за период с 2024-01-01 по 2024-01-31"
}
```

### Ошибки

#### 401 - Не авторизован
```json
{
  "success": false,
  "error": {
    "message": "Требуется авторизация курьера",
    "statusCode": 401
  }
}
```

#### 400 - Неверные параметры
```json
{
  "success": false,
  "error": {
    "message": "Необходимо указать start_date и end_date",
    "statusCode": 400
  }
}
```

## Структура данных

### Order Object
```typescript
interface DeliveredOrder {
  order_id: number;
  order_uuid: string;
  business: {
    business_id: number;
    name: string;
    address: string;
    coordinates: {
      lat: number;
      lon: number;
    };
  } | null;
  user: {
    user_id: number;
    name: string;
  } | null;
  delivery_address: {
    address_id: number;
    name: string;
    address: string;
    coordinates: {
      lat: number;
      lon: number;
    };
    details: {
      apartment?: string;
      entrance?: string;
      floor?: string;
      comment?: string;
    };
  } | null;
  delivery_price: number;
  total_order_cost: number;
  delivery_date: string;
  order_created: string;
  status: {
    status: 4;
    status_name: "Доставлен";
  };
}
```

### Statistics Object
```typescript
interface Statistics {
  total_delivered: number;      // Общее количество доставленных заказов
  total_earnings: number;       // Общий заработок за доставки
  avg_delivery_price: number;   // Средняя цена доставки
}
```

## Особенности реализации

### ✅ Использование order_status
- Статус заказа определяется из последней записи в таблице `order_status`
- Использует оконную функцию `ROW_NUMBER()` для получения актуального статуса
- Фильтрует только заказы со статусом 4 (доставлен)

### ✅ Обработка дат
- Поддержка различных форматов дат: YYYY-MM-DD, YYYY-MM-DD HH:mm:ss
- Автоматическая установка времени для дат без времени
- Валидация корректности периода

### ✅ Статистика
- Подсчет общего количества доставленных заказов
- Расчет общего заработка курьера
- Вычисление средней цены доставки

### ✅ Производительность
- Эффективные SQL запросы с JOIN'ами
- Пагинация для больших наборов данных
- Использование Map для быстрого доступа к связанным данным

## Тестирование

Используйте HTML файл `test-courier-delivered-orders.html` для тестирования API:

1. Откройте файл в браузере
2. Введите токен авторизации курьера
3. Выберите период дат
4. Нажмите "Получить доставленные заказы"

## Интеграция

### JavaScript/TypeScript
```typescript
interface DeliveredOrdersParams {
  start_date: string;
  end_date: string;
  page?: number;
  limit?: number;
}

async function getDeliveredOrders(
  token: string, 
  params: DeliveredOrdersParams
) {
  const searchParams = new URLSearchParams(params as any);
  
  const response = await fetch(
    `/api/courier/orders/delivered?${searchParams}`, 
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }
  );
  
  return response.json();
}
```

### React Hook
```typescript
const useDeliveredOrders = (token: string, params: DeliveredOrdersParams) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchOrders = async () => {
      setLoading(true);
      try {
        const result = await getDeliveredOrders(token, params);
        setData(result);
      } catch (err) {
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    if (token && params.start_date && params.end_date) {
      fetchOrders();
    }
  }, [token, params.start_date, params.end_date, params.page]);

  return { data, loading, error };
};
```

---

**Дата создания:** 12 августа 2025  
**Статус:** ✅ Готово к использованию
