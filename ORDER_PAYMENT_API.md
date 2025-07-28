# API создания заказа с оплатой

## Endpoint: POST /api/payments/create-order-with-payment

### Описание
Создает заказ и инициализирует платеж через Halyk Bank. Возвращает HTML страницу с готовой формой для оплаты.

### Требования
- Авторизация: JWT токен в заголовке `Authorization: Bearer <token>`
- Content-Type: `application/json`

### Параметры запроса

```json
{
  "business_id": 1,                    // ID бизнеса (обязательно)
  "address_id": 42,                    // ID адреса доставки (опционально для PICKUP)
  "delivery_type": "DELIVERY",         // Тип доставки: DELIVERY, PICKUP, SCHEDULED
  "items": [                          // Массив товаров (обязательно)
    {
      "item_id": 1,
      "amount": 2,
      "options": []
    },
    {
      "item_id": 2, 
      "amount": 1,
      "options": []
    }
  ],
  "bonus": 0,                         // Использование бонусов (опционально)
  "extra": null,                      // Дополнительная информация (опционально)
  "delivery_date": "2025-07-27T18:00:00Z", // Дата доставки для SCHEDULED (опционально)
  "payment_method": "card",           // Метод оплаты: "card" или "saved_card"
  "saved_card_id": 123,              // ID сохраненной карты (для payment_method = "saved_card")
  "backLink": "http://localhost:3000/api/payments/success",        // URL успешной оплаты (опционально)
  "failureBackLink": "http://localhost:3000/api/payments/failure", // URL неудачной оплаты (опционально)
  "postLink": "http://localhost:3000/api/payments/webhook"         // URL webhook'а (опционально)
}
```

### Обязательные поля
- `business_id` - ID бизнеса
- `items` - массив товаров
- `delivery_type` - тип доставки

### Типы доставки
- `DELIVERY` - обычная доставка (требует `address_id`)
- `PICKUP` - самовывоз (`address_id` опционален)
- `SCHEDULED` - запланированная доставка (требует `address_id` и `delivery_date`)

### Методы оплаты
- `card` - оплата новой картой (по умолчанию)
- `saved_card` - оплата сохраненной картой (требует `saved_card_id`)

### Ответ
Возвращает HTML страницу с инициализированной платежной формой Halyk Bank.

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Payment Processing</title>
    <script src="https://epay.homebank.kz/payform/payment-api.js"></script>
</head>
<body>
    <div style="text-align: center; padding: 20px;">
        <h2>Обработка платежа</h2>
        <p>Сумма к оплате: 2500 ₸</p>
        <p>Заказ №ORDER-1738027994-ABC123DEF</p>
        <div id="status">Инициализация платежа...</div>
    </div>
</body>
<script>
    // Автоматическая инициализация платежа
    halyk.pay(paymentObject);
</script>
</html>
```

### Логика работы

1. **Создание заказа**: Используется существующий метод `OrderController.createUserOrder`
2. **Расчет стоимости**: Автоматически рассчитывается стоимость товаров, доставки и применяются акции
3. **Генерация платежа**: Создается уникальный invoice ID для платежа
4. **Получение токена**: Запрашивается токен авторизации от Halyk Bank
5. **Возврат HTML**: Возвращается готовая HTML страница с инициализацией платежа

### Особенности

- **Автоматический расчет доставки**: Стоимость доставки рассчитывается автоматически на основе адреса
- **Применение акций**: Автоматически применяются активные акции бизнеса
- **Валюта**: Для обычных платежей используется KZT (тенге)
- **Связь с заказом**: Invoice ID сохраняется в поле `extra` заказа для отслеживания

### Примеры использования

#### 1. Простой заказ с доставкой
```javascript
const response = await fetch('/api/payments/create-order-with-payment', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + userToken
  },
  body: JSON.stringify({
    business_id: 1,
    address_id: 42,
    delivery_type: 'DELIVERY',
    items: [
      { item_id: 1, amount: 2, options: [] },
      { item_id: 3, amount: 1, options: [] }
    ]
  })
});

const htmlPage = await response.text();
// Отобразить HTML страницу пользователю
```

#### 2. Заказ с сохраненной картой
```javascript
const response = await fetch('/api/payments/create-order-with-payment', {
  method: 'POST', 
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + userToken
  },
  body: JSON.stringify({
    business_id: 1,
    address_id: 42,
    delivery_type: 'DELIVERY',
    items: [
      { item_id: 1, amount: 1, options: [] }
    ],
    payment_method: 'saved_card',
    saved_card_id: 123
  })
});
```

#### 3. Самовывоз
```javascript
const response = await fetch('/api/payments/create-order-with-payment', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json', 
    'Authorization': 'Bearer ' + userToken
  },
  body: JSON.stringify({
    business_id: 1,
    delivery_type: 'PICKUP',
    items: [
      { item_id: 1, amount: 1, options: [] }
    ]
  })
});
```

### Обработка ошибок

В случае ошибки возвращается JSON:

```json
{
  "success": false,
  "message": "Описание ошибки",
  "error": {
    "message": "Детальное описание ошибки",
    "statusCode": 400,
    "timestamp": "2025-07-27T14:30:00.000Z"
  }
}
```

### Возможные ошибки
- `400` - Некорректные данные запроса
- `401` - Необходима авторизация
- `404` - Товар, бизнес или адрес не найден
- `500` - Ошибка создания заказа или платежа

### Интеграция с фронтендом

После получения HTML ответа:
1. Отобразите HTML страницу пользователю
2. Halyk Bank автоматически инициализирует платежную форму
3. После завершения платежа пользователь будет перенаправлен на `backLink` или `failureBackLink`
4. Webhook на `postLink` получит уведомление о статусе платежа

### Тестирование

Используйте файл `test-order-with-payment.html` для тестирования API в браузере.

## Обработка результатов оплаты

### 1. Успешная оплата - GET /api/payments/success

**Параметры запроса (query)**:
- `invoiceId` - ID платежа
- `orderId` - ID заказа (опционально)
- `amount` - Сумма платежа
- `cardMask` - Маска карты (опционально)

**Ответ**: HTML страница с подтверждением успешной оплаты

### 2. Неудачная оплата - GET /api/payments/failure

**Параметры запроса (query)**:
- `invoiceId` - ID платежа
- `orderId` - ID заказа (опционально)
- `error` - Код ошибки
- `errorMessage` - Описание ошибки

**Ответ**: HTML страница с информацией об ошибке и возможностью повторить платеж

### 3. Webhook - POST /api/payments/webhook

**Описание**: Принимает уведомления от Halyk Bank о статусе платежа

**Тело запроса**: JSON данные от Halyk Bank
```json
{
  "invoiceId": "CARD1753627123456789",
  "status": "PAID",
  "paymentStatus": "SUCCESS",
  "amount": "2500",
  "currency": "KZT",
  "cardMask": "4455**1234",
  "transactionId": "TXN123456",
  "timestamp": "2025-07-27T15:30:00Z"
}
```

**Ответ**: JSON подтверждение обработки
```json
{
  "status": "received",
  "message": "Webhook обработан"
}
```

**Логика обработки**:
1. Поиск заказа по `invoiceId`
2. Обновление статуса заказа в зависимости от результата платежа
3. Сохранение информации о платеже в поле `extra` заказа

### 4. Проверка статуса - GET /api/payments/order-payment-status/:orderId

**Требования**: JWT авторизация

**Ответ**:
```json
{
  "success": true,
  "data": {
    "order": {
      "order_id": 123,
      "order_uuid": "ORDER-1738027994-ABC123DEF",
      "status": 2,
      "is_canceled": 0,
      "created_at": "2025-07-27T15:00:00Z",
      "delivery_type": "DELIVERY"
    },
    "cost": {
      "total": 2500,
      "delivery": 500,
      "service_fee": 0
    },
    "payment": {
      "payment_invoice_id": "CARD1753627123456789",
      "payment_method": "card",
      "saved_card_id": null
    }
  },
  "message": "Статус заказа и платежа получен"
}
```
