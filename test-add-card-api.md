# Быстрый тест API добавления карты через ссылку

## Шаг 1: Авторизация

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "login": "+77001234567",
    "password": "password"
  }'
```

**Ответ:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "user_id": 1,
      "login": "+77001234567"
    }
  }
}
```

## Шаг 2: Генерация ссылки

```bash
curl -X POST http://localhost:3000/api/payments/generate-add-card-link \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

**Ответ:**
```json
{
  "success": true,
  "data": {
    "addCardLink": "http://localhost:3000/api/payments/add-card?token=eyJhbGciOiJIUzI1NiIs...",
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "expiresIn": "24h",
    "userId": 1,
    "instructions": {
      "ru": "Откройте ссылку для добавления банковской карты",
      "en": "Open the link to add a bank card"
    }
  },
  "message": "Ссылка для добавления карты сгенерирована"
}
```

## Шаг 3: Открытие ссылки

Откройте полученную ссылку `addCardLink` в браузере для добавления карты.

## Примеры ссылок

- **Интерфейс добавления:** `http://localhost:3000/api/payments/add-card?token={jwt}`
- **Страница успеха:** `http://localhost:3000/api/payments/add-card/success`
- **Страница ошибки:** `http://localhost:3000/api/payments/add-card/failure`

## Тестовая страница

Откройте `test-add-card-link.html` в браузере для полного интерактивного тестирования.

## Проверка статуса сервера

```bash
curl http://localhost:3000/health
```
