# API для добавления карт через ссылку

## Обзор

Новый функционал позволяет пользователям добавлять банковские карты через специальные ссылки. Это упрощает процесс добавления карт и позволяет делиться ссылками для быстрого доступа к интерфейсу добавления карты.

## Архитектура решения

### Компоненты системы

1. **Генератор ссылок** - создает безопасные ссылки с JWT токенами
2. **Интерфейс добавления карты** - HTML страница с интеграцией Halyk Bank
3. **Обработчики результатов** - страницы успеха и ошибок
4. **Система безопасности** - JWT токены с ограниченным сроком действия

### Поток выполнения

```
1. Пользователь авторизуется в системе
2. Система генерирует JWT токен и ссылку
3. Пользователь открывает ссылку
4. Система проверяет токен и показывает интерфейс
5. Пользователь добавляет карту через Halyk Bank
6. Система обрабатывает результат и показывает статус
```

## API Endpoints

### 1. Генерация ссылки для добавления карты

**POST** `/api/payments/generate-add-card-link`

**Авторизация:** Требуется JWT токен в заголовке `Authorization: Bearer {token}`

**Описание:** Генерирует безопасную ссылку для добавления банковской карты

**Ответ:**
```json
{
  "success": true,
  "data": {
    "addCardLink": "http://localhost:3000/api/payments/add-card?token=eyJhbGciOiJIUzI1NiIs...",
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "expiresIn": "24h",
    "userId": 123,
    "instructions": {
      "ru": "Откройте ссылку для добавления банковской карты",
      "en": "Open the link to add a bank card"
    }
  },
  "message": "Ссылка для добавления карты сгенерирована"
}
```

### 2. Интерфейс добавления карты

**GET** `/api/payments/add-card?token={jwt_token}`

**Авторизация:** JWT токен в query параметре

**Описание:** Отображает HTML интерфейс для добавления банковской карты

**Параметры:**
- `token` (string, required) - JWT токен пользователя

**Возвращает:** HTML страница с интерфейсом добавления карты

### 3. Страница успешного добавления

**GET** `/api/payments/add-card/success?invoiceId={id}`

**Описание:** Страница подтверждения успешного добавления карты

**Параметры:**
- `invoiceId` (string, optional) - ID операции

### 4. Страница ошибки добавления

**GET** `/api/payments/add-card/failure?error={error}&message={message}`

**Описание:** Страница с информацией об ошибке добавления карты

**Параметры:**
- `error` (string, optional) - Код ошибки
- `message` (string, optional) - Описание ошибки

## Безопасность

### JWT Токены

- **Срок действия:** 24 часа
- **Алгоритм:** HS256
- **Payload:** `{ user_id: number }`
- **Secret:** Из переменной окружения `JWT_SECRET`

### Проверка токенов

```typescript
// Метод для проверки токена
static verifyToken(token: string): any {
  const secret = process.env.JWT_SECRET || 'your-secret-key';
  return jwt.verify(token, secret);
}
```

### Обработка ошибок авторизации

- Недействительный токен → Страница ошибки авторизации
- Отсутствующий токен → Страница ошибки авторизации
- Истекший токен → Страница ошибки авторизации

## Интеграция с Halyk Bank

### Настройки

- **Terminal ID:** `bb4dec49-6e30-41d0-b16b-8ba1831a854b`
- **API URL:** `https://epay.homebank.kz/payform/payment-api.js`
- **Валюта верификации:** USD
- **Сумма верификации:** 0 (без списания)

### Параметры платежного объекта

```javascript
const paymentObject = {
  invoiceId: "уникальный_invoice_id",
  backLink: "http://localhost:3000/api/payments/add-card/success",
  failureBackLink: "http://localhost:3000/api/payments/add-card/failure",
  postLink: "http://localhost:3000/api/payments/save-card/postlink",
  language: "rus",
  description: "Добавление банковской карты",
  accountId: userId,
  terminal: "bb4dec49-6e30-41d0-b16b-8ba1831a854b",
  amount: 0,
  currency: "USD",
  cardSave: true,
  paymentType: "cardVerification"
};
```

## Пользовательский интерфейс

### Функции страницы добавления карты

1. **Верификация токена** - автоматическая проверка при загрузке
2. **Информационный блок** - объяснение процесса
3. **Кнопка добавления** - запуск процесса через Halyk Bank
4. **Статус-индикаторы** - отображение текущего состояния
5. **Уведомления безопасности** - информация о защите данных

### Callback функции

```javascript
// Успешное добавление карты
window.halykPaymentSuccess = function(result) {
  // Перенаправление на страницу успеха
};

// Ошибка добавления карты
window.halykPaymentError = function(error) {
  // Отображение ошибки
};

// Отмена операции
window.halykPaymentCancel = function() {
  // Обработка отмены
};

// Таймаут операции
window.halykPaymentTimeout = function() {
  // Обработка таймаута
};
```

## Использование

### 1. Через API

```javascript
// Авторизация пользователя
const authResponse = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ login: '+77001234567', password: 'password' })
});

const { token } = authResponse.data;

// Генерация ссылки
const linkResponse = await fetch('/api/payments/generate-add-card-link', {
  method: 'POST',
  headers: { 
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});

const { addCardLink } = linkResponse.data;

// Открытие ссылки
window.open(addCardLink, '_blank');
```

### 2. Через тестовую страницу

1. Откройте `test-add-card-link.html` в браузере
2. Авторизуйтесь (логин: `+77001234567`, пароль: `password`)
3. Нажмите "Сгенерировать ссылку"
4. Скопируйте или откройте сгенерированную ссылку
5. Добавьте карту через интерфейс

## Обработка ошибок

### Типы ошибок

1. **401 Unauthorized** - недействительный или отсутствующий токен
2. **500 Internal Server Error** - ошибка сервера или Halyk Bank API
3. **Payment Errors** - ошибки платежной системы
4. **Network Errors** - ошибки сети

### Логирование

Все операции логируются с контекстом:

```typescript
console.log('Добавление карты через ссылку:', {
  userId,
  invoiceId,
  timestamp: new Date().toISOString()
});
```

## Требования к окружению

### Переменные окружения

```env
JWT_SECRET=your-jwt-secret-key
DATABASE_URL=mysql://user:password@localhost:3306/database
```

### Зависимости

```json
{
  "jsonwebtoken": "^9.0.0",
  "@prisma/client": "latest",
  "express": "^4.18.0"
}
```

## Мониторинг и отладка

### Проверка функциональности

1. **Health check:** `GET /health`
2. **Database status:** Через Prisma подключение
3. **Halyk Bank API:** Тест токена авторизации
4. **JWT verification:** Валидация токенов

### Тестирование

- Используйте `test-add-card-link.html` для полного тестирования flow
- Проверьте работу с различными пользователями
- Тестируйте истечение токенов (24 часа)
- Проверьте обработку ошибок Halyk Bank

## Примеры использования

### Мобильное приложение

```javascript
// Генерация ссылки в мобильном приложении
const generateCardLink = async (userToken) => {
  const response = await fetch(`${API_BASE}/payments/generate-add-card-link`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${userToken}` }
  });
  
  const { addCardLink } = response.data;
  
  // Открытие в браузере устройства
  Linking.openURL(addCardLink);
};
```

### Веб-приложение

```javascript
// Интеграция в React компонент
const AddCardButton = ({ userToken }) => {
  const handleAddCard = async () => {
    try {
      const response = await api.post('/payments/generate-add-card-link', {}, {
        headers: { Authorization: `Bearer ${userToken}` }
      });
      
      // Открытие в popup окне
      window.open(response.data.addCardLink, 'addCard', 
        'width=600,height=700,scrollbars=yes,resizable=yes');
    } catch (error) {
      console.error('Ошибка генерации ссылки:', error);
    }
  };

  return (
    <button onClick={handleAddCard}>
      Добавить банковскую карту
    </button>
  );
};
```

### Email уведомления

```javascript
// Отправка ссылки на email
const sendCardAddLinkByEmail = async (userId, email) => {
  const { addCardLink } = await generateAddCardLink(userId);
  
  const emailContent = `
    Добавьте банковскую карту по ссылке:
    ${addCardLink}
    
    Ссылка действительна в течение 24 часов.
  `;
  
  await sendEmail(email, 'Добавление банковской карты', emailContent);
};
```

## Заключение

Система добавления карт через ссылки обеспечивает:

- ✅ **Безопасность** - JWT токены с ограниченным сроком действия
- ✅ **Удобство** - простой процесс через одну ссылку
- ✅ **Надежность** - интеграция с проверенным Halyk Bank API
- ✅ **Гибкость** - поддержка различных сценариев использования
- ✅ **Мониторинг** - полное логирование операций

Функционал готов к использованию в production среде.
