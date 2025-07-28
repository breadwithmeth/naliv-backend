# Naliv Backend API Documentation

## Обзор
Документация API для бэкенда системы Naliv - платформы для заказа товаров с доставкой.

**Base URL:** `http://localhost:3000/api`

## Аутентификация

### 1. Регистрация пользователя
```http
POST /auth/register
```

**Body:**
```json
{
  "phone": "+77077707600",
  "password": "password123",
  "name": "Имя пользователя"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "user_id": 123,
      "name": "Имя пользователя",
      "phone": "+77077707600"
    },
    "token": "jwt_token_here"
  }
}
```

### 2. Авторизация пользователя
```http
POST /auth/login
```

**Body:**
```json
{
  "phone": "+77077707600",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "user_id": 123,
      "name": "Имя пользователя",
      "phone": "+77077707600"
    },
    "token": "jwt_token_here"
  }
}
```

### 3. Получение профиля
```http
GET /auth/profile
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user_id": 123,
    "name": "Имя пользователя",
    "phone": "+77077707600",
    "first_name": "Имя",
    "last_name": "Фамилия"
  }
}
```

## Бизнесы

### 1. Получение списка бизнесов
```http
GET /businesses
```

**Query Parameters:**
- `page` (optional): Номер страницы (по умолчанию 1)
- `limit` (optional): Количество элементов на странице (по умолчанию 10)

**Response:**
```json
{
  "success": true,
  "data": {
    "businesses": [
      {
        "business_id": 1,
        "name": "Название магазина",
        "address": "Адрес магазина",
        "description": "Описание",
        "logo": "logo_url",
        "city_id": 1
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 50,
      "totalPages": 5
    }
  }
}
```

### 2. Получение товаров бизнеса
```http
GET /businesses/{business_id}/items
Authorization: Bearer {token}
```

**Query Parameters:**
- `category_id` (optional): Фильтр по категории
- `page` (optional): Номер страницы
- `limit` (optional): Количество элементов на странице

**Response:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "item_id": 100,
        "name": "Название товара",
        "description": "Описание товара",
        "price": 1500.00,
        "img": "image_url",
        "category_id": 5,
        "is_active": 1
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 100,
      "totalPages": 10
    }
  }
}
```

## Категории

### 1. Получение категорий с подкатегориями
```http
GET /categories
```

**Query Parameters:**
- `business_id` (optional): Фильтр по бизнесу

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "category_id": 1,
      "name": "Алкоголь",
      "parent_id": null,
      "items_count": 150,
      "subcategories": [
        {
          "category_id": 2,
          "name": "Пиво",
          "parent_id": 1,
          "items_count": 50,
          "subcategories": []
        }
      ]
    }
  ]
}
```

### 2. Получение товаров категории (включая подкатегории)
```http
GET /categories/{category_id}/items
```

**Query Parameters:**
- `business_id` (обязательный): ID бизнеса
- `page` (optional): Номер страницы (по умолчанию 1)
- `limit` (optional): Количество товаров на странице (по умолчанию 20)

**Response:**
```json
{
  "success": true,
  "data": {
    "category": {
      "category_id": 37,
      "name": "Вино",
      "photo": "https://example.com/wine.png",
      "img": "https://example.com/wine.jpg"
    },
    "business": {
      "business_id": 2,
      "name": "Название магазина",
      "address": "Адрес магазина"
    },
    "items": [
      {
        "item_id": 100,
        "name": "Название товара",
        "description": "Описание товара",
        "price": 1500,
        "img": "https://example.com/item.jpg",
        "code": "ITEM100",
        "category": {
          "category_id": 64,
          "name": "Подкатегория",
          "parent_category": 37
        },
        "visible": 1
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 185,
      "totalPages": 10
    },
    "categories_included": [37, 58, 59, 60, 61, 62, 63, 64, 186],
    "subcategories_count": 8
  },
  "message": "Товары категории получены успешно"
}
```

## Заказы

### 1. Создание заказа
```http
POST /orders
Authorization: Bearer {token}
```

**Body:**
```json
{
  "user_id": 123,
  "business_id": 2,
  "address_id": 456,
  "payment_type_id": 1,
  "items": [
    {
      "item_id": 100,
      "amount": 2,
      "options": [
        {
          "option_item_relation_id": 10,
          "price": 100.00,
          "amount": 1
        }
      ]
    }
  ],
  "bonus": 50,
  "extra": "Комментарий к заказу",
  "delivery_type": "DELIVERY",
  "delivery_date": "2025-07-24T14:00:00.000Z"
}
```

**Delivery Types:**
- `DELIVERY` - Доставка
- `PICKUP` - Самовывоз
- `SCHEDULED` - Запланированная доставка (требует delivery_date)

**Response:**
```json
{
  "success": true,
  "data": {
    "order": {
      "order_id": 789,
      "user_id": 123,
      "business_id": 2,
      "address_id": 456,
      "delivery_price": 500,
      "total_cost": 3500,
      "delivery_type": "DELIVERY",
      "log_timestamp": "2025-07-24T10:30:00.000Z"
    },
    "items": [
      {
        "relation_id": 1001,
        "order_id": 789,
        "item_id": 100,
        "amount": 2,
        "price": 1500.00,
        "marketing_promotion_detail_id": 5
      }
    ],
    "delivery_calculation": {
      "type": "DISTANCE",
      "distance": 2.5,
      "delivery_cost": 500,
      "coordinates": {
        "lat": 52.271643,
        "lon": 76.950011
      }
    },
    "promotions_applied": [
      {
        "item_id": 100,
        "promotion_type": "SUBTRACT",
        "original_amount": 2,
        "charged_amount": 1,
        "discount_amount": 1500.00
      }
    ]
  }
}
```

### 2. Получение заказа по ID
```http
GET /orders/{order_id}
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "order": {
      "order_id": 789,
      "user_id": 123,
      "business_id": 2,
      "delivery_price": 500,
      "delivery_type": "DELIVERY",
      "log_timestamp": "2025-07-24T10:30:00.000Z"
    },
    "items": [
      {
        "relation_id": 1001,
        "item_id": 100,
        "amount": 2,
        "price": 1500.00,
        "item_name": "Название товара",
        "item_code": "ITEM100",
        "marketing_promotion_detail_id": 5,
        "promotion_detail": {
          "detail_id": 5,
          "type": "SUBTRACT",
          "base_amount": 2,
          "add_amount": 1,
          "name": "Акция 2+1"
        }
      }
    ],
    "business": {
      "id": 2,
      "name": "Название магазина",
      "address": "Адрес магазина"
    },
    "user": {
      "id": 123,
      "name": "Имя пользователя",
      "phone": "+77077707600"
    },
    "status": {
      "status": 1,
      "isCanceled": 0,
      "log_timestamp": "2025-07-24T10:35:00.000Z"
    },
    "cost": {
      "cost": 3000,
      "service_fee": 0,
      "delivery": 500
    }
  }
}
```

### 3. Получение заказов пользователя
```http
GET /orders
Authorization: Bearer {token}
```

**Query Parameters:**
- `page` (optional): Номер страницы
- `limit` (optional): Количество элементов на странице

**Response:**
```json
{
  "success": true,
  "data": {
    "orders": [
      {
        "order_id": 789,
        "business_id": 2,
        "delivery_price": 500,
        "log_timestamp": "2025-07-24T10:30:00.000Z",
        "business": {
          "id": 2,
          "name": "Название магазина",
          "address": "Адрес магазина",
          "logo": "logo_url"
        },
        "status": {
          "status": 1,
          "isCanceled": 0,
          "log_timestamp": "2025-07-24T10:35:00.000Z"
        },
        "cost": {
          "cost": 3000,
          "service_fee": 0,
          "delivery": 500
        },
        "itemsCount": 2
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 25,
      "totalPages": 3
    }
  }
}
```

### 4. Обновление статуса заказа
```http
PATCH /orders/{order_id}/status
Authorization: Bearer {employee_token}
```

**Body:**
```json
{
  "status": 1,
  "isCanceled": false
}
```

**Order Statuses:**
- `0` - Новый
- `1` - Принят магазином
- `2` - Собран
- `3` - Отдан курьеру
- `4` - Доставлен
- `7` - Отменен
- `66` - Не оплачен

## Пользователи

### 1. Поиск пользователей (только для сотрудников)
```http
GET /users/search
Authorization: Bearer {employee_token}
```

**Query Parameters:**
- `phone`: Номер телефона для поиска (обязательный)

**Response:**
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "user_id": 123,
        "name": "Имя пользователя",
        "phone": "+77077707600",
        "first_name": "Имя",
        "last_name": "Фамилия"
      }
    ]
  }
}
```

## Сотрудники

### 1. Авторизация сотрудника
```http
POST /employee/auth/login
```

**Body:**
```json
{
  "login": "employee_login",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "employee": {
      "employee_id": 456,
      "name": "Имя сотрудника",
      "login": "employee_login",
      "role": "OPERATOR",
      "business_id": 2
    },
    "token": "jwt_token_here"
  }
}
```

**Employee Roles:**
- `OPERATOR` - Оператор
- `MANAGER` - Менеджер  
- `ADMIN` - Администратор

### 2. Получение заказов для сотрудника
```http
GET /employee/orders
Authorization: Bearer {employee_token}
```

**Query Parameters:**
- `status` (optional): Фильтр по статусу заказа
- `page` (optional): Номер страницы
- `limit` (optional): Количество элементов на странице

## Доставка

### 1. Расчет стоимости доставки по координатам
```http
POST /delivery/calculate
```

**Body:**
```json
{
  "business_id": 2,
  "lat": 52.271643,
  "lon": 76.950011
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "delivery_type": "DISTANCE",
    "distance": 2.5,
    "delivery_cost": 500,
    "zone_name": "Зона 1",
    "coordinates": {
      "lat": 52.271643,
      "lon": 76.950011
    }
  }
}
```

### 2. Расчет стоимости доставки по адресу
```http
GET /delivery/calculate-by-address
```

**Query Parameters:**
- `business_id`: ID бизнеса (обязательный)
- `address_id`: ID адреса пользователя (обязательный)

**Response:**
```json
{
  "success": true,
  "data": {
    "delivery_type": "DISTANCE",
    "distance": 2.5,
    "delivery_cost": 500,
    "zone_name": "Зона 1",
    "coordinates": {
      "lat": 52.271643,
      "lon": 76.950011
    },
    "address": {
      "address_id": 456,
      "name": "Дом",
      "address": "ул. Пушкина, д. 10",
      "apartment": "15",
      "entrance": "2",
      "floor": "3",
      "other": "Комментарий"
    }
  },
  "message": "Доставка возможна"
}
```

**Delivery Types:**
- `DISTANCE` - Расчет по расстоянию
- `AREA` - Расчет по зонам доставки
- `YANDEX` - Расчет через Яндекс API (fallback)

## Сохраненные карты пользователя

### 1. Получение списка сохраненных карт
```http
GET /user/cards
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "cards": [
      {
        "card_id": 123,
        "mask": "**** **** **** 1234"
      },
      {
        "card_id": 124,
        "mask": "**** **** **** 5678"
      }
    ],
    "total": 2
  },
  "message": "Найдено 2 сохраненных карт"
}
```

### 2. Получение карты по ID
```http
GET /user/cards/{card_id}
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "card": {
      "card_id": 123,
      "mask": "**** **** **** 1234",
      "halyk_card_id": "halyk_123456789"
    }
  },
  "message": "Карта найдена"
}
```

### 3. Удаление сохраненной карты
```http
DELETE /user/cards/{card_id}
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "card_id": 123
  },
  "message": "Карта успешно удалена"
}
```

## Сохранение банковских карт (Halyk Bank)

### ⚡ Улучшенная система генерации Invoice ID

С версии от 27.01.2025 внедрена новая система генерации Invoice ID для карт:

**Формат нового Invoice ID:**
- Шаблон: `CARD{timestamp}{userID}{random}{refresh}`
- Максимальная длина: 20 символов
- Пример: `CARD1753624147697910` (для первичного сохранения)
- Пример: `CARD1753624147697911` (для обновления карты)

**Преимущества новой системы:**
- ✅ **Уникальность**: Проверка в базе данных (таблицы `orders` и `halyk_saved_cards`)
- ✅ **Повторные попытки**: До 5 попыток генерации с задержкой 10мс
- ✅ **Fallback механизм**: Автоматическое использование UUID при неудаче
- ✅ **Логирование**: Детальные логи процесса генерации
- ✅ **Совместимость**: Полная совместимость с Halyk Bank API

**Структура ID:**
- `CARD` - префикс (4 символа)
- `17536241476` - timestamp с усечением (11 символов)
- `979` - padded user ID (3 символа)
- `1` - случайное число (1 символ)
- `0/1` - refresh флаг (1 символ): 0 = новая карта, 1 = обновление

### 1. Инициализация сохранения карты
```http
POST /payments/save-card/init
Authorization: Bearer {token}
```

**Body:**
```json
{
  "backLink": "https://your-app.com/success",
  "failureBackLink": "https://your-app.com/failure", 
  "postLink": "https://your-backend.com/api/payments/save-card/postlink",
  "description": "Регистрация карты",
  "language": "rus"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "paymentObject": {
      "invoiceId": "CARD1753624147697910",
      "backLink": "https://your-app.com/success",
      "failureBackLink": "https://your-app.com/failure",
      "postLink": "https://your-backend.com/api/payments/save-card/postlink",
      "language": "rus",
      "description": "Регистрация карты",
      "accountId": "123",
      "terminal": "bb4dec49-6e30-41d0-b16b-8ba1831a854b",
      "amount": 0,
      "currency": "KZT",
      "cardSave": true,
      "paymentType": "cardVerification",
      "auth": "DCEB8O_ZM5U7SO_T_U5EJQ"
    },
    "jsLibraryUrl": "https://epay.homebank.kz/payform/payment-api.js",
    "invoiceId": "CARD1753624147697910",
    "instructions": {
      "frontend": "Подключите JS-библиотеку и вызовите halyk.pay(paymentObject)",
      "jsLibrary": "https://epay.homebank.kz/payform/payment-api.js",
      "method": "halyk.pay()"
    }
  },
  "message": "Токен получен, готов для сохранения карты"
}
```

### 2. Обновление токена при истечении времени
```http
POST /payments/save-card/refresh-init
Authorization: Bearer {token}
```

**Body:**
```json
{
  "backLink": "https://your-app.com/success",
  "failureBackLink": "https://your-app.com/failure", 
  "postLink": "https://your-backend.com/api/payments/save-card/postlink",
  "description": "Регистрация карты (обновлено)",
  "language": "rus"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "paymentObject": {
      "invoiceId": "CARD1753624147697911",
      "backLink": "https://your-app.com/success",
      "failureBackLink": "https://your-app.com/failure",
      "postLink": "https://your-backend.com/api/payments/save-card/postlink",
      "language": "rus",
      "description": "Регистрация карты (обновлено)",
      "accountId": "123",
      "terminal": "bb4dec49-6e30-41d0-b16b-8ba1831a854b",
      "amount": 0,
      "currency": "KZT",
      "cardSave": true,
      "paymentType": "cardVerification",
      "auth": "NEW_FRESH_TOKEN_HERE",
      "timestamp": 1753617672668
    },
    "jsLibraryUrl": "https://epay.homebank.kz/payform/payment-api.js",
    "invoiceId": "CARD1753624147697911",
    "refreshed": true,
    "instructions": {
      "frontend": "Токен обновлен. Подключите JS-библиотеку и вызовите halyk.pay(paymentObject)",
      "jsLibrary": "https://epay.homebank.kz/payform/payment-api.js",
      "method": "halyk.pay()",
      "note": "Это обновленная сессия с новым токеном"
    }
  },
  "message": "Токен обновлен, готов для сохранения карты"
}
```

### 3. Обработка статуса платежа и ошибок
```http
POST /payments/status
Authorization: Bearer {token}
```

**Body:**
```json
{
  "invoiceId": "CARD1690456789123",
  "error": "timeout",
  "errorMessage": "Время оплаты истекло"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "invoiceId": "CARD1753624147697910",
    "status": "error",
    "canRetry": true,
    "errorType": "timeout",
    "userMessage": "Время сеанса истекло. Попробуйте создать новую сессию.",
    "recommendation": "refresh_token"
  },
  "message": "Статус платежа обработан"
}
```

**Error Types:**
- `timeout` - Истечение времени сессии
- `cancelled` - Отмена пользователем  
- `card_error` - Ошибка с картой
- `unknown` - Неизвестная ошибка

**Recommendations:**
- `refresh_token` - Обновить токен и повторить
- `user_cancelled` - Пользователь отменил операцию
- `check_card_data` - Проверить данные карты
- `retry` - Повторить операцию

### 4. Обработка PostLink (Webhook от Halyk Bank)
```http
POST /payments/save-card/postlink
```

**Body (автоматически отправляется Halyk Bank):**
```json
{
  "accountId": "123",
  "amount": 0,
  "approvalCode": "178644",
  "cardId": "4cd44b44-4445-14a6-e063-1b01040a44c4",
  "cardMask": "440043...0128",
  "cardType": "VISA",
  "code": "ok",
  "currency": "USD",
  "dateTime": "2025-02-12T09:42:51.960781107+05:00",
  "description": "Регистрация карты",
  "invoiceId": "CARD1690456789123",
  "reason": "success",
  "reasonCode": 0,
  "terminal": "67e34d63-102f-4bd1-898e-370781d0074d"
}
```

**Response:**
```json
{
  "success": true,
  "message": "PostLink обработан"
}
```

### 5. Интеграция на фронтенде (исправленная версия)

**Правильная реализация без использования process.env:**

```javascript
// Пример React компонента для добавления карты
const AddCardComponent = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [canRetry, setCanRetry] = useState(true);

  const initCardSave = async (isRefresh = false) => {
    try {
      setLoading(true);
      setError(null);
      
      const endpoint = isRefresh 
        ? '/api/payments/save-card/refresh-init' 
        : '/api/payments/save-card/init';
      
      // Получаем текущий домен динамически
      const baseUrl = window.location.origin;
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          backLink: `${baseUrl}/cards/success`,
          failureBackLink: `${baseUrl}/cards/failure`,
          // Используем статический URL бэкенда или конфиг
          postLink: `${window.API_BASE_URL || 'http://localhost:3000'}/api/payments/save-card/postlink`
        })
      });

      const data = await response.json();
      
      if (data.success) {
        await loadHalykScript(data.data.jsLibraryUrl);
        setupHalykCallbacks(data.data.invoiceId);
        window.halyk.pay(data.data.paymentObject);
      } else {
        throw new Error(data.message);
      }
      
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const loadHalykScript = (url) => {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${url}"]`)) {
        resolve();
        return;
      }
      
      const script = document.createElement('script');
      script.src = url;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  };

  const setupHalykCallbacks = (invoiceId) => {
    // Callback для успешного завершения
    window.halykPaymentSuccess = (result) => {
      setLoading(false);
      console.log('Карта успешно добавлена:', result);
      // Обновить список карт
      refreshCardsList();
    };

    // Callback для ошибок
    window.halykPaymentError = (error) => {
      handlePaymentError(invoiceId, error.code, error.message);
    };

    // Callback для отмены
    window.halykPaymentCancel = () => {
      handlePaymentError(invoiceId, 'cancelled', 'Операция отменена пользователем');
    };

    // Callback для таймаута
    window.halykPaymentTimeout = () => {
      handlePaymentError(invoiceId, 'timeout', 'Время сеанса истекло');
    };
  };

  const handlePaymentError = async (invoiceId, error, errorMessage) => {
    try {
      const response = await fetch('/api/payments/status', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ invoiceId, error, errorMessage })
      });

      const statusData = await response.json();
      
      if (statusData.success) {
        const { userMessage, recommendation, canRetry } = statusData.data;
        setError(userMessage);
        setCanRetry(canRetry);
        setLoading(false);

        // Автоматическое обновление токена при timeout
        if (recommendation === 'refresh_token') {
          setTimeout(() => {
            initCardSave(true); // Обновляем токен
          }, 2000);
        }
      }
    } catch (err) {
      setError('Произошла неизвестная ошибка');
      setLoading(false);
    }
  };

  const refreshCardsList = async () => {
    try {
      const response = await fetch('/api/user/cards', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      const data = await response.json();
      if (data.success) {
        // Обновить состояние списка карт
        console.log('Список карт обновлен:', data.data.cards);
      }
    } catch (error) {
      console.error('Ошибка обновления списка карт:', error);
    }
  };

  return (
    <div className="add-card-component">
      <h3>Добавление банковской карты</h3>
      <p>Для сохранения карты будет произведена верификация на сумму 0 ₸</p>
      
      {loading && (
        <div className="loading">
          <p>Инициализация платежной сессии...</p>
        </div>
      )}
      
      {error && (
        <div className="error">
          <p>{error}</p>
          {canRetry && (
            <div className="retry-buttons">
              <button onClick={() => initCardSave()}>
                Попробовать снова
              </button>
              <button onClick={() => initCardSave(true)}>
                Обновить сессию
              </button>
            </div>
          )}
        </div>
      )}
      
      {!loading && !error && (
        <button onClick={() => initCardSave()}>
          Добавить карту
        </button>
      )}
    </div>
  );
};
```

**Конфигурация для разных окружений:**

```javascript
// В index.html или в начале приложения
window.API_BASE_URL = 'http://localhost:3000'; // для разработки
// window.API_BASE_URL = 'https://api.naliv.kz'; // для продакшена
```

**Альтернативный способ через конфигурационный файл:**

```javascript
// config.js
const config = {
  development: {
    API_BASE_URL: 'http://localhost:3000'
  },
  production: {
    API_BASE_URL: 'https://api.naliv.kz'
  }
};

export default config[process.env.NODE_ENV || 'development'];
```

**Обработка переходов:**

```javascript
// Success page (/cards/success)
useEffect(() => {
  if (window.opener) {
    window.opener.postMessage({ 
      type: 'CARD_SAVE_SUCCESS',
      timestamp: Date.now()
    }, window.location.origin);
    window.close();
  }
}, []);

// Failure page (/cards/failure)  
useEffect(() => {
  const urlParams = new URLSearchParams(window.location.search);
  const error = urlParams.get('error');
  const message = urlParams.get('message');
  
  if (window.opener) {
    window.opener.postMessage({
      type: 'CARD_SAVE_ERROR',
      error,
      message,
      timestamp: Date.now()
    }, window.location.origin);
    window.close();
  }
}, []);
```

**Процесс сохранения карты:**
1. Пользователь инициирует сохранение карты через `/payments/save-card/init`
2. Получаем `paymentObject` и `jsLibraryUrl` 
3. На фронтенде подключаем JS-библиотеку Halyk Bank
4. Вызываем `halyk.pay(paymentObject)` для открытия формы ввода карты
5. Пользователь вводит данные карты (сумма = 0 ₸ для верификации)
6. Halyk Bank отправляет PostLink на наш webhook
7. Карта сохраняется в таблице `halyk_saved_cards`

**Важные замечания:**
- Используется production API Halyk Bank (`https://epay.homebank.kz`)
- Валюта: KZT (казахстанские тенге)
- Сумма верификации: 0 ₸ (деньги не списываются)
- Токен действует 20 минут (1200 секунд)
- При истечении токена используйте `/payments/save-card/refresh-init`
- Не используйте `process.env` на фронтенде - используйте `window.API_BASE_URL`
- Автоматическое восстановление при timeout через 2 секунды

**Обработка ошибок:**
- `timeout` → автоматическое обновление токена
- `cancelled` → показать кнопку "Попробовать снова"  
- `card_error` → показать сообщение "Проверьте данные карты"
- `unknown` → показать общее сообщение об ошибке

## Коды ошибок

### HTTP Status Codes
- `200` - Успешный запрос
- `201` - Ресурс создан
- `400` - Неверный запрос
- `401` - Не авторизован
- `403` - Доступ запрещен
- `404` - Ресурс не найден
- `409` - Конфликт (например, пользователь уже существует)
- `500` - Внутренняя ошибка сервера

### Формат ошибок
```json
{
  "error": {
    "message": "Описание ошибки",
    "statusCode": 400,
    "timestamp": "2025-07-24T10:30:00.000Z",
    "path": "/api/orders",
    "method": "POST"
  }
}
```

## Особенности

### Аутентификация
- Используется JWT токены
- Токен передается в заголовке `Authorization: Bearer {token}`
- Время жизни токена: 24 часа

### Пагинация
Стандартные параметры для всех списков:
- `page` - номер страницы (начинается с 1)
- `limit` - количество элементов (по умолчанию 10, максимум 100)

### Акции и скидки
- Акции применяются автоматически при создании заказа
- Поддерживаются типы: `SUBTRACT` (N+M) и `DISCOUNT` (процентная скидка)
- ID примененной акции сохраняется в `marketing_promotion_detail_id`

### Координаты для доставки
- Координаты берутся из таблицы `user_addresses` по `address_id`
- Пользователь не может задать стоимость доставки вручную
- Стоимость рассчитывается автоматически по координатам адреса

### Валидация
- Все даты в формате ISO 8601
- Номера телефонов в международном формате (+7...)
- Денежные суммы в копейках (для избежания проблем с плавающей точкой)
