# FCM Token API Documentation

## Описание
API для сохранения FCM (Firebase Cloud Messaging) токенов пользователей в поле `OneSignalId` модели `User`. 

**Важно:** userId определяется автоматически из JWT токена пользователя для обеспечения безопасности.

## Endpoint

### POST /api/users/fcm-token

Сохраняет FCM токен пользователя для отправки push-уведомлений.

**URL:** `POST /api/users/fcm-token`

**Авторизация:** Требуется JWT токен в заголовке `Authorization: Bearer <token>`

#### Request Headers

```
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### Request Body

```json
{
  "fcmToken": "fcm_token_string_here"
}
```

**Параметры:**
- `fcmToken` (string, обязательный) - FCM токен для push-уведомлений

**Примечание:** `userId` извлекается автоматически из JWT токена

#### Response

**Success (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "user_id": 123,
      "name": "Иван",
      "first_name": "Иван",
      "last_name": "Иванов",
      "OneSignalId": "fcm_token_string_here"
    },
    "message": "FCM токен успешно сохранен"
  },
  "message": "FCM токен пользователя обновлен"
}
```

**Error (400) - Валидация:**
```json
{
  "success": false,
  "error": {
    "message": "Поле fcmToken обязательно",
    "statusCode": 400,
    "timestamp": "2025-08-07T12:00:00.000Z"
  }
}
```

**Error (401) - Не авторизован:**
```json
{
  "success": false,
  "error": {
    "message": "Требуется авторизация",
    "statusCode": 401,
    "timestamp": "2025-08-07T12:00:00.000Z"
  }
}
```

**Error (500) - Внутренняя ошибка сервера:**
```json
{
  "success": false,
  "error": {
    "message": "Ошибка сохранения FCM токена: [детали ошибки]",
    "statusCode": 500,
    "timestamp": "2025-08-07T12:00:00.000Z"
  }
}
```

## Примеры использования

### cURL
```bash
curl -X POST http://localhost:3000/api/users/fcm-token \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -d '{
    "fcmToken": "fGHJ1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
  }'
```

### JavaScript (fetch)
```javascript
const response = await fetch('/api/users/fcm-token', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${authToken}`
  },
  body: JSON.stringify({
    fcmToken: 'fGHJ1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
  })
});

const data = await response.json();
```

### Axios
```javascript
const response = await axios.post('/api/users/fcm-token', {
  fcmToken: 'fGHJ1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
}, {
  headers: {
    'Authorization': `Bearer ${authToken}`
  }
});
```

## Валидация

API выполняет следующие проверки:
1. **Авторизация** - требуется валидный JWT токен
2. **fcmToken** должен быть строкой и обязательным
3. **fcmToken** не может быть пустой строкой (после trim)
4. **userId** извлекается из JWT токена автоматически

## База данных

Токен сохраняется в поле `OneSignalId` таблицы `users`:
```sql
UPDATE users 
SET OneSignalId = 'fcm_token_here' 
WHERE user_id = <user_id_from_jwt>;
```

## Типы TypeScript

```typescript
interface SaveFcmTokenRequest {
  fcmToken: string;
}

interface SaveFcmTokenResponse {
  user: {
    user_id: number;
    name: string | null;
    first_name: string | null;
    last_name: string | null;
    OneSignalId: string | null;
  };
  message: string;
}
```

## Тестирование

Для тестирования API используйте файл `test-fcm-token-api.html` в корне проекта.

## Примечания

- FCM токен сохраняется в поле `OneSignalId` для совместимости с существующей структурой базы данных
- API следует стандартному формату ответов проекта
- **Требуется авторизация** - userId извлекается из JWT токена для безопасности
- Токен обрезается (trim) перед сохранением для удаления лишних пробелов
- Middleware `authenticateToken` проверяет валидность токена и существование пользователя
