# API оплаты сохраненной картой (Halyk Bank) - Документация

## Описание
API для проведения оплаты заказов с использованием ранее сохраненных карт через платежную систему Halyk Bank. Система возвращает JSON-ответы в соответствии с официальной документацией Halyk Bank.

## Основной endpoint

### POST `/api/orders/:id/pay`

Проводит оплату заказа с использованием сохраненной карты.

#### Параметры URL
- `id` (string, required) - ID заказа для оплаты

#### Headers
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

#### Body параметры
```json
{
  "payment_type": "card",
  "card_id": "string"
}
```

**Параметры:**
- `payment_type` (string, required) - Тип оплаты, должен быть `"card"`
- `card_id` (string, required) - Прямой ID сохраненной карты из системы Halyk Bank (например: `"2d1419c5-379a-d8cd-e063-1b01010a6414"`)

#### Пример запроса
```bash
curl -X POST "https://api.naliv.kz/api/orders/123/pay" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "payment_type": "card",
    "card_id": "2d1419c5-379a-d8cd-e063-1b01010a6414"
  }'
```

## Ответы API

### Успешная оплата (HTTP 200)
```json
{
  "success": true,
  "data": {
    "order_id": "123",
    "payment_status": "completed",
    "halyk_response": {
      "id": "75890cc5-157a-4cce-9624-16b227c2b9ec",
      "accountId": "user_uuid_123",
      "amount": 2500,
      "amountBonus": 0,
      "currency": "KZT",
      "description": "Оплата заказа #123",
      "email": "user@example.com",
      "invoiceID": "000123",
      "invoiceIdAlt": "8564546",
      "language": "RU",
      "phone": "77771234567",
      "reference": "099467918563",
      "intReference": "C3B673466V9600X3",
      "secure3D": null,
      "cardID": "22f2c5db-64d8-475f-8066-af3de3dc8233",
      "code": 0,
      "status": "AUTH"
    }
  },
  "message": "Оплата успешно проведена"
}
```

### Ошибка оплаты (HTTP 400)
```json
{
  "success": false,
  "error": {
    "message": "Платеж отклонен банком",
    "statusCode": 400,
    "timestamp": "2024-01-15T10:30:00.000Z",
    "details": {
      "halyk_error": {
        "code": -2,
        "message": "Недостаточно средств"
      }
    }
  }
}
```

### Ошибка банка (HTTP 502)
```json
{
  "success": false,
  "error": {
    "message": "Ошибка при обработке платежа в банке",
    "statusCode": 502,
    "timestamp": "2024-01-15T10:30:00.000Z",
    "details": {
      "halyk_error": {
        "code": 1267,
        "message": "Ошибка связи с карточной системой"
      }
    }
  }
}
```

### Заказ не найден (HTTP 404)
```json
{
  "success": false,
  "error": {
    "message": "Заказ не найден",
    "statusCode": 404,
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

### Карта не найдена (HTTP 404)
```json
{
  "success": false,
  "error": {
    "message": "Неверные параметры запроса",
    "statusCode": 400,
    "timestamp": "2024-01-15T10:30:00.000Z",
    "details": {
      "validation_errors": [
        "card_id обязателен для payment_type \"card\""
      ]
    }
  }
}
```

### Неверные параметры (HTTP 400)
```json
{
  "success": false,
  "error": {
    "message": "Неверные параметры запроса",
    "statusCode": 400,
    "timestamp": "2024-01-15T10:30:00.000Z",
    "details": {
      "validation_errors": [
        "payment_type должен быть 'card'",
        "card_id обязателен"
      ]
    }
  }
}
```

### Ошибка авторизации (HTTP 401)
```json
{
  "success": false,
  "error": {
    "message": "Токен авторизации недействителен",
    "statusCode": 401,
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

### Ошибка сервера (HTTP 500)
```json
{
  "success": false,
  "error": {
    "message": "Внутренняя ошибка сервера",
    "statusCode": 500,
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

## Коды ошибок и HTTP статусы

API возвращает правильные HTTP статусы в зависимости от результата оплаты:

| HTTP Статус | Ситуация | success |
|-------------|----------|---------|
| 200 | Оплата успешна | true |
| 200 | Заказ уже оплачен | true |
| 400 | Платеж отклонен банком | false |
| 400 | Неверные параметры | false |
| 401 | Ошибка авторизации | false |
| 403 | Доступ запрещен | false |
| 404 | Заказ не найден | false |
| 500 | Системная ошибка | false |
| 502 | Ошибка банка | false |

API обрабатывает следующие коды ошибок от Halyk Bank:

| Код | Описание |
|-----|----------|
| 0 | Успешная операция |
| -1 | Общая ошибка |
| -2 | Недостаточно средств |
| -3 | Карта заблокирована |
| -4 | Неверный CVV |
| -5 | Истек срок действия карты |
| -6 | Превышен лимит операций |
| -7 | Операция отклонена банком-эмитентом |
| -8 | Технические неполадки |

## Статусы заказа

После успешной оплаты заказ переходит в статус:
- `paid` - Оплачен

В случае ошибки оплаты заказ остается в статусе:
- `pending_payment` - Ожидает оплаты

## Логика работы

1. **Валидация данных**: Проверка наличия заказа и корректности параметров
2. **Получение OAuth токена**: Запрос токена доступа к API Halyk Bank
3. **Подготовка данных**: Формирование данных для платежа с переданным card_id
4. **Проведение платежа**: Отправка запроса на оплату в Halyk Bank с прямым использованием card_id
5. **Обработка ответа**: Обновление статуса заказа и возврат результата
6. **Обработка ошибок**: Логирование и возврат понятных сообщений об ошибках

**Важно**: API теперь принимает прямой ID карты из системы Halyk Bank и не выполняет поиск в локальной таблице сохраненных карт.

## Конфигурация

Для работы API требуются следующие переменные окружения:

```env
HALYK_CLIENT_ID=your_client_id
HALYK_CLIENT_SECRET=your_client_secret
HALYK_TERMINAL_ID=your_terminal_id
HALYK_OAUTH_URL=https://testoauth.homebank.kz/epay2/oauth2/token
HALYK_PAYMENT_URL=https://testepay.homebank.kz/api/payments/cards/auth
```

## Безопасность

- Все запросы требуют JWT авторизации
- Пользователь может оплачивать только свои заказы
- Card ID передается напрямую в Halyk Bank без дополнительной валидации
- Все чувствительные данные логируются без раскрытия секретной информации
- OAuth токены имеют ограниченное время жизни (7200 секунд)

## Примеры интеграции

### JavaScript/Fetch
```javascript
async function payOrder(orderId, halykCardId) {
  try {
    const response = await fetch(`/api/orders/${orderId}/pay`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        payment_type: 'card',
        card_id: halykCardId // Прямой ID из Halyk Bank
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log('Оплата успешна:', result.data);
      // Обновить UI - заказ оплачен
    } else {
      console.error('Ошибка оплаты:', result.error.message);
      // Показать ошибку пользователю
    }
  } catch (error) {
    console.error('Ошибка сети:', error);
  }
}
```

### Axios
```javascript
import axios from 'axios';

const payOrder = async (orderId, halykCardId) => {
  try {
    const response = await axios.post(`/api/orders/${orderId}/pay`, {
      payment_type: 'card',
      card_id: halykCardId // Прямой ID из Halyk Bank
    }, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    
    return response.data;
  } catch (error) {
    if (error.response) {
      throw new Error(error.response.data.error.message);
    }
    throw error;
  }
};
```

## Тестирование

Для тестирования API используйте тестовые данные Halyk Bank:

**Тестовая карта:**
- Номер: 4003032001000077
- CVV: 177
- Срок действия: 12/25

**Тестовые суммы:**
- 100 KZT - успешная оплата
- 200 KZT - недостаточно средств
- 300 KZT - карта заблокирована

## Связанные API

- `GET /api/halyk/cards` - Получение списка сохраненных карт пользователя
- `POST /api/halyk/save-card` - Сохранение новой карты
- `DELETE /api/halyk/cards/:id` - Удаление сохраненной карты
- `GET /api/orders/:id/status` - Проверка статуса заказа

## Журналирование

Все операции оплаты логируются с включением:
- ID пользователя
- ID заказа  
- ID карты (замаскированный)
- Сумма платежа
- Статус операции
- Время операции
- Ответ от Halyk Bank (без чувствительных данных)

## Версионирование

Текущая версия API: `v2`

Основные изменения от v1:
- Корректная обработка JSON-ответов от Halyk Bank
- Улучшенная обработка ошибок
- Расширенное логирование
- Поддержка всех кодов ошибок Halyk Bank
