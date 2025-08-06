# Business Order API - Integration Examples

## Frontend Integration Examples

### React.js Hook
```typescript
import { useState, useEffect } from 'react';

interface Order {
  order_id: number;
  order_uuid: string;
  user: {
    user_id: number;
    name: string;
  };
  current_status: {
    status: number;
    status_name: string;
    timestamp: string;
    isCanceled: number;
  };
  total_cost: number;
  items_count: number;
  // ... other fields
}

interface OrdersResponse {
  success: boolean;
  data: {
    orders: Order[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
    business: {
      business_id: number;
      name: string;
    };
  };
  message: string;
}

export const useBusinessOrders = (token: string) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false
  });

  const fetchOrders = async (page = 1, limit = 20, filters = {}) => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...filters
      });

      const response = await fetch(`/api/business/orders?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: OrdersResponse = await response.json();

      if (data.success) {
        setOrders(data.data.orders);
        setPagination(data.data.pagination);
      } else {
        setError('Failed to fetch orders');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId: number, status: number) => {
    try {
      const response = await fetch(`/api/business/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        // Update local state
        setOrders(prevOrders =>
          prevOrders.map(order =>
            order.order_id === orderId
              ? {
                  ...order,
                  current_status: data.data.new_status
                }
              : order
          )
        );
        return data;
      } else {
        throw new Error(data.error || 'Failed to update status');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      throw err;
    }
  };

  useEffect(() => {
    if (token) {
      fetchOrders();
    }
  }, [token]);

  return {
    orders,
    loading,
    error,
    pagination,
    fetchOrders,
    updateOrderStatus
  };
};

// Usage in component
export const OrdersManagement = () => {
  const token = localStorage.getItem('businessToken');
  const { orders, loading, error, pagination, fetchOrders, updateOrderStatus } = useBusinessOrders(token);

  const handleStatusChange = async (orderId: number, newStatus: number) => {
    try {
      await updateOrderStatus(orderId, newStatus);
      console.log('Status updated successfully');
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };

  const handlePageChange = (newPage: number) => {
    fetchOrders(newPage, pagination.limit);
  };

  if (loading) return <div>Loading orders...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <h2>Orders Management</h2>
      
      {/* Orders List */}
      {orders.map(order => (
        <div key={order.order_id} className="order-card">
          <h3>Order #{order.order_id}</h3>
          <p>Customer: {order.user.name}</p>
          <p>Status: {order.current_status.status_name}</p>
          <p>Total: {order.total_cost} ₸</p>
          
          {/* Status Update Buttons */}
          <div className="status-buttons">
            {[1, 2, 3, 4, 5, 6, 7].map(status => (
              <button
                key={status}
                onClick={() => handleStatusChange(order.order_id, status)}
                disabled={order.current_status.status === status}
              >
                Status {status}
              </button>
            ))}
          </div>
        </div>
      ))}

      {/* Pagination */}
      <div className="pagination">
        <button
          onClick={() => handlePageChange(pagination.page - 1)}
          disabled={!pagination.hasPrev}
        >
          Previous
        </button>
        
        <span>
          Page {pagination.page} of {pagination.totalPages}
        </span>
        
        <button
          onClick={() => handlePageChange(pagination.page + 1)}
          disabled={!pagination.hasNext}
        >
          Next
        </button>
      </div>
    </div>
  );
};
```

### Vue.js Composition API
```typescript
import { ref, reactive, onMounted } from 'vue';

export function useBusinessOrders(token: string) {
  const orders = ref([]);
  const loading = ref(false);
  const error = ref(null);
  const pagination = reactive({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false
  });

  const fetchOrders = async (page = 1, limit = 20, filters = {}) => {
    loading.value = true;
    error.value = null;

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...filters
      });

      const response = await fetch(`/api/business/orders?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (data.success) {
        orders.value = data.data.orders;
        Object.assign(pagination, data.data.pagination);
      } else {
        error.value = data.error || 'Failed to fetch orders';
      }
    } catch (err) {
      error.value = err.message;
    } finally {
      loading.value = false;
    }
  };

  const updateOrderStatus = async (orderId, status) => {
    try {
      const response = await fetch(`/api/business/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status })
      });

      const data = await response.json();

      if (data.success) {
        const orderIndex = orders.value.findIndex(order => order.order_id === orderId);
        if (orderIndex !== -1) {
          orders.value[orderIndex].current_status = data.data.new_status;
        }
        return data;
      } else {
        throw new Error(data.error || 'Failed to update status');
      }
    } catch (err) {
      error.value = err.message;
      throw err;
    }
  };

  onMounted(() => {
    if (token) {
      fetchOrders();
    }
  });

  return {
    orders,
    loading,
    error,
    pagination,
    fetchOrders,
    updateOrderStatus
  };
}
```

## Backend Integration Examples

### Node.js Express Middleware
```typescript
import axios from 'axios';

interface BusinessOrdersService {
  token: string;
  baseURL: string;
}

export class BusinessOrdersService {
  private api: any;

  constructor(token: string, baseURL = 'http://localhost:3000') {
    this.token = token;
    this.baseURL = baseURL;
    
    this.api = axios.create({
      baseURL: `${baseURL}/api/business`,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    // Response interceptor for error handling
    this.api.interceptors.response.use(
      (response: any) => response,
      (error: any) => {
        console.error('API Error:', error.response?.data || error.message);
        return Promise.reject(error);
      }
    );
  }

  async getOrders(page = 1, limit = 20, filters = {}) {
    try {
      const response = await this.api.get('/orders', {
        params: { page, limit, ...filters }
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch orders: ${error.message}`);
    }
  }

  async updateOrderStatus(orderId: number, status: number) {
    try {
      const response = await this.api.patch(`/orders/${orderId}/status`, {
        status
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to update order status: ${error.message}`);
    }
  }

  async getStatistics(dateFrom?: string, dateTo?: string) {
    try {
      const params: any = {};
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;

      const response = await this.api.get('/orders/stats', { params });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch statistics: ${error.message}`);
    }
  }

  // Batch status update
  async batchUpdateStatus(orderIds: number[], status: number) {
    const results = await Promise.allSettled(
      orderIds.map(orderId => this.updateOrderStatus(orderId, status))
    );

    const successful = results.filter(result => result.status === 'fulfilled');
    const failed = results.filter(result => result.status === 'rejected');

    return {
      successful: successful.length,
      failed: failed.length,
      total: orderIds.length,
      errors: failed.map((result: any) => result.reason.message)
    };
  }

  // Real-time status tracking
  async trackOrderStatus(orderId: number, callback: (status: any) => void) {
    let lastStatus: number | null = null;

    const checkStatus = async () => {
      try {
        const orders = await this.getOrders(1, 1, { order_id: orderId });
        const order = orders.data.orders.find((o: any) => o.order_id === orderId);
        
        if (order && order.current_status.status !== lastStatus) {
          lastStatus = order.current_status.status;
          callback(order.current_status);
        }
      } catch (error) {
        console.error('Status tracking error:', error);
      }
    };

    // Check every 30 seconds
    const interval = setInterval(checkStatus, 30000);
    
    // Initial check
    checkStatus();

    // Return cleanup function
    return () => clearInterval(interval);
  }
}

// Usage example
const ordersService = new BusinessOrdersService('your_business_token');

// Express route example
app.get('/admin/orders', async (req, res) => {
  try {
    const { page = 1, limit = 20, date_from, date_to } = req.query;
    
    const orders = await ordersService.getOrders(
      Number(page),
      Number(limit),
      { date_from, date_to }
    );

    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/admin/orders/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const result = await ordersService.updateOrderStatus(Number(id), status);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### Python Integration
```python
import requests
import asyncio
import aiohttp
from typing import Optional, List, Dict, Any
from datetime import datetime

class BusinessOrdersClient:
    def __init__(self, token: str, base_url: str = "http://localhost:3000"):
        self.token = token
        self.base_url = f"{base_url}/api/business"
        self.headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }

    def get_orders(self, page: int = 1, limit: int = 20, **filters) -> Dict[str, Any]:
        """Get orders with pagination and filters"""
        params = {"page": page, "limit": limit}
        params.update(filters)
        
        response = requests.get(
            f"{self.base_url}/orders",
            headers=self.headers,
            params=params
        )
        response.raise_for_status()
        return response.json()

    def update_order_status(self, order_id: int, status: int) -> Dict[str, Any]:
        """Update order status"""
        response = requests.patch(
            f"{self.base_url}/orders/{order_id}/status",
            headers=self.headers,
            json={"status": status}
        )
        response.raise_for_status()
        return response.json()

    def get_statistics(self, date_from: Optional[str] = None, date_to: Optional[str] = None) -> Dict[str, Any]:
        """Get order statistics"""
        params = {}
        if date_from:
            params["date_from"] = date_from
        if date_to:
            params["date_to"] = date_to

        response = requests.get(
            f"{self.base_url}/orders/stats",
            headers=self.headers,
            params=params
        )
        response.raise_for_status()
        return response.json()

    def batch_update_status(self, order_ids: List[int], status: int) -> Dict[str, Any]:
        """Update multiple orders status"""
        results = {"successful": 0, "failed": 0, "errors": []}
        
        for order_id in order_ids:
            try:
                self.update_order_status(order_id, status)
                results["successful"] += 1
            except Exception as e:
                results["failed"] += 1
                results["errors"].append(f"Order {order_id}: {str(e)}")
        
        return results

# Async version
class AsyncBusinessOrdersClient:
    def __init__(self, token: str, base_url: str = "http://localhost:3000"):
        self.token = token
        self.base_url = f"{base_url}/api/business"
        self.headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }

    async def get_orders(self, page: int = 1, limit: int = 20, **filters) -> Dict[str, Any]:
        params = {"page": page, "limit": limit}
        params.update(filters)
        
        async with aiohttp.ClientSession() as session:
            async with session.get(
                f"{self.base_url}/orders",
                headers=self.headers,
                params=params
            ) as response:
                response.raise_for_status()
                return await response.json()

    async def update_order_status(self, order_id: int, status: int) -> Dict[str, Any]:
        async with aiohttp.ClientSession() as session:
            async with session.patch(
                f"{self.base_url}/orders/{order_id}/status",
                headers=self.headers,
                json={"status": status}
            ) as response:
                response.raise_for_status()
                return await response.json()

    async def batch_update_status(self, order_ids: List[int], status: int) -> Dict[str, Any]:
        """Async batch update for better performance"""
        tasks = [self.update_order_status(order_id, status) for order_id in order_ids]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        successful = sum(1 for r in results if not isinstance(r, Exception))
        failed = len(results) - successful
        errors = [str(r) for r in results if isinstance(r, Exception)]
        
        return {
            "successful": successful,
            "failed": failed,
            "total": len(order_ids),
            "errors": errors
        }

# Usage examples
def main():
    client = BusinessOrdersClient("your_business_token")
    
    # Get first page of orders
    orders = client.get_orders(page=1, limit=10)
    print(f"Found {orders['data']['pagination']['total']} orders")
    
    # Update order status
    if orders['data']['orders']:
        order_id = orders['data']['orders'][0]['order_id']
        result = client.update_order_status(order_id, 3)  # Set to "Preparing"
        print(f"Updated order {order_id} status")
    
    # Get statistics
    stats = client.get_statistics(
        date_from="2024-01-01",
        date_to="2024-01-31"
    )
    print(f"Total revenue: {stats['data']['stats']['total_revenue']}")

# Async usage
async def async_main():
    client = AsyncBusinessOrdersClient("your_business_token")
    
    # Get orders concurrently
    orders_task = client.get_orders(page=1, limit=10)
    stats_task = client.get_statistics()
    
    orders, stats = await asyncio.gather(orders_task, stats_task)
    
    print(f"Orders: {len(orders['data']['orders'])}")
    print(f"Revenue: {stats['data']['stats']['total_revenue']}")

if __name__ == "__main__":
    main()
    # asyncio.run(async_main())
```

### PHP Integration
```php
<?php

class BusinessOrdersClient
{
    private $token;
    private $baseUrl;
    private $headers;

    public function __construct($token, $baseUrl = 'http://localhost:3000')
    {
        $this->token = $token;
        $this->baseUrl = $baseUrl . '/api/business';
        $this->headers = [
            'Authorization: Bearer ' . $token,
            'Content-Type: application/json'
        ];
    }

    public function getOrders($page = 1, $limit = 20, $filters = [])
    {
        $params = array_merge(['page' => $page, 'limit' => $limit], $filters);
        $url = $this->baseUrl . '/orders?' . http_build_query($params);
        
        return $this->makeRequest('GET', $url);
    }

    public function updateOrderStatus($orderId, $status)
    {
        $url = $this->baseUrl . '/orders/' . $orderId . '/status';
        $data = ['status' => $status];
        
        return $this->makeRequest('PATCH', $url, $data);
    }

    public function getStatistics($dateFrom = null, $dateTo = null)
    {
        $params = [];
        if ($dateFrom) $params['date_from'] = $dateFrom;
        if ($dateTo) $params['date_to'] = $dateTo;
        
        $url = $this->baseUrl . '/orders/stats';
        if (!empty($params)) {
            $url .= '?' . http_build_query($params);
        }
        
        return $this->makeRequest('GET', $url);
    }

    private function makeRequest($method, $url, $data = null)
    {
        $ch = curl_init();
        
        curl_setopt_array($ch, [
            CURLOPT_URL => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => $this->headers,
            CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_TIMEOUT => 30
        ]);
        
        if ($data && in_array($method, ['POST', 'PATCH', 'PUT'])) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        }
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        
        if (curl_error($ch)) {
            throw new Exception('Curl error: ' . curl_error($ch));
        }
        
        curl_close($ch);
        
        $decodedResponse = json_decode($response, true);
        
        if ($httpCode >= 400) {
            throw new Exception('HTTP Error ' . $httpCode . ': ' . ($decodedResponse['error'] ?? 'Unknown error'));
        }
        
        return $decodedResponse;
    }
}

// Usage example
try {
    $client = new BusinessOrdersClient('your_business_token');
    
    // Get orders
    $orders = $client->getOrders(1, 10, [
        'date_from' => '2024-01-01'
    ]);
    
    echo "Found " . $orders['data']['pagination']['total'] . " orders\n";
    
    // Update status
    if (!empty($orders['data']['orders'])) {
        $orderId = $orders['data']['orders'][0]['order_id'];
        $result = $client->updateOrderStatus($orderId, 3);
        echo "Updated order $orderId status\n";
    }
    
    // Get statistics
    $stats = $client->getStatistics('2024-01-01', '2024-01-31');
    echo "Total revenue: " . $stats['data']['stats']['total_revenue'] . "\n";
    
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
```

## Mobile App Integration

### Flutter/Dart
```dart
import 'dart:convert';
import 'package:http/http.dart' as http;

class Order {
  final int orderId;
  final String orderUuid;
  final String userName;
  final OrderStatus currentStatus;
  final double totalCost;
  final int itemsCount;

  Order({
    required this.orderId,
    required this.orderUuid,
    required this.userName,
    required this.currentStatus,
    required this.totalCost,
    required this.itemsCount,
  });

  factory Order.fromJson(Map<String, dynamic> json) {
    return Order(
      orderId: json['order_id'],
      orderUuid: json['order_uuid'],
      userName: json['user']?['name'] ?? 'Unknown',
      currentStatus: OrderStatus.fromJson(json['current_status']),
      totalCost: json['total_cost'].toDouble(),
      itemsCount: json['items_count'],
    );
  }
}

class OrderStatus {
  final int status;
  final String statusName;
  final DateTime timestamp;
  final bool isCanceled;

  OrderStatus({
    required this.status,
    required this.statusName,
    required this.timestamp,
    required this.isCanceled,
  });

  factory OrderStatus.fromJson(Map<String, dynamic> json) {
    return OrderStatus(
      status: json['status'],
      statusName: json['status_name'],
      timestamp: DateTime.parse(json['timestamp']),
      isCanceled: json['isCanceled'] == 1,
    );
  }
}

class BusinessOrdersService {
  final String _token;
  final String _baseUrl;
  late final Map<String, String> _headers;

  BusinessOrdersService(this._token, [this._baseUrl = 'http://localhost:3000']) {
    _headers = {
      'Authorization': 'Bearer $_token',
      'Content-Type': 'application/json',
    };
  }

  Future<List<Order>> getOrders({
    int page = 1,
    int limit = 20,
    String? dateFrom,
    String? dateTo,
  }) async {
    final queryParams = <String, String>{
      'page': page.toString(),
      'limit': limit.toString(),
    };

    if (dateFrom != null) queryParams['date_from'] = dateFrom;
    if (dateTo != null) queryParams['date_to'] = dateTo;

    final uri = Uri.parse('$_baseUrl/api/business/orders')
        .replace(queryParameters: queryParams);

    final response = await http.get(uri, headers: _headers);

    if (response.statusCode == 200) {
      final data = json.decode(response.body);
      if (data['success']) {
        final ordersJson = data['data']['orders'] as List;
        return ordersJson.map((json) => Order.fromJson(json)).toList();
      }
      throw Exception(data['error'] ?? 'Failed to fetch orders');
    }
    throw Exception('HTTP ${response.statusCode}: ${response.body}');
  }

  Future<bool> updateOrderStatus(int orderId, int status) async {
    final uri = Uri.parse('$_baseUrl/api/business/orders/$orderId/status');
    final body = json.encode({'status': status});

    final response = await http.patch(uri, headers: _headers, body: body);

    if (response.statusCode == 200) {
      final data = json.decode(response.body);
      return data['success'] == true;
    }
    throw Exception('HTTP ${response.statusCode}: ${response.body}');
  }

  Future<Map<String, dynamic>> getStatistics({
    String? dateFrom,
    String? dateTo,
  }) async {
    final queryParams = <String, String>{};
    if (dateFrom != null) queryParams['date_from'] = dateFrom;
    if (dateTo != null) queryParams['date_to'] = dateTo;

    final uri = Uri.parse('$_baseUrl/api/business/orders/stats')
        .replace(queryParameters: queryParams);

    final response = await http.get(uri, headers: _headers);

    if (response.statusCode == 200) {
      final data = json.decode(response.body);
      if (data['success']) {
        return data['data']['stats'];
      }
      throw Exception(data['error'] ?? 'Failed to fetch statistics');
    }
    throw Exception('HTTP ${response.statusCode}: ${response.body}');
  }
}

// Usage in Flutter widget
class OrdersPage extends StatefulWidget {
  @override
  _OrdersPageState createState() => _OrdersPageState();
}

class _OrdersPageState extends State<OrdersPage> {
  final BusinessOrdersService _ordersService = 
      BusinessOrdersService('your_business_token');
  
  List<Order> _orders = [];
  bool _loading = false;

  @override
  void initState() {
    super.initState();
    _loadOrders();
  }

  Future<void> _loadOrders() async {
    setState(() => _loading = true);
    try {
      final orders = await _ordersService.getOrders();
      setState(() => _orders = orders);
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error: $e')),
      );
    } finally {
      setState(() => _loading = false);
    }
  }

  Future<void> _updateStatus(int orderId, int status) async {
    try {
      await _ordersService.updateOrderStatus(orderId, status);
      _loadOrders(); // Refresh list
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Status updated successfully')),
      );
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error updating status: $e')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Orders')),
      body: _loading
          ? Center(child: CircularProgressIndicator())
          : ListView.builder(
              itemCount: _orders.length,
              itemBuilder: (context, index) {
                final order = _orders[index];
                return Card(
                  child: ListTile(
                    title: Text('Order #${order.orderId}'),
                    subtitle: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Customer: ${order.userName}'),
                        Text('Status: ${order.currentStatus.statusName}'),
                        Text('Total: ${order.totalCost} ₸'),
                      ],
                    ),
                    trailing: PopupMenuButton<int>(
                      onSelected: (status) => _updateStatus(order.orderId, status),
                      itemBuilder: (context) => [
                        PopupMenuItem(value: 2, child: Text('Accept')),
                        PopupMenuItem(value: 3, child: Text('Preparing')),
                        PopupMenuItem(value: 4, child: Text('Ready')),
                        PopupMenuItem(value: 5, child: Text('Delivering')),
                        PopupMenuItem(value: 7, child: Text('Delivered')),
                        PopupMenuItem(value: 6, child: Text('Cancel')),
                      ],
                    ),
                  ),
                );
              },
            ),
    );
  }
}
```

## Testing & Development

### Unit Test Example (Jest)
```typescript
import { BusinessOrdersService } from './BusinessOrdersService';

describe('BusinessOrdersService', () => {
  let service: BusinessOrdersService;
  const mockToken = 'test_token';

  beforeEach(() => {
    service = new BusinessOrdersService(mockToken, 'http://localhost:3000');
  });

  test('should fetch orders successfully', async () => {
    // Mock successful response
    const mockResponse = {
      success: true,
      data: {
        orders: [
          {
            order_id: 1,
            order_uuid: '123',
            user: { name: 'Test User' },
            current_status: { status: 1, status_name: 'New' }
          }
        ],
        pagination: { page: 1, total: 1 }
      }
    };

    // Mock axios
    jest.spyOn(service['api'], 'get').mockResolvedValue({ data: mockResponse });

    const result = await service.getOrders();
    expect(result.success).toBe(true);
    expect(result.data.orders).toHaveLength(1);
  });

  test('should update order status successfully', async () => {
    const mockResponse = {
      success: true,
      data: {
        order_id: 1,
        new_status: { status: 2, status_name: 'Accepted' }
      }
    };

    jest.spyOn(service['api'], 'patch').mockResolvedValue({ data: mockResponse });

    const result = await service.updateOrderStatus(1, 2);
    expect(result.success).toBe(true);
    expect(result.data.new_status.status).toBe(2);
  });
});
```

These integration examples provide comprehensive solutions for different platforms and use cases. Choose the one that best fits your technology stack and requirements.
