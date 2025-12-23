
# Business API Documentation

## Авторизация

Все эндпоинты раздела `/api/business/*` требуют бизнес‑токен.

Передавайте заголовок:

```
Authorization: Bearer <business_token>
```

`business_id` всегда берётся из токена. Передавать `business_id` в body не нужно.

---

## Promotions (Акции / Скидки)

### POST /api/business/promotions/auto

Автоматически создаёт запись в `marketing_promotions` и сразу создаёт связанные записи в `marketing_promotion_details`.

Инварианты:
- Акция не создаётся без деталей (минимум 1 товар в деталях).
- Поиск товаров идёт по `items.code` + `business_id` из токена.

Поддерживаемые типы деталей:
- `PERCENT` — процентная скидка (legacy `DISCOUNT` принимается и нормализуется в `PERCENT`)
- `SUBTRACT` — акционное правило вида `base_amount + add_amount` (например, 2+1)

#### Вариант 1: PERCENT + item_ids

```json
{
	"type": "PERCENT",
	"discount": 15,
	"item_codes": ["101", "102", "103"],
	"name": "Скидка 15%",
	"duration_days": 7,
	"visible": true
}
```

#### Вариант 2: SUBTRACT + item_codes

```json
{
	"type": "SUBTRACT",
	"base_amount": 2,
	"add_amount": 1,
	"item_codes": ["101", "102"],
	"name": "2+1",
	"duration_days": 14,
	"visible": true
}
```

#### Вариант 3: apply_to_all_items

Создаст детали для всех видимых товаров бизнеса (`items.visible = 1`).

```json
{
	"type": "PERCENT",
	"discount": 10,
	"apply_to_all_items": true,
	"name": "Скидка 10% на всё",
	"duration_days": 3
}
```

#### Вариант 4: details (тонкая настройка)

```json
{
	"type": "PERCENT",
	"name": "Скидки по товарам",
	"start_promotion_date": "2025-01-01T00:00:00.000Z",
	"end_promotion_date": "2025-01-10T00:00:00.000Z",
	"details": [
		{ "item_code": "101", "discount": 10 },
		{ "item_code": "102", "discount": 15 }
	]
}
```

#### Ответ 201

```json
{
	"success": true,
	"data": {
		"promotion": { "marketing_promotion_id": 1 },
		"details": [{ "detail_id": 1 }],
		"created_details_count": 2
	},
	"message": "Акция и детали успешно созданы"
}
```

