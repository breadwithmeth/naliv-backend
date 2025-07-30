# API Уведомлений (Firebase Push Notifications)

## Обзор
API для управления push-уведомлениями через Firebase Cloud Messaging (FCM). Поддерживает регистрацию FCM токенов, отправку уведомлений пользователям и автоматические уведомления при изменении статуса заказов.

## Настройка Firebase

### Переменные окружения в `.env`:
```env
# Firebase Configuration
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY_ID=your-private-key-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nyour-private-key\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com
FIREBASE_CLIENT_ID=your-client-id
FIREBASE_CLIENT_X509_CERT_URL=https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-xxxxx%40your-project-id.iam.gserviceaccount.com
```

### Получение Firebase Service Account:
1. Перейдите в Firebase Console
2. Выберите ваш проект
3. Перейдите в "Project Settings" → "Service Accounts"
4. Нажмите "Generate new private key"
5. Скачайте JSON файл с ключами
6. Добавьте данные из JSON в переменные окружения

## Endpoints

### 1. Регистрация FCM токена
**POST** `/api/notifications/register-token`

Регистрирует FCM токен для получения push-уведомлений.

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Body:**
```json
{
  "fcm_token": "string (required) - FCM токен устройства",
  "device_type": "string (optional) - Тип устройства (ios, android, web)",
  "device_id": "string (optional) - Уникальный ID устройства"
}
```

**Response:**
```json
{
  "success": true,
  "message": "FCM токен успешно зарегистрирован"
}
```

### 2. Удаление FCM токена
**DELETE** `/api/notifications/remove-token`

Удаляет FCM токен пользователя.

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Body:**
```json
{
  "fcm_token": "string (required) - FCM токен для удаления"
}
```

**Response:**
```json
{
  "success": true,
  "message": "FCM токен успешно удален"
}
```

### 3. Отправка уведомления пользователю
**POST** `/api/notifications/send-to-user`

Отправляет push-уведомление конкретному пользователю.

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Body:**
```json
{
  "user_id": "number (required) - ID пользователя",
  "title": "string (required) - Заголовок уведомления",
  "body": "string (required) - Текст уведомления",
  "data": "object (optional) - Дополнительные данные",
  "imageUrl": "string (optional) - URL изображения",
  "sound": "string (optional, default: 'default') - Звук уведомления",
  "badge": "number (optional) - Число для бейджа"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "sent_count": 2,
    "failed_count": 0,
    "total_tokens": 2
  },
  "message": "Уведомление отправлено"
}
```

### 4. История уведомлений пользователя
**GET** `/api/notifications/history`

Получает историю уведомлений пользователя.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Query Parameters:**
```
limit: number (optional, default: 50) - Количество уведомлений
offset: number (optional, default: 0) - Смещение для пагинации
```

**Response:**
```json
{
  "success": true,
  "data": {
    "notifications": [
      {
        "id": 1,
        "title": "🛍️ Заказ оформлен",
        "body": "Ваш заказ №1234567890 принят в обработку",
        "notification_type": "order_status",
        "read_status": false,
        "created_at": "2024-01-15T10:30:00.000Z",
        "data": {
          "order_id": "123",
          "order_uuid": "1234567890"
        }
      }
    ],
    "total": 1,
    "unread_count": 1
  }
}
```

### 5. Отметка уведомления как прочитанного
**PUT** `/api/notifications/:id/read`

Отмечает уведомление как прочитанное.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "success": true,
  "message": "Уведомление отмечено как прочитанное"
}
```

### 6. Тестовое уведомление
**POST** `/api/notifications/test`

Отправляет тестовое уведомление текущему пользователю.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "success": true,
  "message": "Тестовое уведомление отправлено"
}
```

## Автоматические уведомления

### Уведомления о статусе заказа

Система автоматически отправляет уведомления при:

1. **Создании заказа** (статус: 'created')
2. **Изменении статуса заказа** через API `/api/orders/:id/status`

#### Типы уведомлений по статусам:

- **created**: "🛍️ Заказ оформлен"
- **1** (принят): "✅ Заказ принят"
- **2** (готовится): "👨‍🍳 Заказ готовится"
- **3** (готов): "🎉 Заказ готов"
- **4** (в доставке): "🚗 Заказ в доставке"
- **5** (доставлен): "📦 Заказ доставлен"
- **canceled**: "❌ Заказ отменен"

## Структура базы данных

### Таблица `user_fcm_tokens`
Хранит FCM токены пользователей:
```sql
CREATE TABLE user_fcm_tokens (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  fcm_token VARCHAR(500) NOT NULL,
  device_type VARCHAR(50),
  device_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_user_token (user_id, fcm_token)
);
```

### Таблица `user_notifications`
Хранит историю уведомлений:
```sql
CREATE TABLE user_notifications (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  notification_type VARCHAR(100),
  data JSON,
  read_status BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Примеры использования

### Фронтенд (JavaScript)
```javascript
// Регистрация FCM токена
async function registerFCMToken(token) {
  const response = await fetch('/api/notifications/register-token', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${userToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      fcm_token: token,
      device_type: 'web'
    })
  });
  
  const result = await response.json();
  console.log('Token registered:', result);
}

// Получение истории уведомлений
async function getNotifications() {
  const response = await fetch('/api/notifications/history', {
    headers: {
      'Authorization': `Bearer ${userToken}`
    }
  });
  
  const result = await response.json();
  console.log('Notifications:', result.data.notifications);
}
```

### Firebase Web SDK
```javascript
import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

const firebaseConfig = {
  // Ваша конфигурация Firebase
};

const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

// Получение FCM токена
getToken(messaging, { vapidKey: 'your-vapid-key' }).then((currentToken) => {
  if (currentToken) {
    console.log('FCM Token:', currentToken);
    // Отправьте токен на сервер
    registerFCMToken(currentToken);
  }
});

// Обработка входящих уведомлений
onMessage(messaging, (payload) => {
  console.log('Message received:', payload);
  // Обработка уведомления
});
```

## Безопасность

1. **Аутентификация**: Все endpoints требуют JWT токен
2. **Валидация**: Все входные данные валидируются
3. **Изоляция**: Пользователи видят только свои уведомления
4. **Конфиденциальность Firebase**: Приватные ключи хранятся в переменных окружения

## Устранение неполадок

### Частые ошибки:

1. **"Firebase не инициализирован"**
   - Проверьте переменные окружения Firebase
   - Убедитесь, что приватный ключ корректно экранирован

2. **"FCM токен недействителен"**
   - Токен мог истечь
   - Пользователь мог удалить приложение
   - Переинициализируйте FCM на клиенте

3. **"Уведомления не приходят"**
   - Проверьте, зарегистрирован ли FCM токен
   - Убедитесь, что Firebase проект настроен корректно
   - Проверьте права доступа приложения к уведомлениям

### Логи
Все операции логируются в консоль для отладки:
```bash
# Успешная отправка
✅ Firebase Admin SDK инициализирован
Уведомление о создании заказа 123 отправлено пользователю 456

# Ошибки
❌ Ошибка инициализации Firebase: Invalid private key
Ошибка отправки уведомления: No registration tokens found
```
