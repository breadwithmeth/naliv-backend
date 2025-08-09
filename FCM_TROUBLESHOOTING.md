# 🔧 FCM Troubleshooting Guide

## Ошибка: `messaging/third-party-auth-error`

### 📋 Описание проблемы
Ошибка `Auth error from APNS or Web Push Service` обычно возникает из-за:

1. **Недействительный FCM токен** - токен устарел или некорректный
2. **Неправильные настройки проекта** - проблемы с APNS/Web Push конфигурацией
3. **Токен от другого Firebase проекта** - несоответствие проектов
4. **Отозванные сертификаты** - проблемы с Apple Push Notification service

## 🚀 Решения

### 1. Диагностика FCM токена

Используйте новый endpoint для тестирования токена:

```bash
# Тест собственного токена (для пользователей)
curl -X POST http://localhost:3000/api/notifications/test-token \
  -H "Authorization: Bearer USER_TOKEN" \
  -H "Content-Type: application/json"

# Тест токена конкретного пользователя (для сотрудников)
curl -X POST http://localhost:3000/api/notifications/test-token \
  -H "Authorization: Bearer EMPLOYEE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"userId": 123}'
```

**Пример ответа:**
```json
{
  "success": true,
  "data": {
    "diagnostics": {
      "user_id": 123,
      "user_name": "Иван Иванов", 
      "has_token": true,
      "token_preview": "fGHJ1234567890abcdef...",
      "format_valid": true,
      "status": "send_failed",
      "message": "Не удалось отправить уведомление: Ошибка авторизации APNS/Web Push",
      "test_result": {
        "success": false,
        "error": "Ошибка авторизации APNS/Web Push",
        "error_code": "messaging/third-party-auth-error"
      },
      "firebase_info": {
        "project_id": "naliv-web",
        "initialized": true
      }
    }
  }
}
```

### 2. Очистка недействительного токена

Если токен недействителен, очистите его:

```bash
curl -X DELETE http://localhost:3000/api/notifications/cleanup-token \
  -H "Authorization: Bearer EMPLOYEE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"userId": 123}'
```

### 3. Проверка настроек Firebase проекта

#### A. Проверьте настройки APNS (для iOS)
1. Зайдите в Firebase Console
2. Project Settings → Cloud Messaging
3. В разделе "Apple app configuration" проверьте:
   - ✅ APNs Authentication Key загружен
   - ✅ Key ID указан корректно
   - ✅ Team ID указан корректно

#### B. Проверьте настройки Web Push (для веб-приложений)
1. В Firebase Console → Project Settings → Cloud Messaging
2. В разделе "Web configuration" проверьте:
   - ✅ Web Push certificates настроены
   - ✅ Sender ID корректный

#### C. Убедитесь в правильности проекта
Проверьте, что:
- `FIREBASE_PROJECT_ID` соответствует проекту в Firebase Console
- FCM токены были получены для этого же проекта

### 4. Обновление FCM токена

Попросите клиентское приложение обновить FCM токен:

```javascript
// В клиентском приложении (React Native / Flutter / Web)
// Получить новый токен
const newToken = await messaging().getToken();

// Отправить на сервер
await fetch('/api/users/fcm-token', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${userToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    fcmToken: newToken
  })
});
```

### 5. Проверка Service Account прав

Убедитесь, что Service Account имеет нужные права:

1. Зайдите в Google Cloud Console
2. IAM & Admin → Service Accounts
3. Найдите ваш Service Account
4. Проверьте роли:
   - ✅ `Firebase Admin SDK Administrator Service Agent`
   - ✅ `Firebase Cloud Messaging Admin`

## 🛠️ Автоматическое решение проблем

### Встроенная обработка ошибок

Система автоматически:

1. **Валидирует формат токена** перед отправкой
2. **Очищает недействительные токены** из базы данных
3. **Логирует детальную информацию** об ошибках
4. **Предоставляет диагностику** для каждого токена

### Пример автоматической очистки

```typescript
// Если токен недействителен, он автоматически удаляется
if (!pushResult.success && 
    (pushResult.error_code === 'messaging/registration-token-not-registered' ||
     pushResult.error_code === 'messaging/invalid-registration-token' ||
     pushResult.error_code === 'messaging/sender-id-mismatch')) {
  
  // Автоматическая очистка
  await prisma.user.update({
    where: { user_id: userId },
    data: { OneSignalId: null }
  });
}
```

## 📊 Коды ошибок FCM

| Код ошибки | Описание | Решение |
|------------|----------|---------|
| `messaging/registration-token-not-registered` | Токен не зарегистрирован | Обновить токен в приложении |
| `messaging/invalid-registration-token` | Неверный формат токена | Получить новый токен |
| `messaging/third-party-auth-error` | Ошибка APNS/Web Push | Проверить настройки Firebase |
| `messaging/sender-id-mismatch` | Токен от другого проекта | Использовать правильный проект |
| `messaging/quota-exceeded` | Превышена квота | Подождать и повторить |
| `messaging/unavailable` | Сервис недоступен | Повторить позже |

## 🔄 Workflow диагностики

1. **Получите ошибку** при отправке уведомления
2. **Запустите диагностику** токена через `/api/notifications/test-token`
3. **Проанализируйте результат**:
   - Если `format_valid: false` → токен имеет неверный формат
   - Если `status: send_failed` → проблемы с отправкой
   - Если `should_cleanup: true` → токен нужно удалить
4. **Выполните необходимые действия**:
   - Очистите токен через `/api/notifications/cleanup-token`
   - Попросите клиента обновить токен
   - Проверьте настройки Firebase

## 🎯 Лучшие практики

1. **Регулярно проверяйте токены** на валидность
2. **Автоматически очищайте** недействительные токены
3. **Логируйте все ошибки** для анализа
4. **Имейте fallback механизмы** (SMS, email)
5. **Мониторьте успешность доставки** уведомлений

## 🚨 Экстренные действия

Если проблема критична:

1. **Временно отключите** push-уведомления
2. **Переключитесь на альтернативные каналы** (SMS/email)
3. **Свяжитесь с поддержкой Firebase** если проблема в их сервисе
4. **Создайте новый Firebase проект** если текущий поврежден
