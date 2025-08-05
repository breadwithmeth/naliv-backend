# API для оплаты по коду карты Halyk

## Обзор изменений

Метод `payWithSavedCard` был модифицирован для работы напрямую с кодом карты Halyk Bank (`halyk_card_id`) без проверки в локальной таблице `halyk_saved_cards`.

## Ключевые изменения

- ❌ **Убрана** проверка карты по таблице `halyk_saved_cards`
- ✅ **Добавлена** прямая работа с кодом карты Halyk
- ✅ **Упрощен** процесс оплаты без зависимости от локальной базы данных
- ✅ **Обновлен** маршрут на `/api/payments/pay-with-halyk-card`

## Endpoints

### Создание заказа с halyk_id
**POST** `/api/orders/create-user-order`

### Оплата по коду карты Halyk
**POST** `/api/payments/pay-with-halyk-card`

## Авторизация

Требуется JWT токен в заголовке:
```
Authorization: Bearer {jwt_token}
```

## Параметры для создания заказа

| Параметр | Тип | Обязательно | Описание |
|----------|-----|-------------|----------|
| `business_id` | number | ✅ | ID бизнеса |
| `halyk_id` | string | ✅ | Токен карты Halyk Bank для автоплатежа |
| `street` | string | ✅ | Название улицы |
| `house` | string | ✅ | Номер дома |
| `apartment` | string | ❌ | Номер квартиры |
| `lat` | number | ✅ | Широта адреса |
| `lon` | number | ✅ | Долгота адреса |
| `items` | array | ✅ | Массив товаров заказа |
| `delivery_type` | string | ✅ | Тип доставки: DELIVERY, PICKUP, SCHEDULED |

## Параметры для оплаты

| Параметр | Тип | Обязательно | Описание |
|----------|-----|-------------|----------|
| `order_id` | number | ✅ | ID заказа для оплаты |
| `halyk_card_id` | string | ✅ | Код карты Halyk Bank |
| `backLink` | string | ❌ | Ссылка возврата при успехе (по умолчанию: chorenn.naliv.kz/success) |
| `failureBackLink` | string | ❌ | Ссылка возврата при ошибке (по умолчанию: chorenn.naliv.kz/failure) |
| `postLink` | string | ❌ | Webhook URL (по умолчанию: chorenn.naliv.kz/api/payment.php) |

## Пример создания заказа

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
    "lat": 52.271643,
    "lon": 76.950011,
    "items": [
      {
        "item_id": 100,
        "amount": 2
      }
    ],
    "delivery_type": "DELIVERY",
    "scheduled_delivery": {
      "type": "ASAP"
    }
  }'
```

## Пример оплаты по коду карты

```bash
curl -X POST http://localhost:3000/api/payments/pay-with-halyk-card \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -d '{
    "order_id": 12345,
    "halyk_card_id": "abc123def456"
  }'
```

## Ответы

### Успешное создание заказа (201 Created)

```json
{
  "success": true,
  "data": {
    "order_id": 12345,
    "order_uuid": "1722763234252001",
    "total_cost": 2500.50,
    "status": "PAYMENT_INITIATED",
    "payment_info": {
      "halyk_id": "abc123def456",
      "auto_payment": true,
      "message": "Платеж автоматически инициирован"
    }
  },
  "message": "Заказ создан и оплата автоматически инициирована"
}
```

### Успешная инициация оплаты (200 OK)

Возвращает HTML страницу с инициализацией платежной формы Halyk Bank:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <title>Payment with Halyk Card</title>
    <script src="https://epay.homebank.kz/payform/payment-api.js"></script>
</head>
<body>
    <div class="payment-container">
        <h2>Оплата заказа по коду карты Halyk</h2>
        <div class="order-info">
            <p><strong>Номер заказа:</strong> 1722763234252001</p>
            <p><strong>Сумма к оплате:</strong> 2500.50 ₸</p>
        </div>
        <div class="card-info">
            <p><strong>ID карты Halyk:</strong> abc123def456</p>
            <p><strong>Тип платежа:</strong> Оплата по коду карты Halyk</p>
        </div>
    </div>
    <script>
        // Инициализация платежа с кодом карты Halyk
        halyk.pay(createPaymentObject(authToken, invoiceId, amount, halykCardId));
    </script>
</body>
</html>
```

### Ошибки

#### Заказ не найден (404)
```json
{
  "success": false,
  "error": {
    "message": "Заказ не найден",
    "statusCode": 404,
    "timestamp": "2025-08-04T11:43:22.123Z"
  }
}
```

#### Неверные параметры (400)
```json
{
  "success": false,
  "error": {
    "message": "Не указаны обязательные поля: order_id, halyk_card_id",
    "statusCode": 400,
    "timestamp": "2025-08-04T11:43:22.123Z"
  }
}
```

#### Заказ уже оплачен (400)
```json
{
  "success": false,
  "error": {
    "message": "Заказ уже оплачен",
    "statusCode": 400,
    "timestamp": "2025-08-04T11:43:22.123Z"
  }
}
```

## Структура данных для Halyk Bank API

```json
{
  "amount": "250050",
  "currency": "KZT",
  "name": "Иван Иванов",
  "terminalId": "bb4dec49-6e30-41d0-b16b-8ba1831a854b",
  "invoiceId": "1722763234252001",
  "description": "Оплата заказа №1722763234252001",
  "accountId": "252",
  "terminal": "bb4dec49-6e30-41d0-b16b-8ba1831a854b",
  "backLink": "https://chorenn.naliv.kz/success",
  "failureBackLink": "https://chorenn.naliv.kz/failure",
  "postLink": "https://chorenn.naliv.kz/api/payment.php",
  "language": "rus",
  "cardSave": false,
  "paymentType": "payment",
  "cardId": "abc123def456"
}
```

## Отличия от предыдущей версии

| Параметр | Старая версия | Новая версия |
|----------|---------------|--------------|
| **Параметр карты** | `saved_card_id` (number) | `halyk_card_id` (string) |
| **Проверка в БД** | ✅ Проверялась таблица `halyk_saved_cards` | ❌ Нет проверки в БД |
| **Маршрут** | `/pay-with-saved-card` | `/pay-with-halyk-card` |
| **Зависимости** | Локальная база данных | Только Halyk Bank API |
| **Информация о карте** | Маска карты из БД | Только ID карты |

## Преимущества новой версии

- 🚀 **Быстрее** - нет запросов к локальной БД
- 🔧 **Проще** - меньше зависимостей 
- 🎯 **Надежнее** - работает напрямую с Halyk Bank
- 🔄 **Актуальнее** - всегда свежие данные карты

## Тестирование

Используйте файл `test-halyk-card-payment.html` для тестирования нового API:

```bash
open http://localhost:3000/test-halyk-card-payment.html
```

## Безопасность

⚠️ **Важно**: API полагается на валидацию кода карты Halyk Bank API. Убедитесь, что:

1. Код карты передается только от доверенных источников
2. Используется HTTPS для всех запросов
3. JWT токены имеют короткий срок действия
4. Логируются все попытки платежей для аудита

## Миграция

Для перехода на новую версию:

1. Обновите клиентские приложения для использования `halyk_card_id` вместо `saved_card_id`
2. Измените маршрут с `/pay-with-saved-card` на `/pay-with-halyk-card`
3. Адаптируйте обработку ответов (больше нет информации о маске карты)
4. Протестируйте весь процесс оплаты
