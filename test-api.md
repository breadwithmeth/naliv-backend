# API Testing Examples

## Health Check
```bash
curl http://localhost:3000/health
```

## Authentication

### Register User
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+77077707600",
    "password": "test123456",
    "name": "Test User"
  }'
```

### Login User
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+77077707600",
    "password": "test123456"
  }'
```

### Get Profile (requires token)
```bash
curl -X GET http://localhost:3000/api/auth/profile \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"
```

## Businesses

### Get All Businesses
```bash
curl http://localhost:3000/api/businesses
```

### Get Business Items
```bash
curl "http://localhost:3000/api/businesses/1/items?page=1&limit=10"
```

## Users

### Get User Items by Business
```bash
curl "http://localhost:3000/api/users/1/items/business/1?page=1&limit=10"
```

### Add Item to Liked (requires token)
```bash
curl -X POST http://localhost:3000/api/users/1/liked-items \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE" \
  -d '{
    "item_id": 123
  }'
```

### Get Liked Items (requires token)
```bash
curl http://localhost:3000/api/users/1/liked-items \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"
```

## Orders

### Create Order (requires token)
```bash
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE" \
  -d '{
    "user_id": 38378,
    "business_id": 1,
    "address_id": 1,
    "payment_type_id": 1,
    "delivery_price": 500,
    "items": [
      {
        "item_id": 52376,
        "amount": 2,
        "price": 1890
      },
      {
        "item_id": 52323,
        "amount": 1,
        "price": 980
      }
    ]
  }'
```

### Get Order by ID
```bash
curl http://localhost:3000/api/orders/1
```

### Get User Orders (requires token)
```bash
curl "http://localhost:3000/api/orders/user/38378?page=1&limit=10" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"
```

### Update Order Status
```bash
curl -X PUT http://localhost:3000/api/orders/1/status \
  -H "Content-Type: application/json" \
  -d '{
    "status": 2,
    "isCanceled": false
  }'
```

### Cancel Order (requires token)
```bash
curl -X DELETE http://localhost:3000/api/orders/1 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"
```

## Order Status Values:
- 1: CREATED (Создан)
- 2: CONFIRMED (Подтвержден)
- 3: PREPARING (Готовится)
- 4: READY (Готов)
- 5: DELIVERING (Доставляется)
- 6: DELIVERED (Доставлен)
- 7: CANCELED (Отменен)

## Notes:
- Replace YOUR_JWT_TOKEN_HERE with actual JWT token from login response
- Server is running on http://localhost:3000
- Phone format: +77077707600 (Kazakhstan format)
- Address ID should exist in your database
- Payment type ID should exist in your database
