# Business Authentication Middleware

Middleware для авторизации бизнесов в системе Naliv Backend.

## Описание

Данный модуль предоставляет middleware функции для авторизации бизнесов по токенам из поля `token` таблицы `businesses`:

1. **authenticateBusinessToken** - основная авторизация по токену из поля `token` таблицы `businesses`
2. **authenticateBusiness** - алиас для `authenticateBusinessToken`
3. **optionalBusinessAuth** - опциональная авторизация (не обязательная)
4. **requireBusinessAccess** - проверка доступа к ресурсам конкретного бизнеса

## Использование

### Основная авторизация

```typescript
import { authenticateBusiness, BusinessAuthRequest } from '../middleware/businessAuth';

// В маршруте
router.get('/api/business/orders', authenticateBusiness, async (req: BusinessAuthRequest, res) => {
  const businessId = req.business?.business_id;
  // ... логика получения заказов бизнеса
});
```

### Опциональная авторизация

```typescript
import { optionalBusinessAuth, BusinessAuthRequest } from '../middleware/businessAuth';

router.get('/api/public-data', optionalBusinessAuth, async (req: BusinessAuthRequest, res) => {
  if (req.business) {
    // Пользователь авторизован как бизнес
    const businessId = req.business.business_id;
  }
  // ... общая логика
});
```

### Проверка доступа к ресурсам

```typescript
import { authenticateBusiness, requireBusinessAccess, BusinessAuthRequest } from '../middleware/businessAuth';

// Проверяет, что бизнес имеет доступ к заказу
router.get('/api/orders/:business_id/details', 
  authenticateBusiness, 
  requireBusinessAccess('business_id'),
  async (req: BusinessAuthRequest, res) => {
    // Доступ разрешен только если req.business.business_id === req.params.business_id
  }
);
```

## Структура объекта business в запросе

После успешной авторизации в `req.business` будет содержаться:

```typescript
{
  business_id: number;      // ID бизнеса
  name: string;            // Название бизнеса
  organization_id: number; // ID организации
  uuid: string;           // UUID бизнеса
  enabled: number;        // Статус активности (1 = активен)
}
```

## Заголовки запроса

Все middleware ожидают токен в заголовке `Authorization`:

```
Authorization: Bearer YOUR_BUSINESS_TOKEN
```

## Коды ошибок

- **401** - Токен не предоставлен или недействительный
- **401** - Бизнес отключен (enabled !== 1)
- **403** - Недостаточно прав для доступа к ресурсу

## Примеры использования в контроллерах

### Получение заказов бизнеса

```typescript
export class BusinessOrderController {
  static async getOrders(req: BusinessAuthRequest, res: Response) {
    const businessId = req.business!.business_id;
    
    const orders = await prisma.orders.findMany({
      where: { business_id: businessId }
    });
    
    res.json({ success: true, data: orders });
  }
}
```

### Обновление информации о бизнесе

```typescript
router.put('/api/business/profile', 
  authenticateBusiness,
  async (req: BusinessAuthRequest, res: Response) => {
    const businessId = req.business!.business_id;
    const { name, description } = req.body;
    
    const updated = await prisma.businesses.update({
      where: { business_id: businessId },
      data: { name, description }
    });
    
    res.json({ success: true, data: updated });
  }
);
```

## Безопасность

1. **Токены проверяются** только в поле `token` таблицы `businesses`
2. **Статус бизнеса** всегда проверяется (enabled = 1)
3. **Логирование** всех попыток авторизации
4. **Проверка доступа** к ресурсам конкретного бизнеса

## Отладка

Все успешные авторизации логируются в консоль:
```
Авторизован бизнес: Название бизнеса (ID: 123)
```

Ошибки при опциональной авторизации логируются как warnings:
```
Ошибка опциональной авторизации бизнеса: Error message
```
