# API создания заказа без оплаты

## Описание
API для создания заказа без автоматического списания средств. Заказ создается с флагом `is_canceled: 0` и может быть оплачен позже через API платежей.

## Endpoint
```
POST /api/orders/create-order-no-payment
```

## Авторизация
Требуется JWT токен в заголовке:
```
Authorization: Bearer <jwt_token>
```

    ## Параметры запроса

    ### Обязательные поля
    - `business_id` (number) - ID бизнеса
    - `items` (array) - Массив товаров заказа
    - Для доставки (`delivery_type: "DELIVERY"`):
    - `street` (string) - Название улицы
    - `house` (string) - Номер дома
    - `lat` (number) - Широта адреса
    - `lon` (number) - Долгота адреса

    ### Опциональные поля
    - `apartment` (string) - Номер квартиры
    - `entrance` (string) - Номер подъезда
    - `floor` (string) - Этаж
    - `comment` (string) - Комментарий к адресу
    - `bonus` (number, по умолчанию 0) - Бонусы к списанию
    - `extra` (string) - Дополнительные данные
    - `delivery_type` (string, по умолчанию "DELIVERY") - Тип доставки: DELIVERY, PICKUP, SCHEDULED
    - `delivery_date` (string) - Дата и время доставки (для SCHEDULED) в формате ISO: "2024-01-15T14:00:00.000Z"

    ### Структура товара (items)
    ```json
    {
    "item_id": 100,
    "amount": 2,
    "options": [
        {
        "option_item_relation_id": 10,
        "amount": 1
        }
    ]
    }
    ```

    ## Пример запроса

    ```javascript
    const response = await fetch('/api/orders/create-order-no-payment', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
    },
    body: JSON.stringify({
        "business_id": 2,
        "street": "ул. Пушкина",
        "house": "10",
        "apartment": "15",
        "entrance": "2",
        "floor": "3",
        "comment": "Код домофона 1234",
        "lat": 52.271643,
        "lon": 76.950011,
        "items": [
        {
            "item_id": 100,
            "amount": 2,
            "options": [
            {
                "option_item_relation_id": 10,
                "amount": 1
            }
            ]
        }
        ],
        "delivery_type": "SCHEDULED",
        "delivery_date": "2024-01-15T14:00:00.000Z",
        "bonus": 0,
        "extra": ""
    })
    });
    ```

    ## Ответ сервера

    ### Успешный ответ (201 Created)
    ```json
    {
    "success": true,
    "data": {
        "order_id": 12345,
        "order_uuid": "1735743852001001",
        "total_sum": 2850.00,
        "address_id": 678,
        "is_canceled": 0,
        "delivery_type": "DELIVERY"
    },
    "message": "Заказ создан без оплаты. Используйте API платежей для оплаты заказа."
    }
    ```

    ### Коды ошибок
    - **400 Bad Request** - Не все обязательные поля заполнены
    - **401 Unauthorized** - Необходима авторизация
    - **404 Not Found** - Бизнес не найден
    - **500 Internal Server Error** - Ошибка создания заказа

    ### Примеры ошибок

    #### Отсутствуют обязательные поля
    ```json
    {
    "success": false,
    "error": "Не все обязательные поля заполнены"
    }
    ```

    #### Отсутствует адрес для доставки
    ```json
    {
    "success": false,
    "error": "Для доставки необходимо указать адрес: street, house, lat, lon"
    }
    ```

    #### Бизнес не найден
    ```json
    {
    "success": false,
    "error": "Бизнес не найден"
    }
    ```

## Особенности работы

### Создание адреса
- Для доставки автоматически создается новый адрес из переданных полей
- Адрес сохраняется в таблице `user_addreses`
- ID созданного адреса возвращается в ответе

### Статус заказа
- Заказ создается с флагом `is_canceled: 0` (не отменен)
- Заказ готов к оплате через API платежей
- Можно оплатить позже через endpoint `/api/orders/:id/pay`

### Расчет стоимости
- Автоматически рассчитывается общая стоимость заказа
- Учитываются цены товаров и их опций
- Возвращается в поле `total_sum`

### UUID заказа
- Генерируется числовой UUID формата: timestamp(10) + userId(3) + random(3)
- Уникальный идентификатор для отслеживания заказа
- Используется для интеграций и отображения пользователю

## Дальнейшие действия

После создания заказа без оплаты:

1. **Оплата заказа**: Используйте API платежей для списания средств
2. **Отслеживание**: Мониторьте статус заказа через API отслеживания
3. **Управление**: Изменяйте статус заказа через API управления заказами

## Связанные API

- `POST /api/orders/:id/pay` - Оплата созданного заказа
- `GET /api/orders/:id` - Получение информации о заказе
- `PUT /api/orders/:id/status` - Изменение статуса заказа
- `DELETE /api/orders/:id` - Отмена заказа

## Тестирование

Используйте тестовую страницу: `test-order-no-payment.html`

Пример тестовых данных:
- Business ID: `2`
- Адрес: `ул. Пушкина, 10, кв. 15`
- Координаты: `52.271643, 76.950011`
- Товар: `item_id: 100, amount: 2`
