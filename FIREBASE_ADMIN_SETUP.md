# 🔥 Настройка Firebase Admin SDK

## Пошаговая инструкция получения Service Account ключа

### 1. Зайдите в Firebase Console
- Перейдите на https://console.firebase.google.com/
- Войдите в свой Google аккаунт

### 2. Выберите или создайте проект
- Если у вас уже есть Firebase проект - выберите его
- Если нет - создайте новый проект нажав "Add project"

### 3. Перейдите в настройки проекта
- Нажмите на иконку шестеренки ⚙️ рядом с "Project Overview"
- Выберите "Project settings"

### 4. Перейдите на вкладку "Service accounts"
- В настройках проекта найдите вкладку **"Service accounts"**
- Или перейдите по прямой ссылке: `https://console.firebase.google.com/project/YOUR_PROJECT_ID/settings/serviceaccounts/adminsdk`

### 5. Сгенерируйте новый приватный ключ
- Нажмите кнопку **"Generate new private key"**
- Подтвердите действие нажав **"Generate key"**
- Файл `.json` с ключом автоматически скачается

### 6. Извлеките данные из JSON файла
Откройте скачанный JSON файл. Он будет выглядеть примерно так:

\`\`\`json
{
  "type": "service_account",
  "project_id": "your-project-id",
  "private_key_id": "key-id",
  "private_key": "-----BEGIN PRIVATE KEY-----\\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC...\\n-----END PRIVATE KEY-----\\n",
  "client_email": "firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com",
  "client_id": "client-id",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  ...
}
\`\`\`

### 7. Обновите .env файл

Скопируйте данные из JSON файла в ваш `.env` файл:

\`\`\`env
# Firebase Admin SDK Configuration
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC...\\n-----END PRIVATE KEY-----"
\`\`\`

**⚠️ Важно:** 
- Приватный ключ должен быть в кавычках
- Сохраните все `\\n` символы как есть
- Не убирайте `-----BEGIN PRIVATE KEY-----` и `-----END PRIVATE KEY-----`

### 8. Включите Cloud Messaging API
- В Google Cloud Console перейдите в ваш проект
- Найдите "Cloud Messaging API" в библиотеке API
- Включите этот API если он не включен

## 📱 Пример реальных данных в .env

\`\`\`env
# Firebase Admin SDK Configuration
FIREBASE_PROJECT_ID=naliv-app-12345
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-abc123@naliv-app-12345.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDExample...\\n-----END PRIVATE KEY-----"
\`\`\`

## 🔐 Безопасность

1. **Никогда не коммитьте** реальные ключи в git
2. Добавьте `.env` в `.gitignore`
3. Используйте разные проекты для development и production
4. Регулярно ротируйте Service Account ключи
5. Ограничьте права Service Account только необходимыми

## ✅ Проверка настройки

После настройки запустите сервер и проверьте логи:

\`\`\`bash
npm run dev
\`\`\`

Вы должны увидеть:
\`\`\`
✅ Firebase Admin SDK успешно инициализирован
\`\`\`

Если видите предупреждение:
\`\`\`
Firebase Admin SDK не удалось инициализировать: [ошибка]
Push-уведомления будут недоступны
\`\`\`

Значит нужно проверить правильность данных в `.env` файле.

## 🧪 Тестирование

1. Откройте `test-notifications-api.html`
2. Убедитесь, что у пользователя есть FCM токен (через `/api/users/fcm-token`)
3. Попробуйте отправить уведомление через сотрудника
4. Проверьте что уведомление появилось в базе данных и на устройстве

## 🆚 Преимущества над старым подходом

| Старый (Server Key) | Новый (Admin SDK) |
|---------------------|-------------------|
| Устаревший API | Современный API |
| Ограниченная функциональность | Полный набор возможностей |
| HTTP запросы | Нативная библиотека |
| Менее безопасный | Более безопасный |
| Сложная обработка ошибок | Типизированные ошибки |
