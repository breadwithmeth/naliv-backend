# 🚫 Решение проблемы "Адрес находится за пределами зоны доставки"

## Описание проблемы

Пользователи получают ошибку:
```json
{
    "error": {
        "message": "Доставка недоступна: Адрес находится за пределами зоны доставки",
        "statusCode": 400,
        "timestamp": "2025-07-30T04:46:23.733Z",
        "path": "/api/orders/create-user-order",
        "method": "POST"
    }
}
```

## Причины возникновения

### 1. Выбранный адрес в другом городе
Пользователь выбрал адрес доставки в одном городе, но пытается заказать из магазина в другом городе.

**Пример:**
- Магазин: Павлодар (business_id: 1)
- Выбранный адрес: Караганда (address_id: 62655)

### 2. Автоматический выбор неподходящего адреса
Система автоматически выбирает последний добавленный или выбранный адрес, который может не подходить для текущего магазина.

## Решения

### ✅ Решение 1: Использование конкретного address_id
При создании заказа передавайте конкретный `address_id`:

```json
{
  "business_id": 1,
  "items": [...],
  "delivery": true,
  "address_id": 60466
}
```

### ✅ Решение 2: Выбор правильного адреса через API
Выберите адрес в том же городе, что и магазин:

```bash
curl -X POST "http://localhost:3000/api/addresses/user/select" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"address_id": 60466}'
```

### ✅ Решение 3: Проверка зоны доставки перед заказом
Проверьте доступность доставки:

```bash
curl -X POST "http://localhost:3000/api/addresses/check-delivery" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "lat": 52.289902,
    "lon": 76.954619,
    "business_id": 1
  }'
```

## Обновленная логика системы

### До исправления:
1. Система брала последний добавленный адрес
2. Не учитывала выбранный адрес из `selected_address`
3. Не позволяла передать конкретный `address_id`

### После исправления:
1. ✅ Приоритет `address_id` из запроса
2. ✅ Затем выбранный адрес из `selected_address`
3. ✅ В крайнем случае - последний добавленный адрес

## Проверка адресов пользователя

### SQL запрос для проверки адресов:
```sql
SELECT 
  ua.address_id,
  ua.address,
  ua.lat,
  ua.lon,
  CASE 
    WHEN ua.lat BETWEEN 52.0 AND 53.0 AND ua.lon BETWEEN 76.0 AND 77.0 THEN 'Павлодар'
    WHEN ua.lat BETWEEN 49.0 AND 50.0 AND ua.lon BETWEEN 73.0 AND 74.0 THEN 'Караганда'
    ELSE 'Другой город'
  END as city_guess,
  ST_Contains(c.city_border, ST_PointFromText(CONCAT('POINT(', ua.lon, ' ', ua.lat, ')'))) as in_pavlodar
FROM user_addreses ua
CROSS JOIN cities c
WHERE ua.user_id = 252 
  AND ua.isDeleted = 0 
  AND c.city_id = 1
ORDER BY ua.address_id DESC;
```

## Рекомендации для фронтенда

### 1. Показывать город магазина
```javascript
const businessInfo = await fetch(`/api/businesses/${business_id}`);
console.log(`Заказ из города: ${businessInfo.city_name}`);
```

### 2. Фильтровать адреса по городу
```javascript
const suitableAddresses = userAddresses.filter(addr => {
  // Проверить, подходит ли адрес для данного business_id
  return addr.city === business.city;
});
```

### 3. Предупреждать о несовместимости
```javascript
if (selectedAddress.city !== business.city) {
  showWarning('Выбранный адрес находится в другом городе');
}
```

## Примеры правильных запросов

### Создание заказа с конкретным адресом:
```json
{
  "business_id": 1,
  "items": [
    {
      "item_id": 25754,
      "amount": 1
    }
  ],
  "delivery": true,
  "address_id": 60466,
  "extra": "Домофон 15"
}
```

### Выбор подходящего адреса:
```json
{
  "address_id": 60466
}
```

## Мониторинг

Добавлены логи для отладки:
- Выбор адреса: какой адрес используется
- Проверка зоны: результат проверки доставки
- Ошибки: детальная информация о причине отказа

```
📍 Используется адрес: 60466 (Павлодар)
✅ Адрес в зоне доставки, цена: 500 тенге
❌ Адрес за пределами зоны доставки: Караганда -> Павлодар
```
