# 🔄 Обновление: Использование order_status вместо current_status

## Изменения в BusinessController

### ✅ Что изменилось

Теперь оба метода отчетов по курьерам используют **последнюю запись из таблицы `order_status`** вместо поля `current_status` из таблицы `orders`.

### 📋 Затронутые методы

#### 1. `getCouriersDeliveryReport()`
- **Эндпоинт:** `GET /api/business/couriers/delivery-report`
- **Изменение:** Добавлен подзапрос для получения последнего статуса из `order_status`

#### 2. `getCourierDetailedReport()`
- **Эндпоинт:** `GET /api/business/couriers/:courierId/detailed-report`  
- **Изменение:** Аналогично обновлен для использования `order_status`

### 🔧 Техническая реализация

#### Новый SQL подзапрос:
```sql
LEFT JOIN (
  SELECT 
    order_id, 
    status,
    ROW_NUMBER() OVER (PARTITION BY order_id ORDER BY log_timestamp DESC) as rn
  FROM order_status
) os ON o.order_id = os.order_id AND os.rn = 1
WHERE os.status = 4
```

#### Принцип работы:
1. **ROW_NUMBER()** - нумерует записи статусов для каждого заказа
2. **ORDER BY log_timestamp DESC** - сортирует по времени (новые сначала)
3. **rn = 1** - выбирает только последнюю (самую новую) запись статуса
4. **os.status = 4** - фильтрует только доставленные заказы

### 🎯 Преимущества

1. **Точность**: Получаем реальный последний статус из истории
2. **Надежность**: Не зависим от синхронизации поля `current_status`
3. **Гибкость**: Легко адаптировать для других статусов
4. **Производительность**: Эффективный SQL с оконными функциями

### 📊 Примеры использования

#### Отчет по всем курьерам:
```bash
curl -X GET "http://localhost:3000/api/business/couriers/delivery-report" \
  -H "Authorization: Bearer business_token" \
  -G \
  -d "start_date=2024-01-01" \
  -d "end_date=2024-01-31"
```

#### Детальный отчет по курьеру:
```bash
curl -X GET "http://localhost:3000/api/business/couriers/123/detailed-report" \
  -H "Authorization: Bearer business_token" \
  -G \
  -d "start_date=2024-01-01 00:00:00" \
  -d "end_date=2024-01-31 23:59:59"
```

### 🚀 Обратная совместимость

- ✅ API остается прежним
- ✅ Формат ответа не изменился  
- ✅ Параметры запроса остались те же
- ✅ Поддержка различных форматов дат сохранена

### 📝 Обновленная документация

- ✅ Комментарии в коде обновлены
- ✅ HTML тестовый интерфейс обновлен
- ✅ Создана техническая документация

### 🧪 Тестирование

Используйте файл `test-courier-reports.html` для тестирования обновленного функционала с новой логикой определения статусов.

---

**Дата обновления:** 12 августа 2025  
**Статус:** ✅ Готово к использованию
