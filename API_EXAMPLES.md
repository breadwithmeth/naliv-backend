# API Examples - Naliv Backend

## Примеры использования API

### 1. Полный процесс создания заказа

#### Шаг 1: Регистрация/авторизация пользователя
```bash
# Регистрация
curl -X POST "http://localhost:3000/api/auth/register" \
-H "Content-Type: application/json" \
-d '{
  "phone": "+77077707600",
  "password": "test123",
  "name": "Иван Иванов"
}'

# Авторизация
curl -X POST "http://localhost:3000/api/auth/login" \
-H "Content-Type: application/json" \
-d '{
  "phone": "+77077707600",
  "password": "test123"
}'
```

#### Шаг 2: Получение списка бизнесов
```bash
curl -X GET "http://localhost:3000/api/businesses?page=1&limit=10"
```

#### Шаг 3: Получение товаров бизнеса
```bash
curl -X GET "http://localhost:3000/api/businesses/2/items?category_id=5&page=1&limit=20" \
-H "Authorization: Bearer YOUR_TOKEN_HERE"
```

#### Шаг 4: Получение категорий
```bash
curl -X GET "http://localhost:3000/api/categories?business_id=2"
```

#### Шаг 5: Расчет стоимости доставки
```bash
curl -X POST "http://localhost:3000/api/delivery/calculate" \
-H "Content-Type: application/json" \
-d '{
  "business_id": 2,
  "lat": 52.271643,
  "lon": 76.950011
}'
```

#### Шаг 6: Создание заказа
```bash
curl -X POST "http://localhost:3000/api/orders" \
-H "Content-Type: application/json" \
-H "Authorization: Bearer YOUR_TOKEN_HERE" \
-d '{
  "user_id": 7777,
  "business_id": 2,
  "address_id": 60678,
  "items": [
    {
      "item_id": 2406,
      "amount": 4
    },
    {
      "item_id": 2407,
      "amount": 2,
      "options": [
        {
          "option_item_relation_id": 10,
          "price": 100.00,
          "amount": 1
        }
      ]
    }
  ],
  "bonus": 50,
  "extra": "Позвонить за 15 минут до приезда",
  "delivery_type": "DELIVERY"
}'
```

#### Шаг 7: Получение информации о заказе
```bash
curl -X GET "http://localhost:3000/api/orders/789" \
-H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### 2. Работа сотрудника с заказами

#### Авторизация сотрудника
```bash
curl -X POST "http://localhost:3000/api/employee/auth/login" \
-H "Content-Type: application/json" \
-d '{
  "login": "operator1",
  "password": "emp123"
}'
```

#### Получение списка заказов
```bash
curl -X GET "http://localhost:3000/api/employee/orders?status=0&page=1&limit=10" \
-H "Authorization: Bearer EMPLOYEE_TOKEN_HERE"
```

#### Поиск клиента по номеру телефона
```bash
curl -X GET "http://localhost:3000/api/users/search?phone=+77077707600" \
-H "Authorization: Bearer EMPLOYEE_TOKEN_HERE"
```

#### Обновление статуса заказа
```bash
# Принять заказ
curl -X PATCH "http://localhost:3000/api/orders/789/status" \
-H "Content-Type: application/json" \
-H "Authorization: Bearer EMPLOYEE_TOKEN_HERE" \
-d '{
  "status": 1
}'

# Отметить как собранный
curl -X PATCH "http://localhost:3000/api/orders/789/status" \
-H "Content-Type: application/json" \
-H "Authorization: Bearer EMPLOYEE_TOKEN_HERE" \
-d '{
  "status": 2
}'

# Отдать курьеру
curl -X PATCH "http://localhost:3000/api/orders/789/status" \
-H "Content-Type: application/json" \
-H "Authorization: Bearer EMPLOYEE_TOKEN_HERE" \
-d '{
  "status": 3
}'

# Отметить как доставленный
curl -X PATCH "http://localhost:3000/api/orders/789/status" \
-H "Content-Type: application/json" \
-H "Authorization: Bearer EMPLOYEE_TOKEN_HERE" \
-d '{
  "status": 4
}'

# Отменить заказ
curl -X PATCH "http://localhost:3000/api/orders/789/status" \
-H "Content-Type: application/json" \
-H "Authorization: Bearer EMPLOYEE_TOKEN_HERE" \
-d '{
  "status": 7,
  "isCanceled": true
}'
```

### 3. Запланированная доставка

```bash
curl -X POST "http://localhost:3000/api/orders" \
-H "Content-Type: application/json" \
-H "Authorization: Bearer YOUR_TOKEN_HERE" \
-d '{
  "user_id": 7777,
  "business_id": 2,
  "address_id": 60678,
  "items": [
    {
      "item_id": 2406,
      "amount": 2
    }
  ],
  "delivery_type": "SCHEDULED",
  "delivery_date": "2025-07-24T18:00:00.000Z"
}'
```

### 4. Самовывоз

```bash
curl -X POST "http://localhost:3000/api/orders" \
-H "Content-Type: application/json" \
-H "Authorization: Bearer YOUR_TOKEN_HERE" \
-d '{
  "user_id": 7777,
  "business_id": 2,
  "items": [
    {
      "item_id": 2406,
      "amount": 1
    }
  ],
  "delivery_type": "PICKUP"
}'
```

### 5. Получение истории заказов пользователя

```bash
curl -X GET "http://localhost:3000/api/orders?page=1&limit=5" \
-H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### 6. Работа с категориями и фильтрация

#### Получение всех категорий
```bash
curl -X GET "http://localhost:3000/api/categories"
```

#### Получение категорий для конкретного бизнеса
```bash
curl -X GET "http://localhost:3000/api/categories?business_id=2"
```

#### Получение товаров по категории
```bash
curl -X GET "http://localhost:3000/api/businesses/2/items?category_id=5" \
-H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### 7. Получение профиля пользователя

```bash
curl -X GET "http://localhost:3000/api/auth/profile" \
-H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## Частые ошибки и их решения

### Ошибка 401 - Недействительный токен
```json
{
  "error": {
    "message": "Недействительный токен",
    "statusCode": 401
  }
}
```
**Решение:** Обновите токен через повторную авторизацию.

### Ошибка 400 - Неверный тип доставки для SCHEDULED
```json
{
  "error": {
    "message": "Для запланированной доставки необходимо указать delivery_date",
    "statusCode": 400
  }
}
```
**Решение:** Добавьте поле `delivery_date` с датой от 2 до 24 часов от текущего времени.

### Ошибка 400 - Адрес не найден
```json
{
  "error": {
    "message": "Адрес не найден или не принадлежит пользователю",
    "statusCode": 400
  }
}
```
**Решение:** Проверьте что `address_id` существует и принадлежит пользователю.

### Ошибка 400 - Товар не найден или неактивен
```json
{
  "error": {
    "message": "Товар с ID 999 не найден или неактивен",
    "statusCode": 400
  }
}
```
**Решение:** Проверьте что товар существует и активен в указанном бизнесе.

## Примеры ответов с акциями

### Заказ с примененной акцией SUBTRACT (2+1)
```json
{
  "success": true,
  "data": {
    "order": {
      "order_id": 789,
      "total_cost": 2500
    },
    "promotions_applied": [
      {
        "item_id": 2406,
        "promotion_type": "SUBTRACT",
        "promotion_name": "Акция 2+1",
        "original_amount": 3,
        "charged_amount": 2,
        "free_amount": 1,
        "savings": 1000
      }
    ]
  }
}
```

### Заказ с примененной акцией DISCOUNT (скидка 15%)
```json
{
  "success": true,
  "data": {
    "order": {
      "order_id": 790,
      "total_cost": 2125
    },
    "promotions_applied": [
      {
        "item_id": 2407,
        "promotion_type": "DISCOUNT",
        "promotion_name": "Скидка 15%",
        "original_price": 1500,
        "discounted_price": 1275,
        "discount_percent": 15,
        "savings": 225
      }
    ]
  }
}
```

## Тестирование через Postman

Создайте коллекцию Postman с переменными:
- `baseUrl`: `http://localhost:3000/api`
- `userToken`: токен пользователя
- `employeeToken`: токен сотрудника

Используйте переменные в запросах для удобства тестирования.
