# Изменения в API заказов и оплаты

## Что изменилось

### ✅ Разделение создания заказа и оплаты

**До изменений:**
- Один endpoint `POST /api/orders/create-user-order` создавал заказ и сразу пытался его оплатить
- Если оплата не проходила, заказ все равно создавался
- Трудно было отследить этапы процесса

**После изменений:**
- `POST /api/orders/create-user-order` - только создает заказ
- `POST /api/orders/:id/pay` - отдельный endpoint для оплаты заказа
- Лучший контроль над процессом и обработкой ошибок

### 🆕 Новые endpoints

#### 1. POST `/api/orders/:id/pay` - Оплата заказа
```bash
curl -X POST http://localhost:3000/api/orders/12345/pay \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"card_id": 789}'
```

**Возможные ответы:**
- ✅ Успешная оплата
- ❌ Недостаточно средств
- ❌ Заказ уже оплачен
- ❌ Заказ отменен
- ❌ Доступ запрещен

#### 2. Обновленный POST `/api/orders/create-user-order`
Теперь только создает заказ, не оплачивает его.

**Если передан `card_id`:**
```json
{
  "success": true,
  "data": {
    "order_id": 12345,
    "order_uuid": "175372009812345",
    "message": "Заказ создан. Для оплаты используйте POST /api/orders/12345/pay"
  }
}
```

## Преимущества новой архитектуры

### 🔐 Безопасность
- Заказ создается в отдельной транзакции
- Оплата происходит только после проверки всех условий
- Четкое разделение ответственности

### 🎯 Контроль
- Можно создать заказ и оплатить позже
- Лучшая обработка ошибок оплаты
- Возможность повторить оплату при неудаче

### 📊 Мониторинг
- Отдельные логи для создания и оплаты
- Детальная информация о статусах платежей
- Проще отслеживать проблемы

### 🚀 Производительность
- Транзакции создания заказа стали быстрее
- Нет блокировок при проблемах с банком
- Возможность асинхронной оплаты

## Миграция для клиентов

### Старый способ (deprecated):
```javascript
// Создание и оплата в одном запросе
const response = await fetch('/api/orders/create-user-order', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    business_id: 1,
    items: [...],
    card_id: 789  // Игнорируется
  })
});
```

### Новый способ (рекомендуется):
```javascript
// Шаг 1: Создание заказа
const orderResponse = await fetch('/api/orders/create-user-order', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    business_id: 1,
    items: [...]
  })
});

const { order_id } = orderResponse.data;

// Шаг 2: Оплата заказа
const paymentResponse = await fetch(`/api/orders/${order_id}/pay`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    card_id: 789
  })
});

// Проверка результата оплаты
if (paymentResponse.data.payment_result.status === 'ok') {
  console.log('Заказ успешно оплачен!');
} else {
  console.log('Ошибка оплаты:', paymentResponse.data.payment_result);
}
```

## Статусы заказов

| Статус | Описание | Можно оплачивать |
|--------|----------|------------------|
| 66     | Новый заказ | ✅ Да |
| 0      | Оплачен | ❌ Уже оплачен |
| 1      | Принят в обработку | ❌ Нет |
| 2      | Собран | ❌ Нет |
| 3      | Передан курьеру | ❌ Нет |
| 4      | В пути | ❌ Нет |
| 5      | Доставлен | ❌ Нет |
| 99     | Отменен | ❌ Нет |

## Статусы платежей

| Статус | Описание | Действие |
|--------|----------|----------|
| `ok` | Успешно | Заказ оплачен |
| `insufficient_funds` | Недостаточно средств | Попробовать другую карту |
| `bad_request` | Некорректные данные | Проверить параметры |
| `forbidden` | Операция запрещена | Проверить права доступа |
| `server_error` | Ошибка банка | Повторить позже |
| `unknown` | Неизвестная ошибка | Обратиться в поддержку |

## Примеры обработки ошибок

### Обработка ошибок оплаты
```javascript
const paymentResponse = await fetch(`/api/orders/${orderId}/pay`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ card_id: cardId })
});

const result = await paymentResponse.json();

switch (result.data.payment_result.status) {
  case 'ok':
    showSuccess('Заказ успешно оплачен!');
    break;
  case 'insufficient_funds':
    showError('Недостаточно средств на карте');
    // Предложить выбрать другую карту
    break;
  case 'server_error':
    showError('Временные проблемы с банком. Попробуйте позже.');
    break;
  default:
    showError('Ошибка оплаты: ' + result.data.payment_result.error_detail);
}
```

## Тестирование

### Тест создания заказа:
```bash
curl -X POST http://localhost:3000/api/orders/create-user-order \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"business_id": 1, "items": [{"item_id": 123, "amount": 1}]}'
```

### Тест оплаты заказа:
```bash
curl -X POST http://localhost:3000/api/orders/ORDER_ID/pay \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"card_id": 789}'
```

## Заключение

Разделение создания заказа и оплаты улучшает:
- 🔒 **Безопасность** - четкое разделение операций
- 🎯 **Надежность** - лучшая обработка ошибок
- 📈 **Масштабируемость** - возможность оптимизации каждого этапа
- 🛠 **Отладку** - проще находить и исправлять проблемы
- 💡 **UX** - пользователь видит прогресс выполнения операций
