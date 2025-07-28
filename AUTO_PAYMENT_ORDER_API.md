# 🚀 API Автоматического списания при создании заказа

## 📋 Общая информация

API для создания заказов с автоматическим списанием денег с сохраненных карт Halyk Bank. Деньги списываются сразу при создании заказа без дополнительных действий пользователя.

**Базовый URL:** `http://localhost:3000/api`

**Требования авторизации:** JWT токен в заголовке `Authorization: Bearer <token>`

## 🎯 Основной API Endpoint

### Создание заказа с автоматическим списанием

**Endpoint:** `POST /api/orders/create-user-order`

**Описание:** Создает заказ и автоматически списывает деньги с выбранной сохраненной карты

**Заголовки:**
```
Content-Type: application/json
Authorization: Bearer YOUR_JWT_TOKEN
```

**Тело запроса:**
```json
{
  "business_id": 1,
  "address_id": 15,
  "items": [
    {
      "item_id": 123,
      "amount": 2,
      "options": [
        {
          "option_item_relation_id": 45,
          "amount": 1
        }
      ]
    },
    {
      "item_id": 124,
      "amount": 1
    }
  ],
  "bonus": 0,
  "extra": "{\"comment\": \"Без лука\"}",
  "delivery_type": "DELIVERY",
  "delivery_date": "2025-01-27T15:30:00Z",
  "saved_card_id": 7
}
```

**Параметры:**
- `business_id` (number, обязательный) - ID заведения
- `address_id` (number, условно обязательный) - ID адреса доставки (обязательно для DELIVERY и SCHEDULED)
- `items` (array, обязательный) - Массив товаров заказа
  - `item_id` (number) - ID товара
  - `amount` (number) - Количество товара  
  - `options` (array, опционально) - Опции товара
    - `option_item_relation_id` (number) - ID связи опции с товаром
    - `amount` (number, опционально) - Количество опции (по умолчанию 1)
- `bonus` (number, опционально) - Использование бонусов (по умолчанию 0)
- `extra` (string, опционально) - Дополнительная информация в JSON формате
- `delivery_type` (string, обязательный) - Тип доставки: "DELIVERY", "SCHEDULED", "PICKUP"
- `delivery_date` (string, условно обязательный) - Дата доставки в ISO формате (обязательно для SCHEDULED)
- `saved_card_id` (number, обязательный) - ID сохраненной карты для автоматического списания

**Ответ при успехе:**
```json
{
  "success": true,
  "data": {
    "order_id": 12345,
    "order_uuid": "ORDER-1737984123456-ABC123DEF",
    "total_cost": 2750,
    "delivery_price": 500,
    "total_discount": 250,
    "items_count": 2,
    "promotions_applied": 1,
    "payment_type": "Оплата в приложении",
    "status": "PAYMENT_INITIATED",
    "payment_info": {
      "saved_card_id": 7,
      "card_mask": "**** **** **** 1234",
      "auto_payment": true,
      "message": "Платеж автоматически инициирован"
    },
    "delivery_calculation": {
      "delivery_type": "zone",
      "message": "Доставка в пределах зоны",
      "max_distance": 5000,
      "current_distance": 1250,
      "address": {
        "address_id": 15,
        "address": "ул. Абая, 123",
        "name": "Дом",
        "lat": 43.2567,
        "lon": 76.9286
      }
    },
    "items": [
      {
        "item_id": 123,
        "name": "Бургер классический",
        "amount": 2,
        "base_amount": 2,
        "option_multiplier": 0,
        "price": 1200,
        "charged_amount": 2,
        "original_cost": 2400,
        "discounted_cost": 2200,
        "promotion": {
          "name": "Скидка 10%",
          "type": "discount"
        },
        "options": [
          {
            "option_item_relation_id": 45,
            "name": "Дополнительный сыр",
            "amount": 1,
            "price": 150,
            "parent_item_amount": 1
          }
        ]
      }
    ]
  },
  "message": "Заказ создан и оплата автоматически инициирована"
}
```

**Ответ при ошибке:**
```json
{
  "success": false,
  "error": {
    "message": "Сохраненная карта не найдена или не принадлежит пользователю",
    "statusCode": 404,
    "timestamp": "2025-01-27T12:30:00.000Z"
  }
}
```

---

## 🔍 Мониторинг статуса оплаты

### Проверка статуса платежа

**Endpoint:** `GET /api/payments/order-payment-status/:orderId`

**Описание:** Проверяет текущий статус оплаты заказа

**Параметры URL:**
- `orderId` (number) - ID заказа

**Ответ:**
```json
{
  "success": true,
  "data": {
    "order_id": 12345,
    "order_uuid": "CARD1737984123456789",
    "status": 77,
    "is_paid": true,
    "payment_info": {
      "invoice_id": "CARD1737984123456789",
      "payment_status": "SUCCESS",
      "payment_method": "saved_card_auto",
      "amount": 2750,
      "currency": "KZT",
      "error_message": null
    }
  }
}
```

**Статусы заказов:**
- `0` - NEW (новый)
- `1` - PROCESSING (обработка платежа)
- `66` - UNPAID (неоплаченный)
- `77` - PAID (оплаченный)

---

## 🌐 Дополнительные API

### Получение сохраненных карт

**Endpoint:** `GET /api/user/cards`

**Описание:** Получает список сохраненных карт пользователя

**Ответ:**
```json
{
  "success": true,
  "data": [
    {
      "card_id": 7,
      "card_mask": "**** **** **** 1234",
      "halyk_card_id": "abcd1234-efgh-5678-ijkl-mnop9012qrst"
    },
    {
      "card_id": 8,
      "card_mask": "**** **** **** 5678",
      "halyk_card_id": "wxyz5678-abcd-1234-efgh-ijkl9012mnop"
    }
  ]
}
```

---

## 🔄 Жизненный цикл заказа с автоматическим списанием

### 1. Создание заказа
```
POST /api/orders/create-user-order
Status: PAYMENT_INITIATED
```

### 2. Автоматическое списание (происходит на backend)
```
Backend автоматически:
- Получает токен Halyk Bank
- Создает платеж с cardId
- Инициирует списание
- Обновляет статус заказа
```

### 3. Мониторинг результата
```
GET /api/payments/order-payment-status/:orderId
Проверка каждые 2-3 секунды до получения финального статуса
```

### 4. Финальные статусы
- ✅ **Успех:** `is_paid: true`, статус `77` (PAID)
- ❌ **Ошибка:** `payment_info.error_message` содержит описание ошибки
- ⏱️ **Таймаут:** Превышено время ожидания (3 минуты)

---

## 🚨 Обработка ошибок

### Возможные ошибки создания заказа:

**400 Bad Request - Валидация данных**
```json
{
  "success": false,
  "error": {
    "message": "Необходимо указать saved_card_id для автоматического списания",
    "statusCode": 400
  }
}
```

**401 Unauthorized - Авторизация**
```json
{
  "success": false,
  "error": {
    "message": "Необходима авторизация",
    "statusCode": 401
  }
}
```

**404 Not Found - Карта не найдена**
```json
{
  "success": false,
  "error": {
    "message": "Сохраненная карта не найдена или не принадлежит пользователю",
    "statusCode": 404
  }
}
```

**500 Internal Server Error - Ошибка платежа**
```json
{
  "success": false,
  "error": {
    "message": "Ошибка создания заказа: Не удалось инициировать автоматическое списание",
    "statusCode": 500
  }
}
```

### Ошибки списания (в payment_info):
- `insufficient_funds` - Недостаточно средств
- `card_expired` - Срок действия карты истек
- `card_blocked` - Карта заблокирована
- `network_error` - Сетевая ошибка
- `timeout` - Превышено время ожидания

---

## 💻 Примеры использования

### React компонент создания заказа с автоматическим списанием

```jsx
import React, { useState, useEffect } from 'react';

const CreateOrderWithAutoPayment = () => {
  const [orderData, setOrderData] = useState({
    business_id: 1,
    address_id: null,
    items: [],
    delivery_type: 'DELIVERY',
    delivery_date: null,
    saved_card_id: null
  });
  
  const [savedCards, setSavedCards] = useState([]);
  const [orderStatus, setOrderStatus] = useState('idle');
  const [createdOrder, setCreatedOrder] = useState(null);
  const [loading, setLoading] = useState(false);

  // Загрузка сохраненных карт
  useEffect(() => {
    const loadSavedCards = async () => {
      try {
        const response = await fetch('/api/user/cards', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const result = await response.json();
        if (result.success) {
          setSavedCards(result.data);
        }
      } catch (error) {
        console.error('Ошибка загрузки карт:', error);
      }
    };

    loadSavedCards();
  }, []);

  // Создание заказа с автоматическим списанием
  const createOrderWithAutoPayment = async () => {
    if (!orderData.saved_card_id) {
      alert('Выберите карту для автоматического списания');
      return;
    }

    setLoading(true);
    setOrderStatus('creating');

    try {
      const response = await fetch('/api/orders/create-user-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(orderData)
      });

      const result = await response.json();

      if (result.success) {
        setCreatedOrder(result.data);
        setOrderStatus('payment_initiated');
        
        // Начинаем мониторинг статуса платежа
        startPaymentMonitoring(result.data.order_id);
      } else {
        throw new Error(result.error?.message || 'Ошибка создания заказа');
      }

    } catch (error) {
      setOrderStatus('error');
      console.error('Ошибка:', error);
      alert(`Ошибка создания заказа: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Мониторинг статуса платежа
  const startPaymentMonitoring = (orderId) => {
    const checkPaymentStatus = async () => {
      try {
        const response = await fetch(`/api/payments/order-payment-status/${orderId}`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        
        const result = await response.json();
        
        if (result.success) {
          if (result.data.is_paid) {
            setOrderStatus('paid');
            alert('✅ Заказ успешно оплачен!');
            return true; // Останавливаем мониторинг
          } else if (result.data.payment_info.error_message) {
            setOrderStatus('payment_failed');
            alert(`❌ Ошибка оплаты: ${result.data.payment_info.error_message}`);
            return true; // Останавливаем мониторинг
          }
        }
        
        return false; // Продолжаем мониторинг
      } catch (error) {
        console.error('Ошибка проверки статуса:', error);
        return false;
      }
    };

    // Проверяем статус каждые 2 секунды
    const interval = setInterval(async () => {
      const shouldStop = await checkPaymentStatus();
      
      if (shouldStop) {
        clearInterval(interval);
      }
    }, 2000);

    // Останавливаем мониторинг через 3 минуты
    setTimeout(() => {
      clearInterval(interval);
      if (orderStatus === 'payment_initiated') {
        setOrderStatus('payment_timeout');
        alert('⏰ Время ожидания платежа истекло');
      }
    }, 3 * 60 * 1000);
  };

  // Получение сообщения статуса
  const getStatusMessage = () => {
    switch (orderStatus) {
      case 'creating':
        return '⏳ Создание заказа...';
      case 'payment_initiated':
        return '💳 Списание средств с карты...';
      case 'paid':
        return '✅ Заказ успешно оплачен!';
      case 'payment_failed':
        return '❌ Ошибка списания средств';
      case 'payment_timeout':
        return '⏰ Время ожидания платежа истекло';
      case 'error':
        return '❌ Ошибка создания заказа';
      default:
        return '';
    }
  };

  return (
    <div className="create-order-container">
      <h2>Создание заказа с автоматическим списанием</h2>
      
      {/* Выбор сохраненной карты */}
      <div className="payment-section">
        <h3>Выберите карту для автоматического списания:</h3>
        <div className="cards-list">
          {savedCards.map(card => (
            <div 
              key={card.card_id}
              className={`card-option ${orderData.saved_card_id === card.card_id ? 'selected' : ''}`}
              onClick={() => setOrderData({...orderData, saved_card_id: card.card_id})}
            >
              <span className="card-mask">{card.card_mask}</span>
              <input 
                type="radio" 
                checked={orderData.saved_card_id === card.card_id}
                onChange={() => setOrderData({...orderData, saved_card_id: card.card_id})}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Кнопка создания заказа */}
      <button 
        onClick={createOrderWithAutoPayment}
        disabled={loading || !orderData.saved_card_id}
        className="create-order-button"
      >
        {loading ? 'Создание заказа...' : 'Создать заказ и списать деньги'}
      </button>

      {/* Статус процесса */}
      {orderStatus !== 'idle' && (
        <div className={`status-message ${orderStatus}`}>
          {getStatusMessage()}
        </div>
      )}

      {/* Информация о созданном заказе */}
      {createdOrder && (
        <div className="order-info">
          <h3>Информация о заказе:</h3>
          <p><strong>Номер заказа:</strong> {createdOrder.order_id}</p>
          <p><strong>Сумма:</strong> {createdOrder.total_cost} ₸</p>
          <p><strong>Доставка:</strong> {createdOrder.delivery_price} ₸</p>
          <p><strong>Карта:</strong> {createdOrder.payment_info?.card_mask}</p>
        </div>
      )}
    </div>
  );
};

export default CreateOrderWithAutoPayment;
```

---

## ✅ Готово к использованию!

API полностью настроен для автоматического списания при создании заказа. Основные возможности:

- ✅ Создание заказа с автоматическим списанием денег
- ✅ Валидация всех параметров заказа
- ✅ Проверка принадлежности карты пользователю
- ✅ Автоматическая интеграция с Halyk Bank
- ✅ Мониторинг статуса платежа в реальном времени
- ✅ Обработка всех возможных ошибок
- ✅ Подробная документация с примерами

**Преимущества нового подхода:**
1. **Удобство:** Пользователь создает заказ и деньги списываются автоматически
2. **Скорость:** Нет необходимости в дополнительных шагах оплаты
3. **Безопасность:** Все транзакции проходят через защищенную систему Halyk Bank
4. **Надежность:** Полная обработка ошибок и статусов платежей
