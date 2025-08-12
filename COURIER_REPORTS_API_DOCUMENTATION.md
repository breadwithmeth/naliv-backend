# Courier Reports API Documentation

## Базовая информация
- **Базовый URL**: `/api/businesses/reports`
- **Авторизация**: Bearer токен бизнеса (обязательно)
- **Формат ответов**: JSON

## Аутентификация

Все эндпоинты отчетов требуют авторизации бизнеса. Токен должен быть передан в заголовке Authorization:

```
Authorization: Bearer <business_token>
```

Токен проверяется в таблице `businesses` в поле `token`. Отчеты показывают данные только для авторизованного бизнеса.

## Отчеты по курьерам

### Общий отчет по курьерам за период
```http
GET /api/businesses/reports/couriers
Authorization: Bearer <business_token>
```

**Параметры запроса:**
- `start_date` (обязательный) - дата/время начала периода
  - Поддерживаемые форматы:
    - `YYYY-MM-DD` - дата (время автоматически установится на 00:00:00)
    - `YYYY-MM-DD HH:mm` - дата и время (часы:минуты)
    - `YYYY-MM-DD HH:mm:ss` - дата и время (часы:минуты:секунды)
    - `YYYY-MM-DDTHH:mm:ss` - ISO формат
    - `YYYY-MM-DDTHH:mm:ss.sssZ` - полный ISO формат с миллисекундами
- `end_date` (обязательный) - дата/время окончания периода
  - Поддерживаемые форматы: те же, что и для start_date
  - При указании только даты (YYYY-MM-DD) время автоматически установится на 23:59:59
- `city_id` (опциональный) - ID города для фильтрации
- `courier_id` (опциональный) - ID конкретного курьера для фильтрации

**Примечание:** Отчет показывает данные только для заказов авторизованного бизнеса.

**Примеры запросов:**
```
# Отчет за целый день
GET /api/businesses/reports/couriers?start_date=2025-08-01&end_date=2025-08-10&city_id=1

# Отчет за конкретные часы
GET /api/businesses/reports/couriers?start_date=2025-08-01 09:00&end_date=2025-08-01 18:00

# Отчет с точным временем
GET /api/businesses/reports/couriers?start_date=2025-08-01 09:30:00&end_date=2025-08-01 17:45:30
```

**Ответ 200:**
```json
{
  "success": true,
  "data": {
    "period": {
      "start_date": "2025-08-01",
      "end_date": "2025-08-10",
      "days_count": 10
    },
    "summary": {
      "total_orders": 156,
      "total_delivered": 142,
      "total_cancelled": 8,
      "active_couriers": 12,
      "total_delivery_revenue": 78000,
      "total_orders_revenue": 890000,
      "avg_delivery_price": 549,
      "delivery_success_rate": 91
    },
    "top_couriers": [
      {
        "courier_id": 5,
        "courier_name": "Иван Петров",
        "courier_login": "courier_ivan",
        "city_name": "Алматы",
        "delivered_orders": 23,
        "total_delivery_earnings": 12650,
        "success_rate": 96
      },
      {
        "courier_id": 8,
        "courier_name": "Марат Жакупов",
        "courier_login": "courier_marat",
        "city_name": "Алматы",
        "delivered_orders": 18,
        "total_delivery_earnings": 9900,
        "success_rate": 90
      }
    ],
    "couriers_details": [
      {
        "courier_id": 5,
        "courier_login": "courier_ivan",
        "courier_name": "Иван Петров",
        "city_name": "Алматы",
        "total_orders": 24,
        "delivered_orders": 23,
        "cancelled_orders": 1,
        "total_delivery_earnings": 12650,
        "total_order_value": 145000,
        "avg_delivery_price": 550,
        "success_rate": 96,
        "first_delivery_date": "2025-08-01T09:30:00Z",
        "last_delivery_date": "2025-08-10T18:45:00Z"
      }
    ],
    "daily_statistics": [
      {
        "date": "2025-08-01",
        "orders_count": 15,
        "delivered_count": 14,
        "active_couriers_count": 8,
        "daily_delivery_revenue": 7700,
        "success_rate": 93
      },
      {
        "date": "2025-08-02",
        "orders_count": 18,
        "delivered_count": 16,
        "active_couriers_count": 9,
        "daily_delivery_revenue": 8800,
        "success_rate": 89
      }
    ],
    "filters": {
      "city_id": 1,
      "courier_id": null
    }
  },
  "message": "Отчет по курьерам за период с 2025-08-01 по 2025-08-10"
}
```

### Детальный отчет по конкретному курьеру
```http
GET /api/businesses/reports/courier/:courierId
```

**Параметры URL:**
- `courierId` - ID курьера

**Параметры запроса:**
- `start_date` (обязательный) - дата/время начала периода
  - Поддерживаемые форматы:
    - `YYYY-MM-DD` - дата (время автоматически установится на 00:00:00)
    - `YYYY-MM-DD HH:mm` - дата и время (часы:минуты)
    - `YYYY-MM-DD HH:mm:ss` - дата и время (часы:минуты:секунды)
    - `YYYY-MM-DDTHH:mm:ss` - ISO формат
- `end_date` (обязательный) - дата/время окончания периода
  - Поддерживаемые форматы: те же, что и для start_date
  - При указании только даты время автоматически установится на 23:59:59

**Примеры запросов:**
```
# Отчет курьера за целый день
GET /api/businesses/reports/courier/5?start_date=2025-08-01&end_date=2025-08-10

# Отчет курьера за рабочую смену
GET /api/businesses/reports/courier/5?start_date=2025-08-01 09:00&end_date=2025-08-01 18:00

# Отчет курьера с точным временем
GET /api/businesses/reports/courier/5?start_date=2025-08-01 10:30:00&end_date=2025-08-01 16:45:30
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
      "total_orders": 24,
      "delivered_orders": 23,
      "cancelled_orders": 1,
      "in_progress_orders": 0,
      "success_rate": 96,
      "total_earnings": 12650,
      "total_order_value": 145000,
      "avg_delivery_price": 550,
      "avg_delivery_time_minutes": 28
    },
    "orders": [
      {
        "order_id": 1234,
        "order_uuid": "uuid-string-here",
        "status": 4,
        "status_name": "Доставлен",
        "delivery_price": 550,
        "total_sum": 6750,
        "business_name": "Супермаркет Галеон",
        "business_address": "ул. Абая 123",
        "customer_name": "Айжан Кенесова",
        "delivery_address": "ул. Назарбаева 456, кв. 12",
        "order_created": "2025-08-10T15:30:00Z"
      },
      {
        "order_id": 1233,
        "order_uuid": "uuid-string-here-2",
        "status": 4,
        "status_name": "Доставлен",
        "delivery_price": 500,
        "total_sum": 4200,
        "business_name": "Аптека 36.6",
        "business_address": "пр. Достык 78",
        "customer_name": "Марат Исмаилов",
        "delivery_address": "ул. Жандосова 234",
        "order_created": "2025-08-10T14:15:00Z"
      }
    ]
  },
  "message": "Детальный отчет курьера Иван Петров за период с 2025-08-01 по 2025-08-10"
}
```

## Описание полей ответа

### Общий отчет

#### Summary (Сводка)
- `total_orders` - общее количество заказов за период
- `total_delivered` - количество доставленных заказов
- `total_cancelled` - количество отмененных заказов
- `active_couriers` - количество активных курьеров
- `total_delivery_revenue` - общая выручка с доставки
- `total_orders_revenue` - общая сумма заказов
- `avg_delivery_price` - средняя цена доставки
- `delivery_success_rate` - процент успешных доставок

#### Top Couriers (Топ курьеры)
- `courier_id` - ID курьера
- `courier_name` - полное имя курьера
- `courier_login` - логин курьера
- `city_name` - название города
- `delivered_orders` - количество доставленных заказов
- `total_delivery_earnings` - общий заработок с доставки
- `success_rate` - процент успешных доставок

#### Daily Statistics (Статистика по дням)
- `date` - дата
- `orders_count` - количество заказов в день
- `delivered_count` - количество доставленных заказов
- `active_couriers_count` - количество активных курьеров
- `daily_delivery_revenue` - выручка с доставки за день
- `success_rate` - процент успешных доставок за день

### Детальный отчет курьера

#### Courier Info (Информация о курьере)
- `courier_id` - ID курьера
- `login` - логин курьера
- `full_name` - полное имя
- `name` - имя
- `courier_type` - тип курьера
- `city_name` - город работы
- `member_since` - дата регистрации

#### Statistics (Статистика курьера)
- `total_orders` - общее количество заказов
- `delivered_orders` - доставленные заказы
- `cancelled_orders` - отмененные заказы
- `in_progress_orders` - заказы в процессе
- `success_rate` - процент успешности
- `total_earnings` - общий заработок
- `total_order_value` - общая стоимость заказов
- `avg_delivery_price` - средняя цена доставки
- `avg_delivery_time_minutes` - среднее время доставки в минутах (приблизительная оценка)

#### Orders (Заказы)
- `order_id` - ID заказа
- `order_uuid` - UUID заказа
- `status` - код статуса заказа
- `status_name` - название статуса
- `delivery_price` - цена доставки
- `total_sum` - общая сумма заказа
- `business_name` - название магазина
- `business_address` - адрес магазина
- `customer_name` - имя клиента
- `delivery_address` - адрес доставки
- `order_created` - время создания заказа

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
| 400 | Некорректные параметры запроса (неверные даты, отсутствуют обязательные поля) |
| 401 | Требуется авторизация бизнеса или недействительный токен |
| 404 | Курьер не найден (для детального отчета) |
| 500 | Внутренняя ошибка сервера |

## Примеры использования

### Получение общего отчета за последнюю неделю
```bash
curl -H "Authorization: Bearer <business_token>" \
  "http://localhost:3000/api/businesses/reports/couriers?start_date=2025-08-04&end_date=2025-08-11"
```

### Получение отчета по конкретному городу
```bash
curl -H "Authorization: Bearer <business_token>" \
  "http://localhost:3000/api/businesses/reports/couriers?start_date=2025-08-01&end_date=2025-08-10&city_id=1"
```

### Получение отчета по конкретному курьеру
```bash
curl -H "Authorization: Bearer <business_token>" \
  "http://localhost:3000/api/businesses/reports/couriers?start_date=2025-08-01&end_date=2025-08-10&courier_id=5"
```

### Получение детального отчета курьера
```bash
curl -H "Authorization: Bearer <business_token>" \
  "http://localhost:3000/api/businesses/reports/courier/5?start_date=2025-08-01&end_date=2025-08-10"
```

## Важные заметки

### Производительность
- Запросы включают сложные агрегации и JOIN операции
- Рекомендуется ограничивать период отчета разумными рамками (не более 3 месяцев)
- Большие периоды могут увеличить время ответа

### Фильтрация
- Все даты должны быть в формате YYYY-MM-DD
- Дата начала не может быть больше даты окончания
- Фильтры по городу и курьеру работают независимо и могут комбинироваться
- Все отчеты автоматически фильтруются по авторизованному бизнесу

### Точность данных
- Статистика включает только заказы с типом доставки = 1 (курьерская доставка)
- Время доставки рассчитывается от момента взятия заказа до момента доставки
- Средние значения округляются до целых чисел

### Безопасность
- Все эндпоинты требуют авторизации бизнеса через Bearer токен
- Токен проверяется в таблице businesses в поле token
- Отчеты показывают данные только для авторизованного бизнеса
- Данные курьеров не содержат чувствительной информации (пароли, токены)
