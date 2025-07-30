# 🏠 API выбранного адреса - Краткое руководство

## Обзор функциональности

Система выбранного адреса позволяет пользователям сохранять свой последний выбранный адрес доставки и быстро его получать для оформления заказов.

## Новые endpoint'ы

### 1. Получить выбранный адрес
```
GET /api/addresses/user/selected?business_id=1
```

**Описание:** Получает последний выбранный адрес пользователя с опциональной проверкой доставки.

**Ответ (успех):**
```json
{
  "success": true,
  "data": {
    "selected_address": {
      "address_id": 123,
      "lat": 52.2854,
      "lon": 76.9701,
      "address": "ул. Пахомова, 72",
      "name": "Дом",
      "apartment": "15",
      "entrance": "1",
      "floor": "3",
      "other": "Домофон 15",
      "city_id": 1,
      "created_at": "2024-01-15T10:30:00.000Z",
      "selected_at": "2024-01-16T14:20:00.000Z",
      "delivery": {
        "available": true,
        "price": 500,
        "delivery_type": "standard",
        "message": "Доставка доступна",
        "distance": 3.2
      }
    },
    "business_id": 1
  },
  "message": "Выбранный адрес найден с информацией о доставке"
}
```

**Ответ (адрес не выбран):**
```json
{
  "success": false,
  "error": {
    "message": "У пользователя нет выбранного адреса",
    "statusCode": 404
  }
}
```

### 2. Выбрать адрес
```
POST /api/addresses/user/select
```

**Body:**
```json
{
  "address_id": 123
}
```

**Ответ:**
```json
{
  "success": true,
  "data": {
    "selected_address_id": 456,
    "address_id": 123,
    "user_id": 789,
    "selected_at": "2024-01-16T14:20:00.000Z"
  },
  "message": "Адрес успешно выбран"
}
```

## Схема базы данных

Таблица `selected_address`:
```sql
CREATE TABLE selected_address (
  relation_id INT PRIMARY KEY AUTO_INCREMENT,
  address_id INT NOT NULL,
  user_id INT NOT NULL,
  log_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Логика работы

1. **Выбор адреса:** Когда пользователь выбирает адрес, создается новая запись в `selected_address`
2. **Получение выбранного:** Возвращается последняя запись (ORDER BY log_timestamp DESC)
3. **Кэширование:** Информация о доставке кэшируется на 5 минут
4. **Валидация:** Проверяется существование адреса и принадлежность пользователю

## Интеграция с фронтендом

### React Hook
```javascript
const useSelectedAddress = (businessId = null) => {
  const [selectedAddress, setSelectedAddress] = useState(null);
  
  const loadSelectedAddress = async () => {
    const response = await fetch('/api/addresses/user/selected?business_id=' + businessId);
    if (response.ok) {
      const data = await response.json();
      setSelectedAddress(data.data.selected_address);
    }
  };
  
  return { selectedAddress, loadSelectedAddress };
};
```

### Выбор адреса
```javascript
const selectAddress = async (addressId) => {
  const response = await fetch('/api/addresses/user/select', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address_id: addressId })
  });
  
  if (response.ok) {
    // Перезагрузить выбранный адрес
    await loadSelectedAddress();
  }
};
```

## Производительность

- ✅ Кэширование доставки (5 минут TTL)
- ✅ Индексация по user_id в selected_address
- ✅ Параллельная обработка при получении адресов с доставкой

## Безопасность

- ✅ Проверка авторизации (JWT token)
- ✅ Валидация принадлежности адреса пользователю
- ✅ Валидация входных данных

## Тестирование

Используйте файл `test-selected-address.html` для интерактивного тестирования всех endpoint'ов.

## Мониторинг

Все запросы логируются с указанием времени выполнения для мониторинга производительности:
```
⚡ Запрос адресов с доставкой выполнен за 250мс
```
