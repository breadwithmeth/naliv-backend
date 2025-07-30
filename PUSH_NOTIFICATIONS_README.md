# 🔔 Firebase Push Notifications - Naliv Backend

## Обзор

Система push-уведомлений интегрирована в ваш backend и готова к использованию. Уведомления автоматически отправляются при создании и изменении статуса заказов.

## ✅ Что уже сделано

### 1. Backend Integration
- ✅ **NotificationController** - полный контроллер для управления уведомлениями
- ✅ **Routes** - API endpoints для всех операций с уведомлениями  
- ✅ **Database Schema** - таблицы для FCM токенов и истории уведомлений
- ✅ **Order Integration** - автоматические уведомления при создании/изменении заказов
- ✅ **Firebase Admin SDK** - настроена интеграция с Firebase

### 2. API Endpoints
```
POST   /api/notifications/register-token     - Регистрация FCM токена
DELETE /api/notifications/remove-token       - Удаление FCM токена  
POST   /api/notifications/send-to-user       - Отправка уведомления пользователю
GET    /api/notifications/history            - История уведомлений
PUT    /api/notifications/:id/read           - Отметить как прочитанное
POST   /api/notifications/test               - Тестовое уведомление
```

### 3. Автоматические уведомления
- 🛍️ **При создании заказа** - "Заказ оформлен"
- ✅ **При принятии заказа** - "Заказ принят" 
- 👨‍🍳 **При готовке** - "Заказ готовится"
- 🎉 **При готовности** - "Заказ готов"
- 🚗 **При доставке** - "Заказ в доставке"
- 📦 **При доставке** - "Заказ доставлен"
- ❌ **При отмене** - "Заказ отменен"

### 4. Database Tables
```sql
-- FCM токены пользователей
user_fcm_tokens (id, user_id, fcm_token, device_type, device_id, created_at, updated_at)

-- История уведомлений  
user_notifications (id, user_id, title, body, notification_type, data, read_status, created_at)
```

## 🚀 Что нужно сделать для запуска

### 1. Настроить Firebase (5 минут)
```bash
# Следуйте инструкции в файле:
cat FIREBASE_SETUP.md
```

### 2. Добавить переменные в .env
```env
# Firebase Configuration (замените на ваши значения)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY_ID=your-private-key-id  
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nyour-private-key\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com
FIREBASE_CLIENT_ID=your-client-id
FIREBASE_CLIENT_X509_CERT_URL=https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-xxxxx%40your-project-id.iam.gserviceaccount.com
```

### 3. Перезапустить сервер
```bash
npm run dev
```

В логах должно появиться:
```
✅ Firebase Admin SDK инициализирован
```

## 🧪 Тестирование

### 1. Веб-интерфейс для тестирования
Откройте файл `test-notifications.html` в браузере:
```bash
open test-notifications.html
```

### 2. API тестирование
```bash
# Зарегистрировать FCM токен
curl -X POST http://localhost:3000/api/notifications/register-token \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"fcm_token": "test_token", "device_type": "web"}'

# Отправить тестовое уведомление
curl -X POST http://localhost:3000/api/notifications/test \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 3. Автоматическое тестирование через заказы
Создайте заказ через API - уведомление отправится автоматически:
```bash
POST /api/orders/create-user-order
```

## 📱 Клиентская интеграция

### Веб-приложение (Firebase SDK)
```javascript
import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

// Инициализация Firebase
const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

// Получение FCM токена
getToken(messaging, { vapidKey: 'your-vapid-key' }).then((token) => {
  // Отправить токен на сервер
  fetch('/api/notifications/register-token', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${userToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ fcm_token: token, device_type: 'web' })
  });
});

// Обработка входящих уведомлений  
onMessage(messaging, (payload) => {
  console.log('Message received:', payload);
  // Показать уведомление пользователю
});
```

### Мобильное приложение
- **React Native**: `@react-native-firebase/messaging`
- **Flutter**: `firebase_messaging`
- **Native Android**: Firebase SDK for Android
- **Native iOS**: Firebase SDK for iOS

## 📊 Мониторинг и логи

### Логи сервера
```bash
# Успешная инициализация
✅ Firebase Admin SDK инициализирован

# Отправка уведомлений
Уведомление о создании заказа 123 отправлено пользователю 456
Уведомление о смене статуса заказа 123 отправлено пользователю 456

# Ошибки
❌ Ошибка инициализации Firebase: Invalid private key
Ошибка отправки уведомления: No registration tokens found
```

### Firebase Console
В [Firebase Console](https://console.firebase.google.com) можете видеть:
- Статистику отправленных уведомлений
- Ошибки доставки
- Активные устройства

## 📖 Документация

- **API Reference**: `NOTIFICATIONS_API.md` - полная документация API
- **Setup Guide**: `FIREBASE_SETUP.md` - пошаговая настройка Firebase
- **Test Interface**: `test-notifications.html` - веб-интерфейс для тестирования

## 🔧 Архитектура

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Client App    │    │   Naliv Backend  │    │   Firebase FCM  │
│                 │    │                  │    │                 │
│ 1. Register FCM │───▶│ 2. Store Token   │    │                 │
│    Token        │    │    in Database   │    │                 │
│                 │    │                  │    │                 │
│ 6. Receive      │◀───│ 3. Order Created │───▶│ 4. Send Push    │
│    Notification │    │ 5. Send via FCM  │    │    Notification │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## 🆘 Troubleshooting

### Частые проблемы:

**1. "Firebase не инициализирован"**
- Проверьте переменные окружения в `.env`
- Убедитесь, что приватный ключ в кавычках
- Перезапустите сервер

**2. "Уведомления не приходят"**  
- Проверьте, зарегистрирован ли FCM токен
- Убедитесь, что устройство/браузер разрешает уведомления
- Проверьте логи сервера

**3. "No registration tokens found"**
- Пользователь не зарегистрировал FCM токен
- Токен устарел или недействителен
- Пользователь удалил приложение

### Полезные команды:
```bash
# Проверить статус уведомлений пользователя  
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:3000/api/notifications/history

# Зарегистрировать тестовый токен
curl -X POST -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"fcm_token":"test","device_type":"web"}' \
  http://localhost:3000/api/notifications/register-token
```

---

**🎉 Система готова к использованию!** Настройте Firebase, добавьте переменные окружения и начинайте отправлять уведомления своим пользователям.
