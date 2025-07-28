# 🚀 Промпт для GitHub Copilot: Автоматическая оплата при создании заказа

## 📋 Техническое задание

Привет! Мне нужно создать интерфейс для создания заказов с автоматическим списанием денег с сохраненной карты сразу при оформлении заказа. Деньги списываются автоматически без дополнительных действий пользователя.

## 🎯 Что нужно реализовать

### 1. **Компонент создания заказа**
- Выбор товаров и их количества
- Выбор адреса доставки
- Выбор типа доставки (доставка/самовывоз)
- Обязательный выбор сохраненной карты для автоматического списания
- Автоматический расчет стоимости доставки

### 2. **Компонент выбора сохраненной карты**
- Список сохраненных карт пользователя с масками
- Радио-кнопки для выбора карты
- Показать последние 4 цифры карты
- Обязательный выбор карты (без возможности оформить без карты)

### 3. **Процесс создания заказа с автоматическим списанием**
- Отправка запроса на создание заказа с saved_card_id
- Автоматическое списание происходит на backend
- Отображение статуса "Платеж инициирован"
- Мониторинг статуса оплаты в реальном времени

## 🌐 API Endpoints (готовы на backend)

```typescript
// Получение сохраненных карт
GET /api/user/cards  
Headers: { Authorization: Bearer <token> }

// Создание заказа с автоматическим списанием (ОСНОВНОЙ)
POST /api/orders/create-user-order
Headers: { Authorization: Bearer <token> }
Body: {
  business_id: number,
  address_id?: number, // Обязательно для доставки
  items: Array<{
    item_id: number,
    amount: number,
    options?: Array<{
      option_item_relation_id: number,
      amount?: number
    }>
  }>,
  bonus?: number,
  extra?: string,
  delivery_type: "DELIVERY" | "SCHEDULED" | "PICKUP",
  delivery_date?: string, // Для SCHEDULED
  saved_card_id: number // ОБЯЗАТЕЛЬНО для автоматического списания
}
// Возвращает: информацию о заказе и статусе платежа

// Проверка статуса оплаты
GET /api/payments/order-payment-status/:orderId
Headers: { Authorization: Bearer <token> }
```

## 💻 Примеры структур данных

### Запрос создания заказа:
```typescript
interface CreateOrderRequest {
  business_id: number;
  address_id?: number;
  items: OrderItem[];
  bonus?: number;
  extra?: string;
  delivery_type: 'DELIVERY' | 'SCHEDULED' | 'PICKUP';
  delivery_date?: string;
  saved_card_id: number; // ОБЯЗАТЕЛЬНО
}

interface OrderItem {
  item_id: number;
  amount: number;
  options?: OrderItemOption[];
}

interface OrderItemOption {
  option_item_relation_id: number;
  amount?: number;
}
```

### Ответ создания заказа:
```typescript
interface CreateOrderResponse {
  success: true;
  data: {
    order_id: number;
    order_uuid: string;
    total_cost: number;
    delivery_price: number;
    total_discount: number;
    items_count: number;
    promotions_applied: number;
    payment_type: string;
    status: 'PAYMENT_INITIATED'; // Платеж автоматически инициирован
    payment_info: {
      saved_card_id: number;
      card_mask: string;
      auto_payment: true;
      message: string;
    };
    delivery_calculation?: any;
    items: OrderItemWithDetails[];
  };
  message: 'Заказ создан и оплата автоматически инициирована';
}
```

### Сохраненная карта:
```typescript
interface SavedCard {
  card_id: number;
  card_mask: string; // "**** **** **** 1234"
  halyk_card_id: string;
}
```

## 🎨 UI/UX требования

### Страница создания заказа:
```jsx
// Структура компонента
<CreateOrderPage>
  <OrderItems>
    <ItemSelector /> // выбор товаров
    <ItemQuantity /> // количество
  </OrderItems>
  
  <DeliveryOptions>
    <DeliveryTypeSelector /> // доставка/самовывоз
    <AddressSelector /> // адрес доставки (если нужно)
    <DeliveryDatePicker /> // дата доставки (для SCHEDULED)
  </DeliveryOptions>
  
  <PaymentSection>
    <SavedCardsList>
      <CardOption required /> // обязательный выбор карты
    </SavedCardsList>
    <CostSummary /> // итоговая стоимость
  </PaymentSection>
  
  <CreateOrderButton onClick={createOrderWithAutoPayment} />
  
  <PaymentStatusModal>
    <StatusIndicator /> // "Платеж инициирован"
    <PaymentProgress /> // мониторинг статуса
  </PaymentStatusModal>
</CreateOrderPage>
```

### Визуальный дизайн:
- Четкое разделение на секции (товары, доставка, оплата)
- Обязательная секция выбора карты (без возможности пропустить)
- Индикатор автоматического списания
- Прогресс-бар процесса оплаты
- Уведомления об успешном/неуспешном списании

## ⚡ Логика создания заказа с автоматическим списанием

### Пошаговый процесс:
```javascript
const createOrderWithAutoPayment = async (orderData, savedCardId) => {
  try {
    // 1. Валидация данных
    if (!savedCardId) {
      throw new Error('Необходимо выбрать карту для автоматического списания');
    }
    
    // 2. Показать индикатор "Создание заказа..."
    setOrderStatus('creating');
    
    // 3. Отправить запрос на создание заказа с автоматическим списанием
    const response = await fetch('/api/orders/create-user-order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        ...orderData,
        saved_card_id: savedCardId
      })
    });

    const result = await response.json();
    
    if (result.success) {
      // 4. Заказ создан, списание инициировано
      setOrderStatus('payment_initiated');
      
      // 5. Начать мониторинг статуса платежа
      startPaymentMonitoring(result.data.order_id);
      
      return result.data;
    } else {
      throw new Error(result.error?.message || 'Ошибка создания заказа');
    }
    
  } catch (error) {
    setOrderStatus('error');
    showError(error.message);
    throw error;
  }
};

// Мониторинг статуса платежа
const startPaymentMonitoring = (orderId) => {
  const checkPaymentStatus = async () => {
    try {
      const response = await fetch(`/api/payments/order-payment-status/${orderId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const result = await response.json();
      
      if (result.success) {
        if (result.data.is_paid) {
          setOrderStatus('paid');
          showSuccess('Заказ успешно оплачен!');
          redirectToOrderDetails(orderId);
          return true; // Останавливаем мониторинг
        } else if (result.data.payment_info.error_message) {
          setOrderStatus('payment_failed');
          showError(`Ошибка оплаты: ${result.data.payment_info.error_message}`);
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
      showWarning('Время ожидания платежа истекло. Проверьте статус заказа позже.');
    }
  }, 3 * 60 * 1000);
};
```

## 🔄 Управление состоянием

### React state structure:
```typescript
interface OrderCreationState {
  // Данные заказа
  selectedItems: OrderItem[];
  deliveryType: 'DELIVERY' | 'SCHEDULED' | 'PICKUP';
  selectedAddress: Address | null;
  deliveryDate: Date | null;
  
  // Оплата
  savedCards: SavedCard[];
  selectedCard: SavedCard | null;
  
  // Статус процесса
  orderStatus: 'idle' | 'creating' | 'payment_initiated' | 'paid' | 'payment_failed' | 'payment_timeout' | 'error';
  totalCost: number;
  loading: boolean;
  error: string | null;
  
  // Результат
  createdOrder: CreatedOrder | null;
}
```

### Actions:
- `addItem(item)` - добавить товар в заказ
- `removeItem(itemId)` - удалить товар из заказа
- `updateItemQuantity(itemId, quantity)` - изменить количество
- `selectDeliveryType(type)` - выбрать тип доставки
- `selectAddress(address)` - выбрать адрес доставки
- `selectCard(card)` - выбрать карту для автоматического списания
- `createOrderWithAutoPayment()` - создать заказ с автоматическим списанием
- `checkPaymentStatus(orderId)` - проверить статус платежа

## 🎯 Ключевые особенности

### Валидация перед созданием заказа:
```javascript
const validateOrderData = (orderData, selectedCard) => {
  const errors = [];
  
  if (!orderData.items || orderData.items.length === 0) {
    errors.push('Добавьте товары в заказ');
  }
  
  if (!selectedCard) {
    errors.push('Выберите карту для автоматического списания');
  }
  
  if (orderData.delivery_type === 'DELIVERY' && !orderData.address_id) {
    errors.push('Выберите адрес доставки');
  }
  
  if (orderData.delivery_type === 'SCHEDULED' && !orderData.delivery_date) {
    errors.push('Выберите дату и время доставки');
  }
  
  return errors;
};
```

### Отображение статусов процесса:
```javascript
const getStatusMessage = (status) => {
  switch (status) {
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
```

## 🔧 Технические детали

### API базовый URL:
```javascript
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';
```

### Автоматический расчет стоимости:
```javascript
// Стоимость рассчитывается автоматически на backend
// Фронтенд может показывать примерную стоимость для предпросмотра
const calculateEstimatedCost = (items, deliveryType) => {
  const itemsCost = items.reduce((sum, item) => sum + (item.price * item.amount), 0);
  const deliveryCost = deliveryType === 'DELIVERY' ? 500 : 0; // Примерно
  return itemsCost + deliveryCost;
};
```

### Обработка ошибок списания:
```javascript
const handlePaymentError = (error) => {
  if (error.includes('insufficient funds')) {
    showError('Недостаточно средств на карте');
  } else if (error.includes('card expired')) {
    showError('Срок действия карты истек');
  } else if (error.includes('card blocked')) {
    showError('Карта заблокирована');
  } else {
    showError('Произошла ошибка при списании средств');
  }
};
```

## 📱 Адаптивность

- Мобильная версия: вертикальный стек секций
- Планшет: компактное расположение
- Десктоп: широкий layout с сайдбаром для корзины
- Модалки статуса адаптивные

## 🎨 UI библиотека

Используй любую удобную:
- Material-UI / MUI
- Ant Design
- Chakra UI
- Tailwind CSS
- Или чистый CSS/SCSS

## ✅ Чек-лист готовности

1. [ ] Компонент выбора товаров и количества
2. [ ] Компонент выбора типа доставки
3. [ ] Компонент выбора адреса доставки (для DELIVERY)
4. [ ] Компонент выбора сохраненной карты (обязательный)
5. [ ] Валидация всех данных перед отправкой
6. [ ] Создание заказа с автоматическим списанием
7. [ ] Мониторинг статуса платежа в реальном времени
8. [ ] Обработка всех статусов (успех, ошибка, таймаут)
9. [ ] Адаптивный дизайн для всех устройств
10. [ ] Error handling и user-friendly сообщения

## 🚀 Начни с этого:

1. Создай форму создания заказа с выбором товаров
2. Добавь обязательный выбор сохраненной карты
3. Реализуй отправку заказа с автоматическим списанием
4. Добавь мониторинг статуса платежа
5. Улучши UX с прогресс-индикаторами и уведомлениями

Создай современный интерфейс с автоматическим списанием средств! 🎯
