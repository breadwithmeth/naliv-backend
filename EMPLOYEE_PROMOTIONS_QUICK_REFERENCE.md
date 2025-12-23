# Краткий справочник API управления акциями

## 🔐 Авторизация
```
Authorization: Bearer <employee_jwt_token>
```
**Требуемый уровень доступа**: SUPERVISOR или ADMIN

---

## 📋 Акции (Promotions)

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/employee/promotions` | Список всех акций |
| GET | `/api/employee/promotions/:id` | Получить акцию по ID |
| POST | `/api/employee/promotions` | Создать акцию |
| POST | `/api/employee/promotions/auto` | Автоматически создать акцию + детали |
| PUT | `/api/employee/promotions/:id` | Обновить акцию |
| DELETE | `/api/employee/promotions/:id` | Удалить акцию (+ детали и истории) |

### Создание акции
```json
POST /api/employee/promotions
{
  "name": "Новогодняя распродажа",
  "start_promotion_date": "2024-12-20T00:00:00Z",
  "end_promotion_date": "2025-01-10T23:59:59Z",
  "business_id": 1,
  "cover": "https://example.com/cover.jpg",
  "visible": true,
  "details": [
    { "type": "PERCENT", "item_id": 200, "discount": 20 }
  ]
}
```

### Авто-создание акции и деталей
```json
POST /api/employee/promotions/auto
{
  "business_id": 1,
  "type": "PERCENT",
  "discount": 15,
  "item_ids": [100, 101],
  "duration_days": 7
}
```

---

## 🎯 Детали акций (Promotion Details)

| Метод | Путь | Описание |
|-------|------|----------|
| POST | `/api/employee/promotions/:id/details` | Добавить деталь |
| PUT | `/api/employee/promotions/details/:detailId` | Обновить деталь |
| DELETE | `/api/employee/promotions/details/:detailId` | Удалить деталь |

### Добавление детали (Купи 5, получи 6)
```json
POST /api/employee/promotions/1/details
{
  "type": "SUBTRACT",
  "base_amount": 5,
  "add_amount": 1,
  "item_id": 100,
  "name": "Водка Premium"
}
```

### Добавление детали (Скидка 20%)
```json
POST /api/employee/promotions/1/details
{
  "type": "PERCENT",
  "item_id": 200,
  "discount": 20
}
```

---

## 📖 Истории акций (Promotion Stories)

| Метод | Путь | Описание |
|-------|------|----------|
| POST | `/api/employee/promotions/:id/stories` | Добавить историю |
| PUT | `/api/employee/promotions/stories/:storyId` | Обновить историю |
| DELETE | `/api/employee/promotions/stories/:storyId` | Удалить историю |

### Добавление истории
```json
POST /api/employee/promotions/1/stories
{
  "cover": "https://example.com/story.jpg",
  "promo": "Успей купить со скидкой!"
}
```

---

## 📊 Query параметры

### GET /api/employee/promotions
- `business_id` - Фильтр по бизнесу
- `visible` - Фильтр по видимости (`true`/`false`)

**Пример:**
```
GET /api/employee/promotions?business_id=1&visible=true
```

---

## ⚡ Быстрый старт

### 1. Создать акцию
```bash
curl -X POST "http://localhost:3000/api/employee/promotions" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Летняя распродажа","start_promotion_date":"2024-06-01T00:00:00Z","end_promotion_date":"2024-08-31T23:59:59Z","business_id":1}'
```

### 2. Добавить деталь "3+1"
```bash
curl -X POST "http://localhost:3000/api/employee/promotions/1/details" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"type":"SUBTRACT","base_amount":3,"add_amount":1,"item_id":100}'
```

### 3. Добавить историю
```bash
curl -X POST "http://localhost:3000/api/employee/promotions/1/stories" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"cover":"https://example.com/story.jpg","promo":"Купи 3, получи 4!"}'
```

---

## 🔢 HTTP статусы

- `200 OK` - Успех
- `201 Created` - Создано
- `400 Bad Request` - Ошибка валидации
- `401 Unauthorized` - Нет токена
- `403 Forbidden` - Недостаточно прав
- `404 Not Found` - Не найдено
- `500 Internal Server Error` - Ошибка сервера

---

## ⚠️ Важно

1. **Удаление акции** удаляет все связанные детали и истории
2. **Даты** в ISO 8601 формате
3. **visible** - принимает boolean, хранится как Int (0/1)
4. **Decimal** поля принимают числа с плавающей точкой
5. Для типа **SUBTRACT**: `base_amount` и `add_amount` обязательны и > 0
6. **discount** должна быть от 0 до 100

---

## 📚 Полная документация
См. файл `EMPLOYEE_PROMOTIONS_API.md`
