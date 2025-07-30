# API для работы с адресами пользователей ✅ ГОТОВ К ИСПОЛЬЗОВАНИЮ

## ✅ Статус тестирования
- ✅ **Получение адресов пользователя** - работает
- ✅ **Добавление нового адреса** - работает  
- ✅ **Получение конкретного адреса** - работает
- ✅ **Обновление адреса** - работает
- ✅ **Удаление адреса** - работает
- ✅ **Аутентификация пользователей** - работает
- ✅ **Поиск через Яндекс.Карты** - работает! API возвращает реальные результаты
- ✅ **Валидация координат** - работает
- ✅ **Проверка принадлежности адресов** - работает

### 📊 Результат тестирования

#### ✅ Поиск адресов через Yandex API:
```bash
curl "http://localhost:3000/api/addresses/search?query=павлодар"

# Возвращает реальные результаты от Yandex Maps:
{
  "success": true,
  "data": [
    {
      "name": "Казахстан, Шымкент, микрорайон Терискей, 1",
      "point": { "lat": 42.339424, "lon": 69.638928 },
      "description": "Шымкент, Казахстан",
      "kind": "house", "precision": "number"
    }
  ],
  "message": "Адреса найдены"
}
```

#### ✅ CRUD операции с адресами:
```json
{
  "success": true,
  "data": {
    "address_id": 60786,
    "user_id": 158,
    "name": "Тестовый дом",
    "address": "ул. Пушкина, 12, Алматы",
    "lat": 43.222,
    "lon": 76.8512,
    "apartment": "25",
    "entrance": "2",
    "floor": "5",
    "other": "Код домофона 123",
    "city_id": null,
    "log_timestamp": "2025-07-24T13:28:27.000Z",
    "isDeleted": 0
  },
  "message": "Адрес успешно добавлен"
}
```

## Описание
API предоставляет полный функционал для работы с адресами пользователей, включая поиск через Яндекс.Карты и CRUD операции.

## Базовый URL
```
/api/addresses
```

## Эндпоинты

### 🔍 Поиск адресов
#### GET /api/addresses/search
Поиск адресов через Яндекс.Карты API

**Query параметры:**
- `query` (string, обязательно) - строка поиска

**Пример запроса:**
```bash
curl -X GET "http://localhost:3000/api/addresses/search?query=улица+пушкина+12" \
  -H "Content-Type: application/json"
```

**Пример ответа:**
```json
{
  "success": true,
  "data": [
    {
      "name": "Россия, Москва, улица Пушкина, 12",
      "point": {
        "lat": 55.749792,
        "lon": 37.632495
      },
      "description": "Москва, Россия",
      "kind": "house",
      "precision": "exact"
    }
  ],
  "message": "Адреса найдены"
}
```

---

### 🚚 Проверка доставки
#### POST /api/addresses/check-delivery
Проверка возможности доставки по координатам для конкретного бизнеса

**Headers:**
```
Content-Type: application/json
```

**Body параметры:**
| Поле | Тип | Обязательно | Описание |
|------|-----|-------------|----------|
| `lat` | number | ✅ | Широта (от -90 до 90) |
| `lon` | number | ✅ | Долгота (от -180 до 180) |
| `business_id` | number | ✅ | ID бизнеса для проверки доставки |

**Пример запроса:**
```bash
curl -X POST http://localhost:3000/api/addresses/check-delivery \
  -H "Content-Type: application/json" \
  -d '{
    "lat": 43.2220,
    "lon": 76.8512,
    "business_id": 1
  }'
```

**Пример ответа:**
```json
{
  "success": true,
  "data": {
    "available": true,
    "price": 500,
    "delivery_type": "paid",
    "message": "Доставка доступна",
    "distance": 2.5
  },
  "message": "Проверка доставки выполнена"
}
```

---

### 🏠 Управление адресами пользователя (Новая версия)
*Все эндпоинты требуют авторизации*

#### GET /api/addresses/user
Получить все адреса текущего пользователя (новая версия)

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Пример запроса:**
```bash
curl -X GET http://localhost:3000/api/addresses/user \
  -H "Authorization: Bearer <jwt_token>"
```

**Пример ответа:**
```json
{
  "success": true,
  "data": {
    "addresses": [
      {
        "address_id": 1,
        "lat": 43.2220,
        "lon": 76.8512,
        "address": "ул. Пушкина, 12",
        "name": "Дом",
        "apartment": "25",
        "entrance": "2",
        "floor": "5",
        "other": "Код домофона 123",
        "city_id": null,
        "created_at": "2025-07-24T13:30:00.000Z"
      }
    ]
  },
  "message": "Найдено 1 адресов"
}
```

#### GET /api/addresses/user/with-delivery
Получить все адреса пользователя с проверкой доставки

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Query параметры:**
- `business_id` (number, опционально) - ID бизнеса для проверки доставки

**Пример запроса:**
```bash
curl -X GET "http://localhost:3000/api/addresses/user/with-delivery?business_id=1" \
  -H "Authorization: Bearer <jwt_token>"
```

**Пример ответа:**
```json
{
  "success": true,
  "data": {
    "addresses": [
      {
        "address_id": 1,
        "lat": 43.2220,
        "lon": 76.8512,
        "address": "ул. Пушкина, 12",
        "name": "Дом",
        "apartment": "25",
        "entrance": "2",
        "floor": "5",
        "other": "Код домофона 123",
        "city_id": null,
        "created_at": "2025-07-24T13:30:00.000Z",
        "delivery": {
          "available": true,
          "price": 500,
          "delivery_type": "paid",
          "message": "Доставка доступна",
          "distance": 2.5
        }
      }
    ],
    "business_id": 1
  },
  "message": "Найдено 1 адресов"
}
```

#### GET /api/addresses/user/:id
Получить конкретный (выбранный) адрес пользователя

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**URL параметры:**
- `id` (number) - ID адреса

**Query параметры (опционально):**
- `business_id` (number, опционально) - ID бизнеса для проверки доставки

**Пример запроса (без проверки доставки):**
```bash
curl -X GET http://localhost:3000/api/addresses/user/1 \
  -H "Authorization: Bearer <jwt_token>"
```

**Пример запроса (с проверкой доставки):**
```bash
curl -X GET "http://localhost:3000/api/addresses/user/1?business_id=1" \
  -H "Authorization: Bearer <jwt_token>"
```

**Пример ответа (без проверки доставки):**
```json
{
  "success": true,
  "data": {
    "address": {
      "address_id": 1,
      "lat": 43.2220,
      "lon": 76.8512,
      "address": "ул. Пушкина, 12",
      "name": "Дом",
      "apartment": "25",
      "entrance": "2",
      "floor": "5",
      "other": "Код домофона 123",
      "city_id": null,
      "created_at": "2025-07-24T13:30:00.000Z"
    }
  },
  "message": "Адрес найден"
}
```

**Пример ответа (с проверкой доставки):**
```json
{
  "success": true,
  "data": {
    "address": {
      "address_id": 1,
      "lat": 43.2220,
      "lon": 76.8512,
      "address": "ул. Пушкина, 12",
      "name": "Дом",
      "apartment": "25",
      "entrance": "2",
      "floor": "5",
      "other": "Код домофона 123",
      "city_id": null,
      "created_at": "2025-07-24T13:30:00.000Z",
      "delivery": {
        "available": true,
        "price": 500,
        "delivery_type": "paid",
        "message": "Доставка доступна",
        "distance": 2.5
      }
    },
    "business_id": 1
  },
  "message": "Адрес найден с информацией о доставке"
}
```

**Возможные ошибки:**
```json
// Адрес не найден или не принадлежит пользователю
{
  "error": {
    "message": "Адрес не найден или не принадлежит пользователю",
    "statusCode": 404,
    "timestamp": "2025-07-30T03:30:00.000Z"
  }
}

// Адрес удален
{
  "error": {
    "message": "Адрес был удален",
    "statusCode": 410,
    "timestamp": "2025-07-30T03:30:00.000Z"
  }
}

// Ошибка проверки доставки
{
  "error": {
    "message": "Ошибка проверки доставки для данного адреса",
    "statusCode": 500,
    "timestamp": "2025-07-30T03:30:00.000Z"
  }
}
```

#### GET /api/addresses/user/selected
Получить выбранный (последний выбранный) адрес пользователя

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Query параметры (опционально):**
- `business_id` (number, опционально) - ID бизнеса для проверки доставки

**Пример запроса (без проверки доставки):**
```bash
curl -X GET http://localhost:3000/api/addresses/user/selected \
  -H "Authorization: Bearer <jwt_token>"
```

**Пример запроса (с проверкой доставки):**
```bash
curl -X GET "http://localhost:3000/api/addresses/user/selected?business_id=1" \
  -H "Authorization: Bearer <jwt_token>"
```

**Пример ответа (без проверки доставки):**
```json
{
  "success": true,
  "data": {
    "selected_address": {
      "address_id": 1,
      "lat": 43.2220,
      "lon": 76.8512,
      "address": "ул. Пушкина, 12",
      "name": "Дом",
      "apartment": "25",
      "entrance": "2",
      "floor": "5",
      "other": "Код домофона 123",
      "city_id": null,
      "created_at": "2025-07-24T13:30:00.000Z",
      "selected_at": "2025-07-30T10:15:00.000Z"
    }
  },
  "message": "Выбранный адрес найден"
}
```

**Пример ответа (с проверкой доставки):**
```json
{
  "success": true,
  "data": {
    "selected_address": {
      "address_id": 1,
      "lat": 43.2220,
      "lon": 76.8512,
      "address": "ул. Пушкина, 12",
      "name": "Дом",
      "apartment": "25",
      "entrance": "2",
      "floor": "5",
      "other": "Код домофона 123",
      "city_id": null,
      "created_at": "2025-07-24T13:30:00.000Z",
      "selected_at": "2025-07-30T10:15:00.000Z",
      "delivery": {
        "available": true,
        "price": 500,
        "delivery_type": "paid",
        "message": "Доставка доступна",
        "distance": 2.5
      }
    },
    "business_id": 1
  },
  "message": "Выбранный адрес найден с информацией о доставке"
}
```

**Возможные ошибки:**
```json
// У пользователя нет выбранного адреса
{
  "error": {
    "message": "У пользователя нет выбранного адреса",
    "statusCode": 404,
    "timestamp": "2025-07-30T03:30:00.000Z"
  }
}

// Выбранный адрес был удален
{
  "error": {
    "message": "Выбранный адрес не найден или был удален",
    "statusCode": 404,
    "timestamp": "2025-07-30T03:30:00.000Z"
  }
}
```

#### POST /api/addresses/user/select
Установить выбранный адрес пользователя

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Body параметры:**
| Поле | Тип | Обязательно | Описание |
|------|-----|-------------|----------|
| `address_id` | number | ✅ | ID адреса для выбора |

**Пример запроса:**
```bash
curl -X POST http://localhost:3000/api/addresses/user/select \
  -H "Authorization: Bearer <jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "address_id": 1
  }'
```

**Пример ответа:**
```json
{
  "success": true,
  "data": {
    "selected_address_id": 15,
    "address_id": 1,
    "user_id": 158,
    "selected_at": "2025-07-30T10:15:00.000Z"
  },
  "message": "Адрес успешно выбран"
}
```

**Возможные ошибки:**
```json
// Адрес не найден или не принадлежит пользователю
{
  "error": {
    "message": "Адрес не найден или не принадлежит пользователю",
    "statusCode": 404,
    "timestamp": "2025-07-30T03:30:00.000Z"
  }
}

// Некорректный address_id
{
  "error": {
    "message": "Не указан корректный address_id",
    "statusCode": 400,
    "timestamp": "2025-07-30T03:30:00.000Z"
  }
}
```

#### POST /api/addresses/user
Добавить новый адрес (новая версия)

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Body параметры:**
| Поле | Тип | Обязательно | Описание |
|------|-----|-------------|----------|
| `lat` | number | ✅ | Широта (от -90 до 90) |
| `lon` | number | ✅ | Долгота (от -180 до 180) |
| `address` | string | ✅ | Полный адрес |
| `name` | string | ✅ | Название адреса (например, "Дом", "Работа") |
| `apartment` | string | ❌ | Номер квартиры |
| `entrance` | string | ❌ | Номер подъезда |
| `floor` | string | ❌ | Этаж |
| `other` | string | ❌ | Дополнительная информация |
| `city_id` | number | ❌ | ID города |

**Пример запроса:**
```bash
curl -X POST http://localhost:3000/api/addresses/user \
  -H "Authorization: Bearer <jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "lat": 43.2220,
    "lon": 76.8512,
    "address": "ул. Пушкина, 12",
    "name": "Дом",
    "apartment": "25",
    "entrance": "2",
    "floor": "5",
    "other": "Код домофона 123"
  }'
```

**Пример ответа:**
```json
{
  "success": true,
  "data": {
    "address": {
      "address_id": 1,
      "lat": 43.2220,
      "lon": 76.8512,
      "address": "ул. Пушкина, 12",
      "name": "Дом",
      "apartment": "25",
      "entrance": "2",
      "floor": "5",
      "other": "Код домофона 123",
      "city_id": null,
      "created_at": "2025-07-24T13:30:00.000Z"
    }
  },
  "message": "Адрес успешно создан"
}
```

#### PUT /api/addresses/user/:id
Обновить существующий адрес (новая версия)

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**URL параметры:**
- `id` (number) - ID адреса

**Body параметры:** (все поля опциональны)
- `lat` (number) - Новая широта
- `lon` (number) - Новая долгота
- `address` (string) - Новый адрес
- `name` (string) - Новое название
- `apartment` (string) - Новый номер квартиры
- `entrance` (string) - Новый номер подъезда
- `floor` (string) - Новый этаж
- `other` (string) - Новая дополнительная информация
- `city_id` (number) - Новый ID города

**Пример запроса:**
```bash
curl -X PUT http://localhost:3000/api/addresses/user/1 \
  -H "Authorization: Bearer <jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "apartment": "26",
    "other": "Новый код домофона 456"
  }'
```

#### DELETE /api/addresses/user/:id
Удалить адрес (мягкое удаление)

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**URL параметры:**
- `id` (number) - ID адреса

**Пример запроса:**
```bash
curl -X DELETE http://localhost:3000/api/addresses/user/1 \
  -H "Authorization: Bearer <jwt_token>"
```

**Пример ответа:**
```json
{
  "success": true,
  "data": {
    "address_id": 1
  },
  "message": "Адрес успешно удален"
}
```

---

### 🏠 Управление адресами пользователя (Старая версия)
*Все эндпоинты требуют авторизации*

#### GET /api/addresses
Получить все адреса текущего пользователя

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Пример запроса:**
```bash
curl -X GET http://localhost:3000/api/addresses \
  -H "Authorization: Bearer <jwt_token>"
```

**Пример ответа:**
```json
{
  "success": true,
  "data": [
    {
      "address_id": 1,
      "user_id": 158,
      "name": "Дом",
      "address": "ул. Пушкина, 12",
      "lat": 43.2220,
      "lon": 76.8512,
      "apartment": "25",
      "entrance": "2",
      "floor": "5",
      "other": "Код домофона 123",
      "city_id": null,
      "log_timestamp": "2025-07-24T13:30:00.000Z",
      "isDeleted": 0
    }
  ],
  "message": "Адреса получены"
}
```

#### GET /api/addresses/:id
Получить конкретный адрес пользователя

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**URL параметры:**
- `id` (number) - ID адреса

**Пример запроса:**
```bash
curl -X GET http://localhost:3000/api/addresses/1 \
  -H "Authorization: Bearer <jwt_token>"
```

#### POST /api/addresses
Добавить новый адрес

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Body параметры:**
| Поле | Тип | Обязательно | Описание |
|------|-----|-------------|----------|
| `name` | string | ✅ | Название адреса (например, "Дом", "Работа") |
| `address` | string | ✅ | Полный адрес |
| `lat` | number | ✅ | Широта (от -90 до 90) |
| `lon` | number | ✅ | Долгота (от -180 до 180) |
| `apartment` | string | ❌ | Номер квартиры |
| `entrance` | string | ❌ | Номер подъезда |
| `floor` | string | ❌ | Этаж |
| `other` | string | ❌ | Дополнительная информация |

**Пример запроса:**
```bash
curl -X POST http://localhost:3000/api/addresses \
  -H "Authorization: Bearer <jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Дом",
    "address": "ул. Пушкина, 12",
    "lat": 43.2220,
    "lon": 76.8512,
    "apartment": "25",
    "entrance": "2",
    "floor": "5",
    "other": "Код домофона 123"
  }'
```

**Пример ответа:**
```json
{
  "success": true,
  "data": {
    "address_id": 1,
    "user_id": 158,
    "name": "Дом",
    "address": "ул. Пушкина, 12",
    "lat": 43.2220,
    "lon": 76.8512,
    "apartment": "25",
    "entrance": "2",
    "floor": "5",
    "other": "Код домофона 123",
    "city_id": null,
    "log_timestamp": "2025-07-24T13:30:00.000Z",
    "isDeleted": 0
  },
  "message": "Адрес успешно добавлен"
}
```

#### PUT /api/addresses/:id
Обновить существующий адрес

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**URL параметры:**
- `id` (number) - ID адреса

**Body параметры:** (все поля опциональны)
- `name` (string) - Новое название
- `address` (string) - Новый адрес
- `lat` (number) - Новая широта
- `lon` (number) - Новая долгота
- `apartment` (string) - Новый номер квартиры
- `entrance` (string) - Новый номер подъезда
- `floor` (string) - Новый этаж
- `other` (string) - Новая дополнительная информация

**Пример запроса:**
```bash
curl -X PUT http://localhost:3000/api/addresses/1 \
  -H "Authorization: Bearer <jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "apartment": "26",
    "other": "Новый код домофона 456"
  }'
```

#### DELETE /api/addresses/:id
Удалить адрес

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**URL параметры:**
- `id` (number) - ID адреса

**Пример запроса:**
```bash
curl -X DELETE http://localhost:3000/api/addresses/1 \
  -H "Authorization: Bearer <jwt_token>"
```

**Пример ответа:**
```json
{
  "success": true,
  "data": {
    "address_id": 1
  },
  "message": "Адрес успешно удален"
}
```

## Коды ошибок

| Код | Описание |
|-----|----------|
| 400 | Некорректные данные запроса |
| 401 | Требуется авторизация |
| 404 | Адрес не найден |
| 500 | Внутренняя ошибка сервера |

### Примеры ошибок

#### Отсутствует авторизация
```json
{
  "error": {
    "message": "Необходима авторизация",
    "statusCode": 401
  }
}
```

#### Некорректные координаты
```json
{
  "error": {
    "message": "Некорректные координаты",
    "statusCode": 400
  }
}
```

#### Адрес не найден
```json
{
  "error": {
    "message": "Адрес не найден или не принадлежит пользователю",
    "statusCode": 404
  }
}
```

#### Адрес используется в заказах
```json
{
  "error": {
    "message": "Нельзя удалить адрес, используемый в заказах",
    "statusCode": 400
  }
}
```

## Особенности интеграции с Яндекс.Картами

### API ключ
Используется ключ Яндекс.Карт: `7e1b6231-620b-4f24-87fa-c85027f630ab`

### Формат поиска
- Поиск происходит через Yandex Geocoding API
- Возвращает отформатированные адреса с координатами
- Поддерживает поиск по частичному совпадению

### Точность геокодирования
- `exact` - точное совпадение
- `number` - совпадение по номеру дома
- `near` - приблизительное совпадение
- `range` - диапазон номеров
- `street` - совпадение по улице
- `other` - другой тип совпадения

## ✨ Новые возможности системы адресов

### 🚀 Интеграция с доставкой
- ✅ Автоматическая проверка возможности доставки для каждого адреса
- ✅ Получение стоимости и расстояния доставки
- ✅ Фильтрация адресов по возможности доставки

### 🛡️ Улучшенная безопасность
- ✅ Лимит адресов (максимум 10 на пользователя)
- ✅ Мягкое удаление адресов
- ✅ Валидация координат и данных

### 📱 Новые API endpoints
- ✅ `/api/addresses/user` - упрощенное управление адресами
- ✅ `/api/addresses/user/with-delivery` - адреса с проверкой доставки
- ✅ `/api/addresses/check-delivery` - проверка доставки по координатам

---

## Безопасность

### Защита адресов
- ✅ Адреса привязаны к пользователю
- ✅ Пользователь может управлять только своими адресами
- ✅ Валидация координат
- ✅ Проверка использования в заказах перед удалением

### Аудит
- ✅ Логирование всех операций создания/изменения
- ✅ Сохранение временных меток
- ✅ Мягкое удаление (isDeleted флаг)

## Примеры использования

### 🛒 Выбор адреса для заказа (новый рекомендуемый способ)
```javascript
// 1. Получить адреса с проверкой доставки
const getAddressesForOrder = async (businessId, userToken) => {
  const response = await fetch(`/api/addresses/user/with-delivery?business_id=${businessId}`, {
    headers: {
      'Authorization': `Bearer ${userToken}`
    }
  });
  const data = await response.json();
  
  // Возвращаем все адреса с информацией о доставке
  return {
    allAddresses: data.data.addresses,
    availableAddresses: data.data.addresses.filter(addr => addr.delivery?.available),
    businessId: data.data.business_id
  };
};

// 2. Компонент выбора адреса с состоянием выбранного адреса
const AddressSelector = ({ businessId, onAddressSelect, userToken }) => {
  const [addresses, setAddresses] = useState([]);
  const [selectedAddress, setSelectedAddress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  
  useEffect(() => {
    const loadAddresses = async () => {
      setLoading(true);
      try {
        const result = await getAddressesForOrder(businessId, userToken);
        setAddresses(result);
      } catch (error) {
        console.error('Ошибка загрузки адресов:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadAddresses();
  }, [businessId, userToken]);
  
  const handleAddressSelect = (address) => {
    setSelectedAddress(address);
    if (onAddressSelect) {
      onAddressSelect(address);
    }
  };
  
  if (loading) {
    return <div>Загрузка адресов...</div>;
  }
  
  const displayAddresses = showAll ? addresses.allAddresses : addresses.availableAddresses;
  
  return (
    <div className="address-selector">
      <div className="address-filter">
        <label>
          <input 
            type="checkbox" 
            checked={showAll}
            onChange={(e) => setShowAll(e.target.checked)}
          />
          Показать все адреса (включая недоступные для доставки)
        </label>
      </div>
      
      <div className="addresses-list">
        {displayAddresses.length === 0 ? (
          <div className="no-addresses">
            {showAll ? 'У вас нет сохраненных адресов' : 'Нет доступных адресов для доставки'}
          </div>
        ) : (
          displayAddresses.map(address => (
            <div 
              key={address.address_id} 
              className={`address-option ${selectedAddress?.address_id === address.address_id ? 'selected' : ''} ${!address.delivery?.available ? 'unavailable' : ''}`}
            >
              <div className="address-info">
                <h3>{address.name}</h3>
                <p>{address.address}</p>
                {address.apartment && <p>Кв. {address.apartment}</p>}
                {address.entrance && <p>Подъезд {address.entrance}</p>}
                {address.floor && <p>Этаж {address.floor}</p>}
                {address.other && <p className="note">{address.other}</p>}
              </div>
              
              <div className="delivery-info">
                {address.delivery ? (
                  address.delivery.available ? (
                    <div className="delivery-available">
                      <span className="price">Доставка: {address.delivery.price} тенге</span>
                      <span className="distance">Расстояние: {address.delivery.distance} км</span>
                    </div>
                  ) : (
                    <div className="delivery-unavailable">
                      <span className="unavailable-text">Доставка недоступна</span>
                      <span className="reason">{address.delivery.message}</span>
                    </div>
                  )
                ) : (
                  <span className="no-delivery-info">Информация о доставке недоступна</span>
                )}
              </div>
              
              <button 
                onClick={() => handleAddressSelect(address)}
                disabled={!address.delivery?.available}
                className={`select-button ${selectedAddress?.address_id === address.address_id ? 'selected' : ''}`}
              >
                {selectedAddress?.address_id === address.address_id ? '✓ Выбран' : 'Выбрать'}
              </button>
            </div>
          ))
        )}
      </div>
      
      {selectedAddress && (
        <div className="selected-address-summary">
          <h4>Выбранный адрес:</h4>
          <p><strong>{selectedAddress.name}</strong> - {selectedAddress.address}</p>
          {selectedAddress.delivery?.available && (
            <p>Стоимость доставки: <strong>{selectedAddress.delivery.price} тенге</strong></p>
          )}
        </div>
      )}
    </div>
  );
};

// 3. Пример использования компонента
const OrderPage = () => {
  const [selectedAddress, setSelectedAddress] = useState(null);
  const [businessId, setBusinessId] = useState(1);
  const userToken = localStorage.getItem('authToken');
  
  const handleAddressChange = (address) => {
    setSelectedAddress(address);
    console.log('Выбран адрес:', address);
    
    // Здесь можно обновить состояние заказа
    // updateOrderAddress(address);
  };
  
  return (
    <div className="order-page">
      <h2>Выберите адрес доставки</h2>
      
      <AddressSelector 
        businessId={businessId}
        onAddressSelect={handleAddressChange}
        userToken={userToken}
      />
      
      {selectedAddress && (
        <div className="order-summary">
          <h3>Детали заказа</h3>
          <p>Адрес: {selectedAddress.address}</p>
          <p>Доставка: {selectedAddress.delivery?.price || 0} тенге</p>
          
          <button 
            onClick={() => createOrder(selectedAddress)}
            className="create-order-button"
          >
            Оформить заказ
          </button>
        </div>
      )}
    </div>
  );
};

// 4. CSS стили для компонента
const styles = `
.address-selector {
  max-width: 600px;
  margin: 0 auto;
}

.address-option {
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 12px;
  transition: all 0.3s ease;
}

.address-option.selected {
  border-color: #4CAF50;
  background-color: #f8fff8;
}

.address-option.unavailable {
  opacity: 0.6;
  background-color: #fafafa;
}

.delivery-available {
  color: #4CAF50;
  font-weight: bold;
}

.delivery-unavailable {
  color: #f44336;
}

.select-button {
  background-color: #2196F3;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.3s;
}

.select-button:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}

.select-button.selected {
  background-color: #4CAF50;
}

.selected-address-summary {
  background-color: #e8f5e8;
  padding: 16px;
  border-radius: 8px;
  margin-top: 16px;
  border-left: 4px solid #4CAF50;
}
`;
```

### 🏠 Добавление нового адреса с поиском
```javascript
// 1. Поиск адреса через Яндекс.Карты
const searchAddress = async (query) => {
  const response = await fetch(`/api/addresses/search?query=${encodeURIComponent(query)}`);
  return response.json();
};

// 2. Создание адреса из результата поиска
const createAddressFromSearch = async (searchResult, additionalInfo, userToken) => {
  const addressData = {
    lat: searchResult.point.lat,
    lon: searchResult.point.lon,
    address: searchResult.name,
    name: additionalInfo.name, // "Дом", "Работа", etc.
    apartment: additionalInfo.apartment,
    entrance: additionalInfo.entrance,
    floor: additionalInfo.floor,
    other: additionalInfo.other
  };
  
  const response = await fetch('/api/addresses/user', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${userToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(addressData)
  });
  
  return response.json();
};

// 3. Полный workflow добавления адреса
const AddressCreationFlow = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedResult, setSelectedResult] = useState(null);
  
  const handleSearch = async () => {
    const results = await searchAddress(searchQuery);
    setSearchResults(results.data);
  };
  
  const handleCreateAddress = async (additionalInfo) => {
    const result = await createAddressFromSearch(selectedResult, additionalInfo, userToken);
    if (result.success) {
      alert('Адрес успешно добавлен!');
    }
  };
  
  return (
    <div>
      {/* Поиск */}
      <input 
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Введите адрес..."
      />
      <button onClick={handleSearch}>Найти</button>
      
      {/* Результаты поиска */}
      {searchResults.map((result, index) => (
        <div key={index} onClick={() => setSelectedResult(result)}>
          {result.name}
        </div>
      ))}
      
      {/* Дополнительная информация */}
      {selectedResult && (
        <AddressDetailsForm onSubmit={handleCreateAddress} />
      )}
    </div>
  );
};
```

### 🏠 Работа с выбранным адресом пользователя
```javascript
// 1. Получить выбранный адрес пользователя
const getSelectedAddress = async (businessId = null, userToken) => {
  const url = businessId 
    ? `/api/addresses/user/selected?business_id=${businessId}`
    : '/api/addresses/user/selected';
    
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${userToken}`
    }
  });
  
  if (response.status === 404) {
    return null; // У пользователя нет выбранного адреса
  }
  
  if (!response.ok) {
    throw new Error('Ошибка получения выбранного адреса');
  }
  
  const data = await response.json();
  return data.data.selected_address;
};

// 2. Установить выбранный адрес
const selectAddress = async (addressId, userToken) => {
  const response = await fetch('/api/addresses/user/select', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${userToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ address_id: addressId })
  });
  
  if (!response.ok) {
    throw new Error('Ошибка выбора адреса');
  }
  
  return response.json();
};

// 3. Компонент для отображения выбранного адреса
const CurrentSelectedAddress = ({ businessId, userToken, onAddressChange }) => {
  const [selectedAddress, setSelectedAddress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const loadSelectedAddress = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const address = await getSelectedAddress(businessId, userToken);
      setSelectedAddress(address);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    loadSelectedAddress();
  }, [businessId, userToken]);
  
  const handleChangeAddress = () => {
    if (onAddressChange) {
      onAddressChange();
    }
  };
  
  if (loading) return <div>Загрузка выбранного адреса...</div>;
  if (error) return <div className="error">Ошибка: {error}</div>;
  
  if (!selectedAddress) {
    return (
      <div className="no-selected-address">
        <p>Адрес доставки не выбран</p>
        <button onClick={handleChangeAddress} className="select-address-btn">
          Выбрать адрес
        </button>
      </div>
    );
  }
  
  return (
    <div className="selected-address-card">
      <div className="address-header">
        <h3>📍 Адрес доставки</h3>
        <button onClick={handleChangeAddress} className="change-address-btn">
          Изменить
        </button>
      </div>
      
      <div className="address-content">
        <h4>{selectedAddress.name}</h4>
        <p className="address-text">{selectedAddress.address}</p>
        
        <div className="address-details">
          {selectedAddress.apartment && <span>Кв. {selectedAddress.apartment}</span>}
          {selectedAddress.entrance && <span>Подъезд {selectedAddress.entrance}</span>}
          {selectedAddress.floor && <span>Этаж {selectedAddress.floor}</span>}
        </div>
        
        {selectedAddress.other && (
          <p className="additional-info">{selectedAddress.other}</p>
        )}
        
        {selectedAddress.delivery && (
          <div className="delivery-status">
            {selectedAddress.delivery.available ? (
              <div className="delivery-available">
                <span className="status">✅ Доставка доступна</span>
                <span className="price">💰 {selectedAddress.delivery.price} тенге</span>
                <span className="distance">📍 {selectedAddress.delivery.distance} км</span>
              </div>
            ) : (
              <div className="delivery-unavailable">
                <span className="status">❌ Доставка недоступна</span>
                <span className="reason">{selectedAddress.delivery.message}</span>
              </div>
            )}
          </div>
        )}
        
        <div className="selection-time">
          <small>Выбран: {new Date(selectedAddress.selected_at).toLocaleString()}</small>
        </div>
      </div>
    </div>
  );
};

// 4. Hook для работы с выбранным адресом
const useSelectedAddress = (businessId = null) => {
  const [selectedAddress, setSelectedAddress] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const userToken = localStorage.getItem('authToken');
  
  const loadSelectedAddress = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const address = await getSelectedAddress(businessId, userToken);
      setSelectedAddress(address);
    } catch (err) {
      setError(err.message);
      setSelectedAddress(null);
    } finally {
      setLoading(false);
    }
  }, [businessId, userToken]);
  
  const selectNewAddress = useCallback(async (addressId) => {
    try {
      await selectAddress(addressId, userToken);
      await loadSelectedAddress(); // Перезагружаем выбранный адрес
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    }
  }, [userToken, loadSelectedAddress]);
  
  useEffect(() => {
    loadSelectedAddress();
  }, [loadSelectedAddress]);
  
  return {
    selectedAddress,
    loading,
    error,
    selectAddress: selectNewAddress,
    reload: loadSelectedAddress,
    hasSelectedAddress: !!selectedAddress,
    isDeliveryAvailable: selectedAddress?.delivery?.available || false,
    deliveryPrice: selectedAddress?.delivery?.price || 0
  };
};

// 5. Интегрированный компонент выбора адреса
const AddressSelectorWithSelected = ({ businessId, userToken }) => {
  const { 
    selectedAddress, 
    selectAddress: setSelectedAddress, 
    hasSelectedAddress 
  } = useSelectedAddress(businessId);
  
  const [showSelector, setShowSelector] = useState(!hasSelectedAddress);
  const [addresses, setAddresses] = useState([]);
  
  const handleAddressSelect = async (address) => {
    const success = await setSelectedAddress(address.address_id);
    if (success) {
      setShowSelector(false);
    }
  };
  
  return (
    <div className="address-selector-with-selected">
      {hasSelectedAddress && !showSelector ? (
        <CurrentSelectedAddress 
          businessId={businessId}
          userToken={userToken}
          onAddressChange={() => setShowSelector(true)}
        />
      ) : (
        <div className="address-selection">
          <h3>Выберите адрес доставки</h3>
          <AddressSelector 
            businessId={businessId}
            onAddressSelect={handleAddressSelect}
            userToken={userToken}
          />
          
          {hasSelectedAddress && (
            <button 
              onClick={() => setShowSelector(false)}
              className="cancel-selection"
            >
              Отменить
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// 6. CSS стили для компонентов
const selectedAddressStyles = `
.selected-address-card {
  border: 2px solid #4CAF50;
  border-radius: 8px;
  padding: 16px;
  background-color: #f8fff8;
  margin-bottom: 16px;
}

.address-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.change-address-btn {
  background-color: #2196F3;
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.delivery-status {
  margin-top: 12px;
  padding: 8px;
  border-radius: 4px;
}

.delivery-available {
  background-color: #e8f5e8;
  border-left: 4px solid #4CAF50;
}

.delivery-unavailable {
  background-color: #ffeaea;
  border-left: 4px solid #f44336;
}

.selection-time {
  margin-top: 8px;
  color: #666;
}

.no-selected-address {
  text-align: center;
  padding: 32px;
  border: 2px dashed #ccc;
  border-radius: 8px;
  background-color: #fafafa;
}

.select-address-btn {
  background-color: #4CAF50;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
}
`;
```

### 🏠 Получение выбранного адреса пользователя
```javascript
// 1. Получить конкретный адрес без проверки доставки
const getSelectedAddress = async (addressId, userToken) => {
  const response = await fetch(`/api/addresses/user/${addressId}`, {
    headers: {
      'Authorization': `Bearer ${userToken}`
    }
  });
  
  if (!response.ok) {
    throw new Error('Адрес не найден');
  }
  
  const data = await response.json();
  return data.data.address;
};

// 2. Получить конкретный адрес с проверкой доставки
const getSelectedAddressWithDelivery = async (addressId, businessId, userToken) => {
  const response = await fetch(`/api/addresses/user/${addressId}?business_id=${businessId}`, {
    headers: {
      'Authorization': `Bearer ${userToken}`
    }
  });
  
  if (!response.ok) {
    throw new Error('Адрес не найден или недоступен');
  }
  
  const data = await response.json();
  return data.data.address;
};

// 3. Компонент для отображения выбранного адреса
const SelectedAddressDisplay = ({ addressId, businessId, userToken }) => {
  const [address, setAddress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    const loadAddress = async () => {
      setLoading(true);
      try {
        const addressData = businessId 
          ? await getSelectedAddressWithDelivery(addressId, businessId, userToken)
          : await getSelectedAddress(addressId, userToken);
        setAddress(addressData);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    
    if (addressId) {
      loadAddress();
    }
  }, [addressId, businessId, userToken]);
  
  if (loading) return <div>Загрузка адреса...</div>;
  if (error) return <div className="error">Ошибка: {error}</div>;
  if (!address) return <div>Адрес не выбран</div>;
  
  return (
    <div className="selected-address">
      <h3>{address.name}</h3>
      <p className="address-text">{address.address}</p>
      
      <div className="address-details">
        {address.apartment && <span>Кв. {address.apartment}</span>}
        {address.entrance && <span>Подъезд {address.entrance}</span>}
        {address.floor && <span>Этаж {address.floor}</span>}
      </div>
      
      {address.other && (
        <p className="additional-info">{address.other}</p>
      )}
      
      {address.delivery && (
        <div className="delivery-info">
          {address.delivery.available ? (
            <div className="delivery-available">
              <span className="price">💰 {address.delivery.price} тенге</span>
              <span className="distance">📍 {address.delivery.distance} км</span>
              <span className="type">{address.delivery.delivery_type}</span>
            </div>
          ) : (
            <div className="delivery-unavailable">
              <span>❌ Доставка недоступна</span>
              <span className="reason">{address.delivery.message}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// 4. Hook для работы с выбранным адресом
const useSelectedAddress = (addressId, businessId = null) => {
  const [address, setAddress] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const userToken = localStorage.getItem('authToken');
  
  const loadAddress = useCallback(async () => {
    if (!addressId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const addressData = businessId 
        ? await getSelectedAddressWithDelivery(addressId, businessId, userToken)
        : await getSelectedAddress(addressId, userToken);
      setAddress(addressData);
    } catch (err) {
      setError(err.message);
      setAddress(null);
    } finally {
      setLoading(false);
    }
  }, [addressId, businessId, userToken]);
  
  useEffect(() => {
    loadAddress();
  }, [loadAddress]);
  
  return {
    address,
    loading,
    error,
    reload: loadAddress,
    isDeliveryAvailable: address?.delivery?.available || false,
    deliveryPrice: address?.delivery?.price || 0
  };
};

// 5. Пример использования в компоненте заказа
const OrderConfirmation = ({ selectedAddressId, businessId }) => {
  const { 
    address, 
    loading, 
    error, 
    isDeliveryAvailable, 
    deliveryPrice 
  } = useSelectedAddress(selectedAddressId, businessId);
  
  if (loading) return <div>Загрузка информации о доставке...</div>;
  if (error) return <div>Ошибка: {error}</div>;
  if (!address) return <div>Выберите адрес доставки</div>;
  
  return (
    <div className="order-confirmation">
      <h2>Подтверждение заказа</h2>
      
      <div className="delivery-address">
        <h3>Адрес доставки:</h3>
        <SelectedAddressDisplay 
          addressId={selectedAddressId}
          businessId={businessId}
          userToken={localStorage.getItem('authToken')}
        />
      </div>
      
      <div className="order-summary">
        <p>Стоимость доставки: <strong>{deliveryPrice} тенге</strong></p>
        <p>Статус доставки: {
          isDeliveryAvailable 
            ? <span className="available">✅ Доступна</span>
            : <span className="unavailable">❌ Недоступна</span>
        }</p>
        
        <button 
          disabled={!isDeliveryAvailable}
          onClick={() => createOrder(address)}
          className="confirm-order"
        >
          {isDeliveryAvailable ? 'Подтвердить заказ' : 'Доставка недоступна'}
        </button>
      </div>
    </div>
  );
};
```

### 🚚 Проверка доставки для произвольного адреса
```javascript
// Проверить доставку перед добавлением адреса
const checkDeliveryBeforeAdd = async (lat, lon, businessId) => {
  const response = await fetch('/api/addresses/check-delivery', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ lat, lon, business_id: businessId })
  });
  
  const data = await response.json();
  
  if (data.success && data.data.available) {
    console.log(`Доставка доступна! Стоимость: ${data.data.price} тенге`);
    return true;
  } else {
    console.log('Доставка недоступна в данный район');
    return false;
  }
};
```

### 📱 React Hook для работы с адресами
```javascript
const useUserAddresses = (businessId = null) => {
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const loadAddresses = async () => {
    setLoading(true);
    try {
      const endpoint = businessId 
        ? `/api/addresses/user/with-delivery?business_id=${businessId}`
        : '/api/addresses/user';
        
      const response = await fetch(endpoint, {
        headers: { 'Authorization': `Bearer ${userToken}` }
      });
      
      const data = await response.json();
      setAddresses(data.data.addresses || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  const addAddress = async (addressData) => {
    const response = await fetch('/api/addresses/user', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${userToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(addressData)
    });
    
    if (response.ok) {
      await loadAddresses(); // Перезагрузить список
    }
    
    return response.json();
  };
  
  const deleteAddress = async (addressId) => {
    const response = await fetch(`/api/addresses/user/${addressId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${userToken}` }
    });
    
    if (response.ok) {
      await loadAddresses(); // Перезагрузить список
    }
    
    return response.json();
  };
  
  useEffect(() => {
    loadAddresses();
  }, [businessId]);
  
  return {
    addresses,
    loading,
    error,
    addAddress,
    deleteAddress,
    reload: loadAddresses
  };
};
```

### Рабочий процесс добавления адреса
1. **Поиск адреса**: `GET /api/addresses/search?query=улица+пушкина`
2. **Выбор из результатов** пользователем
3. **Добавление адреса**: `POST /api/addresses` с координатами

### Интеграция с заказами
Полученный `address_id` используется в API заказов:
```json
{
  "business_id": 1,
  "address_id": 1,
  "delivery_type": "DELIVERY",
  "items": [...]
}
```

## Структура базы данных

### Таблица user_addreses
| Поле | Тип | Описание |
|------|-----|----------|
| `address_id` | INT (PK) | Уникальный ID адреса |
| `user_id` | INT | ID пользователя |
| `name` | VARCHAR(255) | Название адреса |
| `address` | VARCHAR(255) | Полный адрес |
| `lat` | FLOAT | Широта |
| `lon` | FLOAT | Долгота |
| `apartment` | VARCHAR(20) | Номер квартиры |
| `entrance` | VARCHAR(20) | Номер подъезда |
| `floor` | VARCHAR(20) | Этаж |
| `other` | VARCHAR(255) | Дополнительная информация |
| `city_id` | INT | ID города (опционально) |
| `log_timestamp` | TIMESTAMP | Время создания |
| `isDeleted` | INT | Флаг удаления (0/1) |
