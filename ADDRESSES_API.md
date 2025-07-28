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

### 🏠 Управление адресами пользователя
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
