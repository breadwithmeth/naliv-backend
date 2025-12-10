# API управления категориями и суперкатегориями

## Описание
Данный API предоставляет функционал для управления категориями и суперкатегориями. Все операции создания, обновления и удаления доступны **только для сотрудников с уровнем доступа `SUPERVISOR` или `ADMIN`** и находятся в employee controller.

## Базовые URL

- **Публичные эндпоинты**: `/api/categories`
- **Защищенные эндпоинты**: `/api/employee/categories` и `/api/employee/supercategories`

## Уровни доступа сотрудников

1. **OPERATOR** - базовый уровень (просмотр)
2. **MANAGER** - менеджер
3. **SUPERVISOR** - супервайзер (может управлять категориями)
4. **ADMIN** - администратор (полный доступ)

## Авторизация

Все защищенные эндпоинты требуют:
- Header: `Authorization: Bearer <JWT_TOKEN>`
- Уровень доступа: `SUPERVISOR` или `ADMIN`

---

## Получение структуры для управления

### 1. Получить полную структуру категорий и суперкатегорий

**GET** `/api/employee/categories/structure`

**Требуемый уровень доступа:** SUPERVISOR или ADMIN

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

**Возможные ошибки:**
- `400` - Не указаны обязательные поля (name, supercategory_id)
- `401` - Токен не предоставлен или недействителен
- `403` - Недостаточно прав доступа (уровень ниже SUPERVISOR)
- `404` - Суперкатегория или родительская категория не найдены

---

### 2. Обновление категории

**PUT** `/api/categories/:id`

**Требуемый уровень доступа:** SUPERVISOR или ADMIN

**Параметры URL:**
- `id` - ID категории для обновления

**Body:**
```json
{
  "name": "Вино красное полусладкое",
  "supercategory_id": 1,
  "parent_category": 5,
  "visible": 1,
  "img": "https://example.com/wine-red-new.jpg"
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
      "supercategory_id": 1,
      "parent_category": 5,
      "visible": 1,
      "img": "https://example.com/wine-red-new.jpg"
    }
  },
  "message": "Категория успешно обновлена"
}
```

**Возможные ошибки:**
- `400` - Неверный ID категории или категория является родителем самой себя
- `401` - Токен не предоставлен или недействителен
- `403` - Недостаточно прав доступа
- `404` - Категория, суперкатегория или родительская категория не найдены

---

### 3. Удаление категории

**DELETE** `/api/categories/:id`

**Требуемый уровень доступа:** SUPERVISOR или ADMIN

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
- `401` - Токен не предоставлен или недействителен
- `403` - Недостаточно прав доступа
- `404` - Категория не найдена

---

## Управление суперкатегориями

### 4. Создание суперкатегории

**POST** `/api/categories/supercategories`

**Требуемый уровень доступа:** SUPERVISOR или ADMIN

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

**Возможные ошибки:**
- `400` - Не указано обязательное поле name
- `401` - Токен не предоставлен или недействителен
- `403` - Недостаточно прав доступа

---

### 5. Обновление суперкатегории

**PUT** `/api/categories/supercategories/:id`

**Требуемый уровень доступа:** SUPERVISOR или ADMIN

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

**Возможные ошибки:**
- `400` - Неверный ID суперкатегории
- `401` - Токен не предоставлен или недействителен
- `403` - Недостаточно прав доступа
- `404` - Суперкатегория не найдена

---

### 6. Удаление суперкатегории

**DELETE** `/api/categories/supercategories/:id`

**Требуемый уровень доступа:** SUPERVISOR или ADMIN

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
- `401` - Токен не предоставлен или недействителен
- `403` - Недостаточно прав доступа
- `404` - Суперкатегория не найдена

---

## Получение структуры для управления

### 7. Получить полную структуру категорий и суперкатегорий

**GET** `/api/categories/management/structure`

**Требуемый уровень доступа:** SUPERVISOR или ADMIN

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
              },
              {
                "category_id": 11,
                "name": "Вино белое",
                "img": "https://example.com/white-wine.jpg",
                "photo": null,
                "visible": 0,
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

**Возможные ошибки:**
- `401` - Токен не предоставлен или недействителен
- `403` - Недостаточно прав доступа

---

## Примеры использования

### Создание категории с авторизацией

```bash
curl -X POST http://localhost:3000/api/categories \
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
curl -X PUT http://localhost:3000/api/categories/123 \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Вино игристое белое",
    "visible": 1
  }'
```

### Удаление категории

```bash
curl -X DELETE http://localhost:3000/api/categories/123 \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Создание суперкатегории

```bash
curl -X POST http://localhost:3000/api/categories/supercategories \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Снеки",
    "priority": 5
  }'
```

### Получение полной структуры для управления

```bash
curl -X GET http://localhost:3000/api/categories/management/structure \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

## Безопасность

1. **Все модификации требуют авторизации** - используется JWT токен
2. **Проверка уровня доступа** - только SUPERVISOR и ADMIN
3. **Валидация данных** - проверка всех входных параметров
4. **Защита от каскадного удаления** - нельзя удалить категорию с подкатегориями или товарами
5. **Защита от циклических ссылок** - категория не может быть родителем самой себя

---

## Публичные эндпоинты (без авторизации)

Эти эндпоинты доступны всем без авторизации:

- `GET /api/categories` - Получить все категории
- `GET /api/categories/root` - Получить корневые категории
- `GET /api/categories/supercategories` - Получить суперкатегории
- `GET /api/categories/:id` - Получить категорию по ID
- `GET /api/categories/:id/items` - Получить товары категории
- `GET /api/categories/items/:itemId` - Получить товар по ID
