# Тест API отслеживания статуса заказа

## Описание
Новый API endpoint `/api/orders/:id/status` предоставляет подробную информацию о текущем статусе заказа с полной историей изменений.

## Основные возможности

### 1. Текущий статус с детальной информацией
- Код и название статуса
- Описание статуса
- Цвет для UI (hex)
- Иконка для отображения  
- Время изменения статуса
- Финальный ли статус

### 2. История статусов
- Полная хронология изменений
- Время каждого изменения
- Относительное время ("5 мин назад")

### 3. Прогнозирование
- Следующий ожидаемый статус
- Примерное время доставки
- Относительное время до доставки

### 4. Дополнительная информация
- Информация о магазине
- Стоимость заказа
- Возможность отмены
- Необходимость оплаты

## Статусы заказов

| Код | Название | Описание | Цвет | Финальный |
|-----|----------|----------|------|-----------|
| 66  | Новый заказ | Заказ создан, ожидает оплаты | #ffa500 | Нет |
| 0   | Оплачен | Заказ оплачен, передан в обработку | #4caf50 | Нет |
| 1   | В обработке | Заказ принят в обработку | #2196f3 | Нет |
| 2   | Собран | Заказ собран, готов к доставке | #9c27b0 | Нет |
| 3   | Передан курьеру | Заказ передан курьеру для доставки | #ff9800 | Нет |
| 4   | В пути | Курьер направляется к вам | #607d8b | Нет |
| 5   | Доставлен | Заказ успешно доставлен | #4caf50 | Да |
| 99  | Отменен | Заказ отменен | #ff4444 | Да |

## Пример использования

```bash
# Отслеживание статуса заказа
curl -X GET "http://localhost:3000/api/orders/61838/status" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Ответ API

```json
{
  "success": true,
  "data": {
    "order_id": 61838,
    "order_uuid": "175372365461838",
    "delivery_type": "DELIVERY",
    "current_status": {
      "code": 66,
      "name": "Новый заказ",
      "description": "Заказ создан, ожидает оплаты",
      "color": "#ffa500",
      "icon": "pending",
      "is_final": false,
      "timestamp": "2025-07-28T20:00:00.000Z",
      "time_ago": "9 мин назад"
    },
    "next_expected_status": {
      "code": 0,
      "name": "Оплачен",
      "description": "Заказ оплачен, передан в обработку",
      "color": "#4caf50",
      "icon": "paid",
      "is_final": false
    },
    "business": {
      "business_id": 1,
      "name": "Алкомаркет №1",
      "address": "ул. Абая, 1"
    },
    "status_history": [
      {
        "status": 66,
        "is_canceled": 0,
        "timestamp": "2025-07-28T20:00:00.000Z",
        "status_info": {
          "code": 66,
          "name": "Новый заказ",
          "description": "Заказ создан, ожидает оплаты",
          "color": "#ffa500",
          "icon": "pending",
          "is_final": false
        },
        "time_ago": "9 мин назад"
      }
    ],
    "can_cancel": true,
    "payment_required": true,
    "created_at": "2025-07-28T20:00:00.000Z"
  },
  "message": "Информация о статусе заказа получена"
}
```

## Интеграция с фронтендом

### JavaScript пример
```javascript
// Отслеживание статуса с автообновлением
async function trackOrder(orderId) {
  const response = await fetch(`/api/orders/${orderId}/status`, {
    headers: { 'Authorization': 'Bearer ' + token }
  });
  
  const data = await response.json();
  
  if (data.success) {
    // Обновляем UI
    updateOrderStatus(data.data);
    
    // Если заказ не завершен, обновляем через 30 сек
    if (!data.data.current_status.is_final) {
      setTimeout(() => trackOrder(orderId), 30000);
    }
  }
}

function updateOrderStatus(orderData) {
  // Обновляем заголовок статуса
  document.getElementById('status-name').textContent = orderData.current_status.name;
  document.getElementById('status-description').textContent = orderData.current_status.description;
  
  // Устанавливаем цвет статуса
  document.getElementById('status-indicator').style.backgroundColor = orderData.current_status.color;
  
  // Показываем время
  document.getElementById('status-time').textContent = orderData.current_status.time_ago;
  
  // Обновляем прогресс-бар
  updateProgressBar(orderData.status_history);
  
  // Показываем кнопки действий
  if (orderData.can_cancel) {
    document.getElementById('cancel-button').style.display = 'block';
  }
  
  if (orderData.payment_required) {
    document.getElementById('pay-button').style.display = 'block';
  }
}
```

## Особенности реализации

### 1. Безопасность
- Пользователи могут отслеживать только свои заказы
- Требуется аутентификация JWT

### 2. Производительность
- Единый запрос получает всю необходимую информацию
- Минимальное количество обращений к БД

### 3. Пользовательский опыт
- Понятные названия и описания статусов
- Цвета для визуального восприятия
- Относительное время ("5 мин назад")
- Прогнозирование следующих шагов

### 4. Гибкость
- Легко добавить новые статусы
- Возможность кастомизации для разных типов доставки
- Поддержка будущих фич (уведомления, трекинг курьера)

## Возможные улучшения

1. **WebSocket уведомления** - мгновенные обновления статуса
2. **Геолокация курьера** - отслеживание в реальном времени  
3. **Push-уведомления** - автоматические уведомления об изменениях
4. **Детальная аналитика** - время на каждом этапе
5. **Интеграция с курьерскими службами** - реальные данные о доставке
