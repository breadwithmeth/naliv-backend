# API управления акциями для сотрудников

## Обзор
Этот API предоставляет возможности управления маркетинговыми акциями для сотрудников с уровнем доступа **SUPERVISOR** и **ADMIN**.

## Аутентификация
Все эндпоинты требуют JWT токен сотрудника в заголовке:
```
Authorization: Bearer <employee_jwt_token>
```

## Уровни доступа
- **SUPERVISOR** - доступ ко всем операциям управления акциями
- **ADMIN** - полный доступ

---

## 📋 Управление акциями

### 1. Получить список акций
**GET** `/api/employee/promotions`

#### Query параметры:
- `business_id` (опционально) - Фильтр по бизнесу
- `visible` (опционально) - Фильтр по видимости (`true`/`false`)

#### Пример запроса:
```bash
curl -X GET "http://localhost:3000/api/employee/promotions?business_id=1&visible=true" \
  -H "Authorization: Bearer <token>"
```

#### Пример ответа:
```json
{
  "success": true,
  "data": {
    "promotions": [
      {
        "marketing_promotion_id": 1,
        "name": "Черная пятница",
        "start_promotion_date": "2024-11-01T00:00:00.000Z",
        "end_promotion_date": "2024-11-30T23:59:59.000Z",
        "business_id": 1,
        "cover": "https://example.com/promo-cover.jpg",
        "visible": 1,
        "marketing_promotion_details": [
          {
            "detail_id": 1,
            "type": "SUBTRACT",
            "base_amount": "5.000",
            "add_amount": "1.000",
            "item_id": 100,
            "name": "Водка Premium",
            "discount": null
          }
        ],
        "marketing_promotion_stories": [
          {
            "story_id": 1,
            "cover": "https://example.com/story.jpg",
            "promo": "Описание акции"
          }
        ],
        "business": {
          "business_id": 1,
          "name": "Алкомаркет №1"
        }
      }
    ]
  }
}
```

---

### 2. Получить акцию по ID
**GET** `/api/employee/promotions/:id`

#### Параметры пути:
- `id` - ID акции

#### Пример запроса:
```bash
curl -X GET "http://localhost:3000/api/employee/promotions/1" \
  -H "Authorization: Bearer <token>"
```

#### Ответы:
- **200 OK** - Акция найдена
- **404 Not Found** - Акция не найдена
- **400 Bad Request** - Неверный ID

---

### 3. Создать акцию
**POST** `/api/employee/promotions`

#### Тело запроса:
```json
{
  "name": "Новогодняя распродажа",
  "start_promotion_date": "2024-12-20T00:00:00Z",
  "end_promotion_date": "2025-01-10T23:59:59Z",
  "business_id": 1,
  "cover": "https://example.com/new-year-promo.jpg",
  "visible": true,
  "details": [
    {
      "type": "PERCENT",
      "item_id": 100,
      "discount": 15,
      "name": "Скидка 15%"
    }
  ]
}
```

#### Обязательные поля:
- `name` - Название акции
- `start_promotion_date` - Дата начала (ISO 8601)
- `end_promotion_date` - Дата окончания (ISO 8601)
- `business_id` - ID бизнеса
- `details` - Массив деталей акции (минимум 1), каждая деталь обязана содержать `item_id`

#### Опциональные поля:
- `cover` - URL обложки (по умолчанию: `""`)
- `visible` - Видимость (по умолчанию: `true`)

#### Пример запроса:
```bash
curl -X POST "http://localhost:3000/api/employee/promotions" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Новогодняя распродажа",
    "start_promotion_date": "2024-12-20T00:00:00Z",
    "end_promotion_date": "2025-01-10T23:59:59Z",
    "business_id": 1
  }'
```

#### Валидация:
- Дата окончания должна быть позже даты начала
- Бизнес должен существовать
- Акция не может быть создана без деталей
- Товары в `details` должны принадлежать указанному `business_id`

#### Ответы:
- **201 Created** - Акция создана
- **400 Bad Request** - Ошибка валидации
- **404 Not Found** - Бизнес не найден

---

### 3.1. Автоматически создать акцию и детали
**POST** `/api/employee/promotions/auto`

Создает `marketing_promotions` и набор `marketing_promotion_details` за один запрос.

#### Поддерживаемые типы:
- `SUBTRACT` - акция N+M
- `PERCENT` - процентная скидка

Также принимается legacy `DISCOUNT` (будет нормализован в `PERCENT`).

#### Вариант A: скидка на список товаров
```json
{
  "business_id": 1,
  "type": "PERCENT",
  "discount": 15,
  "item_ids": [100, 101, 102],
  "duration_days": 7,
  "visible": true
}
```

#### Вариант B: акция 2+1 на все товары бизнеса
```json
{
  "business_id": 1,
  "type": "SUBTRACT",
  "base_amount": 2,
  "add_amount": 1,
  "apply_to_all_items": true,
  "duration_days": 14
}
```

#### Вариант C: детали вручную
```json
{
  "business_id": 1,
  "type": "PERCENT",
  "start_promotion_date": "2025-12-18T10:00:00.000Z",
  "end_promotion_date": "2025-12-25T10:00:00.000Z",
  "details": [
    { "item_id": 100, "discount": 10 },
    { "item_id": 101, "discount": 25 }
  ]
}
```

---

### 4. Обновить акцию
**PUT** `/api/employee/promotions/:id`

#### Параметры пути:
- `id` - ID акции

#### Тело запроса (все поля опциональны):
```json
{
  "name": "Обновленное название",
  "start_promotion_date": "2024-12-25T00:00:00Z",
  "end_promotion_date": "2025-01-15T23:59:59Z",
  "business_id": 2,
  "cover": "https://example.com/updated-cover.jpg",
  "visible": false
}
```

#### Пример запроса:
```bash
curl -X PUT "http://localhost:3000/api/employee/promotions/1" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "visible": false
  }'
```

#### Ответы:
- **200 OK** - Акция обновлена
- **404 Not Found** - Акция не найдена
- **400 Bad Request** - Ошибка валидации

---

### 5. Удалить акцию
**DELETE** `/api/employee/promotions/:id`

**⚠️ Внимание:** Удаляет акцию вместе со всеми деталями и историями!

#### Параметры пути:
- `id` - ID акции

#### Пример запроса:
```bash
curl -X DELETE "http://localhost:3000/api/employee/promotions/1" \
  -H "Authorization: Bearer <token>"
```

#### Ответы:
- **200 OK** - Акция удалена
- **404 Not Found** - Акция не найдена

---

## 🎯 Управление деталями акций

### 6. Добавить деталь к акции
**POST** `/api/employee/promotions/:id/details`

#### Параметры пути:
- `id` - ID акции

#### Тело запроса:
```json
{
  "type": "SUBTRACT",
  "base_amount": 5,
  "add_amount": 1,
  "item_id": 100,
  "name": "Водка Premium 0.5л",
  "discount": null
}
```

#### Обязательные поля:
- `type` - Тип акции (`SUBTRACT` или другой)
- `item_id` - ID товара

#### Поля для типа `SUBTRACT`:
- `base_amount` - Базовое количество (купи N)
- `add_amount` - Дополнительное количество (получи M бесплатно)

#### Поля для процентной скидки:
- `discount` - Скидка в процентах (0-100)

#### Опциональные поля:
- `name` - Название (по умолчанию: имя товара)

#### Примеры:

**Акция "5+1" (купи 5, получи 6):**
```bash
curl -X POST "http://localhost:3000/api/employee/promotions/1/details" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "SUBTRACT",
    "base_amount": 5,
    "add_amount": 1,
    "item_id": 100
  }'
```

**Процентная скидка:**
```bash
curl -X POST "http://localhost:3000/api/employee/promotions/1/details" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "PERCENTAGE",
    "item_id": 200,
    "discount": 20
  }'
```

#### Валидация:
- Товар должен существовать
- Для типа `SUBTRACT`: `base_amount` и `add_amount` > 0
- Для скидки: `discount` должна быть от 0 до 100

#### Ответы:
- **201 Created** - Деталь добавлена
- **400 Bad Request** - Ошибка валидации
- **404 Not Found** - Акция или товар не найдены

---

### 7. Обновить деталь акции
**PUT** `/api/employee/promotions/details/:detailId`

#### Параметры пути:
- `detailId` - ID детали

#### Тело запроса (все поля опциональны):
```json
{
  "type": "SUBTRACT",
  "base_amount": 10,
  "add_amount": 2,
  "item_id": 150,
  "name": "Обновленное название",
  "discount": 15
}
```

#### Пример запроса:
```bash
curl -X PUT "http://localhost:3000/api/employee/promotions/details/1" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "discount": 25
  }'
```

#### Ответы:
- **200 OK** - Деталь обновлена
- **404 Not Found** - Деталь не найдена
- **400 Bad Request** - Ошибка валидации

---

### 8. Удалить деталь акции
**DELETE** `/api/employee/promotions/details/:detailId`

#### Параметры пути:
- `detailId` - ID детали

#### Пример запроса:
```bash
curl -X DELETE "http://localhost:3000/api/employee/promotions/details/1" \
  -H "Authorization: Bearer <token>"
```

#### Ответы:
- **200 OK** - Деталь удалена
- **404 Not Found** - Деталь не найдена

---

## 📖 Управление историями акций

### 9. Добавить историю к акции
**POST** `/api/employee/promotions/:id/stories`

#### Параметры пути:
- `id` - ID акции

#### Тело запроса:
```json
{
  "cover": "https://example.com/story-image.jpg",
  "promo": "Текст истории акции"
}
```

#### Обязательные поля:
- `cover` - URL изображения истории

#### Опциональные поля:
- `promo` - Текст/описание истории (по умолчанию: `""`)

#### Пример запроса:
```bash
curl -X POST "http://localhost:3000/api/employee/promotions/1/stories" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "cover": "https://example.com/story.jpg",
    "promo": "Успей купить со скидкой!"
  }'
```

#### Ответы:
- **201 Created** - История добавлена
- **400 Bad Request** - Отсутствует cover
- **404 Not Found** - Акция не найдена

---

### 10. Обновить историю акции
**PUT** `/api/employee/promotions/stories/:storyId`

#### Параметры пути:
- `storyId` - ID истории

#### Тело запроса (все поля опциональны):
```json
{
  "cover": "https://example.com/new-story.jpg",
  "promo": "Обновленный текст"
}
```

#### Пример запроса:
```bash
curl -X PUT "http://localhost:3000/api/employee/promotions/stories/1" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "promo": "Новый текст истории"
  }'
```

#### Ответы:
- **200 OK** - История обновлена
- **404 Not Found** - История не найдена

---

### 11. Удалить историю акции
**DELETE** `/api/employee/promotions/stories/:storyId`

#### Параметры пути:
- `storyId` - ID истории

#### Пример запроса:
```bash
curl -X DELETE "http://localhost:3000/api/employee/promotions/stories/1" \
  -H "Authorization: Bearer <token>"
```

#### Ответы:
- **200 OK** - История удалена
- **404 Not Found** - История не найдена

---

## 🔒 Безопасность

### Требования к доступу:
- **Все эндпоинты**: Требуют аутентификации сотрудника
- **Уровень доступа**: SUPERVISOR или ADMIN

### Обработка ошибок:
```json
{
  "success": false,
  "error": {
    "message": "Описание ошибки",
    "statusCode": 400,
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

### Статус коды:
- `200 OK` - Успешная операция
- `201 Created` - Ресурс создан
- `400 Bad Request` - Ошибка валидации
- `401 Unauthorized` - Отсутствует токен
- `403 Forbidden` - Недостаточно прав
- `404 Not Found` - Ресурс не найден
- `500 Internal Server Error` - Ошибка сервера

---

## 💡 Примеры использования

### Создание полной акции с деталями:

```bash
# 1. Создать акцию
PROMO_ID=$(curl -X POST "http://localhost:3000/api/employee/promotions" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Летняя распродажа",
    "start_promotion_date": "2024-06-01T00:00:00Z",
    "end_promotion_date": "2024-08-31T23:59:59Z",
    "business_id": 1,
    "visible": true
  }' | jq -r '.data.promotion.marketing_promotion_id')

# 2. Добавить детали акции
curl -X POST "http://localhost:3000/api/employee/promotions/$PROMO_ID/details" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "SUBTRACT",
    "base_amount": 3,
    "add_amount": 1,
    "item_id": 100
  }'

# 3. Добавить историю
curl -X POST "http://localhost:3000/api/employee/promotions/$PROMO_ID/stories" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "cover": "https://example.com/summer-sale.jpg",
    "promo": "Покупай 3, получи 4!"
  }'
```

---

## 📊 Структура данных

### Promotion (marketing_promotions):
- `marketing_promotion_id` - ID акции
- `name` - Название
- `start_promotion_date` - Дата начала
- `end_promotion_date` - Дата окончания
- `business_id` - ID бизнеса
- `cover` - URL обложки
- `visible` - Видимость (0 или 1)

### Promotion Detail (marketing_promotion_details):
- `detail_id` - ID детали
- `type` - Тип акции
- `base_amount` - Базовое количество
- `add_amount` - Дополнительное количество
- `marketing_promotion_id` - ID акции
- `item_id` - ID товара
- `name` - Название
- `discount` - Скидка в %

### Promotion Story (marketing_promotion_stories):
- `story_id` - ID истории
- `cover` - URL изображения
- `marketing_promotion_id` - ID акции
- `promo` - Текст истории

---

## 🔄 Типы акций

### SUBTRACT (Купи X, получи Y)
Пример: "5+1" - купи 5 товаров, получи 6
```json
{
  "type": "SUBTRACT",
  "base_amount": 5,
  "add_amount": 1
}
```
**Расчет**: клиент платит за `base_amount`, получает `base_amount + add_amount`

### Процентная скидка
Пример: 20% скидка на товар
```json
{
  "type": "PERCENTAGE",
  "discount": 20
}
```

---

## ⚠️ Важные замечания

1. **Удаление акции** каскадно удаляет все детали и истории
2. **Даты** должны быть в формате ISO 8601
3. **Видимость** хранится как число (0 или 1), но принимает boolean
4. **Decimal поля** (`base_amount`, `add_amount`, `discount`) принимают числа с плавающей точкой
5. **Транзакции** обеспечивают целостность данных при удалении

---

## 📝 История изменений

- **v1.0.0** - Начальная версия API управления акциями
