# Business Order API - Quick Reference

## Authentication
```
Authorization: Bearer <business_token>
```

## Endpoints

### 1. Get Orders
```http
GET /api/business/orders
```

**Query Parameters:**
- `page` (number) - Page number (default: 1)
- `limit` (number) - Items per page (max: 100, default: 20)
- `date_from` (string) - Start date filter (ISO format)
- `date_to` (string) - End date filter (ISO format)

**Example:**
```bash
curl -H "Authorization: Bearer token" \
  "http://localhost:3000/api/business/orders?page=1&limit=10"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "orders": [...],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 25,
      "totalPages": 3,
      "hasNext": true,
      "hasPrev": false
    },
    "business": {
      "business_id": 1,
      "name": "Business Name"
    }
  }
}
```

### 2. Update Order Status
```http
PATCH /api/business/orders/:id/status
```

**Body:**
```json
{
  "status": 3
}
```

**Status Codes:**
- `1` - New Order
- `2` - Accepted
- `3` - Preparing
- `4` - Ready for Delivery
- `5` - Out for Delivery
- `6` - Cancelled
- `7` - Delivered

**Example:**
```bash
curl -X PATCH \
  -H "Authorization: Bearer token" \
  -H "Content-Type: application/json" \
  -d '{"status": 3}' \
  "http://localhost:3000/api/business/orders/123/status"
```

### 3. Get Statistics
```http
GET /api/business/orders/stats
```

**Query Parameters:**
- `date_from` (string) - Start date (ISO format)
- `date_to` (string) - End date (ISO format)

**Example:**
```bash
curl -H "Authorization: Bearer token" \
  "http://localhost:3000/api/business/orders/stats?date_from=2024-01-01"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "stats": {
      "total_orders": 150,
      "total_revenue": 450000,
      "total_service_fee": 45000,
      "by_status": [
        {
          "status": 7,
          "status_name": "Delivered",
          "count": 120
        }
      ]
    }
  }
}
```

## Error Responses

### 401 Unauthorized
```json
{
  "success": false,
  "error": "Business authentication required"
}
```

### 404 Not Found
```json
{
  "success": false,
  "error": "Order not found or does not belong to this business"
}
```

### 400 Bad Request
```json
{
  "success": false,
  "error": "Invalid order ID"
}
```

## Order Object Structure

```json
{
  "order_id": 123,
  "order_uuid": "123456789",
  "user": {
    "user_id": 252,
    "name": "John Doe"
  },
  "delivery_address": {
    "address_id": 45,
    "name": "Home",
    "address": "123 Main St",
    "coordinates": {
      "lat": 43.2220,
      "lon": 76.8512
    },
    "details": {
      "apartment": "25",
      "entrance": "2",
      "floor": "5",
      "comment": "Door code 123"
    }
  },
  "delivery_type": "delivery",
  "delivery_price": 500,
  "cost": 2500,
  "service_fee": 250,
  "total_cost": 3250,
  "payment_type": {
    "payment_type_id": 1,
    "name": "Cash"
  },
  "current_status": {
    "status": 2,
    "status_name": "Accepted",
    "timestamp": "2024-01-15T10:30:00.000Z",
    "isCanceled": 0
  },
  "items_count": 5,
  "extra": null,
  "delivery_date": "2024-01-15T15:00:00.000Z",
  "log_timestamp": "2024-01-15T10:00:00.000Z",
  "bonus": 0
}
```

## JavaScript Examples

### Fetch API
```javascript
const API_BASE = 'http://localhost:3000/api/business';
const TOKEN = 'your_business_token';

// Get orders
async function getOrders(page = 1, limit = 10) {
  const response = await fetch(`${API_BASE}/orders?page=${page}&limit=${limit}`, {
    headers: { 'Authorization': `Bearer ${TOKEN}` }
  });
  return response.json();
}

// Update order status
async function updateOrderStatus(orderId, status) {
  const response = await fetch(`${API_BASE}/orders/${orderId}/status`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ status })
  });
  return response.json();
}

// Get statistics
async function getStats(dateFrom, dateTo) {
  const params = new URLSearchParams();
  if (dateFrom) params.append('date_from', dateFrom);
  if (dateTo) params.append('date_to', dateTo);
  
  const response = await fetch(`${API_BASE}/orders/stats?${params}`, {
    headers: { 'Authorization': `Bearer ${TOKEN}` }
  });
  return response.json();
}
```

### Node.js with Axios
```javascript
const axios = require('axios');

const api = axios.create({
  baseURL: 'http://localhost:3000/api/business',
  headers: { 'Authorization': `Bearer ${TOKEN}` }
});

// Get orders
const orders = await api.get('/orders', {
  params: { page: 1, limit: 10 }
});

// Update status
const result = await api.patch(`/orders/${orderId}/status`, {
  status: 3
});

// Get stats
const stats = await api.get('/orders/stats', {
  params: { date_from: '2024-01-01' }
});
```

## Testing

Use the provided HTML test interface: `test-business-order-api.html`

1. Open the file in a browser
2. Enter your API URL and business token
3. Test all endpoints interactively

## Database Tables

- `businesses` - Business information and tokens
- `orders` - Main order information
- `order_status` - Order status history
- `orders_cost` - Order costs and fees
- `orders_items` - Order items
- `user` - User information
- `user_addreses` - User addresses
- `payment_types` - Payment methods
