<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

# Copilot Instructions для Naliv Backend

## Общие принципы
- Используйте TypeScript для всех файлов
- Следуйте принципам REST API
- Используйте async/await вместо Promise.then()
- Всегда добавляйте обработку ошибок
- Используйте интерфейсы TypeScript для типизации данных

## Структура проекта
- `src/` - исходный код
- `src/routes/` - маршруты API
- `src/controllers/` - контроллеры (бизнес-логика)
- `src/middleware/` - middleware функции
- `src/types/` - TypeScript интерфейсы и типы
- `dist/` - скомпилированный код

## Стандарты кодирования
- Используйте PascalCase для классов и интерфейсов
- Используйте camelCase для переменных и функций
- Используйте UPPER_SNAKE_CASE для констант
- Добавляйте JSDoc комментарии для публичных методов
- Используйте строгую типизацию TypeScript

## API Response Format
Всегда возвращайте ответы в формате:
```json
{
  "success": boolean,
  "data": any,
  "message"?: string,
  "error"?: {
    "message": string,
    "statusCode": number,
    "timestamp": string
  }
}
```

## Обработка ошибок
- Используйте middleware errorHandler
- Создавайте кастомные ошибки через функцию createError
- Логируйте все ошибки с контекстом
- Не раскрывайте внутренние детали в production

## Безопасность
- Используйте helmet для базовой защиты
- Валидируйте все входящие данные
- Используйте CORS правильно
- Никогда не коммитьте секреты в код
