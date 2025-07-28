# 💳 API Оплаты Сохраненными Картами (Обновленная версия)

## 📋 Общая информация

API предназначен для оплаты заказов с использованием ранее сохраненных карт Halyk Bank. Система позволяет пользователям оплачивать заказы без повторного ввода данных карты.

**Базовый URL:** `http://localhost:3000/api/payments`

**Требования авторизации:** Все методы требуют JWT токен в заголовке `Authorization: Bearer <token>`

## 🎯 Основные endpoint'ы

### 1. Оплата заказа сохраненной картой

**Endpoint:** `POST /pay-with-saved-card`

**Описание:** Инициирует оплату существующего заказа с использованием сохраненной карты

**Заголовки:**
```
Content-Type: application/json
Authorization: Bearer YOUR_JWT_TOKEN
```

**Тело запроса:**
```json
{
  "order_id": 123,
  "saved_card_id": 45
}
```

**Параметры:**
- `order_id` (number, обязательный) - ID заказа для оплаты
- `saved_card_id` (number, обязательный) - ID сохраненной карты пользователя

**Ответ:** HTML страница с формой оплаты Halyk Bank

**Пример использования:**
```javascript
const response = await fetch('/api/payments/pay-with-saved-card', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    order_id: 123,
    saved_card_id: 45
  })
});

const htmlForm = await response.text();
// Открыть HTML форму в новом окне
const paymentWindow = window.open('', '_blank', 'width=600,height=700');
paymentWindow.document.write(htmlForm);
```

---

### 2. Проверка статуса оплаты заказа

**Endpoint:** `GET /order-payment-status/:orderId`

**Описание:** Получает текущий статус заказа и информацию о платеже

**Заголовки:**
```
Authorization: Bearer YOUR_JWT_TOKEN
```

**Параметры URL:**
- `orderId` (number) - ID заказа

**Ответ:**
```json
{
  "success": true,
  "data": {
    "order_id": 123,
    "order_uuid": "CARD1234567890123456",
    "status": 77,
    "is_paid": true,
    "payment_info": {
      "invoice_id": "CARD1234567890123456",
      "payment_status": "SUCCESS",
      "payment_method": "saved_card",
      "amount": 2500,
      "currency": "KZT",
      "error_message": null
    }
  }
}
```

**Статусы заказов:**
- `0` - NEW (новый)
- `66` - UNPAID (неоплаченный)
- `77` - PAID (оплаченный)

**Пример использования:**
```javascript
const response = await fetch(`/api/payments/order-payment-status/${orderId}`, {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

const result = await response.json();
if (result.success && result.data.is_paid) {
  console.log('Заказ успешно оплачен!');
}
```

---

## 🔄 Полный процесс оплаты

### Шаг 1: Получение неоплаченных заказов
```javascript
// Получаем заказы пользователя (используйте API заказов)
const ordersResponse = await fetch('/api/orders/user', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const orders = await ordersResponse.json();

// Фильтруем неоплаченные заказы
const unpaidOrders = orders.data.filter(order => 
  order.status?.status === 66 || order.status?.status === 0
);
```

### Шаг 2: Получение сохраненных карт
```javascript
// Получаем список сохраненных карт пользователя
const cardsResponse = await fetch('/api/user/cards', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const savedCards = await cardsResponse.json();
```

### Шаг 3: Инициация оплаты
```javascript
const payWithSavedCard = async (orderId, savedCardId) => {
  try {
    const response = await fetch('/api/payments/pay-with-saved-card', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        order_id: orderId,
        saved_card_id: savedCardId
      })
    });

    if (!response.ok) {
      throw new Error('Ошибка инициации оплаты');
    }

    // Получаем HTML форму
    const htmlForm = await response.text();
    
    // Открываем в новом окне
    const paymentWindow = window.open('', '_blank', 'width=600,height=700');
    paymentWindow.document.write(htmlForm);
    
    return paymentWindow;
  } catch (error) {
    console.error('Ошибка оплаты:', error);
    throw error;
  }
};
```

### Шаг 4: Отслеживание результата
```javascript
const trackPaymentResult = (orderId, paymentWindow) => {
  // Периодически проверяем статус заказа
  const checkStatus = async () => {
    try {
      const response = await fetch(`/api/payments/order-payment-status/${orderId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const result = await response.json();
      
      if (result.success) {
        if (result.data.is_paid) {
          console.log('✅ Заказ успешно оплачен!');
          paymentWindow.close();
          return true; // Оплата завершена
        } else if (result.data.payment_info.error_message) {
          console.log('❌ Ошибка оплаты:', result.data.payment_info.error_message);
          paymentWindow.close();
          return false; // Ошибка оплаты
        }
      }
      
      return null; // Оплата в процессе
    } catch (error) {
      console.error('Ошибка проверки статуса:', error);
      return null;
    }
  };

  // Проверяем каждые 3 секунды
  const interval = setInterval(async () => {
    const result = await checkStatus();
    
    if (result !== null) {
      clearInterval(interval);
      
      if (result) {
        // Успешная оплата - обновляем интерфейс
        window.location.reload(); // или обновляем список заказов
      } else {
        // Ошибка оплаты - показываем сообщение
        alert('Произошла ошибка при оплате. Попробуйте еще раз.');
      }
    }
  }, 3000);

  // Останавливаем проверку через 5 минут
  setTimeout(() => {
    clearInterval(interval);
    if (!paymentWindow.closed) {
      paymentWindow.close();
    }
  }, 5 * 60 * 1000);
};
```

---

## 🚨 Обработка ошибок

### Возможные ошибки API:

**401 Unauthorized**
```json
{
  "success": false,
  "error": {
    "message": "Пользователь не авторизован",
    "statusCode": 401
  }
}
```

**404 Not Found**
```json
{
  "success": false,
  "error": {
    "message": "Заказ не найден или уже оплачен",
    "statusCode": 404
  }
}
```

**400 Bad Request**
```json
{
  "success": false,
  "error": {
    "message": "Не указан ID заказа или ID сохраненной карты",
    "statusCode": 400
  }
}
```

**500 Internal Server Error**
```json
{
  "success": false,
  "error": {
    "message": "Ошибка обработки оплаты: подробности",
    "statusCode": 500
  }
}
```

---

## 📊 Структуры данных

### Заказ (Order)
```typescript
interface Order {
  order_id: number;
  order_uuid: string;
  user_id: number;
  business_id: number;
  delivery_price: number;
  log_timestamp: string;
  extra: string; // JSON с дополнительной информацией
}
```

### Сохраненная карта (SavedCard)
```typescript
interface SavedCard {
  card_id: number;
  user_id: number;
  halyk_card_id: string; // ID карты в системе Halyk Bank
  card_mask: string; // "**** **** **** 1234"
  created_at: string;
}
```

### Стоимость заказа (OrderCost)
```typescript
interface OrderCost {
  cost_id: number;
  order_id: number;
  cost: number; // Стоимость товаров
  delivery: number; // Стоимость доставки
  service_fee: number; // Сервисный сбор
}
```

---

## ✅ Готово к использованию!

API полностью настроен и готов к интеграции с фронтендом. Основные возможности:

- ✅ Оплата заказов сохраненными картами
- ✅ Проверка статуса оплаты в реальном времени
- ✅ Полная интеграция с Halyk Bank
- ✅ Обработка ошибок и edge cases
- ✅ Безопасная авторизация через JWT
- ✅ Подробная документация с примерами

**Следующие шаги:**
1. Интегрируйте API в ваш фронтенд
2. Протестируйте оплату с реальными сохраненными картами
3. Настройте обработку результатов оплаты
4. Добавьте UI/UX элементы согласно дизайну
