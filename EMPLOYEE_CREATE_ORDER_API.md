# Employee Create Order API

## Создание заказа сотрудником (Call-Center)

Endpoint для создания заказа от лица сотрудника call-центра с указанием метода оплаты.

### Endpoint
```
POST /api/employee/create-order
```

### Авторизация
Требуется токен сотрудника в заголовке:
```
Authorization: Bearer <employee_token>
```

### Параметры запроса

| Параметр | Тип | Обязательный | Описание |
|----------|-----|--------------|----------|
| `business_id` | number | Да | ID бизнеса |
| `user_id` | number | Нет* | ID пользователя |
| `phone_number` | string | Нет* | Номер телефона пользователя |
| `payment_method` | string | Да | Метод оплаты: 'CARD', 'CASH', 'KASPI' |
| `items` | array | Да | Массив товаров |
| `delivery_type` | string | Нет | Тип доставки: 'DELIVERY', 'PICKUP', 'SCHEDULED' (по умолчанию: 'DELIVERY') |
| `street` | string | Да** | Улица |
| `house` | string | Да** | Дом |
| `apartment` | string | Нет | Квартира |
| `entrance` | string | Нет | Подъезд |
| `floor` | string | Нет | Этаж |
| `comment` | string | Нет | Комментарий к адресу |
| `lat` | number | Да** | Широта |
| `lon` | number | Да** | Долгота |
| `bonus_amount` | number | Нет | Сумма бонусов к применению (по умолчанию: 0) |
| `extra` | string | Нет | Дополнительная информация |
| `delivery_date` | string | Да*** | Дата доставки (ISO 8601) |

*Необходимо указать либо `user_id`, либо `phone_number`. Если указан только `phone_number`, система найдет или создаст пользователя.

**Обязательны для `delivery_type` = 'DELIVERY' или 'SCHEDULED'

***Обязательна для `delivery_type` = 'SCHEDULED'

### Формат массива items

```json
[
  {
    "item_id": 123,
    "amount": 2,
    "options": [
      {
        "option_item_relation_id": 456
      }
    ]
  }
]
```

### Пример запроса

```bash
curl -X POST http://localhost:3000/api/employee/create-order \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_EMPLOYEE_TOKEN" \
  -d '{
    "business_id": 1,
    "phone_number": "+77001234567",
    "payment_method": "CASH",
    "delivery_type": "DELIVERY",
    "street": "ул. Абая",
    "house": "150",
    "apartment": "45",
    "entrance": "2",
    "floor": "5",
    "comment": "Позвонить в домофон",
    "lat": 43.238293,
    "lon": 76.945465,
    "items": [
      {
        "item_id": 100,
        "amount": 2,
        "options": []
      },
      {
        "item_id": 101,
        "amount": 1,
        "options": [
          {
            "option_item_relation_id": 50
          }
        ]
      }
    ],
    "bonus_amount": 0,
    "extra": "Клиент постоянный"
  }'
```

### Пример запроса с запланированной доставкой

```bash
curl -X POST http://localhost:3000/api/employee/create-order \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_EMPLOYEE_TOKEN" \
  -d '{
    "business_id": 1,
    "user_id": 42,
    "payment_method": "CARD",
    "delivery_type": "SCHEDULED",
    "delivery_date": "2025-12-10T18:00:00Z",
    "street": "ул. Назарбаева",
    "house": "50",
    "lat": 43.238293,
    "lon": 76.945465,
    "items": [
      {
        "item_id": 100,
        "amount": 3
      }
    ]
  }'
```

### Пример запроса с самовывозом

```bash
curl -X POST http://localhost:3000/api/employee/create-order \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_EMPLOYEE_TOKEN" \
  -d '{
    "business_id": 1,
    "phone_number": "+77001234567",
    "payment_method": "KASPI",
    "delivery_type": "PICKUP",
    "items": [
      {
        "item_id": 100,
        "amount": 1
      }
    ]
  }'
```

### Успешный ответ (201 Created)

```json
{
  "success": true,
  "data": {
    "order_id": 12345,
    "order_uuid": 1234567890,
    "total_sum": 5500,
    "delivery_price": 500,
    "address_id": 789,
    "is_canceled": 0,
    "delivery_type": "DELIVERY",
    "payment_method": "CASH",
    "created_by": "call_center",
    "employee_id": 5
  },
  "message": "Заказ успешно создан сотрудником. Метод оплаты: CASH"
}
```

### Возможные ошибки

#### 400 Bad Request
```json
{
  "success": false,
  "error": {
    "message": "Не все обязательные поля заполнены (business_id, items)",
    "statusCode": 400,
    "timestamp": "2025-12-04T10:30:00.000Z"
  }
}
```

#### 400 Bad Request - Некорректный метод оплаты
```json
{
  "success": false,
  "error": {
    "message": "Некорректный метод оплаты. Доступные: CARD, CASH, KASPI",
    "statusCode": 400,
    "timestamp": "2025-12-04T10:30:00.000Z"
  }
}
```

#### 400 Bad Request - Доставка недоступна
```json
{
  "success": false,
  "error": {
    "message": "Доставка недоступна: Адрес вне зоны доставки",
    "statusCode": 400,
    "timestamp": "2025-12-04T10:30:00.000Z"
  }
}
```

#### 401 Unauthorized
```json
{
  "success": false,
  "error": {
    "message": "Необходима авторизация сотрудника",
    "statusCode": 401,
    "timestamp": "2025-12-04T10:30:00.000Z"
  }
}
```

#### 404 Not Found
```json
{
  "success": false,
  "error": {
    "message": "Бизнес не найден",
    "statusCode": 404,
    "timestamp": "2025-12-04T10:30:00.000Z"
  }
}
```

## Особенности работы

### Статус заказа
- Заказы, созданные сотрудником, получают статус **0** (новый заказ, оплаченный)
- В отличие от заказов пользователей без оплаты (статус 66), эти заказы сразу считаются оплаченными

### Метод оплаты
- Метод оплаты сохраняется в поле `extra` заказа в формате JSON
- Доступные методы: `CARD`, `CASH`, `KASPI`
- Поле `payment_method` обязательно для всех заказов call-центра

### Привязка к сотруднику
- В таблице `orders` заполняется поле `employee_id`
- Это позволяет отличать заказы из приложения от заказов call-центра
- Заказы из приложения имеют `employee_id = NULL` или `0`
- Заказы call-центра имеют `employee_id > 0`

### Создание пользователя
- Если передан только `phone_number`, система:
  1. Ищет пользователя с таким номером (в поле `login`)
  2. Если не найден - создает нового пользователя
  3. Новые пользователи получают `is_app_user = 0` (не пользователь приложения)

### Расчет стоимости
- Автоматически применяются активные акции на товары
- Рассчитывается стоимость доставки на основе зоны
- Учитываются опции товаров
- Возможно применение бонусов

### Типы доставки
- **DELIVERY** - обычная доставка (требуется адрес)
- **PICKUP** - самовывоз (адрес не требуется)
- **SCHEDULED** - запланированная доставка (требуется адрес и дата)

### Валидация запланированной доставки
- Дата должна быть в будущем
- Максимум на 30 дней вперед
- Формат даты: ISO 8601 (например, `2025-12-10T18:00:00Z`)

## Workflow

1. **Авторизация сотрудника** - проверка токена
2. **Валидация данных** - проверка обязательных полей и корректности данных
3. **Поиск/создание пользователя** - по `user_id` или `phone_number`
4. **Проверка бизнеса** - существование в БД
5. **Расчет доставки** - если требуется
6. **Создание заказа** в транзакции:
   - Создание адреса (если доставка)
   - Создание заказа с `employee_id`
   - Создание статуса заказа (status = 0)
   - Добавление товаров с применением акций
   - Добавление опций товаров
   - Расчет итоговой стоимости
7. **Возврат результата** с деталями заказа

## Примеры использования

### Создание заказа для существующего пользователя
```javascript
const response = await fetch('/api/employee/create-order', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${employeeToken}`
  },
  body: JSON.stringify({
    business_id: 1,
    user_id: 42,
    payment_method: 'CASH',
    delivery_type: 'DELIVERY',
    street: 'ул. Абая',
    house: '150',
    lat: 43.238293,
    lon: 76.945465,
    items: [
      { item_id: 100, amount: 2 }
    ]
  })
});

const result = await response.json();
console.log('Order created:', result.data.order_id);
```

### Создание заказа для нового клиента
```javascript
const response = await fetch('/api/employee/create-order', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${employeeToken}`
  },
  body: JSON.stringify({
    business_id: 1,
    phone_number: '+77001234567',
    payment_method: 'CARD',
    delivery_type: 'DELIVERY',
    street: 'ул. Назарбаева',
    house: '50',
    apartment: '10',
    lat: 43.238293,
    lon: 76.945465,
    items: [
      { item_id: 100, amount: 1 },
      { item_id: 101, amount: 3 }
    ]
  })
});

const result = await response.json();
console.log('New user ID:', result.data.user_id);
console.log('Order ID:', result.data.order_id);
```

## Отличия от клиентского API

| Параметр | Клиентский API | Employee API |
|----------|----------------|--------------|
| Статус заказа | 66 (не оплачен) | 0 (оплачен) |
| employee_id | NULL/0 | ID сотрудника |
| payment_method | Не требуется | Обязателен |
| user_id | Из токена | Можно указать любого |
| Создание пользователя | Только при регистрации | Автоматически по phone_number |
| is_app_user | 1 | 0 |

## Безопасность

- Требуется валидный токен сотрудника
- Проверяется авторизация через middleware `authenticateEmployee`
- Валидация всех входных данных
- Защита от SQL-инъекций через Prisma
- Транзакционность операций для консистентности данных
