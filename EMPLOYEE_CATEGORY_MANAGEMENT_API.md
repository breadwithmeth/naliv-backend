# API управления категориями для сотрудников

## Описание
Данный API предоставляет функционал для управления категориями и суперкатегориями через employee controller. Все операции доступны **только для сотрудников с уровнем доступа `SUPERVISOR` или `ADMIN`**.

## Базовый URL
`/api/employee`

## Уровни доступа сотрудников

1. **OPERATOR** - базовый уровень (только просмотр)
2. **MANAGER** - менеджер
3. **SUPERVISOR** - супервайзер (может управлять категориями) ✅
4. **ADMIN** - администратор (полный доступ) ✅

## Авторизация

Все эндпоинты требуют:
- Header: `Authorization: Bearer <JWT_TOKEN>`
- Уровень доступа: `SUPERVISOR` или `ADMIN`

---

## Получение структуры категорий

### Получить полную структуру категорий и суперкатегорий

**GET** `/api/employee/categories/structure`

Этот эндпоинт возвращает полную структуру всех категорий и суперкатегорий для удобного управления. В отличие от публичных эндпоинтов, он включает:
- Скрытые категории (visible = 0)
- Статистику по категориям
- Категории без суперкатегории
- Полную иерархическую структуру

**Успешный ответ:** `200 OK`
```json
{
  "success": true,
  "data": {
    "supercategories": [
      {
        "supercategory_id": 1,
        "name": "Алкоголь",
        "priority": 10,
        "categories": [
          {
            "category_id": 5,
            "name": "Вино",
            "img": "https://example.com/wine.jpg",
            "photo": null,
            "visible": 1,
            "parent_category": 0,
            "supercategory_id": 1,
            "subcategories": [
              {
                "category_id": 10,
                "name": "Вино красное",
                "img": "https://example.com/red-wine.jpg",
                "photo": null,
                "visible": 1,
                "parent_category": 5,
                "supercategory_id": 1
              }
            ]
          }
        ]
      }
    ],
    "orphan_categories": [],
    "stats": {
      "total_supercategories": 5,
      "total_categories": 25,
      "total_subcategories": 48,
      "visible_categories": 60,
      "hidden_categories": 13
    }
  },
  "message": "Структура категорий получена успешно"
}
```

---

## Управление категориями

### Создание категории

**POST** `/api/employee/categories`

**Body:**
```json
{
  "name": "Вино красное",
  "supercategory_id": 1,
  "parent_category": 0,
  "visible": 1,
  "img": "https://example.com/wine-red.jpg"
}
```

**Параметры:**
- `name` (обязательно) - Название категории
- `supercategory_id` (обязательно) - ID суперкатегории
- `parent_category` (опционально, по умолчанию: 0) - ID родительской категории (0 = корневая)
- `visible` (опционально, по умолчанию: 1) - Видимость категории (1 = видна, 0 = скрыта)
- `img` (опционально, по умолчанию: '') - URL изображения категории

**Успешный ответ:** `201 Created`
```json
{
  "success": true,
  "data": {
    "category": {
      "category_id": 123,
      "name": "Вино красное",
      "supercategory_id": 1,
      "parent_category": 0,
      "visible": 1,
      "img": "https://example.com/wine-red.jpg"
    }
  },
  "message": "Категория успешно создана"
}
```

---

### Обновление категории

**PUT** `/api/employee/categories/:id`

**Параметры URL:**
- `id` - ID категории для обновления

**Body:**
```json
{
  "name": "Вино красное полусладкое",
  "visible": 1
}
```

**Параметры:** (все опциональны)
- `name` - Новое название категории
- `supercategory_id` - Новая суперкатегория
- `parent_category` - Новая родительская категория
- `visible` - Видимость (1 или 0)
- `img` - URL изображения

**Успешный ответ:** `200 OK`
```json
{
  "success": true,
  "data": {
    "category": {
      "category_id": 123,
      "name": "Вино красное полусладкое",
      "visible": 1
    }
  },
  "message": "Категория успешно обновлена"
}
```

---

### Удаление категории

**DELETE** `/api/employee/categories/:id`

**Параметры URL:**
- `id` - ID категории для удаления

**Успешный ответ:** `200 OK`
```json
{
  "success": true,
  "message": "Категория успешно удалена"
}
```

**Возможные ошибки:**
- `400` - Невозможно удалить категорию с подкатегориями или товарами
- `404` - Категория не найдена

---

## Управление суперкатегориями

### Создание суперкатегории

**POST** `/api/employee/supercategories`

**Body:**
```json
{
  "name": "Алкоголь",
  "priority": 10
}
```

**Параметры:**
- `name` (обязательно) - Название суперкатегории
- `priority` (опционально, по умолчанию: 0) - Приоритет сортировки

**Успешный ответ:** `201 Created`
```json
{
  "success": true,
  "data": {
    "supercategory": {
      "supercategory_id": 5,
      "name": "Алкоголь",
      "priority": 10
    }
  },
  "message": "Суперкатегория успешно создана"
}
```

---

### Обновление суперкатегории

**PUT** `/api/employee/supercategories/:id`

**Параметры URL:**
- `id` - ID суперкатегории для обновления

**Body:**
```json
{
  "name": "Алкогольные напитки",
  "priority": 15
}
```

**Параметры:** (все опциональны)
- `name` - Новое название суперкатегории
- `priority` - Новый приоритет

**Успешный ответ:** `200 OK`
```json
{
  "success": true,
  "data": {
    "supercategory": {
      "supercategory_id": 5,
      "name": "Алкогольные напитки",
      "priority": 15
    }
  },
  "message": "Суперкатегория успешно обновлена"
}
```

---

### Удаление суперкатегории

**DELETE** `/api/employee/supercategories/:id`

**Параметры URL:**
- `id` - ID суперкатегории для удаления

**Успешный ответ:** `200 OK`
```json
{
  "success": true,
  "message": "Суперкатегория успешно удалена"
}
```

**Возможные ошибки:**
- `400` - Невозможно удалить суперкатегорию с категориями
- `404` - Суперкатегория не найдена

---

## Примеры использования

### Получение структуры категорий

```bash
curl -X GET http://localhost:3000/api/employee/categories/structure \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Создание категории

```bash
curl -X POST http://localhost:3000/api/employee/categories \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Вино игристое",
    "supercategory_id": 1,
    "parent_category": 0,
    "visible": 1,
    "img": "https://example.com/sparkling-wine.jpg"
  }'
```

### Обновление категории

```bash
curl -X PUT http://localhost:3000/api/employee/categories/123 \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Вино игристое белое",
    "visible": 1
  }'
```

### Удаление категории

```bash
curl -X DELETE http://localhost:3000/api/employee/categories/123 \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Создание суперкатегории

```bash
curl -X POST http://localhost:3000/api/employee/supercategories \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Снеки",
    "priority": 5
  }'
```

---

## Общие ошибки

### Ошибки авторизации
- `401` - Токен не предоставлен или недействителен
- `403` - Недостаточно прав доступа (уровень ниже SUPERVISOR)

### Ошибки валидации
- `400` - Не указаны обязательные поля
- `400` - Некорректный формат данных
- `400` - Невозможно выполнить операцию (есть связанные данные)

### Ошибки данных
- `404` - Запрашиваемая сущность не найдена
- `500` - Внутренняя ошибка сервера

---

## Безопасность

1. **Обязательная авторизация** - все эндпоинты требуют JWT токен
2. **Проверка уровня доступа** - только SUPERVISOR и ADMIN
3. **Валидация данных** - проверка всех входных параметров
4. **Защита от каскадного удаления** - нельзя удалить категорию с подкатегориями или товарами
5. **Защита от циклических ссылок** - категория не может быть родителем самой себя

---

## Публичные эндпоинты (без авторизации)

Для просмотра категорий без авторизации используйте публичные эндпоинты:

- `GET /api/categories` - Получить все видимые категории
- `GET /api/categories/root` - Получить корневые категории
- `GET /api/categories/supercategories` - Получить суперкатегории
- `GET /api/categories/:id` - Получить категорию по ID
- `GET /api/categories/:id/items` - Получить товары категории
- `GET /api/categories/items/:itemId` - Получить товар по ID
