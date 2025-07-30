# Настройка Firebase Push Notifications

## Пошаговая инструкция

### 1. Создание Firebase проекта

1. Перейдите на [Firebase Console](https://console.firebase.google.com/)
2. Нажмите "Add project" (Добавить проект)
3. Введите название проекта (например, "naliv-app")
4. Отключите Google Analytics (не обязательно для push-уведомлений)
5. Нажмите "Create project"

### 2. Настройка FCM (Firebase Cloud Messaging)

1. В левом меню выберите "Cloud Messaging"
2. Если появится предложение добавить приложение, нажмите "Get started"

### 3. Создание Service Account

1. В Firebase Console перейдите в "Project Settings" (иконка шестеренки)
2. Перейдите на вкладку "Service accounts"
3. Нажмите "Generate new private key"
4. Подтвердите загрузку JSON файла
5. Сохраните файл в безопасном месте

### 4. Настройка переменных окружения

Откройте файл `.env` в корне проекта и добавьте следующие переменные:

```env
# Firebase Configuration
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY_ID=your-private-key-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nyour-private-key\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com
FIREBASE_CLIENT_ID=your-client-id
FIREBASE_CLIENT_X509_CERT_URL=https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-xxxxx%40your-project-id.iam.gserviceaccount.com
```

**Как заполнить из JSON файла:**

Если ваш скачанный JSON файл выглядит так:
```json
{
  "type": "service_account",
  "project_id": "naliv-app-12345",
  "private_key_id": "abc123def456...",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-xyz@naliv-app-12345.iam.gserviceaccount.com",
  "client_id": "123456789012345678901",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-xyz%40naliv-app-12345.iam.gserviceaccount.com"
}
```

Тогда ваш `.env` должен быть:
```env
FIREBASE_PROJECT_ID=naliv-app-12345
FIREBASE_PRIVATE_KEY_ID=abc123def456...
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xyz@naliv-app-12345.iam.gserviceaccount.com
FIREBASE_CLIENT_ID=123456789012345678901
FIREBASE_CLIENT_X509_CERT_URL=https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-xyz%40naliv-app-12345.iam.gserviceaccount.com
```

**ВАЖНО:** 
- Приватный ключ должен быть в кавычках
- Символы `\n` в приватном ключе должны остаться как есть
- Не добавляйте лишние пробелы

### 5. Перезапуск сервера

После добавления переменных перезапустите сервер:
```bash
npm run dev
```

В логах должно появиться сообщение:
```
✅ Firebase Admin SDK инициализирован
```

### 6. Тестирование

#### Через API:
1. Зарегистрируйте FCM токен:
```bash
POST /api/notifications/register-token
{
  "fcm_token": "your-fcm-token",
  "device_type": "web"
}
```

2. Отправьте тестовое уведомление:
```bash
POST /api/notifications/test
```

#### Автоматически:
Уведомления будут автоматически отправляться при:
- Создании нового заказа
- Изменении статуса заказа

### 7. Настройка клиентского приложения

#### Для веб-приложения:
```javascript
import { initializeApp } from 'firebase/app';
import { getMessaging, getToken } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: "your-api-key",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "your-app-id"
};

const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

// Получение FCM токена
getToken(messaging, { vapidKey: 'your-vapid-key' }).then((currentToken) => {
  if (currentToken) {
    // Отправьте токен на ваш сервер
    registerToken(currentToken);
  }
});
```

#### Для мобильных приложений:
- **Android**: Используйте Firebase SDK для Android
- **iOS**: Используйте Firebase SDK для iOS

### 8. Устранение неполадок

**Ошибка "Firebase не инициализирован":**
- Проверьте правильность всех переменных окружения
- Убедитесь, что приватный ключ скопирован полностью
- Проверьте, что JSON файл скачан с правильного проекта

**Уведомления не приходят:**
- Убедитесь, что FCM токен правильно зарегистрирован
- Проверьте права на уведомления в браузере/приложении
- Проверьте логи сервера на наличие ошибок

**Ошибка "Invalid private key":**
- Убедитесь, что приватный ключ в кавычках
- Проверьте, что символы `\n` не заменились на реальные переносы строк

### 9. Мониторинг

В Firebase Console вы можете:
- Видеть статистику отправленных уведомлений
- Создавать кампании уведомлений
- Настраивать A/B тестирование

Готово! Теперь ваша система push-уведомлений настроена и готова к использованию.
