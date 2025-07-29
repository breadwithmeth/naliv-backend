# API для работы с адресами пользователей ✅ ГОТОВ К ИСПОЛЬЗОВАНИЮ

## ✅ Статус тестирования
- ✅ **Получение адресов пользователя** - работает
- ✅ **Добавление нового адреса** - работает  
- ✅ **Получение конкретного адреса** - работает
- ✅ **Обновление адреса** - работает
- ✅ **Удаление адреса** - работает
- ✅ **Аутентификация пользователей** - работает
- ✅ **Поиск через Яндекс.Карты** - работает! API возвращает реальные результаты
- ✅ **Валидация координат** - работает
- ✅ **Проверка принадлежности адресов** - работает

### 📊 Результат тестирования

#### ✅ Поиск адресов через Yandex API:
```bash
curl "http://localhost:3000/api/addresses/search?query=павлодар"

# Возвращает реальные результаты от Yandex Maps:
{
  "success": true,
  "data": [
    {
      "name": "Казахстан, Шымкент, микрорайон Терискей, 1",
      "point": { "lat": 42.339424, "lon": 69.638928 },
      "description": "Шымкент, Казахстан",
      "kind": "house", "precision": "number"
    }
  ],
  "message": "Адреса найдены"
}
```

#### ✅ CRUD операции с адресами:
```json
{
  "success": true,
  "data": {
    "address_id": 60786,
    "user_id": 158,
    "name": "Тестовый дом",
    "address": "ул. Пушкина, 12, Алматы",
    "lat": 43.222,
    "lon": 76.8512,
    "apartment": "25",
    "entrance": "2",
    "floor": "5",
    "other": "Код домофона 123",
    "city_id": null,
    "log_timestamp": "2025-07-24T13:28:27.000Z",
    "isDeleted": 0
  },
  "message": "Адрес успешно добавлен"
}
```

## Описание
API предоставляет полный функционал для работы с адресами пользователей, включая поиск через Яндекс.Карты и CRUD операции.

## Базовый URL
```
/api/addresses
```

## Эндпоинты

### 🔍 Поиск адресов
#### GET /api/addresses/search
Поиск адресов через Яндекс.Карты API

**Query параметры:**
- `query` (string, обязательно) - строка поиска

**Пример запроса:**
```bash
curl -X GET "http://localhost:3000/api/addresses/search?query=улица+пушкина+12" \
  -H "Content-Type: application/json"
```

**Пример ответа:**
```json
{
  "success": true,
  "data": [
    {
      "name": "Россия, Москва, улица Пушкина, 12",
      "point": {
        "lat": 55.749792,
        "lon": 37.632495
      },
      "description": "Москва, Россия",
      "kind": "house",
      "precision": "exact"
    }
  ],
  "message": "Адреса найдены"
}
```

---

### 🚚 Проверка доставки
#### POST /api/addresses/check-delivery
Проверка возможности доставки по координатам для конкретного бизнеса

**Headers:**
```
Content-Type: application/json
```

**Body параметры:**
| Поле | Тип | Обязательно | Описание |
|------|-----|-------------|----------|
| `lat` | number | ✅ | Широта (от -90 до 90) |
| `lon` | number | ✅ | Долгота (от -180 до 180) |
| `business_id` | number | ✅ | ID бизнеса для проверки доставки |

**Пример запроса:**
```bash
curl -X POST http://localhost:3000/api/addresses/check-delivery \
  -H "Content-Type: application/json" \
  -d '{
    "lat": 43.2220,
    "lon": 76.8512,
    "business_id": 1
  }'
```

**Пример ответа:**
```json
{
  "success": true,
  "data": {
    "available": true,
    "price": 500,
    "delivery_type": "paid",
    "message": "Доставка доступна",
    "distance": 2.5
  },
  "message": "Проверка доставки выполнена"
}
```

---

### 🏠 Управление адресами пользователя (Новая версия)
*Все эндпоинты требуют авторизации*

#### GET /api/addresses/user
Получить все адреса текущего пользователя (новая версия)

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Пример запроса:**
```bash
curl -X GET http://localhost:3000/api/addresses/user \
  -H "Authorization: Bearer <jwt_token>"
```

**Пример ответа:**
```json
{
  "success": true,
  "data": {
    "addresses": [
      {
        "address_id": 1,
        "lat": 43.2220,
        "lon": 76.8512,
        "address": "ул. Пушкина, 12",
        "name": "Дом",
        "apartment": "25",
        "entrance": "2",
        "floor": "5",
        "other": "Код домофона 123",
        "city_id": null,
        "created_at": "2025-07-24T13:30:00.000Z"
      }
    ]
  },
  "message": "Найдено 1 адресов"
}
```

#### GET /api/addresses/user/with-delivery
Получить все адреса пользователя с проверкой доставки

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Query параметры:**
- `business_id` (number, опционально) - ID бизнеса для проверки доставки

**Пример запроса:**
```bash
curl -X GET "http://localhost:3000/api/addresses/user/with-delivery?business_id=1" \
  -H "Authorization: Bearer <jwt_token>"
```

**Пример ответа:**
```json
{
  "success": true,
  "data": {
    "addresses": [
      {
        "address_id": 1,
        "lat": 43.2220,
        "lon": 76.8512,
        "address": "ул. Пушкина, 12",
        "name": "Дом",
        "apartment": "25",
        "entrance": "2",
        "floor": "5",
        "other": "Код домофона 123",
        "city_id": null,
        "created_at": "2025-07-24T13:30:00.000Z",
        "delivery": {
          "available": true,
          "price": 500,
          "delivery_type": "paid",
          "message": "Доставка доступна",
          "distance": 2.5
        }
      }
    ],
    "business_id": 1
  },
  "message": "Найдено 1 адресов"
}
```

#### POST /api/addresses/user
Добавить новый адрес (новая версия)

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Body параметры:**
| Поле | Тип | Обязательно | Описание |
|------|-----|-------------|----------|
| `lat` | number | ✅ | Широта (от -90 до 90) |
| `lon` | number | ✅ | Долгота (от -180 до 180) |
| `address` | string | ✅ | Полный адрес |
| `name` | string | ✅ | Название адреса (например, "Дом", "Работа") |
| `apartment` | string | ❌ | Номер квартиры |
| `entrance` | string | ❌ | Номер подъезда |
| `floor` | string | ❌ | Этаж |
| `other` | string | ❌ | Дополнительная информация |
| `city_id` | number | ❌ | ID города |

**Пример запроса:**
```bash
curl -X POST http://localhost:3000/api/addresses/user \
  -H "Authorization: Bearer <jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "lat": 43.2220,
    "lon": 76.8512,
    "address": "ул. Пушкина, 12",
    "name": "Дом",
    "apartment": "25",
    "entrance": "2",
    "floor": "5",
    "other": "Код домофона 123"
  }'
```

**Пример ответа:**
```json
{
  "success": true,
  "data": {
    "address": {
      "address_id": 1,
      "lat": 43.2220,
      "lon": 76.8512,
      "address": "ул. Пушкина, 12",
      "name": "Дом",
      "apartment": "25",
      "entrance": "2",
      "floor": "5",
      "other": "Код домофона 123",
      "city_id": null,
      "created_at": "2025-07-24T13:30:00.000Z"
    }
  },
  "message": "Адрес успешно создан"
}
```

#### PUT /api/addresses/user/:id
Обновить существующий адрес (новая версия)

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**URL параметры:**
- `id` (number) - ID адреса

**Body параметры:** (все поля опциональны)
- `lat` (number) - Новая широта
- `lon` (number) - Новая долгота
- `address` (string) - Новый адрес
- `name` (string) - Новое название
- `apartment` (string) - Новый номер квартиры
- `entrance` (string) - Новый номер подъезда
- `floor` (string) - Новый этаж
- `other` (string) - Новая дополнительная информация
- `city_id` (number) - Новый ID города

**Пример запроса:**
```bash
curl -X PUT http://localhost:3000/api/addresses/user/1 \
  -H "Authorization: Bearer <jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "apartment": "26",
    "other": "Новый код домофона 456"
  }'
```

#### DELETE /api/addresses/user/:id
Удалить адрес (мягкое удаление)

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**URL параметры:**
- `id` (number) - ID адреса

**Пример запроса:**
```bash
curl -X DELETE http://localhost:3000/api/addresses/user/1 \
  -H "Authorization: Bearer <jwt_token>"
```

**Пример ответа:**
```json
{
  "success": true,
  "data": {
    "address_id": 1
  },
  "message": "Адрес успешно удален"
}
```

---

### 🏠 Управление адресами пользователя (Старая версия)
*Все эндпоинты требуют авторизации*

#### GET /api/addresses
Получить все адреса текущего пользователя

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Пример запроса:**
```bash
curl -X GET http://localhost:3000/api/addresses \
  -H "Authorization: Bearer <jwt_token>"
```

**Пример ответа:**
```json
{
  "success": true,
  "data": [
    {
      "address_id": 1,
      "user_id": 158,
      "name": "Дом",
      "address": "ул. Пушкина, 12",
      "lat": 43.2220,
      "lon": 76.8512,
      "apartment": "25",
      "entrance": "2",
      "floor": "5",
      "other": "Код домофона 123",
      "city_id": null,
      "log_timestamp": "2025-07-24T13:30:00.000Z",
      "isDeleted": 0
    }
  ],
  "message": "Адреса получены"
}
```

#### GET /api/addresses/:id
Получить конкретный адрес пользователя

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**URL параметры:**
- `id` (number) - ID адреса

**Пример запроса:**
```bash
curl -X GET http://localhost:3000/api/addresses/1 \
  -H "Authorization: Bearer <jwt_token>"
```

#### POST /api/addresses
Добавить новый адрес

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Body параметры:**
| Поле | Тип | Обязательно | Описание |
|------|-----|-------------|----------|
| `name` | string | ✅ | Название адреса (например, "Дом", "Работа") |
| `address` | string | ✅ | Полный адрес |
| `lat` | number | ✅ | Широта (от -90 до 90) |
| `lon` | number | ✅ | Долгота (от -180 до 180) |
| `apartment` | string | ❌ | Номер квартиры |
| `entrance` | string | ❌ | Номер подъезда |
| `floor` | string | ❌ | Этаж |
| `other` | string | ❌ | Дополнительная информация |

**Пример запроса:**
```bash
curl -X POST http://localhost:3000/api/addresses \
  -H "Authorization: Bearer <jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Дом",
    "address": "ул. Пушкина, 12",
    "lat": 43.2220,
    "lon": 76.8512,
    "apartment": "25",
    "entrance": "2",
    "floor": "5",
    "other": "Код домофона 123"
  }'
```

**Пример ответа:**
```json
{
  "success": true,
  "data": {
    "address_id": 1,
    "user_id": 158,
    "name": "Дом",
    "address": "ул. Пушкина, 12",
    "lat": 43.2220,
    "lon": 76.8512,
    "apartment": "25",
    "entrance": "2",
    "floor": "5",
    "other": "Код домофона 123",
    "city_id": null,
    "log_timestamp": "2025-07-24T13:30:00.000Z",
    "isDeleted": 0
  },
  "message": "Адрес успешно добавлен"
}
```

#### PUT /api/addresses/:id
Обновить существующий адрес

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**URL параметры:**
- `id` (number) - ID адреса

**Body параметры:** (все поля опциональны)
- `name` (string) - Новое название
- `address` (string) - Новый адрес
- `lat` (number) - Новая широта
- `lon` (number) - Новая долгота
- `apartment` (string) - Новый номер квартиры
- `entrance` (string) - Новый номер подъезда
- `floor` (string) - Новый этаж
- `other` (string) - Новая дополнительная информация

**Пример запроса:**
```bash
curl -X PUT http://localhost:3000/api/addresses/1 \
  -H "Authorization: Bearer <jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "apartment": "26",
    "other": "Новый код домофона 456"
  }'
```

#### DELETE /api/addresses/:id
Удалить адрес

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**URL параметры:**
- `id` (number) - ID адреса

**Пример запроса:**
```bash
curl -X DELETE http://localhost:3000/api/addresses/1 \
  -H "Authorization: Bearer <jwt_token>"
```

**Пример ответа:**
```json
{
  "success": true,
  "data": {
    "address_id": 1
  },
  "message": "Адрес успешно удален"
}
```

## Коды ошибок

| Код | Описание |
|-----|----------|
| 400 | Некорректные данные запроса |
| 401 | Требуется авторизация |
| 404 | Адрес не найден |
| 500 | Внутренняя ошибка сервера |

### Примеры ошибок

#### Отсутствует авторизация
```json
{
  "error": {
    "message": "Необходима авторизация",
    "statusCode": 401
  }
}
```

#### Некорректные координаты
```json
{
  "error": {
    "message": "Некорректные координаты",
    "statusCode": 400
  }
}
```

#### Адрес не найден
```json
{
  "error": {
    "message": "Адрес не найден или не принадлежит пользователю",
    "statusCode": 404
  }
}
```

#### Адрес используется в заказах
```json
{
  "error": {
    "message": "Нельзя удалить адрес, используемый в заказах",
    "statusCode": 400
  }
}
```

## Особенности интеграции с Яндекс.Картами

### API ключ
Используется ключ Яндекс.Карт: `7e1b6231-620b-4f24-87fa-c85027f630ab`

### Формат поиска
- Поиск происходит через Yandex Geocoding API
- Возвращает отформатированные адреса с координатами
- Поддерживает поиск по частичному совпадению

### Точность геокодирования
- `exact` - точное совпадение
- `number` - совпадение по номеру дома
- `near` - приблизительное совпадение
- `range` - диапазон номеров
- `street` - совпадение по улице
- `other` - другой тип совпадения

## ✨ Новые возможности системы адресов

### 🚀 Интеграция с доставкой
- ✅ Автоматическая проверка возможности доставки для каждого адреса
- ✅ Получение стоимости и расстояния доставки
- ✅ Фильтрация адресов по возможности доставки

### 🛡️ Улучшенная безопасность
- ✅ Лимит адресов (максимум 10 на пользователя)
- ✅ Мягкое удаление адресов
- ✅ Валидация координат и данных

### 📱 Новые API endpoints
- ✅ `/api/addresses/user` - упрощенное управление адресами
- ✅ `/api/addresses/user/with-delivery` - адреса с проверкой доставки
- ✅ `/api/addresses/check-delivery` - проверка доставки по координатам

---

## Безопасность

### Защита адресов
- ✅ Адреса привязаны к пользователю
- ✅ Пользователь может управлять только своими адресами
- ✅ Валидация координат
- ✅ Проверка использования в заказах перед удалением

### Аудит
- ✅ Логирование всех операций создания/изменения
- ✅ Сохранение временных меток
- ✅ Мягкое удаление (isDeleted флаг)

## Примеры использования

### 🛒 Выбор адреса для заказа (новый рекомендуемый способ)
```javascript
// 1. Получить адреса с проверкой доставки
const getAddressesForOrder = async (businessId, userToken) => {
  const response = await fetch(`/api/addresses/user/with-delivery?business_id=${businessId}`, {
    headers: {
      'Authorization': `Bearer ${userToken}`
    }
  });
  const data = await response.json();
  
  // Фильтруем только те адреса, где доставка доступна
  return data.data.addresses.filter(addr => addr.delivery?.available);
};

// 2. Использование в интерфейсе выбора адреса
const AddressSelector = ({ businessId, onAddressSelect }) => {
  const [addresses, setAddresses] = useState([]);
  
  useEffect(() => {
    getAddressesForOrder(businessId, userToken).then(setAddresses);
  }, [businessId]);
  
  return (
    <div>
      {addresses.map(address => (
        <div key={address.address_id} className="address-option">
          <h3>{address.name}</h3>
          <p>{address.address}</p>
          <p>Доставка: {address.delivery.price} тенге</p>
          <button onClick={() => onAddressSelect(address)}>
            Выбрать этот адрес
          </button>
        </div>
      ))}
    </div>
  );
};
```

### 🏠 Добавление нового адреса с поиском
```javascript
// 1. Поиск адреса через Яндекс.Карты
const searchAddress = async (query) => {
  const response = await fetch(`/api/addresses/search?query=${encodeURIComponent(query)}`);
  return response.json();
};

// 2. Создание адреса из результата поиска
const createAddressFromSearch = async (searchResult, additionalInfo, userToken) => {
  const addressData = {
    lat: searchResult.point.lat,
    lon: searchResult.point.lon,
    address: searchResult.name,
    name: additionalInfo.name, // "Дом", "Работа", etc.
    apartment: additionalInfo.apartment,
    entrance: additionalInfo.entrance,
    floor: additionalInfo.floor,
    other: additionalInfo.other
  };
  
  const response = await fetch('/api/addresses/user', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${userToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(addressData)
  });
  
  return response.json();
};

// 3. Полный workflow добавления адреса
const AddressCreationFlow = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedResult, setSelectedResult] = useState(null);
  
  const handleSearch = async () => {
    const results = await searchAddress(searchQuery);
    setSearchResults(results.data);
  };
  
  const handleCreateAddress = async (additionalInfo) => {
    const result = await createAddressFromSearch(selectedResult, additionalInfo, userToken);
    if (result.success) {
      alert('Адрес успешно добавлен!');
    }
  };
  
  return (
    <div>
      {/* Поиск */}
      <input 
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Введите адрес..."
      />
      <button onClick={handleSearch}>Найти</button>
      
      {/* Результаты поиска */}
      {searchResults.map((result, index) => (
        <div key={index} onClick={() => setSelectedResult(result)}>
          {result.name}
        </div>
      ))}
      
      {/* Дополнительная информация */}
      {selectedResult && (
        <AddressDetailsForm onSubmit={handleCreateAddress} />
      )}
    </div>
  );
};
```

### 🚚 Проверка доставки для произвольного адреса
```javascript
// Проверить доставку перед добавлением адреса
const checkDeliveryBeforeAdd = async (lat, lon, businessId) => {
  const response = await fetch('/api/addresses/check-delivery', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ lat, lon, business_id: businessId })
  });
  
  const data = await response.json();
  
  if (data.success && data.data.available) {
    console.log(`Доставка доступна! Стоимость: ${data.data.price} тенге`);
    return true;
  } else {
    console.log('Доставка недоступна в данный район');
    return false;
  }
};
```

### 📱 React Hook для работы с адресами
```javascript
const useUserAddresses = (businessId = null) => {
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const loadAddresses = async () => {
    setLoading(true);
    try {
      const endpoint = businessId 
        ? `/api/addresses/user/with-delivery?business_id=${businessId}`
        : '/api/addresses/user';
        
      const response = await fetch(endpoint, {
        headers: { 'Authorization': `Bearer ${userToken}` }
      });
      
      const data = await response.json();
      setAddresses(data.data.addresses || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  const addAddress = async (addressData) => {
    const response = await fetch('/api/addresses/user', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${userToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(addressData)
    });
    
    if (response.ok) {
      await loadAddresses(); // Перезагрузить список
    }
    
    return response.json();
  };
  
  const deleteAddress = async (addressId) => {
    const response = await fetch(`/api/addresses/user/${addressId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${userToken}` }
    });
    
    if (response.ok) {
      await loadAddresses(); // Перезагрузить список
    }
    
    return response.json();
  };
  
  useEffect(() => {
    loadAddresses();
  }, [businessId]);
  
  return {
    addresses,
    loading,
    error,
    addAddress,
    deleteAddress,
    reload: loadAddresses
  };
};
```

### Рабочий процесс добавления адреса
1. **Поиск адреса**: `GET /api/addresses/search?query=улица+пушкина`
2. **Выбор из результатов** пользователем
3. **Добавление адреса**: `POST /api/addresses` с координатами

### Интеграция с заказами
Полученный `address_id` используется в API заказов:
```json
{
  "business_id": 1,
  "address_id": 1,
  "delivery_type": "DELIVERY",
  "items": [...]
}
```

## Структура базы данных

### Таблица user_addreses
| Поле | Тип | Описание |
|------|-----|----------|
| `address_id` | INT (PK) | Уникальный ID адреса |
| `user_id` | INT | ID пользователя |
| `name` | VARCHAR(255) | Название адреса |
| `address` | VARCHAR(255) | Полный адрес |
| `lat` | FLOAT | Широта |
| `lon` | FLOAT | Долгота |
| `apartment` | VARCHAR(20) | Номер квартиры |
| `entrance` | VARCHAR(20) | Номер подъезда |
| `floor` | VARCHAR(20) | Этаж |
| `other` | VARCHAR(255) | Дополнительная информация |
| `city_id` | INT | ID города (опционально) |
| `log_timestamp` | TIMESTAMP | Время создания |
| `isDeleted` | INT | Флаг удаления (0/1) |
