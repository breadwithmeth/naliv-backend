# Employee API Quick Reference

Краткий справочник по Employee API для разработчиков.

## 🔐 Аутентификация

```bash
Authorization: Bearer YOUR_EMPLOYEE_TOKEN
```

## 📋 Эндпоинты

### 1. Список заказов
```
GET /api/employee/orders
```

**Параметры:**
- `page` - номер страницы (default: 1)
- `limit` - записей на странице (default: 20, max: 100)
- `status` - статус заказа (0-66)
- `business_id` - ID бизнеса
- `start_date` - дата начала (YYYY-MM-DD)
- `end_date` - дата окончания (YYYY-MM-DD)
- `search` - поиск по тексту

**Быстрый пример:**
```bash
curl -H "Authorization: Bearer TOKEN" \
"http://localhost:3000/api/employee/orders?status=4&limit=10"
```

### 2. Детали заказа
```
GET /api/employee/orders/{orderId}
```

**Быстрый пример:**
```bash
curl -H "Authorization: Bearer TOKEN" \
"http://localhost:3000/api/employee/orders/123"
```

### 3. Статистика заказов
```
GET /api/employee/orders/statistics
```

**Параметры:**
- `start_date` - дата начала
- `end_date` - дата окончания
- `business_id` - ID бизнеса

**Быстрый пример:**
```bash
curl -H "Authorization: Bearer TOKEN" \
"http://localhost:3000/api/employee/orders/statistics?start_date=2024-01-01"
```

## 📊 Статусы заказов

| Код | Статус |
|-----|--------|
| 0 | Новый заказ |
| 1 | Принят магазином |
| 2 | Готов к выдаче |
| 3 | Доставляется |
| 4 | Доставлен |
| 5 | Отменен |
| 6 | Ошибка платежа |
| 66 | Не оплачен |

## 🔧 JavaScript Examples

### Получить все доставленные заказы
```javascript
const response = await fetch('/api/employee/orders?status=4', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const data = await response.json();
```

### Поиск заказов по клиенту
```javascript
const response = await fetch('/api/employee/orders?search=Иван', {
  headers: { 'Authorization': `Bearer ${token}` }
});
```

### Статистика за месяц
```javascript
const response = await fetch(
  '/api/employee/orders/statistics?start_date=2024-01-01&end_date=2024-01-31',
  { headers: { 'Authorization': `Bearer ${token}` }}
);
```

## ⚡ Полезные фильтры

### Сегодняшние заказы
```
?start_date=2024-01-15&end_date=2024-01-15
```

### Заказы конкретного бизнеса
```
?business_id=123
```

### Активные заказы (не доставлены)
```
?status=0,1,2,3
```

### Проблемные заказы
```
?status=5,6,66
```

## 📱 Мобильная разработка

### React Native / Expo
```javascript
const getOrders = async (filters = {}) => {
  const params = new URLSearchParams(filters).toString();
  const response = await fetch(`${API_URL}/employee/orders?${params}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  return response.json();
};
```

### Flutter/Dart
```dart
Future<Map<String, dynamic>> getOrders({Map<String, String>? filters}) async {
  final uri = Uri.parse('$apiUrl/employee/orders').replace(
    queryParameters: filters
  );
  
  final response = await http.get(uri, headers: {
    'Authorization': 'Bearer $token',
    'Content-Type': 'application/json'
  });
  
  return json.decode(response.body);
}
```

## 🐛 Отладка

### Проверка токена
```bash
curl -H "Authorization: Bearer TOKEN" \
"http://localhost:3000/api/employee/auth/profile"
```

### Тест базового запроса
```bash
curl -H "Authorization: Bearer TOKEN" \
"http://localhost:3000/api/employee/orders?limit=1"
```

## 🚀 Производительность

### Рекомендации
- Используйте пагинацию (`limit` ≤ 50)
- Фильтруйте по дате для больших объемов
- Кешируйте статистику на клиенте
- Используйте `business_id` для специфичных запросов

### Оптимальные запросы
```bash
# Хорошо - с пагинацией и фильтрами
/api/employee/orders?limit=20&status=4&business_id=123

# Плохо - без ограничений
/api/employee/orders

# Хорошо - статистика за период
/api/employee/orders/statistics?start_date=2024-01-01&end_date=2024-01-31

# Плохо - статистика за все время без фильтров
/api/employee/orders/statistics
```

## 📝 Типичные сценарии

### 1. Дашборд сотрудника
```javascript
// Получить статистику за сегодня
const today = new Date().toISOString().split('T')[0];
const stats = await fetch(`/api/employee/orders/statistics?start_date=${today}&end_date=${today}`);

// Получить последние 10 заказов
const orders = await fetch('/api/employee/orders?limit=10');
```

### 2. Поиск заказа клиента
```javascript
// Поиск по номеру телефона
const orders = await fetch('/api/employee/orders?search=+77071234567');

// Поиск по UUID заказа
const orders = await fetch('/api/employee/orders?search=550e8400-e29b');
```

### 3. Мониторинг доставок
```javascript
// Заказы в доставке
const delivering = await fetch('/api/employee/orders?status=3');

// Готовые к выдаче
const ready = await fetch('/api/employee/orders?status=2');
```

## 🔗 Интеграция с другими API

### Получить детали курьера для заказа
```javascript
const orderDetails = await fetch(`/api/employee/orders/${orderId}`);
const courierId = orderDetails.data.order.courier?.courier_id;

if (courierId) {
  // Использовать Courier API для дополнительной информации
  const courierInfo = await fetch(`/api/courier/${courierId}/profile`);
}
```

## 🎯 Полезные ссылки

- [Полная документация](./EMPLOYEE_API_DOCUMENTATION.md)
- [Тестовый интерфейс](./test-employee-api.html)
- [Employee Auth API](./src/routes/employeeAuth.ts)
- [Схема базы данных](./BUSINESS_ORDER_SYSTEM_ARCHITECTURE.md)
