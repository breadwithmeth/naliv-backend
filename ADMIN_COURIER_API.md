# Admin Courier API

Базовый URL: `/api/admin/courier`

Требования доступа:
- Авторизация: Bearer токен курьера с `courier_type = 10`.
- Формат ответа: `{ "success": boolean, "data": any, "message"?: string }`.

## Создание курьера
```
POST /couriers
Authorization: Bearer <admin-token>
Content-Type: application/json
{
  "login": "courier_1",
  "password": "StrongPass123",
  "name": "Иван",
  "full_name": "Иван Петров",
  "courier_type": 1
}
```
Условия пароля: минимум 6 символов, буквы и цифры. Логин должен быть уникальным.

Ответ 201:
```json
{
  "success": true,
  "data": {
    "courier_id": 42,
    "login": "courier_1",
    "courier_type": 1
  },
  "message": "Курьер создан"
}
```

## Получение списка курьеров
```
GET /couriers?page=1&limit=20&search=ivan
Authorization: Bearer <admin-token>
```
Параметры: `page` (>=1), `limit` (1-100), `search` (поиск по login/name/full_name, регистронезависимый).

Ответ 200 (пример):
```json
{
  "success": true,
  "data": {
    "couriers": [
      {
        "courier_id": 42,
        "login": "courier_1",
        "name": "Иван",
        "full_name": "Иван Петров",
        "courier_type": 1
      }
    ],
    "total": 1
  }
}
```

  ## Получение списка локаций курьеров
  ```
  GET /couriers/locations?page=1&limit=20&search=ivan
  Authorization: Bearer <admin-token>
  ```
  Возвращает курьеров с последней известной локацией (если она есть). Поиск по `login`, сортировка по `updated_at` у локации.

  Ответ 200:
  ```json
  {
    "success": true,
    "data": {
      "locations": [
        {
          "courier_id": 42,
          "login": "courier_1",
          "courier_type": 1,
          "location": {
            "lat": 43.256649,
            "lon": 76.945465,
            "updated_at": "2025-02-01T10:10:00.000Z"
          }
        }
      ],
      "total": 1
    }
  }
  ```
  Если координат нет, поле `location` будет `null`.

## Получение текущей локации курьера
```
GET /couriers/:courierId/location
Authorization: Bearer <admin-token>
```
Ответ 200 (если локация есть):
```json
{
  "success": true,
  "data": {
    "courier_id": 42,
    "location": {
      "lat": 43.256649,
      "lon": 76.945465,
      "updated_at": "2025-02-01T10:10:00.000Z"
    }
  },
  "message": "Текущая геолокация курьера"
}
```
Если локации нет: `location: null` и сообщение `"Локация не найдена"`.

## Изменение типа курьера
```
PATCH /couriers/:courierId/type
Authorization: Bearer <admin-token>
Content-Type: application/json
{
  "courier_type": 2
}
```
Ответ 200:
```json
{
  "success": true,
  "data": {
    "courier_id": 42,
    "courier_type": 2
  }
}
```

  ## Смена пароля курьера (админ)
  ```
  POST /couriers/:courierId/password
  Authorization: Bearer <admin-token>
  Content-Type: application/json
  {
    "password": "NewPass123"
  }
  ```
  Пароль: минимум 6 символов, буквы и цифры. При смене все активные токены курьера отзываются.

  Ответ 200:
  ```json
  {
    "success": true,
    "data": {
      "courier_id": 42,
      "revoked_tokens": 3
    },
    "message": "Пароль обновлен, токены отозваны"
  }
  ```

## Отзыв всех токенов курьера
```
POST /couriers/:courierId/revoke-tokens
Authorization: Bearer <admin-token>
```
Ответ 200:
```json
{
  "success": true,
  "data": {
    "revoked": 3
  }
}
```
`revoked` — количество отозванных токенов.

## Сводка по курьерам
```
GET /couriers/summary
Authorization: Bearer <admin-token>
```
Ответ 200:
```json
{
  "success": true,
  "data": {
    "totalCouriers": 120,
    "adminCouriers": 2
  }
}
```
