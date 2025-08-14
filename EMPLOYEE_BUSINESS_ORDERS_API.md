# Employee Business Orders API Documentation

## Описание

API эндпоинт `getBusinessOrders` предназначен для получения списка заказов конкретного бизнеса сотрудником. Функция предоставляет детальную информацию о заказах с возможностью фильтрации и пагинации.

## Эндпоинт

```
GET /api/employee/business-orders/:businessId
```

## Аутентификация

Требуется токен авторизации сотрудника в заголовке `Authorization`:
```
Authorization: Bearer <employee_token>
```

## Параметры маршрута

| Параметр | Тип | Описание |
|----------|-----|----------|
| businessId | number | ID бизнеса (обязательный) |

## Параметры запроса (Query Parameters)

| Параметр | Тип | Описание | По умолчанию |
|----------|-----|----------|--------------|
| page | number | Номер страницы | 1 |
| limit | number | Количество записей на странице (максимум 100) | 20 |
| date_from | string | Дата начала фильтрации (YYYY-MM-DD) | - |
| date_to | string | Дата окончания фильтрации (YYYY-MM-DD) | - |
| status | number | Фильтр по статусу заказа | - |

## Статусы заказов

| Статус | Название |
|--------|----------|
| 0 | Новый заказ |
| 1 | Принят магазином |
| 2 | Готов к выдаче |
| 3 | Доставляется |
| 4 | Доставлен |
| 5 | Отменен |
| 6 | Ошибка платежа |
| 66 | Не оплачен |

## Пример запроса

```bash
curl -X GET "http://localhost:3000/api/employee/business-orders/123?page=1&limit=20&date_from=2024-01-01&date_to=2024-12-31&status=4" \
  -H "Authorization: Bearer <employee_token>" \
  -H "Content-Type: application/json"
```

## Структура ответа

### Успешный ответ (200 OK)

```json
{
  "success": true,
  "data": {
    "orders": [
      {
        "order_id": 12345,
        "order_uuid": "uuid-string",
        "customer": {
          "user_id": 67890,
          "name": "Иван Иванов",
          "login": "ivan@example.com"
        },
        "delivery_address": {
          "address_id": 111,
          "address": "ул. Примерная, 123",
          "coordinates": {
            "lat": 43.2220,
            "lon": 76.8512
          },
          "details": {
            "apartment": "45",
            "entrance": "2",
            "floor": "5",
            "comment": "Домофон не работает"
          }
        },
        "delivery_type": 1,
        "delivery_price": 500,
        "items_cost": 2500,
        "service_fee": 250,
        "total_sum": 3250,
        "payment_type": {
          "payment_type_id": 1,
          "name": "Наличные"
        },
        "current_status": {
          "status": 4,
          "status_name": "Доставлен",
          "timestamp": "2024-01-15T14:30:00.000Z",
          "is_canceled": false
        },
        "items": [
          {
            "order_item_id": 1,
            "item_id": 456,
            "name": "Товар",
            "description": "",
            "image": "",
            "unit": "",
            "amount": 2,
            "price": 1250,
            "subtotal": 2500
          }
        ],
        "items_count": 2,
        "extra": null,
        "delivery_date": "2024-01-15T12:00:00.000Z",
        "order_created": "2024-01-15T10:00:00.000Z",
        "bonus": 0
      }
    ],
    "pagination": {
      "current_page": 1,
      "per_page": 20,
      "total": 15,
      "total_orders": 100,
      "total_pages": 1,
      "has_next": false,
      "has_prev": false
    },
    "business": {
      "business_id": 123,
      "name": "Супермаркет ABC",
      "address": "ул. Торговая, 1"
    },
    "statistics": {
      "by_status": [
        {
          "status": 4,
          "status_name": "Доставлен",
          "count": 10
        },
        {
          "status": 5,
          "status_name": "Отменен",
          "count": 5
        }
      ]
    },
    "filters": {
      "date_from": "2024-01-01",
      "date_to": "2024-12-31",
      "status": 4
    }
  },
  "message": "Найдено 15 заказов для бизнеса \"Супермаркет ABC\""
}
```

### Ошибки

#### 401 Unauthorized
```json
{
  "success": false,
  "error": {
    "message": "Сотрудник не авторизован",
    "statusCode": 401,
    "timestamp": "2024-01-15T10:00:00.000Z"
  }
}
```

#### 400 Bad Request
```json
{
  "success": false,
  "error": {
    "message": "Неверный ID бизнеса",
    "statusCode": 400,
    "timestamp": "2024-01-15T10:00:00.000Z"
  }
}
```

#### 404 Not Found
```json
{
  "success": false,
  "error": {
    "message": "Бизнес не найден",
    "statusCode": 404,
    "timestamp": "2024-01-15T10:00:00.000Z"
  }
}
```

## Особенности реализации

### Валидация дат
- Функция использует метод `validateAndParseDate` для корректной обработки дат
- Поддерживаются форматы: `YYYY-MM-DD`, `YYYY-MM-DD HH:mm:ss`, ISO 8601
- Для дат без времени автоматически устанавливается начало/конец дня

### Оптимизация запросов
- Используются параллельные запросы для получения связанных данных
- Применяется пагинация для ограничения количества записей
- Статусы заказов получаются через SQL с оконными функциями

### Фильтрация
- Фильтрация по статусу применяется на уровне приложения после получения данных
- Фильтрация по датам применяется на уровне базы данных для оптимизации

### Безопасность
- Все запросы требуют аутентификации сотрудника
- Валидация всех входящих параметров
- Использование типизированных запросов для предотвращения SQL-инъекций

## Примеры использования

### Получение всех заказов бизнеса
```bash
GET /api/employee/business-orders/123
```

### Получение заказов с фильтрацией по статусу
```bash
GET /api/employee/business-orders/123?status=4
```

### Получение заказов за определенный период
```bash
GET /api/employee/business-orders/123?date_from=2024-01-01&date_to=2024-01-31
```

### Пагинация
```bash
GET /api/employee/business-orders/123?page=2&limit=50
```

### Комбинированная фильтрация
```bash
GET /api/employee/business-orders/123?page=1&limit=20&date_from=2024-01-01&date_to=2024-01-31&status=4
```

## Тестирование

Для тестирования API создан HTML-файл `test-employee-business-orders.html` с интерактивным интерфейсом, который позволяет:

- Ввести токен авторизации сотрудника
- Указать ID бизнеса
- Настроить фильтры (даты, статус, пагинация)
- Просмотреть детальные результаты запроса
- Навигация по страницам результатов

## Связанные эндпоинты

- `GET /api/employee/orders` - Общий список заказов для сотрудника
- `GET /api/employee/orders/:orderId` - Детали конкретного заказа
- `GET /api/employee/orders/statistics` - Статистика заказов

## Версия API

Версия: 1.0
Дата создания: 2024-01-15
Совместимость: TypeScript 4.0+, Node.js 16+
