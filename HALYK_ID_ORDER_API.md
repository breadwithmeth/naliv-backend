# API для создания заказа с Halyk ID

## Обзор изменений

Метод `createUserOrder` был модифицирован для работы с токеном карты Halyk Bank (`halyk_id`) вместо ID сохраненной карты (`saved_card_id`).

## Endpoint

**POST** `/api/orders/create-user-order`

## Авторизация

Требуется JWT токен в заголовке:
```
Authorization: Bearer {jwt_token}
```

## Изменения в параметрах

### Было (старая версия):
```json
{
  "saved_card_id": 123
}
```

### Стало (новая версия):
```json
{
  "halyk_id": "abc123def456"
}
```

## Полный список параметров

| Параметр | Тип | Обязательно | Описание |
|----------|-----|-------------|----------|
| `business_id` | number | ✅ | ID бизнеса |
| `halyk_id` | string | ✅ | Токен карты Halyk Bank для автоплатежа |
| `street` | string | ✅* | Название улицы (для доставки) |
| `house` | string | ✅* | Номер дома (для доставки) |
| `apartment` | string | ❌ | Номер квартиры |
| `entrance` | string | ❌ | Номер подъезда |
| `floor` | string | ❌ | Этаж |
| `comment` | string | ❌ | Комментарий к адресу |
| `lat` | number | ✅* | Широта адреса (для доставки) |
| `lon` | number | ✅* | Долгота адреса (для доставки) |
| `items` | array | ✅ | Массив товаров заказа |
| `bonus` | number | ❌ | Бонусы к списанию (по умолчанию 0) |
| `delivery_type` | string | ✅ | Тип доставки: DELIVERY, PICKUP, SCHEDULED |
| `scheduled_delivery` | object | ❌ | Настройки запланированной доставки |

*обязательно только для типов доставки DELIVERY и SCHEDULED

## Структура товара в массиве items

```json
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
```

## Структура scheduled_delivery

```json
{
  "type": "TODAY|ASAP|SCHEDULED",
  "time_slot": "14:00-16:00",
  "date": "2025-08-05"
}
```

## Пример запроса

```bash
curl -X POST http://localhost:3000/api/orders/create-user-order \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -d '{
    "business_id": 2,
    "halyk_id": "abc123def456",
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
    "delivery_type": "DELIVERY",
    "scheduled_delivery": {
      "type": "TODAY",
      "time_slot": "14:00-16:00"
    }
  }'
```

## Пример ответа

### Успешный ответ (201 Created)

```json
{
  "success": true,
  "data": {
    "order_id": 12345,
    "order_uuid": "1722763234252001",
    "total_cost": 2500.50,
    "delivery_price": 300,
    "total_discount": 150,
    "items_count": 1,
    "promotions_applied": 1,
    "payment_type": "In-App платеж",
    "status": "PAYMENT_INITIATED",
    "scheduled_delivery": {
      "type": "TODAY",
      "date": null,
      "time_slot": "14:00-16:00",
      "formatted_delivery_time": "Сегодня, 14:00-16:00"
    },
    "payment_info": {
      "halyk_id": "abc123def456",
      "card_mask": "**** **** **** 1234",
      "auto_payment": true,
      "message": "Платеж автоматически инициирован"
    },
    "delivery_calculation": {
      "delivery_type": "В пределах зоны доставки",
      "message": "Доставка возможна",
      "max_distance": 5000,
      "current_distance": 2300,
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
        "name": "Пицца Маргарита",
        "amount": 2,
        "base_amount": 2,
        "option_multiplier": 0,
        "price": 1200,
        "charged_amount": 2,
        "original_cost": 2400,
        "discounted_cost": 2250,
        "promotion": {
          "name": "Скидка 10%",
          "type": "discount"
        },
        "options": [
          {
            "option_item_relation_id": 10,
            "name": "Дополнительный сыр",
            "amount": 1,
            "price": 200,
            "parent_item_amount": 1
          }
        ]
      }
    ]
  },
  "message": "Заказ создан и оплата автоматически инициирована"
}
```

### Ошибка - карта не найдена (404)

```json
{
  "success": false,
  "error": {
    "message": "Карта не найдена или не принадлежит пользователю",
    "statusCode": 404,
    "timestamp": "2025-08-04T11:43:22.123Z"
  }
}
```

### Ошибка - неверный halyk_id (400)

```json
{
  "success": false,
  "error": {
    "message": "Необходимо указать halyk_id для автоматического списания",
    "statusCode": 400,
    "timestamp": "2025-08-04T11:43:22.123Z"
  }
}
```

## Изменения в базе данных

Метод ищет карту по полю `halyk_card_id` в таблице `halyk_saved_cards`:

```sql
SELECT * FROM halyk_saved_cards 
WHERE halyk_card_id = ? AND user_id = ?
```

## Логика автоматического списания

1. **Валидация halyk_id** - проверяется, что карта существует и принадлежит пользователю
2. **Создание заказа** - создается заказ со статусом UNPAID
3. **Подготовка данных платежа** - формируются данные для Halyk Bank API
4. **Отправка запроса** - POST запрос на `https://epay-api.homebank.kz/payments/cards/auth`
5. **Обработка ответа** - обновление статуса заказа в зависимости от результата

## Структура данных для Halyk Bank API

```json
{
  "amount": 250050,
  "currency": "KZT",
  "name": "Иван Иванов",
  "terminalId": "bb4dec49-6e30-41d0-b16b-8ba1831a854b",
  "invoiceId": "1722763234252001",
  "description": "Автоматическая оплата заказа №12345 в Ресторан Тест",
  "accountId": "252",
  "email": "",
  "phone": "+77051234567",
  "backLink": "http://localhost:3000/payment-success?order_id=12345&invoice_id=1722763234252001",
  "failureBackLink": "http://localhost:3000/payment-failure?order_id=12345&invoice_id=1722763234252001",
  "postLink": "http://localhost:3000/api/payments/payment-webhook",
  "failurePostLink": "http://localhost:3000/api/payments/payment-webhook",
  "language": "rus",
  "paymentType": "cardId",
  "recurrent": true,
  "cardId": {
    "id": "abc123def456"
  }
}
```

## Тестирование

Используйте файл `test-halyk-id-order.html` для тестирования нового API:

```bash
open http://localhost:3000/test-halyk-id-order.html
```

## Обратная совместимость

⚠️ **Внимание**: Этот API не совместим с предыдущей версией, которая использовала `saved_card_id`. Убедитесь, что клиентские приложения обновлены для использования `halyk_id`.
