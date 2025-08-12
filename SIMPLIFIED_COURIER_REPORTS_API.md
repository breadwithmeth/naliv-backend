# Simplified Courier Reports API Documentation

## Базовая информация
- **Базовый URL**: `/api/businesses/reports`
- **Авторизация**: Bearer токен бизнеса (обязательно)
- **Формат ответов**: JSON

## Аутентификация

Все эндпоинты отчетов требуют авторизации бизнеса. Токен должен быть передан в заголовке Authorization:

```
Authorization: Bearer <business_token>
```

## Упрощенные отчеты по доставкам

### 1. Список доставленных заказов
```http
GET /api/businesses/reports/couriers
Authorization: Bearer <business_token>
```

**Описание**: Возвращает простой список всех заказов со статусом 4 (доставлен) с информацией о курьере, если он назначен.

**Параметры запроса:**
- `start_date` (обязательный) - дата/время начала периода
- `end_date` (обязательный) - дата/время окончания периода

**Поддерживаемые форматы даты:**
- `YYYY-MM-DD` - только дата
- `YYYY-MM-DD HH:mm` - дата с временем
- `YYYY-MM-DD HH:mm:ss` - полное время

**Пример запроса:**
```
GET /api/businesses/reports/couriers?start_date=2025-08-01&end_date=2025-08-10
Authorization: Bearer abc123business_token_here
```

**Ответ 200:**
```json
{
  "success": true,
  "data": {
    "period": {
      "start_date": "2025-08-01",
      "end_date": "2025-08-10"
    },
    "summary": {
      "total_delivered_orders": 25,
      "orders_with_courier": 20,
      "orders_without_courier": 5,
      "total_revenue": 125000,
      "total_delivery_revenue": 12500
    },
    "orders": [
      {
        "order_id": 1234,
        "order_uuid": "uuid-string-here",
        "delivery_price": 500,
        "total_sum": 5000,
        "order_created": "2025-08-10T15:30:00Z",
        "courier": {
          "courier_id": 5,
          "login": "courier_ivan",
          "name": "Иван Петров"
        },
        "business_name": "Магазин продуктов",
        "customer_name": "Алия Нурманова",
        "delivery_address": "ул. Абая 123"
      },
      {
        "order_id": 1235,
        "order_uuid": "uuid-string-here-2",
        "delivery_price": 400,
        "total_sum": 3200,
        "order_created": "2025-08-10T14:15:00Z",
        "courier": null,
        "business_name": "Супермаркет",
        "customer_name": "Марат Исмаилов",
        "delivery_address": "ул. Жандосова 234"
      }
    ]
  },
  "message": "Найдено 25 доставленных заказов за период с 2025-08-01 по 2025-08-10"
}
```

### 2. Заказы конкретного курьера
```http
GET /api/businesses/reports/courier/:courierId
Authorization: Bearer <business_token>
```

**Описание**: Возвращает все доставленные заказы (статус 4) конкретного курьера за период.

**Параметры URL:**
- `courierId` - ID курьера

**Параметры запроса:**
- `start_date` (обязательный) - дата/время начала периода
- `end_date` (обязательный) - дата/время окончания периода

**Пример запроса:**
```
GET /api/businesses/reports/courier/5?start_date=2025-08-01&end_date=2025-08-10
Authorization: Bearer abc123business_token_here
```

**Ответ 200:**
```json
{
  "success": true,
  "data": {
    "courier_info": {
      "courier_id": 5,
      "login": "courier_ivan",
      "full_name": "Иван Петров",
      "name": "Иван",
      "courier_type": 1,
      "city_name": "Алматы",
      "member_since": "2025-07-15T10:00:00Z"
    },
    "period": {
      "start_date": "2025-08-01",
      "end_date": "2025-08-10"
    },
    "statistics": {
      "total_delivered_orders": 15,
      "total_earnings": 7500,
      "total_order_value": 150000,
      "avg_delivery_price": 500
    },
    "orders": [
      {
        "order_id": 1234,
        "order_uuid": "uuid-string-here",
        "delivery_price": 500,
        "total_sum": 5000,
        "business_name": "Магазин продуктов",
        "business_address": "ул. Тимирязева 42",
        "customer_name": "Алия Нурманова",
        "delivery_address": "ул. Абая 123",
        "order_created": "2025-08-10T15:30:00Z"
      }
    ]
  },
  "message": "Курьер Иван Петров доставил 15 заказов за период с 2025-08-01 по 2025-08-10"
}
```

## Описание полей ответа

### Summary (Сводка)
- `total_delivered_orders` - общее количество доставленных заказов
- `orders_with_courier` - заказы с назначенным курьером
- `orders_without_courier` - заказы без назначенного курьера
- `total_revenue` - общая выручка от заказов
- `total_delivery_revenue` - общая выручка от доставки

### Orders (Заказы)
- `order_id` - ID заказа
- `order_uuid` - UUID заказа
- `delivery_price` - цена доставки
- `total_sum` - общая сумма заказа
- `order_created` - время создания заказа
- `courier` - информация о курьере (может быть null)
- `business_name` - название бизнеса
- `customer_name` - имя клиента
- `delivery_address` - адрес доставки

### Courier Info (Информация о курьере)
- `courier_id` - ID курьера
- `login` - логин курьера
- `full_name` - полное имя курьера
- `name` - имя курьера
- `courier_type` - тип курьера
- `city_name` - название города
- `member_since` - дата регистрации курьера

## Коды ошибок

### 400 Bad Request
```json
{
  "success": false,
  "error": {
    "message": "Необходимо указать start_date и end_date",
    "statusCode": 400,
    "timestamp": "2025-08-12T10:30:00Z"
  }
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "error": {
    "message": "Токен авторизации не предоставлен",
    "statusCode": 401,
    "timestamp": "2025-08-12T10:30:00Z"
  }
}
```

### 404 Not Found
```json
{
  "success": false,
  "error": {
    "message": "Курьер не найден",
    "statusCode": 404,
    "timestamp": "2025-08-12T10:30:00Z"
  }
}
```

## Примеры использования

### Все доставки за день
```bash
curl -H "Authorization: Bearer your_token" \
  "http://localhost:3000/api/businesses/reports/couriers?start_date=2025-08-01&end_date=2025-08-01"
```

### Доставки за рабочее время
```bash
curl -H "Authorization: Bearer your_token" \
  "http://localhost:3000/api/businesses/reports/couriers?start_date=2025-08-01 09:00&end_date=2025-08-01 18:00"
```

### Заказы конкретного курьера
```bash
curl -H "Authorization: Bearer your_token" \
  "http://localhost:3000/api/businesses/reports/courier/5?start_date=2025-08-01&end_date=2025-08-10"
```

## Особенности

1. **Только доставленные заказы**: API возвращает только заказы со статусом 4 (доставлен)
2. **Курьер может быть null**: Некоторые заказы могут быть доставлены без назначенного курьера
3. **Бизнес-изоляция**: Каждый бизнес видит только свои заказы
4. **Гибкая фильтрация по времени**: Поддержка различных форматов даты и времени
