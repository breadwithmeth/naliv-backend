# Employee API Integration Examples

Примеры интеграции Employee API для различных платформ и языков программирования.

## 📱 Frontend интеграция

### React.js Hook

```jsx
import { useState, useEffect } from 'react';

const useEmployeeOrders = (filters = {}) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState(null);

  const fetchOrders = async (newFilters = {}) => {
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams({ ...filters, ...newFilters });
      const response = await fetch(`/api/employee/orders?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('employeeToken')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch orders');
      }

      const data = await response.json();
      setOrders(data.data.orders);
      setPagination(data.data.pagination);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  return { orders, loading, error, pagination, refetch: fetchOrders };
};

// Использование в компоненте
const OrdersList = () => {
  const { orders, loading, error, pagination, refetch } = useEmployeeOrders({
    limit: 20,
    status: 4
  });

  const handleStatusFilter = (status) => {
    refetch({ status, page: 1 });
  };

  if (loading) return <div>Загрузка...</div>;
  if (error) return <div>Ошибка: {error}</div>;

  return (
    <div>
      <h2>Заказы ({pagination?.total})</h2>
      
      <div className="filters">
        <button onClick={() => handleStatusFilter(4)}>Доставленные</button>
        <button onClick={() => handleStatusFilter(3)}>В доставке</button>
        <button onClick={() => handleStatusFilter(5)}>Отмененные</button>
      </div>

      <div className="orders-list">
        {orders.map(order => (
          <div key={order.order_id} className="order-card">
            <h3>Заказ #{order.order_uuid}</h3>
            <p>Клиент: {order.customer.name}</p>
            <p>Сумма: {order.total_sum} тенге</p>
            <p>Статус: {order.status_name}</p>
            <p>Бизнес: {order.business.name}</p>
          </div>
        ))}
      </div>

      {pagination && (
        <div className="pagination">
          <button 
            disabled={!pagination.has_prev}
            onClick={() => refetch({ page: pagination.current_page - 1 })}
          >
            Назад
          </button>
          <span>
            Страница {pagination.current_page} из {pagination.total_pages}
          </span>
          <button 
            disabled={!pagination.has_next}
            onClick={() => refetch({ page: pagination.current_page + 1 })}
          >
            Вперед
          </button>
        </div>
      )}
    </div>
  );
};
```

### Vue.js Composable

```vue
<template>
  <div>
    <div v-if="loading">Загрузка...</div>
    <div v-else-if="error">Ошибка: {{ error }}</div>
    <div v-else>
      <h2>Заказы ({{ pagination?.total }})</h2>
      
      <div class="filters">
        <input 
          v-model="filters.search" 
          placeholder="Поиск заказов..."
          @input="debouncedSearch"
        />
        <select v-model="filters.status" @change="fetchOrders">
          <option value="">Все статусы</option>
          <option value="0">Новый заказ</option>
          <option value="1">Принят магазином</option>
          <option value="4">Доставлен</option>
          <option value="5">Отменен</option>
        </select>
      </div>

      <div class="orders-grid">
        <div 
          v-for="order in orders" 
          :key="order.order_id"
          class="order-card"
          @click="showOrderDetails(order.order_id)"
        >
          <h3>{{ order.order_uuid }}</h3>
          <p>{{ order.customer.name }}</p>
          <p>{{ order.total_sum }} тенге</p>
          <span :class="`status-${order.current_status}`">
            {{ order.status_name }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { debounce } from 'lodash';

const orders = ref([]);
const loading = ref(false);
const error = ref(null);
const pagination = ref(null);

const filters = reactive({
  page: 1,
  limit: 20,
  status: '',
  search: ''
});

const fetchOrders = async () => {
  loading.value = true;
  error.value = null;
  
  try {
    const params = new URLSearchParams(
      Object.fromEntries(
        Object.entries(filters).filter(([_, v]) => v !== '' && v !== null)
      )
    );
    
    const response = await fetch(`/api/employee/orders?${params}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('employeeToken')}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    
    if (response.ok) {
      orders.value = data.data.orders;
      pagination.value = data.data.pagination;
    } else {
      throw new Error(data.message);
    }
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
};

const debouncedSearch = debounce(() => {
  filters.page = 1;
  fetchOrders();
}, 500);

const showOrderDetails = async (orderId) => {
  // Навигация к деталям заказа или открытие модального окна
  const response = await fetch(`/api/employee/orders/${orderId}`, {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('employeeToken')}`
    }
  });
  
  const data = await response.json();
  // Показать детали заказа
  console.log(data.data);
};

onMounted(() => {
  fetchOrders();
});
</script>

<style scoped>
.orders-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1rem;
}

.order-card {
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 1rem;
  cursor: pointer;
  transition: box-shadow 0.2s;
}

.order-card:hover {
  box-shadow: 0 4px 8px rgba(0,0,0,0.1);
}

.status-4 { color: green; }
.status-5 { color: red; }
.status-3 { color: orange; }
</style>
```

## 📱 Mobile Development

### React Native

```jsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  StyleSheet,
  Alert
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const EmployeeOrdersScreen = ({ navigation }) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const fetchOrders = async (pageNum = 1, append = false) => {
    if (pageNum === 1) setLoading(true);
    
    try {
      const token = await AsyncStorage.getItem('employeeToken');
      const response = await fetch(
        `${API_BASE_URL}/api/employee/orders?page=${pageNum}&limit=20`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const data = await response.json();
      
      if (response.ok) {
        if (append) {
          setOrders(prev => [...prev, ...data.data.orders]);
        } else {
          setOrders(data.data.orders);
        }
        setHasMore(data.data.pagination.has_next);
      } else {
        Alert.alert('Ошибка', data.message);
      }
    } catch (error) {
      Alert.alert('Ошибка', 'Не удалось загрузить заказы');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadMore = () => {
    if (hasMore && !loading) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchOrders(nextPage, true);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    setPage(1);
    fetchOrders(1, false);
  };

  const renderOrder = ({ item }) => (
    <TouchableOpacity
      style={styles.orderCard}
      onPress={() => navigation.navigate('OrderDetails', { orderId: item.order_id })}
    >
      <Text style={styles.orderNumber}>#{item.order_uuid.slice(-8)}</Text>
      <Text style={styles.customerName}>{item.customer.name}</Text>
      <Text style={styles.businessName}>{item.business.name}</Text>
      <View style={styles.orderInfo}>
        <Text style={styles.amount}>{item.total_sum} ₸</Text>
        <Text style={[styles.status, getStatusStyle(item.current_status)]}>
          {item.status_name}
        </Text>
      </View>
      <Text style={styles.date}>
        {new Date(item.order_created).toLocaleDateString('ru-RU')}
      </Text>
    </TouchableOpacity>
  );

  const getStatusStyle = (status) => {
    switch (status) {
      case 4: return { color: '#4CAF50' };
      case 5: return { color: '#F44336' };
      case 3: return { color: '#FF9800' };
      default: return { color: '#2196F3' };
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  return (
    <View style={styles.container}>
      <FlatList
        data={orders}
        keyExtractor={(item) => item.order_id.toString()}
        renderItem={renderOrder}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.1}
        ListEmptyComponent={
          !loading && (
            <Text style={styles.emptyText}>Заказы не найдены</Text>
          )
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  orderCard: {
    backgroundColor: 'white',
    margin: 8,
    padding: 16,
    borderRadius: 8,
    elevation: 2,
  },
  orderNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  customerName: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  businessName: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  orderInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  amount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  status: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  date: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 50,
    color: '#999',
  },
});

export default EmployeeOrdersScreen;
```

### Flutter

```dart
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';

class EmployeeOrdersScreen extends StatefulWidget {
  @override
  _EmployeeOrdersScreenState createState() => _EmployeeOrdersScreenState();
}

class _EmployeeOrdersScreenState extends State<EmployeeOrdersScreen> {
  List<dynamic> orders = [];
  bool isLoading = false;
  bool hasMore = true;
  int currentPage = 1;
  String? searchQuery;
  int? selectedStatus;

  final ScrollController _scrollController = ScrollController();
  final TextEditingController _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _fetchOrders();
    _scrollController.addListener(_onScroll);
  }

  Future<void> _fetchOrders({bool loadMore = false}) async {
    if (isLoading) return;

    setState(() {
      isLoading = true;
    });

    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('employeeToken');

      final queryParams = <String, String>{
        'page': loadMore ? (currentPage + 1).toString() : '1',
        'limit': '20',
      };

      if (searchQuery?.isNotEmpty == true) {
        queryParams['search'] = searchQuery!;
      }

      if (selectedStatus != null) {
        queryParams['status'] = selectedStatus.toString();
      }

      final uri = Uri.parse('$API_BASE_URL/api/employee/orders')
          .replace(queryParameters: queryParams);

      final response = await http.get(
        uri,
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
        },
      );

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        final newOrders = data['data']['orders'] as List;
        final pagination = data['data']['pagination'];

        setState(() {
          if (loadMore) {
            orders.addAll(newOrders);
            currentPage++;
          } else {
            orders = newOrders;
            currentPage = 1;
          }
          hasMore = pagination['has_next'];
        });
      } else {
        _showError('Ошибка загрузки заказов');
      }
    } catch (e) {
      _showError('Ошибка сети: $e');
    } finally {
      setState(() {
        isLoading = false;
      });
    }
  }

  void _onScroll() {
    if (_scrollController.position.pixels ==
        _scrollController.position.maxScrollExtent &&
        hasMore &&
        !isLoading) {
      _fetchOrders(loadMore: true);
    }
  }

  void _showError(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message)),
    );
  }

  Color _getStatusColor(int status) {
    switch (status) {
      case 4: return Colors.green;
      case 5: return Colors.red;
      case 3: return Colors.orange;
      default: return Colors.blue;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Заказы'),
        actions: [
          IconButton(
            icon: Icon(Icons.filter_list),
            onPressed: _showFilterDialog,
          ),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: EdgeInsets.all(16),
            child: TextField(
              controller: _searchController,
              decoration: InputDecoration(
                labelText: 'Поиск заказов',
                prefixIcon: Icon(Icons.search),
                border: OutlineInputBorder(),
              ),
              onSubmitted: (value) {
                searchQuery = value;
                _fetchOrders();
              },
            ),
          ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: () => _fetchOrders(),
              child: ListView.builder(
                controller: _scrollController,
                itemCount: orders.length + (hasMore ? 1 : 0),
                itemBuilder: (context, index) {
                  if (index == orders.length) {
                    return Center(
                      child: Padding(
                        padding: EdgeInsets.all(16),
                        child: CircularProgressIndicator(),
                      ),
                    );
                  }

                  final order = orders[index];
                  return Card(
                    margin: EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    child: ListTile(
                      title: Text('Заказ #${order['order_uuid'].substring(0, 8)}'),
                      subtitle: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Клиент: ${order['customer']['name']}'),
                          Text('Бизнес: ${order['business']['name']}'),
                          Text('Сумма: ${order['total_sum']} ₸'),
                        ],
                      ),
                      trailing: Container(
                        padding: EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: _getStatusColor(order['current_status']),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          order['status_name'],
                          style: TextStyle(color: Colors.white, fontSize: 12),
                        ),
                      ),
                      onTap: () {
                        Navigator.pushNamed(
                          context,
                          '/order-details',
                          arguments: order['order_id'],
                        );
                      },
                    ),
                  );
                },
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _showFilterDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Фильтры'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            DropdownButtonFormField<int?>(
              value: selectedStatus,
              decoration: InputDecoration(labelText: 'Статус'),
              items: [
                DropdownMenuItem(value: null, child: Text('Все')),
                DropdownMenuItem(value: 0, child: Text('Новый заказ')),
                DropdownMenuItem(value: 1, child: Text('Принят магазином')),
                DropdownMenuItem(value: 2, child: Text('Готов к выдаче')),
                DropdownMenuItem(value: 3, child: Text('Доставляется')),
                DropdownMenuItem(value: 4, child: Text('Доставлен')),
                DropdownMenuItem(value: 5, child: Text('Отменен')),
              ],
              onChanged: (value) {
                selectedStatus = value;
              },
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text('Отмена'),
          ),
          TextButton(
            onPressed: () {
              Navigator.pop(context);
              _fetchOrders();
            },
            child: Text('Применить'),
          ),
        ],
      ),
    );
  }

  @override
  void dispose() {
    _scrollController.dispose();
    _searchController.dispose();
    super.dispose();
  }
}
```

## 🖥️ Backend Integration

### Node.js/Express Proxy

```javascript
const express = require('express');
const axios = require('axios');
const router = express.Router();

// Middleware для проверки токена администратора
const adminAuth = (req, res, next) => {
  const adminToken = req.headers['x-admin-token'];
  if (adminToken !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// Прокси для получения заказов от имени сотрудника
router.get('/proxy/employee/:employeeId/orders', adminAuth, async (req, res) => {
  try {
    const { employeeId } = req.params;
    
    // Получаем токен сотрудника из базы данных
    const employee = await Employee.findById(employeeId);
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Делаем запрос к Employee API
    const response = await axios.get(
      `${process.env.API_URL}/api/employee/orders`,
      {
        headers: {
          'Authorization': `Bearer ${employee.token}`,
          'Content-Type': 'application/json'
        },
        params: req.query
      }
    );

    res.json(response.data);
  } catch (error) {
    res.status(500).json({ 
      error: 'Proxy error', 
      message: error.response?.data?.message 
    });
  }
});

// Агрегация данных от нескольких сотрудников
router.get('/aggregate/orders', adminAuth, async (req, res) => {
  try {
    const employees = await Employee.findAll({ where: { active: true } });
    const allOrders = [];

    for (const employee of employees) {
      try {
        const response = await axios.get(
          `${process.env.API_URL}/api/employee/orders`,
          {
            headers: {
              'Authorization': `Bearer ${employee.token}`
            },
            params: { limit: 100, ...req.query }
          }
        );
        
        allOrders.push(...response.data.data.orders.map(order => ({
          ...order,
          employee_id: employee.id,
          employee_name: employee.name
        })));
      } catch (error) {
        console.error(`Failed to fetch orders for employee ${employee.id}`);
      }
    }

    res.json({
      success: true,
      data: {
        orders: allOrders,
        total_count: allOrders.length,
        employees_count: employees.length
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Aggregation failed' });
  }
});

module.exports = router;
```

### Python Django Integration

```python
import requests
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.contrib.auth.decorators import login_required
from django.conf import settings
import json

@login_required
@require_http_methods(["GET"])
def employee_orders_proxy(request):
    """
    Прокси для Employee API с дополнительной обработкой
    """
    try:
        # Получаем токен сотрудника из сессии или модели пользователя
        employee_token = request.user.employee_profile.api_token
        
        # Формируем параметры запроса
        params = dict(request.GET.items())
        
        # Делаем запрос к Employee API
        response = requests.get(
            f"{settings.NALIV_API_URL}/api/employee/orders",
            headers={
                'Authorization': f'Bearer {employee_token}',
                'Content-Type': 'application/json'
            },
            params=params,
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            
            # Дополнительная обработка данных
            for order in data['data']['orders']:
                # Добавляем вычисляемые поля
                order['days_since_created'] = (
                    datetime.now() - 
                    datetime.fromisoformat(order['order_created'].replace('Z', '+00:00'))
                ).days
                
                # Маскируем телефоны клиентов для безопасности
                if order['customer']['login'].startswith('+'):
                    phone = order['customer']['login']
                    order['customer']['masked_phone'] = phone[:4] + '***' + phone[-4:]
            
            return JsonResponse(data)
        else:
            return JsonResponse({
                'error': 'API request failed',
                'status_code': response.status_code
            }, status=response.status_code)
            
    except requests.RequestException as e:
        return JsonResponse({
            'error': 'Network error',
            'message': str(e)
        }, status=500)
    except Exception as e:
        return JsonResponse({
            'error': 'Internal error',
            'message': str(e)
        }, status=500)

@login_required
def orders_analytics(request):
    """
    Аналитика заказов с кешированием
    """
    from django.core.cache import cache
    
    cache_key = f"employee_analytics_{request.user.id}"
    cached_data = cache.get(cache_key)
    
    if cached_data:
        return JsonResponse(cached_data)
    
    try:
        employee_token = request.user.employee_profile.api_token
        
        # Получаем статистику за последние 30 дней
        end_date = datetime.now()
        start_date = end_date - timedelta(days=30)
        
        response = requests.get(
            f"{settings.NALIV_API_URL}/api/employee/orders/statistics",
            headers={'Authorization': f'Bearer {employee_token}'},
            params={
                'start_date': start_date.strftime('%Y-%m-%d'),
                'end_date': end_date.strftime('%Y-%m-%d')
            }
        )
        
        if response.status_code == 200:
            data = response.json()
            
            # Дополнительные вычисления
            general = data['data']['general']
            analytics = {
                **data['data'],
                'performance_metrics': {
                    'orders_per_day': general['total_orders'] / 30,
                    'revenue_per_day': general['total_revenue'] / 30,
                    'cancellation_rate': (
                        general['canceled_orders'] / general['total_orders'] * 100
                        if general['total_orders'] > 0 else 0
                    )
                }
            }
            
            # Кешируем на 1 час
            cache.set(cache_key, analytics, 3600)
            
            return JsonResponse(analytics)
        else:
            return JsonResponse({'error': 'Analytics request failed'}, status=500)
            
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)
```

## 🔄 Real-time Updates

### WebSocket Integration

```javascript
// WebSocket клиент для real-time обновлений
class EmployeeOrdersWebSocket {
  constructor(employeeToken) {
    this.token = employeeToken;
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.listeners = new Map();
  }

  connect() {
    this.ws = new WebSocket(`ws://localhost:3000/ws/employee/orders?token=${this.token}`);
    
    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
      this.emit('connected');
    };

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.handleMessage(data);
    };

    this.ws.onclose = () => {
      console.log('WebSocket disconnected');
      this.emit('disconnected');
      this.attemptReconnect();
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.emit('error', error);
    };
  }

  handleMessage(data) {
    const { type, payload } = data;
    
    switch (type) {
      case 'order_created':
        this.emit('orderCreated', payload);
        break;
      case 'order_status_updated':
        this.emit('orderStatusUpdated', payload);
        break;
      case 'order_assigned':
        this.emit('orderAssigned', payload);
        break;
      default:
        this.emit('message', data);
    }
  }

  attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      setTimeout(() => {
        this.reconnectAttempts++;
        console.log(`Reconnecting... Attempt ${this.reconnectAttempts}`);
        this.connect();
      }, Math.pow(2, this.reconnectAttempts) * 1000);
    }
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  emit(event, data) {
    const callbacks = this.listeners.get(event) || [];
    callbacks.forEach(callback => callback(data));
  }

  sendMessage(type, payload) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, payload }));
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

// Использование
const ws = new EmployeeOrdersWebSocket(employeeToken);

ws.on('orderCreated', (order) => {
  console.log('Новый заказ:', order);
  // Обновить UI
  addOrderToList(order);
  showNotification(`Новый заказ #${order.order_uuid}`);
});

ws.on('orderStatusUpdated', (update) => {
  console.log('Статус заказа обновлен:', update);
  // Обновить конкретный заказ в UI
  updateOrderStatus(update.order_id, update.status);
});

ws.connect();
```

## 📊 Data Export

### Excel Export Function

```javascript
import * as XLSX from 'xlsx';

const exportOrdersToExcel = async (filters = {}) => {
  try {
    // Получаем все заказы (с большим лимитом)
    const response = await fetch('/api/employee/orders?' + new URLSearchParams({
      ...filters,
      limit: '1000' // Максимальное количество для экспорта
    }), {
      headers: {
        'Authorization': `Bearer ${employeeToken}`
      }
    });

    const data = await response.json();
    const orders = data.data.orders;

    // Подготавливаем данные для Excel
    const excelData = orders.map(order => ({
      'ID заказа': order.order_id,
      'UUID заказа': order.order_uuid,
      'Дата создания': new Date(order.order_created).toLocaleString('ru-RU'),
      'Клиент': order.customer.name,
      'Телефон клиента': order.customer.login,
      'Бизнес': order.business.name,
      'Адрес бизнеса': order.business.address,
      'Курьер': order.courier?.name || 'Не назначен',
      'Адрес доставки': order.delivery_address.address,
      'Сумма заказа': order.total_sum,
      'Стоимость доставки': order.delivery_price,
      'Статус': order.status_name,
      'Дата обновления статуса': new Date(order.status_updated).toLocaleString('ru-RU')
    }));

    // Создаем рабочую книгу
    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Заказы');

    // Устанавливаем ширину колонок
    const colWidths = [
      { wch: 10 }, // ID заказа
      { wch: 20 }, // UUID заказа
      { wch: 20 }, // Дата создания
      { wch: 25 }, // Клиент
      { wch: 15 }, // Телефон
      { wch: 30 }, // Бизнес
      { wch: 40 }, // Адрес бизнеса
      { wch: 20 }, // Курьер
      { wch: 40 }, // Адрес доставки
      { wch: 12 }, // Сумма
      { wch: 12 }, // Доставка
      { wch: 15 }, // Статус
      { wch: 20 }  // Дата обновления
    ];
    ws['!cols'] = colWidths;

    // Скачиваем файл
    const fileName = `orders_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, fileName);

    return {
      success: true,
      message: `Экспортировано ${orders.length} заказов`,
      fileName
    };
  } catch (error) {
    console.error('Export error:', error);
    return {
      success: false,
      message: 'Ошибка экспорта: ' + error.message
    };
  }
};

// PDF Export с jsPDF
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const exportOrdersToPDF = async (orderId) => {
  try {
    // Получаем детали заказа
    const response = await fetch(`/api/employee/orders/${orderId}`, {
      headers: { 'Authorization': `Bearer ${employeeToken}` }
    });

    const data = await response.json();
    const { order, items, cost_breakdown } = data.data;

    // Создаем PDF документ
    const doc = new jsPDF();

    // Заголовок
    doc.setFontSize(18);
    doc.text(`Заказ #${order.order_uuid}`, 20, 20);

    // Информация о заказе
    doc.setFontSize(12);
    let y = 40;
    
    doc.text(`Дата: ${new Date(order.order_created).toLocaleString('ru-RU')}`, 20, y);
    y += 10;
    doc.text(`Статус: ${order.status_name}`, 20, y);
    y += 10;
    doc.text(`Клиент: ${order.customer.name}`, 20, y);
    y += 10;
    doc.text(`Телефон: ${order.customer.login}`, 20, y);
    y += 10;
    doc.text(`Бизнес: ${order.business.name}`, 20, y);
    y += 10;
    doc.text(`Адрес доставки: ${order.delivery_address.address}`, 20, y);
    y += 20;

    // Таблица товаров
    const tableData = items.map(item => [
      item.name,
      item.amount,
      item.unit,
      item.price + ' ₸',
      item.subtotal + ' ₸'
    ]);

    doc.autoTable({
      head: [['Товар', 'Количество', 'Ед.изм.', 'Цена', 'Сумма']],
      body: tableData,
      startY: y,
      styles: { fontSize: 10 }
    });

    // Итоговая стоимость
    const finalY = doc.lastAutoTable.finalY + 20;
    doc.text(`Стоимость товаров: ${cost_breakdown.cost} ₸`, 20, finalY);
    doc.text(`Доставка: ${cost_breakdown.delivery} ₸`, 20, finalY + 10);
    doc.text(`Итого: ${cost_breakdown.total_cost} ₸`, 20, finalY + 20);

    // Сохраняем файл
    doc.save(`order_${order.order_uuid}.pdf`);

    return { success: true, message: 'PDF создан успешно' };
  } catch (error) {
    return { success: false, message: 'Ошибка создания PDF: ' + error.message };
  }
};
```

Эти примеры показывают различные способы интеграции Employee API в различных технологических стеках и платформах. Каждый пример включает обработку ошибок, пагинацию, фильтрацию и современные практики разработки.
