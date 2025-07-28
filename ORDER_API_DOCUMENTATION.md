# API Документация: Заказы и Оплата

## Содержание
1. [Создание заказа](#создание-заказа)
2. [Оплата заказа](#оплата-заказа)
3. [Получение информации о заказе](#получение-информации-о-заказе)
4. [Управление заказами](#управление-заказами)

---

## 1. Создание заказа

### POST `/api/orders/create-user-order`
Создает новый заказ без автоматической оплаты.

#### Заголовки
```
Authorization: Bearer {jwt_token}
Content-Type: application/json
```

#### Параметры запроса
```json
{
  "business_id": 1,
  "items": [
    {
      "item_id": 123,
      "amount": 2,
      "options": [
        {
          "option_item_relation_id": 456,
          "price": 500,
          "parent_amount": 1
        }
      ]
    }
  ],
  "delivery": false,
  "bonus": false,
  "extra": "Комментарий к заказу",
  "card_id": 789
}
```

#### Описание параметров
- `business_id` (обязательно) - ID магазина
- `items` (обязательно) - Массив товаров
  - `item_id` - ID товара
  - `amount` - Количество
  - `options` - Массив опций товара (необязательно)
- `delivery` - Нужна ли доставка (по умолчанию false)
- `bonus` - Использовать ли бонусы (по умолчанию false)
- `extra` - Дополнительный комментарий
- `card_id` - ID сохраненной карты (НЕ используется для автоматической оплаты)

#### Успешный ответ (201)
```json
{
  "success": true,
  "data": {
    "order_id": 12345,
    "order_uuid": "175372009812345",
    "message": "Заказ создан. Для оплаты используйте POST /api/orders/12345/pay"
  },
  "message": "Заказ успешно создан"
}
```

#### Ошибки
- `400` - Не все обязательные поля заполнены
- `401` - Необходима авторизация
- `404` - Товар не найден / Адрес для доставки не найден
- `500` - Внутренняя ошибка сервера

---

## 2. Оплата заказа

### POST `/api/orders/:id/pay`
Оплачивает существующий заказ двумя способами:
1. **Сохраненной картой** - мгновенное списание средств
2. **Через страницу оплаты** - переход на страницу банка для ввода данных карты

#### Заголовки
```
Authorization: Bearer {jwt_token}
Content-Type: application/json
```

#### Параметры URL
- `id` - ID заказа для оплаты

#### Параметры запроса

**Вариант 1: Оплата сохраненной картой**
```json
{
  "payment_type": "card",
  "card_id": 789
}
```

**Вариант 2: Оплата через страницу банка**
```json
{
  "payment_type": "page"
}
```

#### Описание параметров
- `payment_type` (обязательно) - Тип оплаты:
  - `"card"` - Оплата сохраненной картой
  - `"page"` - Оплата через страницу банка
- `card_id` - ID сохраненной карты (обязательно для `payment_type: "card"`)

#### Успешный ответ для сохраненной карты (200)
```json
{
  "success": true,
  "data": {
    "order_id": 12345,
    "payment_type": "card",
    "payment_result": {
      "status": "ok",
      "payment_id": "halyk_payment_id_123",
      "bank_response": {
        "id": "halyk_payment_id_123",
        "status": "success"
      }
    }
  },
  "message": "Заказ успешно оплачен"
}
```

#### Успешный ответ для страницы оплаты (200)
```json
{
  "success": true,
  "data": {
    "order_id": 12345,
    "payment_type": "page",
    "payment_result": {
      "status": "redirect",
      "payment_url": "https://epay.homebank.kz/payment/bb4dec49-6e30-41d0-b16b-8ba1831a854b",
      "payment_id": "halyk_payment_page_id_456",
      "expires_at": "2025-01-28T12:00:00.000Z",
      "bank_response": {
        "id": "halyk_payment_page_id_456",
        "redirectUrl": "https://epay.homebank.kz/payment/bb4dec49-6e30-41d0-b16b-8ba1831a854b"
      }
    }
  },
  "message": "Ссылка для оплаты создана"
}
```

#### Ответ при ошибке оплаты (200)
```json
{
  "success": true,
  "data": {
    "order_id": 12345,
    "payment_type": "card",
    "payment_result": {
      "status": "insufficient_funds",
      "code": 400,
      "bank_error_code": 484,
      "bank_error_message": "Недостаточно средств на карте",
      "user_message": "Недостаточно средств на карте",
      "is_final": true,
      "should_retry": false,
      "error_detail": "Недостаточно средств на карте"
    }
  },
  "message": "Ошибка при оплате заказа"
}
```

#### Ответ при системной ошибке банка (200)
```json
{
  "success": true,
  "data": {
    "order_id": 61838,
    "payment_type": "page",
    "payment_result": {
      "status": "system_error",
      "code": 400,
      "bank_error_code": 461,
      "bank_error_message": "Системная ошибка, попробуйте провести транзакцию позже",
      "user_message": "Системная ошибка, попробуйте провести транзакцию позже",
      "is_final": true,
      "should_retry": false,
      "error_detail": "Системная ошибка, попробуйте провести транзакцию позже"
    }
  },
  "message": "Ошибка при оплате заказа"
}
```

#### Ответ при превышении лимита (200)
```json
{
  "success": true,
  "data": {
    "order_id": 61838,
    "payment_type": "page",
    "payment_result": {
      "status": "amount_limit_exceeded",
      "code": 400,
      "bank_error_code": 488,
      "bank_error_message": "Сумма превышает допустимый лимит",
      "user_message": "Сумма превышает допустимый лимит",
      "is_final": true,
      "should_retry": false,
      "error_detail": "Сумма превышает допустимый лимит"
    }
  },
  "message": "Ошибка при оплате заказа"
}
```

#### Ошибки
- `400` - Неверный ID заказа / Неверный тип оплаты / Не указан ID карты для оплаты картой / Заказ уже оплачен / Нельзя оплатить отмененный заказ / Заказ не в статусе "новый" (только новые заказы можно оплачивать)
- `401` - Необходима авторизация
- `403` - Доступ запрещен - заказ принадлежит другому пользователю
- `404` - Заказ не найден
- `500` - Ошибка при обработке платежа

#### Статусы платежа
- `ok` - Платеж прошел успешно
- `redirect` - Создана ссылка для оплаты (для страницы оплаты)

**Финансовые ошибки:**
- `insufficient_funds` - Недостаточно средств на карте (код 484)
- `amount_limit_exceeded` - Превышен лимит суммы (код 488)
- `frequency_limit_exceeded` - Превышен лимит частоты оплат (код 491)
- `daily_limit_exceeded` - Превышен суточный лимит (коды 528, 529, 2678)

**Ошибки карты:**
- `card_blocked` - Карта заблокирована (коды 465, 467, 479, 489, 492)
- `card_expired` - Срок действия карты истек (коды 478, 485)
- `invalid_card` - Карта недействительна (коды 481, 482, 525)
- `invalid_card_number` - Неверный номер карты (коды 459, 471, 472)
- `invalid_expiry` - Неверный срок действия (код 457)

**Ошибки безопасности:**
- `security_check_failed` - Ошибка 3DSecure (коды 455, 877)
- `security_code_error` - Неверный код безопасности (коды 473, 499)
- `security_required` - Требуется 3DSecure (код 503)

**Банковские отказы:**
- `bank_declined` - Транзакция отклонена банком (коды 462, 463, 466, 521, 523, 527)
- `internet_payments_disabled` - Интернет-платежи отключены (код 486)
- `transaction_prohibited` - Транзакция запрещена (коды 490, 495)

**Системные ошибки:**
- `system_error` - Системная ошибка банка (коды 100, 293, 456, 461, 526, 3014)
- `server_not_responding` - Сервер не отвечает (коды 458, 497, 502)
- `technical_error` - Техническая ошибка (коды 1268, 1269, 2656)

**Прочие:**
- `bad_request` - Некорректные данные запроса
- `forbidden` - Операция запрещена
- `unknown_error` - Неизвестная ошибка

#### Поля ответа при ошибке
- `status` - Категория ошибки (см. выше)
- `code` - HTTP код ответа от банка
- `bank_error_code` - Код ошибки от банка Halyk
- `bank_error_message` - Исходное сообщение от банка
- `user_message` - Понятное пользователю сообщение
- `is_final` - Финальная ли ошибка (true = повторять бессмысленно)
- `should_retry` - Стоит ли повторить попытку позже
- `error_detail` - Детальное описание ошибки

---

## 3. Получение информации о заказе

### GET `/api/orders/:id`
Получает полную информацию о заказе.

#### Параметры URL
- `id` - ID заказа

#### Успешный ответ (200)
```json
{
  "success": true,
  "data": {
    "order": {
      "order_id": 12345,
      "order_uuid": "175372009812345",
      "user_id": 252,
      "business_id": 1,
      "address_id": 123,
      "delivery_price": 500,
      "bonus": 0,
      "extra": "Комментарий к заказу",
      "payment_id": "halyk_payment_id_123",
      "log_timestamp": "2025-01-28T10:30:00.000Z",
      "items": [
        {
          "relation_id": 1,
          "item_id": 123,
          "amount": 2,
          "price": 1500,
          "item_name": "Водка Столичная",
          "item_code": "VOD001",
          "item_img": "vodka.jpg"
        }
      ],
      "business": {
        "id": 1,
        "name": "Алкомаркет №1",
        "address": "ул. Абая, 1"
      },
      "user": {
        "id": 252,
        "name": "Иван Иванов",
        "phone": "+77771234567"
      },
      "status": {
        "status": 0,
        "isCanceled": 0,
        "log_timestamp": "2025-01-28T10:35:00.000Z"
      },
      "cost": {
        "cost": 3500,
        "service_fee": 0,
        "delivery": 500
      }
    }
  },
  "message": "Заказ найден"
}
```

### GET `/api/orders/user/:userId`
Получает список заказов пользователя с пагинацией.

#### Заголовки
```
Authorization: Bearer {jwt_token}
```

#### Параметры URL
- `userId` - ID пользователя

#### Параметры запроса (query)
- `page` - Номер страницы (по умолчанию 1)
- `limit` - Количество заказов на странице (по умолчанию 20, максимум 100)

#### Успешный ответ (200)
```json
{
  "success": true,
  "data": {
    "orders": [
      {
        "order_id": 12345,
        "order_uuid": "175372009812345",
        "user_id": 252,
        "business_id": 1,
        "delivery_price": 500,
        "log_timestamp": "2025-01-28T10:30:00.000Z",
        "business": {
          "id": 1,
          "name": "Алкомаркет №1",
          "address": "ул. Абая, 1",
          "logo": "logo.jpg"
        },
        "status": {
          "status": 0,
          "isCanceled": 0,
          "log_timestamp": "2025-01-28T10:35:00.000Z"
        },
        "cost": {
          "cost": 3500,
          "service_fee": 0,
          "delivery": 500
        },
        "items_count": 2
      }
    ],
    "pagination": {
      "current_page": 1,
      "per_page": 20,
      "total": 5,
      "total_pages": 1
    }
  },
  "message": "Найдено 5 заказов"
}
```

---

## 3.1. Отслеживание статуса заказа

### GET `/api/orders/:id/status`
Получает подробную информацию о текущем статусе заказа с историей изменений.

#### Заголовки
```
Authorization: Bearer {jwt_token}
```

#### Параметры URL
- `id` - ID заказа

#### Успешный ответ (200)
```json
{
  "success": true,
  "data": {
    "order_id": 12345,
    "order_uuid": "175372009812345",
    "delivery_type": "DELIVERY",
    "delivery_date": null,
    "current_status": {
      "code": 1,
      "name": "В обработке",
      "description": "Заказ принят в обработку",
      "color": "#2196f3",
      "icon": "processing",
      "is_final": false,
      "timestamp": "2025-01-28T10:35:00.000Z",
      "time_ago": "5 мин назад"
    },
    "next_expected_status": {
      "code": 2,
      "name": "Собран",
      "description": "Заказ собран, готов к доставке",
      "color": "#9c27b0",
      "icon": "ready",
      "is_final": false
    },
    "estimated_delivery_time": "2025-01-28T11:15:00.000Z",
    "estimated_delivery_time_ago": "через 35 мин",
    "business": {
      "business_id": 1,
      "name": "Алкомаркет №1",
      "address": "ул. Абая, 1",
      "logo": "logo.jpg"
    },
    "cost": {
      "total": 4000,
      "delivery": 500,
      "service_fee": 0
    },
    "status_history": [
      {
        "status": 66,
        "is_canceled": 0,
        "timestamp": "2025-01-28T10:30:00.000Z",
        "status_info": {
          "code": 66,
          "name": "Новый заказ",
          "description": "Заказ создан, ожидает оплаты",
          "color": "#ffa500",
          "icon": "pending",
          "is_final": false
        },
        "time_ago": "10 мин назад"
      },
      {
        "status": 0,
        "is_canceled": 0,
        "timestamp": "2025-01-28T10:32:00.000Z",
        "status_info": {
          "code": 0,
          "name": "Оплачен",
          "description": "Заказ оплачен, передан в обработку",
          "color": "#4caf50",
          "icon": "paid",
          "is_final": false
        },
        "time_ago": "8 мин назад"
      },
      {
        "status": 1,
        "is_canceled": 0,
        "timestamp": "2025-01-28T10:35:00.000Z",
        "status_info": {
          "code": 1,
          "name": "В обработке",
          "description": "Заказ принят в обработку",
          "color": "#2196f3",
          "icon": "processing",
          "is_final": false
        },
        "time_ago": "5 мин назад"
      }
    ],
    "can_cancel": false,
    "payment_required": false,
    "created_at": "2025-01-28T10:30:00.000Z"
  },
  "message": "Информация о статусе заказа получена"
}
```

#### Статусы заказов
- `66` - Новый заказ (создан) - оранжевый
- `0` - Оплачен - зеленый  
- `1` - Принят в обработку - синий
- `2` - Собран - фиолетовый
- `3` - Передан курьеру - оранжевый
- `4` - В пути - серый
- `5` - Доставлен - зеленый
- `99` - Отменен - красный

#### Поля ответа
- `current_status` - Текущий статус с подробной информацией
- `next_expected_status` - Ожидаемый следующий статус (если не финальный)
- `estimated_delivery_time` - Прогнозируемое время доставки
- `status_history` - Полная история изменений статуса
- `can_cancel` - Можно ли отменить заказ (только для статусов 66 и 0)
- `payment_required` - Требуется ли оплата (для статуса 66)

#### Ошибки
- `400` - Неверный ID заказа / Не найден статус заказа
- `401` - Необходима авторизация
- `403` - Доступ запрещен - заказ принадлежит другому пользователю
- `404` - Заказ не найден
- `500` - Внутренняя ошибка сервера

---

## 4. Управление заказами

### PUT `/api/orders/:id/status`
Обновляет статус заказа (только для сотрудников).

#### Заголовки
```
Authorization: Bearer {employee_jwt_token}
Content-Type: application/json
```

#### Параметры запроса
```json
{
  "status": 1,
  "isCanceled": 0
}
```

#### Статусы заказов
- `66` - Новый заказ (создан)
- `0` - Оплачен
- `1` - Принят в обработку
- `2` - Собран
- `3` - Передан курьеру
- `4` - В пути
- `5` - Доставлен
- `99` - Отменен

### DELETE `/api/orders/:id`
Отменяет заказ (для пользователей).

#### Заголовки
```
Authorization: Bearer {jwt_token}
```

#### Успешный ответ (200)
```json
{
  "success": true,
  "data": {
    "order_id": 12345
  },
  "message": "Заказ отменен"
}
```

---

## Примеры использования

### 1. Полный процесс создания и оплаты заказа

#### Шаг 1: Создание заказа
```bash
curl -X POST http://localhost:3000/api/orders/create-user-order \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "business_id": 1,
    "items": [
      {
        "item_id": 123,
        "amount": 2
      }
    ],
    "delivery": true,
    "bonus": false
  }'
```

#### Шаг 2a: Оплата сохраненной картой
```bash
curl -X POST http://localhost:3000/api/orders/12345/pay \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "payment_type": "card",
    "card_id": 789
  }'
```

#### Шаг 2b: Оплата через страницу банка
```bash
curl -X POST http://localhost:3000/api/orders/12345/pay \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "payment_type": "page"
  }'
```

#### Шаг 3: Проверка статуса заказа
```bash
curl -X GET http://localhost:3000/api/orders/12345 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### Шаг 4: Отслеживание статуса заказа
```bash
curl -X GET http://localhost:3000/api/orders/12345/status \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 2. Получение списка заказов пользователя
```bash
curl -X GET "http://localhost:3000/api/orders/user/252?page=1&limit=10" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 3. Отслеживание статуса заказа
```bash
curl -X GET http://localhost:3000/api/orders/12345/status \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 4. Отмена заказа
```bash
curl -X DELETE http://localhost:3000/api/orders/12345 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## Коды ошибок

| Код | Описание |
|-----|----------|
| 400 | Некорректные данные запроса |
| 401 | Необходима авторизация |
| 403 | Доступ запрещен |
| 404 | Ресурс не найден |
| 500 | Внутренняя ошибка сервера |

## Заметки

1. **Разделение создания и оплаты**: Создание заказа и оплата теперь разделены на два отдельных запроса для лучшего контроля процесса.

2. **Авторизация**: Все endpoints требуют JWT токен в заголовке Authorization.

3. **Права доступа**: Пользователи могут работать только со своими заказами, сотрудники имеют расширенные права.

4. **Обработка ошибок Halyk Bank**: Система автоматически обрабатывает все коды ошибок банка согласно документации https://epayment.kz/docs/kody-oshibok и предоставляет понятные пользователю сообщения.

5. **Финальные и нефинальные ошибки**: 
   - Финальные ошибки (`is_final: true`) - повторять попытку бессмысленно
   - Нефинальные ошибки (`is_final: false`) - можно повторить позже
   - Поле `should_retry` указывает, стоит ли автоматически повторить

6. **Валидация**: Строгая проверка всех входных данных и состояний заказа.

## Примеры обработки ошибок в клиентском коде

### JavaScript пример
```javascript
async function payOrder(orderId, paymentType, cardId = null) {
  try {
    const response = await fetch(`/api/orders/${orderId}/pay`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        payment_type: paymentType,
        ...(cardId && { card_id: cardId })
      })
    });

    const result = await response.json();
    
    if (result.success && result.data.payment_result.status === 'ok') {
      // Успешная оплата
      showSuccess('Заказ успешно оплачен!');
      
    } else if (result.success && result.data.payment_result.status === 'redirect') {
      // Перенаправление на страницу банка
      window.location.href = result.data.payment_result.payment_url;
      
    } else if (result.data.payment_result) {
      // Обработка ошибки
      const error = result.data.payment_result;
      
      // Показываем понятное пользователю сообщение
      showError(error.user_message || error.error_detail);
      
      // Определяем дальнейшие действия
      if (!error.is_final && error.should_retry) {
        // Можно предложить повторить позже
        showRetryOption();
      } else if (error.status === 'insufficient_funds') {
        // Предложить другую карту
        showChangeCardOption();
      } else if (error.status.includes('card_')) {
        // Проблемы с картой - предложить другую
        showChangeCardOption();
      }
    }
  } catch (err) {
    showError('Ошибка соединения с сервером');
  }
}
```

### Пример отслеживания статуса заказа
```javascript
async function trackOrderStatus(orderId) {
  try {
    const response = await fetch(`/api/orders/${orderId}/status`, {
      headers: {
        'Authorization': 'Bearer ' + token
      }
    });

    const result = await response.json();
    
    if (result.success) {
      const data = result.data;
      
      // Отображаем текущий статус
      updateStatusDisplay({
        status: data.current_status.name,
        description: data.current_status.description,
        color: data.current_status.color,
        icon: data.current_status.icon,
        timeAgo: data.current_status.time_ago
      });

      // Показываем прогресс
      updateProgressBar(data.status_history);

      // Если есть примерное время доставки
      if (data.estimated_delivery_time) {
        showEstimatedDelivery(data.estimated_delivery_time_ago);
      }

      // Показываем кнопки действий
      if (data.can_cancel) {
        showCancelButton(orderId);
      }
      
      if (data.payment_required) {
        showPaymentButton(orderId);
      }

      // Если заказ не финальный, запланировать следующее обновление
      if (!data.current_status.is_final) {
        setTimeout(() => trackOrderStatus(orderId), 30000); // Обновляем каждые 30 сек
      }

    } else {
      showError('Не удалось получить статус заказа');
    }
  } catch (err) {
    showError('Ошибка соединения с сервером');
  }
}

// Функция обновления индикатора прогресса
function updateProgressBar(statusHistory) {
  const steps = [66, 0, 1, 2, 3, 4, 5]; // Последовательность статусов
  const completedSteps = statusHistory.map(h => h.status);
  
  steps.forEach((step, index) => {
    const stepElement = document.getElementById(`step-${step}`);
    if (stepElement) {
      if (completedSteps.includes(step)) {
        stepElement.classList.add('completed');
      } else {
        stepElement.classList.remove('completed');
      }
    }
  });
}
```
