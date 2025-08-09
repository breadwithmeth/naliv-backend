# Notifications API Documentation

## Описание
API для отправки и управления push-уведомлениями через Firebase Cloud Messaging (FCM). Поддерживает отправку уведомлений конкретным пользователям, группам пользователей, а также управление уведомлениями со стороны пользователя.

## Настройка

Для работы API необходимо настроить переменную окружения:
```bash
FCM_SERVER_KEY=ваш_fcm_server_key_из_firebase_console
```

## Endpoints

### 1. Отправка уведомления одному пользователю

**POST** `/api/notifications/send`

**Авторизация:** Требуется токен сотрудника

**Request Body:**
```json
{
  "userId": 123,
  "title": "Заголовок уведомления",
  "body": "Текст уведомления",
  "data": {
    "type": "order",
    "order_id": "456"
  }
}
```

**Response (Success 200):**
```json
{
  "success": true,
  "data": {
    "notification": {
      "id": 1,
      "user_id": 123,
      "title": "Заголовок уведомления",
      "body": "Текст уведомления",
      "data": {
        "type": "order",
        "order_id": "456"
      },
      "sent_at": "2025-08-07T12:00:00.000Z",
      "is_read": false
    },
    "push_result": {
      "success": true,
      "message_id": "fcm_message_id"
    },
    "user": {
      "user_id": 123,
      "name": "Иван",
      "first_name": "Иван",
      "last_name": "Иванов"
    }
  },
  "message": "Уведомление успешно отправлено"
}
```

### 2. Отправка группового уведомления

**POST** `/api/notifications/send-bulk`

**Авторизация:** Требуется токен сотрудника

**Request Body:**
```json
{
  "userIds": [123, 456, 789],
  "title": "Групповое уведомление",
  "body": "Текст для всех пользователей",
  "data": {
    "type": "promotion",
    "promo_id": "SALE2025"
  }
}
```

**Response (Success 200):**
```json
{
  "success": true,
  "data": {
    "summary": {
      "total_users": 3,
      "users_with_tokens": 2,
      "success_count": 2,
      "failure_count": 0
    },
    "results": [
      {
        "user_id": 123,
        "success": true,
        "push_result": {
          "success": true,
          "message_id": "fcm_message_id_1"
        }
      },
      {
        "user_id": 456,
        "success": true,
        "push_result": {
          "success": true,
          "message_id": "fcm_message_id_2"
        }
      }
    ],
    "notifications": [...]
  },
  "message": "Уведомления отправлены: 2 успешно, 0 с ошибками"
}
```

### 3. Получение уведомлений пользователя

**GET** `/api/notifications/my?page=1&limit=20`

**Авторизация:** Требуется токен пользователя

**Query Parameters:**
- `page` (number, optional) - номер страницы (по умолчанию 1)
- `limit` (number, optional) - количество на странице (по умолчанию 20, максимум 100)

**Response (Success 200):**
```json
{
  "success": true,
  "data": {
    "notifications": [
      {
        "id": 1,
        "title": "Заголовок уведомления",
        "body": "Текст уведомления",
        "data": {
          "type": "order",
          "order_id": "456"
        },
        "sent_at": "2025-08-07T12:00:00.000Z",
        "is_read": false
      }
    ],
    "pagination": {
      "current_page": 1,
      "total_pages": 5,
      "total_count": 98,
      "per_page": 20,
      "has_next": true,
      "has_prev": false
    },
    "unread_count": 3
  },
  "message": "Уведомления получены"
}
```

### 4. Отметить уведомление как прочитанное

**PUT** `/api/notifications/:notificationId/read`

**Авторизация:** Требуется токен пользователя

**Response (Success 200):**
```json
{
  "success": true,
  "data": {
    "notification": {
      "id": 1,
      "title": "Заголовок уведомления",
      "body": "Текст уведомления",
      "data": null,
      "sent_at": "2025-08-07T12:00:00.000Z",
      "is_read": true
    }
  },
  "message": "Уведомление отмечено как прочитанное"
}
```

### 5. Отметить все уведомления как прочитанные

**PUT** `/api/notifications/mark-all-read`

**Авторизация:** Требуется токен пользователя

**Response (Success 200):**
```json
{
  "success": true,
  "data": {
    "updated_count": 5
  },
  "message": "Отмечено как прочитанных: 5 уведомлений"
}
```

## Ошибки

### 400 - Bad Request
```json
{
  "success": false,
  "error": {
    "message": "Поля userId, title и body обязательны",
    "statusCode": 400,
    "timestamp": "2025-08-07T12:00:00.000Z"
  }
}
```

### 401 - Unauthorized
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

### 404 - Not Found
```json
{
  "success": false,
  "error": {
    "message": "Пользователь не найден",
    "statusCode": 404,
    "timestamp": "2025-08-07T12:00:00.000Z"
  }
}
```

## Примеры использования

### cURL - Отправка уведомления
```bash
curl -X POST http://localhost:3000/api/notifications/send \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer employee_token_here" \
  -d '{
    "userId": 123,
    "title": "Ваш заказ готов!",
    "body": "Заказ #456 готов к получению",
    "data": {
      "type": "order_ready",
      "order_id": "456"
    }
  }'
```

### JavaScript - Получение уведомлений
```javascript
const response = await fetch('/api/notifications/my?page=1&limit=10', {
  headers: {
    'Authorization': `Bearer ${userToken}`
  }
});

const data = await response.json();
console.log('Уведомления:', data.data.notifications);
console.log('Непрочитанных:', data.data.unread_count);
```

### JavaScript - Отметить как прочитанное
```javascript
const response = await fetch(`/api/notifications/${notificationId}/read`, {
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${userToken}`
  }
});

const data = await response.json();
```

## База данных

Уведомления сохраняются в таблице `user_notifications`:

```sql
CREATE TABLE user_notifications (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  data TEXT NULL,
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_read INT DEFAULT 0,
  INDEX idx_user_id (user_id),
  INDEX idx_is_read (is_read)
);
```

## FCM интеграция

### Требования
1. Firebase проект с настроенным Cloud Messaging
2. Server Key из Firebase Console
3. FCM токены пользователей (сохраняются в `User.OneSignalId`)

### Формат FCM payload
```json
{
  "to": "fcm_token_here",
  "notification": {
    "title": "Заголовок",
    "body": "Текст",
    "sound": "default",
    "badge": 1
  },
  "data": {
    "custom_key": "custom_value"
  },
  "priority": "high",
  "content_available": true
}
```

## Тестирование

Используйте файл `test-notifications-api.html` для тестирования всех endpoints.

## Лимиты

- Максимум 100 пользователей за раз при групповой отправке
- Максимум 100 уведомлений на страницу при получении
- FCM токен обязателен для отправки push-уведомлений

## Безопасность

- Отправка уведомлений доступна только сотрудникам
- Получение уведомлений только для авторизованных пользователей
- Пользователи могут читать только свои уведомления
- Все операции логируются

## Мониторинг

API логирует:
- Успешные и неудачные отправки
- Ошибки FCM
- Статистику по пользователям без токенов
- Время выполнения операций
