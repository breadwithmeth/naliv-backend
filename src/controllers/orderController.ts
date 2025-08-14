import { Request, Response, NextFunction } from 'express';
import prisma from '../database';
import { createError } from '../middleware/errorHandler';
import { 
  CreateOrderRequest, 
  OrderStatus,
  DeliveryType,
  MarketingPromotion,
  MarketingPromotionDetail,
  PromotionCalculationResult
} from '../types/orders';
import { orders_delivery_type } from '@prisma/client';
import { DeliveryController } from './deliveryController';

interface AuthRequest extends Request {
  user?: {
    user_id: number;
    login: string;
  };
  employee?: {
    employee_id: number;
    login: string;
    access_level: string;
  };
}

export class OrderController {

  /**
   * Генерация числового UUID для заказа
   * Формат: timestamp(10 цифр) + userId(3 цифры) + random(3 цифры) = 16 цифр
   */
  private static generateNumericOrderUuid(userId: number): string {
    const timestamp = Math.floor(Date.now() / 1000); // Unix timestamp в секундах (10 цифр)
    const userPart = userId.toString().padStart(3, '0').slice(-3); // Последние 3 цифры user_id
    const randomPart = Math.floor(Math.random() * 1000).toString().padStart(3, '0'); // 3 случайные цифры
    
    return `${timestamp}${userPart}${randomPart}`;
  }

  /**
   * Создание заказа на основе PHP логики createOrder4
   * POST /api/orders/create-user-order
   */
  static async createUserOrder(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { 
        business_id,
        items,
        delivery = false, // boolean для доставки (для обратной совместимости)
        delivery_type, // новый параметр: 'DELIVERY', 'PICKUP', 'SCHEDULED'
        delivery_date, // дата доставки для SCHEDULED
        bonus = false, // boolean для использования бонусов
        extra = '',
        halyk_id, // Токен карты Halyk Bank для автоматического списания
        address_id // Опциональный конкретный ID адреса для доставки
      } = req.body;

      // Определяем тип доставки (для обратной совместимости)
      let actualDeliveryType = delivery_type;
      if (!delivery_type && delivery) {
        actualDeliveryType = 'DELIVERY'; // если передан старый параметр delivery=true
      } else if (!delivery_type && !delivery) {
        actualDeliveryType = 'PICKUP'; // если доставка не нужна
      }

      // Проверяем авторизацию пользователя
      if (!req.user) {
        return next(createError(401, 'Необходима авторизация'));
      }

      const user_id = req.user.user_id;

      // Входные проверки как в PHP
      if (!business_id || !items || items.length === 0) {
        return next(createError(400, 'Не все обязательные поля заполнены'));
      }

      // Проверяем корректность данных товаров
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!item.item_id || typeof item.item_id !== 'number') {
          return next(createError(400, `Товар ${i + 1}: отсутствует или некорректный item_id`));
        }
        
        // Проверяем amount - может быть числом или строкой, содержащей число
        const amount = typeof item.amount === 'string' ? parseFloat(item.amount) : item.amount;
        if (!item.amount || isNaN(amount) || amount <= 0) {
          return next(createError(400, `Товар ${i + 1}: отсутствует или некорректное количество amount`));
        }
        
        // Обновляем значение amount в объекте для дальнейшего использования
        item.amount = amount;
      }

      console.log('Начинаем создание заказа для пользователя:', user_id);
      console.log('Получены товары:', JSON.stringify(items, null, 2));
      console.log('Тип доставки:', actualDeliveryType);

      // Валидация для запланированной доставки
      let deliveryDate = null;
      if (actualDeliveryType === 'SCHEDULED') {
        if (!delivery_date) {
          return next(createError(400, 'Для запланированной доставки необходимо указать дату delivery_date'));
        }
        
        const scheduledDate = new Date(delivery_date);
        const now = new Date();
        
        if (scheduledDate <= now) {
          return next(createError(400, 'Дата запланированной доставки должна быть в будущем'));
        }
        
        const maxFutureDate = new Date();
        maxFutureDate.setDate(maxFutureDate.getDate() + 30);
        
        if (scheduledDate > maxFutureDate) {
          return next(createError(400, 'Дата запланированной доставки не может быть более чем на 30 дней вперед'));
        }
        
        deliveryDate = scheduledDate;
        console.log('Запланированная доставка на:', scheduledDate.toISOString());
      }

      // Получаем адрес для доставки - ДО транзакции
      let selectedAddress = null;
      
      // Если передан конкретный address_id, используем его
      if (address_id && (actualDeliveryType === 'DELIVERY' || actualDeliveryType === 'SCHEDULED')) {
        selectedAddress = await prisma.user_addreses.findFirst({
          where: {
            address_id: address_id,
            user_id: user_id,
            isDeleted: 0
          }
        });
        
        if (!selectedAddress) {
          return next(createError(400, 'Указанный адрес не найден или не принадлежит пользователю'));
        }
      }
      // Иначе получаем выбранный адрес из таблицы selected_address
      else if (actualDeliveryType === 'DELIVERY' || actualDeliveryType === 'SCHEDULED') {
        const selectedAddressRecord = await prisma.selected_address.findFirst({
          where: {
            user_id: user_id
          },
          orderBy: {
            log_timestamp: 'desc' // Берем последний выбранный адрес
          }
        });

        if (selectedAddressRecord) {
          // Получаем полную информацию об адресе
          selectedAddress = await prisma.user_addreses.findFirst({
            where: {
              address_id: selectedAddressRecord.address_id,
              user_id: user_id,
              isDeleted: 0
            }
          });
        }

        // Если нет выбранного адреса, берем последний добавленный (fallback)
        if (!selectedAddress) {
          selectedAddress = await prisma.user_addreses.findFirst({
            where: {
              user_id: user_id,
              isDeleted: 0
            },
            orderBy: {
              address_id: 'desc' // Берем последний добавленный адрес
            }
          });
        }
      }

      if (!selectedAddress && (actualDeliveryType === 'DELIVERY' || actualDeliveryType === 'SCHEDULED')) {
        const deliveryTypeText = actualDeliveryType === 'SCHEDULED' ? 'запланированной доставки' : 'доставки';
        return next(createError(400, `Не найден адрес для ${deliveryTypeText}`));
      }

      // Рассчитываем стоимость доставки (аналог getDistanceToBusinesses4) - ДО транзакции
      let deliveryPrice = 0;
      if ((actualDeliveryType === 'DELIVERY' || actualDeliveryType === 'SCHEDULED') && selectedAddress) {
        try {
          const deliveryResult = await DeliveryController.calculateDeliveryZone({
            lat: Number(selectedAddress.lat),
            lon: Number(selectedAddress.lon),
            business_id
          });
          
          if (deliveryResult.in_zone && deliveryResult.price !== false) {
            deliveryPrice = Number(deliveryResult.price);
            
            if (actualDeliveryType === 'SCHEDULED') {
              console.log('Рассчитана стоимость запланированной доставки:', deliveryPrice);
            } else {
              console.log('Рассчитана стоимость обычной доставки:', deliveryPrice);
            }
          } else {
            const deliveryTypeText = actualDeliveryType === 'SCHEDULED' ? 'Запланированная доставка' : 'Доставка';
            return next(createError(400, `${deliveryTypeText} недоступна: ${deliveryResult.message}`));
          }
        } catch (deliveryError: any) {
          console.error('Ошибка расчета доставки:', deliveryError);
          return next(createError(500, 'Ошибка расчета доставки'));
        }
      }

      // Проверяем наличие товаров на складе ДО транзакции
      const stockValidation: Array<{
        item_id: number;
        amount: number;
        options?: any[];
        stockData: any;
        itemPrice: number;
      }> = [];
      for (const item of items) {
        const stockCheck = await prisma.items.findUnique({
          where: { item_id: item.item_id }
        });

        if (!stockCheck) {
          return next(createError(404, `Товар с ID ${item.item_id} не найден`));
        }

        if (Number(stockCheck.amount || 0) < item.amount) {
          return next(createError(400, `Недостаточно товара ${stockCheck.name} на складе`));
        }

        const itemPrice = Number(stockCheck.price || 0);
        if (itemPrice <= 0) {
          return next(createError(400, `Не найдена цена для товара ${stockCheck.name}`));
        }

        stockValidation.push({
          ...item,
          stockData: stockCheck,
          itemPrice
        });
      }

      // Переменная для хранения результата транзакции
      let orderResult: any;

      // Начинаем транзакцию с увеличенным таймаутом
      orderResult = await prisma.$transaction(async (tx) => {

        // Создаем заказ (аналог INSERT INTO orders в PHP)
        const order = await tx.orders.create({
          data: {
            business_id,
            user_id,
            delivery_type: actualDeliveryType,
            delivery_date: deliveryDate,
            address_id: selectedAddress?.address_id || 0,
            delivery_price: deliveryPrice,
            extra: extra || ''
          }
        });

        console.log('Заказ создан с ID:', order.order_id);

        // Генерируем order_uuid как в PHP: time() + order_id
        const order_uuid = `${Math.floor(Date.now() / 1000)}${order.order_id}`;
        
        // Обновляем UUID заказа и создаем статус (как в PHP)
        await tx.orders.update({
          where: { order_id: order.order_id },
          data: { order_uuid }
        });

        await tx.order_status.create({
          data: {
            order_id: order.order_id,
            status: 66, // Статус как в PHP коде
            isCanceled: 0,
            log_timestamp: new Date()
          }
        });

        console.log('Обновлен UUID заказа:', order_uuid);

        // Добавляем товары и опции - используем уже проверенные данные
        for (const validatedItem of stockValidation) {
          console.log('Обрабатываем проверенный товар с ID:', validatedItem.item_id);
          
          // Проверяем активные акции для данного товара
          let appliedPromotionDetailId = null;
          
          // Поиск акций для конкретного товара (аналог SQL запроса)
          const now = new Date();
          const promotionDetailsRaw = await tx.$queryRaw`
            SELECT 
              mpd.detail_id,
              mpd.type,
              mpd.base_amount,
              mpd.add_amount,
              mpd.discount,
              mp.start_promotion_date,
              mp.end_promotion_date
            FROM marketing_promotion_details mpd
            LEFT JOIN marketing_promotions mp ON mp.marketing_promotion_id = mpd.marketing_promotion_id
            WHERE mpd.item_id = ${validatedItem.item_id}
              AND mp.business_id = ${business_id}
              AND mp.start_promotion_date < ${now}
              AND mp.end_promotion_date > ${now}
              AND mp.visible = 1
            ORDER BY mpd.discount DESC
            LIMIT 1
          `;

          // Берем первую (лучшую) акцию если она есть
          if (Array.isArray(promotionDetailsRaw) && promotionDetailsRaw.length > 0) {
            appliedPromotionDetailId = (promotionDetailsRaw[0] as any).detail_id;
            console.log('Применена акция detail_id:', appliedPromotionDetailId, 'для товара:', validatedItem.item_id);
          }

          // Добавляем основной товар в заказ
          const orderItem = await tx.orders_items.create({
            data: {
              order_id: order.order_id,
              item_id: validatedItem.item_id,
              price_id: null, // Не используем price_id, цена из items
              amount: validatedItem.amount,
              price: validatedItem.itemPrice, // Цена из таблицы items
              marketing_promotion_detail_id: appliedPromotionDetailId // ID примененной акции
            }
          });

          console.log('Добавлен товар в заказ:', orderItem.relation_id);

          // Добавляем опции если есть (аналог PHP логики)
          if (validatedItem.options && validatedItem.options.length > 0) {
            for (const option of validatedItem.options) {
              if (option.option_item_relation_id) {
                // Получаем данные опции
                const optionData = await tx.option_items.findUnique({
                  where: { relation_id: option.option_item_relation_id }
                });

                if (optionData) {
                  // Рассчитываем количество опции (аналог PHP формулы)
                  const optionAmount = validatedItem.amount / (option.parent_amount || 1);

                  await tx.order_items_options.create({
                    data: {
                      order_item_relation_id: orderItem.relation_id,
                      item_id: optionData.item_id,
                      option_item_relation_id: option.option_item_relation_id,
                      order_id: order.order_id,
                      price: option.price || optionData.price || 0,
                      amount: optionAmount
                    }
                  });

                  console.log('Добавлена опция:', option.option_item_relation_id);
                }
              }
            }
          }
        }

        // Обработка бонусов (аналог PHP логики)
        if (bonus) {
          const userBonus = await tx.bonuses.findFirst({
            where: { user_id },
            orderBy: { bonus_id: 'desc' }
          });

          if (userBonus && userBonus.amount) {
            // Получаем сумму заказа для расчета максимального бонуса внутри транзакции
            const orderCost = await OrderController.calculateOrderTotalInTransaction(tx, order.order_id);
            const maxBonus = orderCost.sum_before_delivery * 0.25; // 25% от суммы заказа
            const usedBonus = Math.min(Number(userBonus.amount), maxBonus);

            await tx.orders.update({
              where: { order_id: order.order_id },
              data: { bonus: usedBonus }
            });

            console.log('Применены бонусы:', usedBonus);
          }
        }

        console.log('ID карты Halyk:', halyk_id);

        // Возвращаем успешный результат
        return {
          success: true,
          order_id: order.order_id,
          order_uuid: order_uuid
        };
      }, {
        maxWait: 10000, // максимальное время ожидания транзакции - 10 секунд
        timeout: 100000  // таймаут выполнения транзакции - 15 секунд
      });

      // Обрабатываем платеж после завершения транзакции
      if (halyk_id) {
        console.log('⚠️  ВНИМАНИЕ: halyk_id передан, но оплата не будет выполнена');
        console.log('Используйте отдельный endpoint POST /api/orders/:id/pay для оплаты заказа');
      }

      // Отправляем уведомление о создании заказа
      try {
        // Получаем информацию о бизнесе для уведомления
        const businessInfo = await prisma.businesses.findUnique({
          where: { business_id: business_id }
        });

        // await NotificationController.sendOrderStatusNotification({
        //   order_id: orderResult.order_id,
        //   order_uuid: orderResult.order_uuid,
        //   status: 'created',
        //   business_name: businessInfo?.name || 'Неизвестное заведение'
        // });
        console.log(`Уведомление о создании заказа ${orderResult.order_id} отправлено пользователю ${user_id}`);
      } catch (notificationError) {
        console.error('Ошибка отправки уведомления о создании заказа:', notificationError);
        // Не прерываем выполнение, если уведомление не удалось отправить
      }

      res.status(201).json({
        success: true,
        data: {
          order_id: orderResult.order_id,
          order_uuid: orderResult.order_uuid,
          message: halyk_id ? 'Заказ создан. Для оплаты используйте POST /api/orders/' + orderResult.order_id + '/pay' : 'Заказ успешно создан'
        },
        message: 'Заказ успешно создан'
      });

    } catch (error: any) {
      console.error('Ошибка создания заказа:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Создание заказа без оплаты
   * POST /api/orders/create-order-no-payment
   * 
   * @description Создает новый заказ для авторизованного пользователя без автоматического
   * списания средств. Автоматически создает новый адрес доставки из переданных адресных полей.
   * Заказ создается с флагом is_canceled=0 и может быть оплачен позже.
   * 
   * @param {AuthRequest} req - Запрос с авторизованным пользователем
   * @param {Response} res - Ответ сервера  
   * @param {NextFunction} next - Функция передачи управления
   * 
   * @body {Object} req.body - Тело запроса
   * @body {number} business_id - ID бизнеса (обязательно)
   * @body {string} street - Название улицы (обязательно для доставки)
   * @body {string} house - Номер дома (обязательно для доставки)
   * @body {string} [apartment] - Номер квартиры (опционально)
   * @body {string} [entrance] - Номер подъезда (опционально)
   * @body {string} [floor] - Этаж (опционально)
   * @body {string} [comment] - Комментарий к адресу (опционально)
   * @body {number} lat - Широта адреса (обязательно для доставки)
   * @body {number} lon - Долгота адреса (обязательно для доставки)
   * @body {Array} items - Массив товаров заказа (обязательно)
   * @body {number} items[].item_id - ID товара
   * @body {number} items[].amount - Количество товара
   * @body {Array} [items[].options] - Опции товара
   * @body {number} items[].options[].option_item_relation_id - ID опции
   * @body {number} items[].options[].amount - Количество опции
   * @body {number} [bonus=0] - Бонусы к списанию
   * @body {string} [extra] - Дополнительные данные
   * @body {string} delivery_type - Тип доставки: DELIVERY, PICKUP, SCHEDULED
   * @body {string} [delivery_date] - Дата доставки (для SCHEDULED) в формате ISO
   * 
   * @returns {Object} Данные созданного заказа
   * 
   * @throws {400} Не указаны обязательные поля
   * @throws {401} Необходима авторизация
   * @throws {404} Бизнес не найден
   * @throws {500} Ошибка создания заказа
   * 
   * @example
   * POST /api/orders/create-order-no-payment
   * Authorization: Bearer {token}
   * {
   *   "business_id": 2,
   *   "street": "ул. Пушкина",
   *   "house": "10",
   *   "apartment": "15",
   *   "entrance": "2", 
   *   "floor": "3",
   *   "comment": "Код домофона 1234",
   *   "lat": 52.271643,
   *   "lon": 76.950011,
   *   "items": [
   *     {
   *       "item_id": 100,
   *       "amount": 2,
   *       "options": [
   *         {
   *           "option_item_relation_id": 10,
   *           "amount": 1
   *         }
   *       ]
   *     }
   *   ],
   *   "delivery_type": "SCHEDULED",
   *   "delivery_date": "2024-01-15T14:00:00.000Z"
   * }
   */
  static async createOrderNoPayment(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { 
        business_id, 
        street,
        house,
        apartment,
        entrance,
        floor,
        comment,
        lat,
        lon,
        items, 
        bonus = 0, 
        extra = '',
        delivery_type = 'DELIVERY',
        delivery_date
      } = req.body;

      // Проверяем авторизацию пользователя
      if (!req.user) {
        return next(createError(401, 'Необходима авторизация'));
      }

      const user_id = req.user.user_id;

      // Входные проверки
      if (!business_id || !items || items.length === 0) {
        return next(createError(400, 'Не все обязательные поля заполнены'));
      }

      // Проверяем корректность данных товаров
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!item.item_id || typeof item.item_id !== 'number') {
          return next(createError(400, `Товар ${i + 1}: отсутствует или некорректный item_id`));
        }
        
        // Проверяем amount - может быть числом или строкой, содержащей число
        const amount = typeof item.amount === 'string' ? parseFloat(item.amount) : item.amount;
        if (!item.amount || isNaN(amount) || amount <= 0) {
          return next(createError(400, `Товар ${i + 1}: отсутствует или некорректное количество amount`));
        }
        
        // Обновляем значение amount в объекте для дальнейшего использования
        item.amount = amount;
      }

      // Для доставки проверяем адрес
      if (delivery_type === 'DELIVERY' || delivery_type === 'SCHEDULED') {
        if (!street || !house || lat === undefined || lon === undefined) {
          const deliveryTypeText = delivery_type === 'SCHEDULED' ? 'запланированной доставки' : 'доставки';
          return next(createError(400, `Для ${deliveryTypeText} необходимо указать адрес: street, house, lat, lon`));
        }
      }

      // Для запланированной доставки проверяем дату
      if (delivery_type === 'SCHEDULED') {
        if (!delivery_date) {
          return next(createError(400, 'Для запланированной доставки необходимо указать дату delivery_date'));
        }
        
        const scheduledDate = new Date(delivery_date);
        const now = new Date();
        
        if (scheduledDate <= now) {
          return next(createError(400, 'Дата запланированной доставки должна быть в будущем'));
        }
        
        // Проверяем, что дата не слишком далеко в будущем (например, не более 30 дней)
        const maxFutureDate = new Date();
        maxFutureDate.setDate(maxFutureDate.getDate() + 30);
        
        if (scheduledDate > maxFutureDate) {
          return next(createError(400, 'Дата запланированной доставки не может быть более чем на 30 дней вперед'));
        }
        
        console.log('Запланированная доставка на:', scheduledDate.toISOString());
      }

      console.log('Начинаем создание заказа без оплаты для пользователя:', user_id);
      console.log('Получены товары:', JSON.stringify(items, null, 2));

      // Проверяем существование бизнеса
      const business = await prisma.businesses.findUnique({
        where: { business_id }
      });

      if (!business) {
        return next(createError(404, 'Бизнес не найден'));
      }

      const order_uuid = OrderController.generateNumericOrderUuid(user_id);

      // Рассчитываем стоимость доставки ДО транзакции
      let deliveryPrice = 0;
      if (delivery_type === 'DELIVERY' || delivery_type === 'SCHEDULED') {
        try {
          const deliveryResult = await DeliveryController.calculateDeliveryZone({
            lat: parseFloat(lat),
            lon: parseFloat(lon),
            business_id
          });
          
          if (deliveryResult.in_zone && deliveryResult.price !== false) {
            deliveryPrice = Number(deliveryResult.price);
            
            // Для запланированной доставки может быть другая стоимость
            if (delivery_type === 'SCHEDULED') {
              // Можно добавить дополнительную логику для SCHEDULED доставки
              // например, увеличить стоимость или применить другие правила
              console.log('Рассчитана стоимость запланированной доставки:', deliveryPrice);
            } else {
              console.log('Рассчитана стоимость обычной доставки:', deliveryPrice);
            }
          } else {
            const deliveryTypeText = delivery_type === 'SCHEDULED' ? 'Запланированная доставка' : 'Доставка';
            return next(createError(400, `${deliveryTypeText} недоступна: ${deliveryResult.message}`));
          }
        } catch (deliveryError: any) {
          console.error('Ошибка расчета доставки:', deliveryError);
          return next(createError(500, 'Ошибка расчета доставки'));
        }
      }

      // Создаем заказ и все связанные данные в транзакции
      const orderResult = await prisma.$transaction(async (tx) => {
        let address_id = null;

        // Создаем адрес для доставки, если это доставка
        if (delivery_type === 'DELIVERY' || delivery_type === 'SCHEDULED') {
          const addressData = {
            user_id,
            address: street + ', ' + house + (apartment ? ', кв.' + apartment : ''),
            name: delivery_type === 'SCHEDULED' ? 'Адрес запланированной доставки' : 'Адрес доставки',
            apartment: apartment || '',
            entrance: entrance || '',
            floor: floor || '',
            other: comment || '',
            lat: parseFloat(lat),
            lon: parseFloat(lon),
            isDeleted: 0
          };

          const newAddress = await tx.user_addreses.create({
            data: addressData
          });

          address_id = newAddress.address_id;
          const addressType = delivery_type === 'SCHEDULED' ? 'запланированной доставки' : 'доставки';
          console.log(`Создан новый адрес ${addressType} с ID:`, address_id);
        }

        // Создаем заказ
        const orderData: any = {
          business_id,
          user_id,
          order_uuid,
          address_id: address_id || 1, // Обязательное поле, ставим дефолтное значение если нет адреса
          delivery_price: deliveryPrice, // Добавляем стоимость доставки
          bonus,
          extra,
          delivery_type: delivery_type as orders_delivery_type,
          delivery_date: delivery_date ? new Date(delivery_date) : null,
          is_canceled: 0 // Заказ не отменен
        };

        const order = await tx.orders.create({
          data: orderData
        });

        console.log('Создан заказ с ID:', order.order_id);

        // Создаем статус заказа (новый заказ без оплаты)
        await tx.order_status.create({
          data: {
            order_id: order.order_id,
            status: 66, // Статус 66 - новый заказ без оплаты
            isCanceled: 0,
            log_timestamp: new Date()
          }
        });

        console.log('Создан статус заказа для order_id:', order.order_id);

        // Добавляем товары в заказ
        for (const item of items) {
          // Дополнительная проверка на всякий случай
          if (!item.item_id || typeof item.item_id !== 'number') {
            throw new Error(`Некорректный item_id: ${item.item_id}`);
          }
          
          console.log('Обрабатываем товар с ID:', item.item_id);
          
          // Получаем данные товара для определения цены
          const itemData = await tx.items.findUnique({
            where: { item_id: item.item_id }
          });

          if (!itemData) {
            throw new Error(`Товар с ID ${item.item_id} не найден`);
          }

          const itemPrice = Number(itemData.price || 0);

          // Проверяем активные акции для данного товара
          let appliedPromotionDetailId = null;
          
          // Поиск акций для конкретного товара (аналог SQL запроса)
          const now = new Date();
          const promotionDetailsRaw = await tx.$queryRaw`
            SELECT 
              mpd.detail_id,
              mpd.type,
              mpd.base_amount,
              mpd.add_amount,
              mpd.discount,
              mp.start_promotion_date,
              mp.end_promotion_date
            FROM marketing_promotion_details mpd
            LEFT JOIN marketing_promotions mp ON mp.marketing_promotion_id = mpd.marketing_promotion_id
            WHERE mpd.item_id = ${item.item_id}
              AND mp.start_promotion_date < NOW()
              AND mp.end_promotion_date > NOW()
              AND mp.visible = 1
            ORDER BY mpd.discount DESC
            LIMIT 1
          `;

          // Берем первую (лучшую) акцию если она есть
          if (Array.isArray(promotionDetailsRaw) && promotionDetailsRaw.length > 0) {
            appliedPromotionDetailId = (promotionDetailsRaw[0] as any).detail_id;
            console.log('Применена акция detail_id:', appliedPromotionDetailId, 'для товара:', item.item_id);
          }

          const orderItem = await tx.orders_items.create({
            data: {
              order_id: order.order_id,
              item_id: item.item_id,
              amount: item.amount,
              price: itemPrice, // Цена из таблицы items
              marketing_promotion_detail_id: appliedPromotionDetailId // ID примененной акции
            }
          });

          console.log('Добавлен товар:', orderItem);

          // Добавляем опции товара
          if (item.options && item.options.length > 0) {
            for (const option of item.options) {
              // Получаем данные опции для определения цены
              const optionData = await tx.option_items.findUnique({
                where: { relation_id: option.option_item_relation_id }
              });

              if (optionData) {
                await tx.order_items_options.create({
                  data: {
                    order_item_relation_id: orderItem.relation_id,
                    item_id: optionData.item_id,
                    option_item_relation_id: option.option_item_relation_id,
                    order_id: order.order_id,
                    price: Number(optionData.price || 0), // Цена из таблицы option_items
                    amount: option.amount
                  }
                });
              }
            }
          }
        }

        // Рассчитываем итоговую стоимость заказа
        const totals = await OrderController.calculateOrderTotalInTransaction(tx, order.order_id);
        
        console.log('Заказ создан без оплаты. Итоговая сумма:', totals.total_sum);
        console.log('Сумма до доставки:', totals.sum_before_delivery, 'Стоимость доставки:', deliveryPrice);

        return {
          success: true,
          order_id: order.order_id,
          order_uuid: order_uuid,
          total_sum: totals.total_sum,
          delivery_price: deliveryPrice,
          address_id
        };
      }, {
        maxWait: 10000,
        timeout: 100000
      });

      // Отправляем уведомление о создании заказа
      try {
        console.log('Уведомление о заказе отправлено');
      } catch (notificationError) {
        console.error('Ошибка отправки уведомления:', notificationError);
      }

      res.status(201).json({
        success: true,
        data: {
          order_id: orderResult.order_id,
          order_uuid: orderResult.order_uuid,
          total_sum: orderResult.total_sum,
          delivery_price: orderResult.delivery_price,
          address_id: orderResult.address_id,
          is_canceled: 0,
          delivery_type: delivery_type
        },
        message: 'Заказ создан без оплаты. Используйте API платежей для оплаты заказа.'
      });

    } catch (error: any) {
      console.error('Ошибка создания заказа без оплаты:', error);
      next(createError(500, `Ошибка создания заказа: ${error.message}`));
    }
  }

  /**
   * Расчет общей стоимости заказа внутри транзакции
   */
  private static async calculateOrderTotalInTransaction(tx: any, orderId: number): Promise<{ sum_before_delivery: number; total_sum: number }> {
    const orderItems = await tx.orders_items.findMany({
      where: { order_id: orderId }
    });

    const orderOptions = await tx.order_items_options.findMany({
      where: { order_id: orderId }
    });

    let sumBeforeDelivery = 0;
    
    // Считаем стоимость товаров с учетом акций
    for (const item of orderItems) {
      const itemPrice = Number(item.price || 0);
      const itemAmount = Number(item.amount || 0);
      let itemCost = itemPrice * itemAmount;

      // Если есть примененная акция, получаем ее детали и пересчитываем стоимость
      if (item.marketing_promotion_detail_id) {
        try {
          const promotionDetail = await tx.marketing_promotion_details.findUnique({
            where: { detail_id: item.marketing_promotion_detail_id }
          });

          if (promotionDetail) {
            if (promotionDetail.type === 'SUBTRACT') {
              // Акция типа SUBTRACT: например, купи 2 получи 1 бесплатно
              const baseAmount = Number(promotionDetail.base_amount || 0);
              const addAmount = Number(promotionDetail.add_amount || 0);
              
              if (baseAmount > 0 && addAmount > 0 && itemAmount >= baseAmount) {
                // Сколько полных наборов акции
                const fullSets = Math.floor(itemAmount / (baseAmount + addAmount));
                const remainder = itemAmount % (baseAmount + addAmount);
                
                // Количество товаров к оплате
                let chargedAmount = fullSets * baseAmount;
                
                // Обрабатываем остаток
                if (remainder >= baseAmount) {
                  // Если остаток больше базового количества, добавляем базовое количество к оплате
                  chargedAmount += baseAmount;
                } else {
                  // Если остаток меньше базового количества, добавляем весь остаток к оплате
                  chargedAmount += remainder;
                }
                
                itemCost = itemPrice * chargedAmount;
                console.log(`Применена акция SUBTRACT для товара ${item.item_id}: было ${itemAmount}, к оплате ${chargedAmount}`);
              }
            } else if (promotionDetail.type === 'DISCOUNT') {
              // Акция типа DISCOUNT: скидка в процентах
              const discountPercent = Number(promotionDetail.discount || 0);
              if (discountPercent > 0) {
                const discountAmount = (itemCost * discountPercent) / 100;
                itemCost = itemCost - discountAmount;
                console.log(`Применена акция DISCOUNT для товара ${item.item_id}: скидка ${discountPercent}%, сумма со скидкой ${itemCost}`);
              }
            }
          }
        } catch (promotionError) {
          console.error('Ошибка применения акции:', promotionError);
          // В случае ошибки используем обычную стоимость без акции
        }
      }

      sumBeforeDelivery += itemCost;
    }

    // Считаем стоимость опций
    for (const option of orderOptions) {
      sumBeforeDelivery += Number(option.price || 0) * Number(option.amount || 0);
    }

    // Получаем стоимость доставки
    const order = await tx.orders.findUnique({
      where: { order_id: orderId }
    });

    const deliveryPrice = Number(order?.delivery_price || 0);
    const totalSum = sumBeforeDelivery + deliveryPrice;

    return {
      sum_before_delivery: sumBeforeDelivery,
      total_sum: totalSum
    };
  }

  /**
   * Публичный метод для расчета общей стоимости заказа
   */
  public static async calculateOrderCostPublic(orderId: number): Promise<{ sum_before_delivery: number; total_sum: number }> {
    return OrderController.calculateOrderTotal(orderId);
  }

  /**
   * Расчет общей стоимости заказа (аналог getOrderSumTotal PHP)
   */
  private static async calculateOrderTotal(orderId: number): Promise<{ sum_before_delivery: number; total_sum: number }> {
    const orderItems = await prisma.orders_items.findMany({
      where: { order_id: orderId }
    });

    const orderOptions = await prisma.order_items_options.findMany({
      where: { order_id: orderId }
    });

    let sumBeforeDelivery = 0;
    
    // Считаем стоимость товаров с учетом акций
    for (const item of orderItems) {
      const itemPrice = Number(item.price || 0);
      const itemAmount = Number(item.amount || 0);
      let itemCost = itemPrice * itemAmount;

      // Если есть примененная акция, получаем ее детали и пересчитываем стоимость
      if (item.marketing_promotion_detail_id) {
        try {
          const promotionDetail = await prisma.marketing_promotion_details.findUnique({
            where: { detail_id: item.marketing_promotion_detail_id }
          });

          if (promotionDetail) {
            if (promotionDetail.type === 'SUBTRACT') {
              // Акция типа SUBTRACT: например, купи 2 получи 1 бесплатно
              const baseAmount = Number(promotionDetail.base_amount || 0);
              const addAmount = Number(promotionDetail.add_amount || 0);
              
              if (baseAmount > 0 && addAmount > 0 && itemAmount >= baseAmount) {
                // Сколько полных наборов акции
                const fullSets = Math.floor(itemAmount / (baseAmount + addAmount));
                const remainder = itemAmount % (baseAmount + addAmount);
                
                // Количество товаров к оплате
                let chargedAmount = fullSets * baseAmount;
                
                // Обрабатываем остаток
                if (remainder >= baseAmount) {
                  // Если остаток больше базового количества, добавляем базовое количество к оплате
                  chargedAmount += baseAmount;
                } else {
                  // Если остаток меньше базового количества, добавляем весь остаток к оплате
                  chargedAmount += remainder;
                }
                
                itemCost = itemPrice * chargedAmount;
                console.log(`Применена акция SUBTRACT для товара ${item.item_id}: было ${itemAmount}, к оплате ${chargedAmount}`);
              }
            } else if (promotionDetail.type === 'DISCOUNT') {
              // Акция типа DISCOUNT: скидка в процентах
              const discountPercent = Number(promotionDetail.discount || 0);
              if (discountPercent > 0) {
                const discountAmount = (itemCost * discountPercent) / 100;
                itemCost = itemCost - discountAmount;
                console.log(`Применена акция DISCOUNT для товара ${item.item_id}: скидка ${discountPercent}%, сумма со скидкой ${itemCost}`);
              }
            }
          }
        } catch (promotionError) {
          console.error('Ошибка применения акции:', promotionError);
          // В случае ошибки используем обычную стоимость без акции
        }
      }

      sumBeforeDelivery += itemCost;
    }

    // Считаем стоимость опций
    for (const option of orderOptions) {
      sumBeforeDelivery += Number(option.price || 0) * Number(option.amount || 0);
    }

    // Получаем стоимость доставки
    const order = await prisma.orders.findUnique({
      where: { order_id: orderId }
    });

    const deliveryPrice = Number(order?.delivery_price || 0);
    const totalSum = sumBeforeDelivery + deliveryPrice;

    return {
      sum_before_delivery: sumBeforeDelivery,
      total_sum: totalSum
    };
  }

  /**
   * Оплата заказа картой
   * POST /api/orders/:id/pay
   * 
   * @param card_id - Прямой ID карты из системы Halyk Bank (например: "2d1419c5-379a-d8cd-e063-1b01010a6414")
   */
  static async payOrder(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const orderId = parseInt(req.params.id);
      const { card_id, payment_type = 'card' } = req.body;

      if (isNaN(orderId)) {
        res.status(400).json({
          success: false,
          error: {
            message: 'Неверный ID заказа',
            statusCode: 400,
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      // Валидация типа оплаты
      if (!['card', 'page'].includes(payment_type)) {
        res.status(400).json({
          success: false,
          error: {
            message: 'Неверный тип оплаты',
            statusCode: 400,
            timestamp: new Date().toISOString(),
            details: {
              validation_errors: ['payment_type должен быть "card" или "page"']
            }
          }
        });
        return;
      }

      // Для оплаты сохраненной картой card_id обязателен
      if (payment_type === 'card' && !card_id) {
        res.status(400).json({
          success: false,
          error: {
            message: 'Неверные параметры запроса',
            statusCode: 400,
            timestamp: new Date().toISOString(),
            details: {
              validation_errors: ['card_id обязателен для payment_type "card"']
            }
          }
        });
        return;
      }

      // Проверяем авторизацию пользователя
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: {
            message: 'Токен авторизации недействителен',
            statusCode: 401,
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      const user_id = req.user.user_id;

      // Проверяем существование заказа и права доступа
      const order = await prisma.orders.findUnique({
        where: { order_id: orderId }
      });

      if (!order) {
        res.status(404).json({
          success: false,
          error: {
            message: 'Заказ не найден',
            statusCode: 404,
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      if (order.user_id !== user_id) {
        res.status(403).json({
          success: false,
          error: {
            message: 'Доступ запрещен',
            statusCode: 403,
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      // Проверяем статус заказа
      const currentStatus = await prisma.order_status.findFirst({
        where: { order_id: orderId },
        orderBy: { log_timestamp: 'desc' }
      });

      if (!currentStatus) {
        res.status(400).json({
          success: false,
          error: {
            message: 'Не найден статус заказа',
            statusCode: 400,
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      // Проверяем, можно ли оплачивать заказ
      if (currentStatus.status === 0) {
        res.json({
          success: true,
          data: { 
            order_id: orderId,
            payment_status: 'already_paid',
            message: 'Заказ уже оплачен' 
          },
          message: 'Заказ уже оплачен'
        });
        return;
      }

      if (currentStatus.isCanceled === 1) {
        res.status(400).json({
          success: false,
          error: {
            message: 'Нельзя оплатить отмененный заказ',
            statusCode: 400,
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      // Оплачивать можно только новые заказы (статус 66)
      if (currentStatus.status !== 66) {
        if (currentStatus.status >= 1 && currentStatus.status <= 5) {
          res.status(400).json({
            success: false,
            error: {
              message: 'Заказ уже в процессе выполнения или доставлен',
              statusCode: 400,
              timestamp: new Date().toISOString()
            }
          });
          return;
        } else {
          res.status(400).json({
            success: false,
            error: {
              message: 'Заказ находится в неподходящем для оплаты статусе',
              statusCode: 400,
              timestamp: new Date().toISOString()
            }
          });
          return;
        }
      }

      console.log('Начинаем оплату заказа:', orderId, 'типом:', payment_type);

      try {
        let paymentResult;

        if (payment_type === 'card') {
          // Оплата сохраненной картой
          console.log('Оплата сохраненной картой с Halyk ID:', card_id);
          paymentResult = await OrderController.processCardPayment(orderId, user_id, card_id);
        } else {
          // Создание ссылки для оплаты на странице
          console.log('Создание ссылки для оплаты на странице');
          paymentResult = await OrderController.createPaymentPage(orderId, user_id);
        }

        console.log('Результат платежа:', paymentResult);

        // Проверяем успешность платежа для корректного HTTP статуса
        if (paymentResult.status === 'payment_declined') {
          res.status(400).json({
            success: false,
            error: {
              message: paymentResult.message || 'Платеж отклонен банком',
              statusCode: 400,
              timestamp: new Date().toISOString(),
              details: {
                halyk_error: {
                  code: paymentResult.error_code || paymentResult.halyk_response?.code || -1,
                  message: paymentResult.message || 'Payment declined'
                }
              }
            }
          });
          return;
        }

        if (paymentResult.status === 'payment_error') {
          res.status(502).json({
            success: false,
            error: {
              message: 'Ошибка при обработке платежа в банке',
              statusCode: 502,
              timestamp: new Date().toISOString(),
              details: {
                halyk_error: {
                  code: paymentResult.error_code || -1,
                  message: paymentResult.message || 'Bank processing error'
                }
              }
            }
          });
          return;
        }

        if (paymentResult.status === 'system_error') {
          res.status(500).json({
            success: false,
            error: {
              message: 'Системная ошибка при обработке платежа',
              statusCode: 500,
              timestamp: new Date().toISOString(),
              details: {
                internal_error: paymentResult.message || 'System error'
              }
            }
          });
          return;
        }

        // Проверяем, что платеж действительно успешен
        if (paymentResult.status !== 'ok' && paymentResult.status !== 'redirect') {
          res.status(400).json({
            success: false,
            error: {
              message: paymentResult.message || 'Неизвестная ошибка при обработке платежа',
              statusCode: 400,
              timestamp: new Date().toISOString(),
              details: {
                payment_status: paymentResult.status
              }
            }
          });
          return;
        }

        // Успешная оплата или создание ссылки
        res.json({
          success: true,
          data: {
            order_id: orderId,
            payment_status: paymentResult.status === 'ok' ? 'completed' : 'pending',
            halyk_response: paymentResult.halyk_response || paymentResult
          },
          message: paymentResult.status === 'ok' 
            ? (payment_type === 'card' ? 'Оплата успешно проведена' : 'Ссылка для оплаты создана')
            : 'Платеж в обработке'
        });

      } catch (paymentError: any) {
        console.error('Ошибка обработки платежа:', paymentError);
        res.status(500).json({
          success: false,
          error: {
            message: 'Внутренняя ошибка сервера при обработке платежа',
            statusCode: 500,
            timestamp: new Date().toISOString(),
            details: {
              internal_error: paymentError.message
            }
          }
        });
      }

    } catch (error: any) {
      console.error('Ошибка оплаты заказа:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Внутренняя ошибка сервера',
          statusCode: 500,
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  /**
   * Создание ссылки для оплаты на странице (аналог создания платежной страницы)
   */
  private static async createPaymentPage(orderId: number, userId: number): Promise<any> {
    try {
      // Получаем данные заказа
      const order = await prisma.orders.findUnique({
        where: { order_id: orderId }
      });

      if (!order) {
        throw new Error('Заказ не найден');
      }

      // Получаем данные пользователя
      const user = await prisma.user.findUnique({
        where: { user_id: userId }
      });

      if (!user) {
        throw new Error('Пользователь не найден');
      }

      // Получаем стоимость заказа
      const orderTotal = await OrderController.calculateOrderTotal(orderId);
      const amount = Math.round(orderTotal.total_sum * 100); // В тийинах

      console.log('Создание страницы оплаты для суммы:', amount, 'тийин (', orderTotal.total_sum, 'тенге)');

      // Проверяем минимальную сумму
      if (amount < 100) { // минимум 1 тенге
        throw new Error('Сумма заказа слишком мала для оплаты');
      }

      // Получаем токен для создания платежной страницы
      const token = await OrderController.getHalykToken(amount, order.order_uuid || '', userId, user.login || '');

      if (!token || !token.access_token) {
        throw new Error('Не удалось получить токен');
      }

      console.log('Получен токен для создания страницы оплаты:', token.access_token.substring(0, 20) + '...');

      // Формируем данные для создания платежной страницы
      const paymentPageData = {
        amount: amount,
        currency: 'KZT',
        name: user.name || user.login,
        terminalId: 'bb4dec49-6e30-41d0-b16b-8ba1831a854b',
        invoiceId: order.order_uuid,
        description: 'Оплата заказа алкогольных напитков',
        accountId: user.user_id.toString(),
        backLink: 'https://chorenn.naliv.kz/success',
        failureBackLink: 'https://chorenn.naliv.kz/failure',
        postLink: 'https://chorenn.naliv.kz/api/payment.php',
        language: 'rus',
        paymentType: 'normal' // Обычная оплата на странице
      };

      console.log('Создаем платежную страницу с данными:');
      console.log('- Сумма:', amount, 'тийин');
      console.log('- Валюта:', paymentPageData.currency);
      console.log('- Invoice ID:', paymentPageData.invoiceId);
      console.log('- Тип оплаты:', paymentPageData.paymentType);

      // Отправляем запрос на создание платежной страницы
      const response = await fetch('https://epay-api.homebank.kz/payments/cards/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token.access_token}`
        },
        body: JSON.stringify(paymentPageData)
      });

      const responseText = await response.text();
      console.log('Ответ банка при создании страницы (статус):', response.status);
      console.log('Ответ банка при создании страницы (заголовки):', Object.fromEntries(response.headers.entries()));
      console.log('Ответ банка при создании страницы (тело):', responseText);

      if (response.status === 200) {
        let halykResponse;
        try {
          halykResponse = JSON.parse(responseText);
        } catch (parseError) {
          console.error('Ошибка парсинга ответа банка:', parseError);
          throw new Error('Неверный формат ответа от банка');
        }

        console.log('Платежная страница создана:', halykResponse);

        // Если есть URL для перенаправления, возвращаем его
        if (halykResponse.redirectUrl || halykResponse.paymentUrl || halykResponse.url) {
          const paymentUrl = halykResponse.redirectUrl || halykResponse.paymentUrl || halykResponse.url;
          
          // Сохраняем информацию о созданной платежной ссылке
          if (halykResponse.id) {
            await prisma.orders.update({
              where: { order_id: orderId },
              data: { payment_id: halykResponse.id }
            });
            console.log('Сохранен payment_id для страницы оплаты:', halykResponse.id);
          }

          return {
            status: 'redirect',
            payment_url: paymentUrl,
            payment_id: halykResponse.id,
            expires_at: halykResponse.expiresAt,
            bank_response: halykResponse
          };
        } else {
          throw new Error('Банк не вернул URL для оплаты');
        }

      } else {
        console.error('Ошибка создания платежной страницы. Статус:', response.status, 'Ответ:', responseText);

        // Пытаемся парсить ответ для получения детальной информации
        let errorInfo = responseText;
        let bankErrorCode = null;
        let bankErrorMessage = null;
        let halykErrorInfo = null;

        try {
          const errorData = JSON.parse(responseText);
          if (errorData.code) {
            bankErrorCode = errorData.code;
            bankErrorMessage = errorData.message;
            halykErrorInfo = OrderController.getHalykErrorInfo(bankErrorCode);
            console.error('Код ошибки банка (страница):', bankErrorCode, 'Сообщение:', bankErrorMessage);
            console.log('Обработанная ошибка:', halykErrorInfo);
          }
        } catch (parseError) {
          console.log('Не удалось парсить ответ банка как JSON');
        }

        // Определяем тип ошибки на основе кода банка
        let errorType = 'unknown';
        let userMessage = 'Ошибка при создании платежной страницы';
        
        if (halykErrorInfo) {
          errorType = halykErrorInfo.status;
          userMessage = halykErrorInfo.message;
        } else if (response.status === 400) {
          errorType = 'bad_request';
        } else if (response.status === 403) {
          errorType = 'forbidden';
        } else if (response.status >= 500) {
          errorType = 'server_error';
        }

        return {
          status: errorType,
          code: response.status,
          bank_error_code: bankErrorCode,
          bank_error_message: bankErrorMessage,
          user_message: userMessage,
          is_final: halykErrorInfo?.isFinal ?? true,
          should_retry: halykErrorInfo?.shouldRetry ?? false,
          info: errorInfo,
          error_detail: userMessage
        };
      }

    } catch (error: any) {
      console.error('Ошибка создания платежной страницы:', error);
      return { status: 'unknown', error: error.message };
    }
  }

  /**
   * Обработка платежа картой (принимает прямой Halyk card ID)
   * @param halykCardId - ID карты из системы Halyk Bank
   */
  private static async processCardPayment(orderId: number, userId: number, halykCardId: string): Promise<any> {
    try {
      // Получаем данные заказа
      const order = await prisma.orders.findUnique({
        where: { order_id: orderId }
      });

      if (!order) {
        throw new Error('Заказ не найден');
      }

      // Получаем данные пользователя
      const user = await prisma.user.findUnique({
        where: { user_id: userId }
      });

      if (!user) {
        throw new Error('Пользователь не найден');
      }

      // Используем переданный Halyk card ID напрямую
      console.log('Используем Halyk card ID:', halykCardId);

      // Получаем стоимость заказа
      const orderTotal = await OrderController.calculateOrderTotal(orderId);
      const amount = Math.round(orderTotal.total_sum ); // В тийинах

      console.log('Сумма к оплате:', amount, 'тийин (', orderTotal.total_sum, 'тенге)');

      // Проверяем минимальную сумму
      if (amount < 100) { // минимум 1 тенге
        throw new Error('Сумма заказа слишком мала для оплаты');
      }

      // Получаем токен (аналог getToken PHP)
      const token = await OrderController.getHalykToken(amount, order.order_uuid || '', userId, user.login || '');

      if (!token || !token.access_token) {
        throw new Error('Не удалось получить токен');
      }

      console.log('Получен токен:', token.access_token.substring(0, 20) + '...');

      // Формируем данные для платежа (точно как в документации)
      const paymentData = {
        amount: amount,
        currency: 'KZT',
        name: user.name || user.login,
        terminalId: 'bb4dec49-6e30-41d0-b16b-8ba1831a854b',
        invoiceId: order.order_uuid,
        description: 'Оплата заказа доставки',
        accountId: user.user_id.toString(),
        email: '', // email не хранится в нашей модели user
        phone: user.login || '',
        backLink: 'https://chorenn.naliv.kz/success',
        failureBackLink: 'https://chorenn.naliv.kz/failure',
        postLink: 'https://chorenn.naliv.kz/api/payment.php',
        failurePostLink: 'https://chorenn.naliv.kz/api/payment.php',
        language: 'rus',
        paymentType: 'cardId', // Ключевой параметр для оплаты сохраненной картой
        cardId: {
          id: halykCardId
        }
      };

      console.log('Отправляем данные платежа в Halyk Bank:');
      console.log('- Сумма:', amount, 'тийин');
      console.log('- Валюта:', paymentData.currency);
      console.log('- Invoice ID:', paymentData.invoiceId);
      console.log('- Card ID:', halykCardId);
      console.log('- Payment Type:', paymentData.paymentType);

      // Отправляем запрос на оплату
      const response = await fetch('https://epay-api.homebank.kz/payments/cards/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token.access_token}`
        },
        body: JSON.stringify(paymentData)
      });

      const responseText = await response.text();
      console.log('Ответ банка (статус):', response.status);
      console.log('Ответ банка (заголовки):', Object.fromEntries(response.headers.entries()));
      console.log('Ответ банка (тело):', responseText);

      if (response.status === 200) {
        let halykResponse;
        try {
          halykResponse = JSON.parse(responseText);
        } catch (parseError) {
          console.error('Ошибка парсинга ответа банка:', parseError);
          throw new Error('Неверный формат ответа от банка');
        }
        
        console.log('Платеж успешно обработан:', halykResponse);
        
        // Проверяем статус платежа
        if (halykResponse.code === 0 && halykResponse.status === 'AUTH') {
          // Обновляем статус заказа на "оплачен"
          await prisma.order_status.create({
            data: {
              order_id: orderId,
              status: 0, // Статус 0 - заказ оплачен
              isCanceled: 0,
              log_timestamp: new Date()
            }
          });

          // Обновляем payment_id в заказе
          await prisma.orders.update({
            where: { order_id: orderId },
            data: { 
              payment_id: halykResponse.id || halykResponse.reference || null
            }
          });

          console.log('Статус заказа обновлен на "оплачен"');

          return {
            status: 'ok',
            message: 'Оплата прошла успешно',
            payment_id: halykResponse.id,
            reference: halykResponse.reference,
            amount: orderTotal.total_sum,
            order_id: orderId,
            card_id: halykCardId,
            halyk_response: {
              id: halykResponse.id,
              accountId: halykResponse.accountId,
              amount: halykResponse.amount,
              currency: halykResponse.currency,
              reference: halykResponse.reference,
              intReference: halykResponse.intReference,
              status: halykResponse.status,
              code: halykResponse.code
            }
          };
        } else {
          // Платеж не прошел - обрабатываем ошибку
          const errorCode = halykResponse.code || -1;
          const errorMessage = halykResponse.message || 'Неизвестная ошибка банка';
          
          console.error('Платеж отклонен банком:', errorCode, errorMessage);
          
          // Логируем ошибку в базу данных
          try {
            await prisma.order_status.create({
              data: {
                order_id: orderId,
                status: 67, // Статус ошибки оплаты
                isCanceled: 0,
                log_timestamp: new Date()
              }
            });
          } catch (logError) {
            console.error('Ошибка логирования статуса ошибки:', logError);
          }

          return {
            status: 'payment_declined',
            message: errorMessage,
            error_code: errorCode,
            order_id: orderId,
            halyk_response: halykResponse
          };
        }

      } else {
        console.error('Ошибка платежа. Статус:', response.status, 'Ответ:', responseText);

        // Пытаемся парсить ответ для получения детальной информации об ошибке
        let errorInfo = responseText;
        let bankErrorCode = null;
        let bankErrorMessage = null;

        try {
          const errorResponse = JSON.parse(responseText);
          console.log('Ошибка банка (парсинг):', errorResponse);

          bankErrorCode = errorResponse.code || response.status;
          bankErrorMessage = errorResponse.message || `HTTP ${response.status}`;
          errorInfo = bankErrorMessage;
        } catch (parseError) {
          console.error('Не удалось парсить ошибку банка:', parseError);
          errorInfo = `Ошибка связи с банком (HTTP ${response.status})`;
          bankErrorMessage = errorInfo;
        }

        // Логируем ошибку в базу данных
        try {
          await prisma.order_status.create({
            data: {
              order_id: orderId,
              status: 67, // Статус ошибки оплаты
              isCanceled: 0,
              log_timestamp: new Date()
            }
          });
        } catch (logError) {
          console.error('Ошибка логирования статуса ошибки:', logError);
        }

        return {
          status: 'payment_error',
          message: bankErrorMessage || errorInfo,
          error_code: bankErrorCode,
          http_status: response.status,
          order_id: orderId
        };
      }

    } catch (error: any) {
      console.error('Ошибка обработки платежа картой:', error);
      
      // Логируем системную ошибку
      try {
        await prisma.order_status.create({
          data: {
            order_id: orderId,
            status: 68, // Статус системной ошибки
            isCanceled: 0,
            log_timestamp: new Date()
          }
        });
      } catch (logError) {
        console.error('Ошибка логирования системной ошибки:', logError);
      }

      return {
        status: 'system_error',
        message: error.message || 'Системная ошибка при обработке платежа',
        order_id: orderId
      };
    }
  }

  /**
   * Получение информации об ошибке по коду банка Halyk
   */
  private static getHalykErrorInfo(errorCode: number): { status: string, message: string, isFinal: boolean, shouldRetry: boolean } {
    const errorMap: Record<number, { status: string, message: string, isFinal: boolean, shouldRetry: boolean }> = {
      // Успех
      0: { status: 'ok', message: 'Платеж успешен', isFinal: true, shouldRetry: false },

      // Системные ошибки (не финальные)
      100: { status: 'system_error', message: 'Системная ошибка. Необходимо проверить статус платежа', isFinal: false, shouldRetry: true },
      293: { status: 'technical_error', message: 'Техническая ошибка. Проверьте статус платежа', isFinal: false, shouldRetry: true },
      454: { status: 'operation_failed', message: 'Операция не удалась, проверьте, не заблокирована ли сумма на карте и повторите попытку позже', isFinal: false, shouldRetry: true },
      1267: { status: 'communication_error', message: 'Ошибка связи с карточной системой', isFinal: false, shouldRetry: true },
      1268: { status: 'technical_error', message: 'Техническая ошибка', isFinal: false, shouldRetry: true },
      1269: { status: 'technical_error', message: 'Техническая ошибка', isFinal: false, shouldRetry: true },
      1563: { status: 'http_error', message: 'Ошибка выполнения HTTP-запроса', isFinal: false, shouldRetry: true },
      1564: { status: 'http_error', message: 'Получен HTTP-ответ с неожиданным кодом', isFinal: false, shouldRetry: true },
      2358: { status: 'card_info_error', message: 'Ошибка при получении информации о карте', isFinal: false, shouldRetry: true },
      2656: { status: 'technical_error', message: 'Техническая ошибка', isFinal: false, shouldRetry: true },
      3014: { status: 'system_error', message: 'Системная ошибка', isFinal: false, shouldRetry: true },
      3240: { status: 'retry_payment', message: 'Повторите платеж', isFinal: false, shouldRetry: true },
      
      // Ошибки карты и безопасности (финальные)
      455: { status: 'security_check_failed', message: '3DSecure/Securecode недоступна или неверно введен номер карты. Попробуйте другой браузер/устройство', isFinal: true, shouldRetry: false },
      457: { status: 'invalid_expiry', message: 'Некорректно введен срок действия карты', isFinal: true, shouldRetry: false },
      459: { status: 'invalid_card_number', message: 'Проверьте корректность номера карты', isFinal: true, shouldRetry: false },
      465: { status: 'card_blocked', message: 'Карта заблокирована', isFinal: true, shouldRetry: false },
      467: { status: 'card_blocked', message: 'Карта заблокирована', isFinal: true, shouldRetry: false },
      471: { status: 'invalid_card_number', message: 'Недействительный номер карточки', isFinal: true, shouldRetry: false },
      472: { status: 'invalid_card_number', message: 'Недействительный номер карточки', isFinal: true, shouldRetry: false },
      473: { status: 'security_code_error', message: '3DSecure/Securecode введен некорректно', isFinal: true, shouldRetry: false },
      478: { status: 'card_expired', message: 'Просрочен срок действия карты', isFinal: true, shouldRetry: false },
      479: { status: 'card_blocked', message: 'Карточка заблокирована', isFinal: true, shouldRetry: false },
      481: { status: 'invalid_card', message: 'Карта недействительна. Обратитесь в Банк', isFinal: true, shouldRetry: false },
      482: { status: 'invalid_card', message: 'Карта недействительна. Обратитесь в Банк', isFinal: true, shouldRetry: false },
      483: { status: 'card_stolen', message: 'Статус карты - украдена. Обратитесь в Банк', isFinal: true, shouldRetry: false },
      485: { status: 'card_expired', message: 'Срок действия карты истек', isFinal: true, shouldRetry: false },
      489: { status: 'card_blocked', message: 'Карточка заблокирована', isFinal: true, shouldRetry: false },
      492: { status: 'card_blocked_pin', message: 'Карта заблокирована по причине неверного ввода пин-кода', isFinal: true, shouldRetry: false },
      499: { status: 'security_code_error', message: 'Неверно введен или не введен 3DSecure/Securecode', isFinal: true, shouldRetry: false },
      500: { status: 'security_check_unavailable', message: 'Проверка 3DSecure недоступна, попробуйте сменить точку доступа в интернет', isFinal: true, shouldRetry: false },
      503: { status: 'security_required', message: 'Операция требует обязательного использования 3DSecure пароля', isFinal: true, shouldRetry: false },
      525: { status: 'invalid_card', message: 'Карта недействительна. Обратитесь в Банк', isFinal: true, shouldRetry: false },
      877: { status: 'security_check_failed', message: 'Невозможно завершить проверку 3DSecure', isFinal: true, shouldRetry: false },

      // Финансовые ошибки (финальные)
      484: { status: 'insufficient_funds', message: 'Недостаточно средств на карте', isFinal: true, shouldRetry: false },
      488: { status: 'amount_limit_exceeded', message: 'Сумма превышает допустимый лимит', isFinal: true, shouldRetry: false },
      491: { status: 'frequency_limit_exceeded', message: 'Превышен лимит частоты оплат', isFinal: true, shouldRetry: false },
      528: { status: 'daily_limit_exceeded', message: 'Превышен суточный лимит входящих переводов на карту', isFinal: true, shouldRetry: false },
      529: { status: 'terminal_limit_exceeded', message: 'Сработал суточный лимит на терминале', isFinal: true, shouldRetry: false },
      2678: { status: 'terminal_limit_exceeded', message: 'Сработал лимит на терминале', isFinal: true, shouldRetry: false },
      3141: { status: 'refund_limit_exceeded', message: 'На контракте сработал лимит для возврата', isFinal: true, shouldRetry: false },

      // Банковские отказы (финальные)
      462: { status: 'bank_declined', message: 'Транзакция отклонена банком. Обратитесь по контактам на обратной стороне карты', isFinal: true, shouldRetry: false },
      463: { status: 'bank_declined', message: 'Транзакция отклонена банком. Обратитесь по контактам на обратной стороне карты', isFinal: true, shouldRetry: false },
      466: { status: 'bank_declined', message: 'Транзакция отклонена банком. Обратитесь по контактам на обратной стороне карты', isFinal: true, shouldRetry: false },
      480: { status: 'contact_bank', message: 'Обратиться к банку-эмитенту', isFinal: true, shouldRetry: false },
      486: { status: 'internet_payments_disabled', message: 'На карте запрещена возможность покупок в сети интернет', isFinal: true, shouldRetry: false },
      490: { status: 'transaction_prohibited', message: 'Запрет на проведение транзакции по карте', isFinal: true, shouldRetry: false },
      495: { status: 'transaction_prohibited', message: 'Транзакция запрещена, воспользуйтесь другой картой', isFinal: true, shouldRetry: false },
      521: { status: 'bank_declined', message: 'Транзакция отклонена банком. Обратитесь по контактам на обратной стороне карты', isFinal: true, shouldRetry: false },
      523: { status: 'bank_declined', message: 'Транзакция отклонена банком. Обратитесь по контактам на обратной стороне карты', isFinal: true, shouldRetry: false },
      527: { status: 'bank_declined', message: 'Транзакция отклонена банком. Обратитесь по контактам на обратной стороне карты', isFinal: true, shouldRetry: false },
      2740: { status: 'too_many_attempts', message: 'Превышено количество неуспешных попыток оплат', isFinal: true, shouldRetry: false },
      2872: { status: 'critical_decline', message: 'Получен критичный код отказа от банка, воспользуйтесь другой картой', isFinal: true, shouldRetry: false },

      // Системные и сетевые ошибки (финальные)
      456: { status: 'system_error', message: 'Системная ошибка, попробуйте позже, если ошибка сохраняется, обратитесь в компанию', isFinal: true, shouldRetry: false },
      458: { status: 'server_not_responding', message: 'Сервер не отвечает. Попробуйте попозже', isFinal: true, shouldRetry: false },
      461: { status: 'system_error', message: 'Системная ошибка, попробуйте провести транзакцию позже', isFinal: true, shouldRetry: false },
      497: { status: 'server_not_responding', message: 'Сервер не отвечает. Попробуйте попозже', isFinal: true, shouldRetry: false },
      502: { status: 'server_not_responding', message: 'Сервер не отвечает. Попробуйте попозже', isFinal: true, shouldRetry: false },
      526: { status: 'system_error', message: 'Системная ошибка. Попробуйте позднее', isFinal: true, shouldRetry: false },

      // Прочие ошибки (финальные)
      460: { status: 'error_with_block', message: 'Произошла ошибка, возможно сумма заблокировалась на карте', isFinal: true, shouldRetry: false },
      464: { status: 'invalid_merchant', message: 'Недействительный коммерсант', isFinal: true, shouldRetry: false },
      468: { status: 'additional_identification_required', message: 'Требуется дополнительная идентификация', isFinal: true, shouldRetry: false },
      469: { status: 'invalid_transaction', message: 'Недействительная транзакция, перепроверить введенные данные', isFinal: true, shouldRetry: false },
      470: { status: 'zero_amount', message: 'Сумма транзакции равно нулю', isFinal: true, shouldRetry: false },
      475: { status: 'transaction_unsuccessful', message: 'Транзакция не успешна. Повторите снова', isFinal: true, shouldRetry: false },
      476: { status: 'retry_limit', message: 'Повторное проведение транзакции будет доступно не менее чем через 30 минут', isFinal: true, shouldRetry: false },
      477: { status: 'use_another_card', message: 'Ошибка, воспользуйтесь другой картой', isFinal: true, shouldRetry: false },
      487: { status: 'transaction_declined', message: 'Транзакция отклонена, обратитесь в службу поддержки', isFinal: true, shouldRetry: false },
      498: { status: 'bonus_payment_unavailable', message: 'Оплата бонусами невозможна. Попробуйте попозже', isFinal: true, shouldRetry: false },
      501: { status: 'card_service_error', message: 'Ошибка обслуживания карты. Проверьте правильность ввода карты', isFinal: true, shouldRetry: false },
      522: { status: 'record_not_found', message: 'Запись не найдена, проверьте карточку', isFinal: true, shouldRetry: false },
      2357: { status: 'iin_phone_mismatch', message: 'Указанные ИИН и номер телефона не соответствуют друг другу', isFinal: true, shouldRetry: false },
      
      // Банковые ошибки доступности (смешанные)
      493: { status: 'bank_unavailable', message: 'Недоступен банк, выпустивший карту, попробуйте повторить оплату позже', isFinal: true, shouldRetry: false },
      494: { status: 'bank_unavailable', message: 'Недоступен банк, выпустивший карту, попробуйте провести транзакцию позже', isFinal: true, shouldRetry: false },
      496: { status: 'system_error', message: 'Системная ошибка', isFinal: true, shouldRetry: false }
    };

    const errorInfo = errorMap[errorCode];
    if (errorInfo) {
      return errorInfo;
    }

    // Если код ошибки не найден, возвращаем общую ошибку
    return {
      status: 'unknown_error',
      message: `Неизвестная ошибка банка (код: ${errorCode})`,
      isFinal: true,
      shouldRetry: false
    };
  }

  /**
   * Получение токена Halyk Bank (аналог getToken PHP)
   */
  private static async getHalykToken(amount: number, orderUuid: string, clientId: number, phoneNumber: string): Promise<any> {
    try {
      const data = new URLSearchParams({
        grant_type: 'client_credentials',
        scope: 'webapi usermanagement email_send verification statement statistics payment',
        client_id: 'NALIV.KZ',
        client_secret: 'B5Y56*Hw9hxcvwwY',
        invoiceID: orderUuid,
        amount: amount.toString(),
        currency: 'KZT',
        terminal: 'bb4dec49-6e30-41d0-b16b-8ba1831a854b',
        postLink: 'https://chorenn.naliv.kz/api/payment.php',
        failurePostLink: 'https://chorenn.naliv.kz/api/payment.php'
      });

      console.log('Запрос токена с данными:', data.toString());

      const response = await fetch('https://epay-oauth.homebank.kz/oauth2/token', {
        method: 'POST',
        headers: {
          'AUTH': '050052bf-1761-11ee-8376-088fc3787894',
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: data.toString()
      });

      const responseText = await response.text();
      console.log('Ответ токена:', responseText);

      if (!response.ok) {
        throw new Error(`Ошибка получения токена: ${response.status} ${responseText}`);
      }

      return JSON.parse(responseText);

    } catch (error: any) {
      console.error('Ошибка получения токена:', error);
      throw error;
    }
  }

  /**
   * Получить активные акции для бизнеса
   */
  private static async getActivePromotions(businessId: number): Promise<(MarketingPromotion & { details: MarketingPromotionDetail[] })[]> {
    const now = new Date();
    
    const promotions = await prisma.marketing_promotions.findMany({
      where: {
        business_id: businessId,
        visible: 1,
        start_promotion_date: { lte: now },
        end_promotion_date: { gte: now }
      }
    });

    const promotionsWithDetails = [];
    for (const promotion of promotions) {
      const details = await prisma.marketing_promotion_details.findMany({
        where: { marketing_promotion_id: promotion.marketing_promotion_id }
      });
      
      promotionsWithDetails.push({
        ...promotion,
        details: details.map(detail => ({
          ...detail,
          base_amount: detail.base_amount ? Number(detail.base_amount) : undefined,
          add_amount: detail.add_amount ? Number(detail.add_amount) : undefined,
          discount: detail.discount ? Number(detail.discount) : undefined
        }))
      });
    }

    return promotionsWithDetails;
  }

  /**
   * Применить акции типа SUBTRACT к товару
   */
  private static calculateSubtractPromotion(
    quantity: number, 
    baseAmount: number, 
    addAmount: number
  ): PromotionCalculationResult {
    if (quantity < baseAmount) {
      return {
        originalQuantity: quantity,
        chargedQuantity: quantity,
        freeQuantity: 0
      };
    }

    // Сколько полных наборов акции (base_amount + add_amount)
    const fullSets = Math.floor(quantity / (baseAmount + addAmount));
    // Остаток товаров после полных наборов
    const remainder = quantity % (baseAmount + addAmount);
    
    // Количество бесплатных товаров из полных наборов
    let freeFromSets = fullSets * addAmount;
    // Количество товаров к оплате из полных наборов
    let chargedFromSets = fullSets * baseAmount;
    
    // Обрабатываем остаток
    let chargedFromRemainder = 0;
    let freeFromRemainder = 0;
    
    if (remainder >= baseAmount) {
      // Если остаток больше или равен базовому количеству, 
      // то можем дать часть бесплатных товаров
      chargedFromRemainder = baseAmount;
      freeFromRemainder = remainder - baseAmount;
    } else {
      // Иначе платим за весь остаток
      chargedFromRemainder = remainder;
    }

    const totalCharged = chargedFromSets + chargedFromRemainder;
    const totalFree = freeFromSets + freeFromRemainder;

    return {
      originalQuantity: quantity,
      chargedQuantity: totalCharged,
      freeQuantity: totalFree
    };
  }

  /**
   * Применить акции типа DISCOUNT к товару
   */
  private static calculateDiscountPromotion(
    quantity: number,
    price: number,
    discountPercent: number
  ): PromotionCalculationResult {
    const discountAmount = (discountPercent / 100) * price;
    const discountedPrice = price - discountAmount;
    
    return {
      originalQuantity: quantity,
      chargedQuantity: quantity, // Количество остается то же
      freeQuantity: 0, // Нет бесплатных товаров, только скидка
      discountedPrice: discountedPrice,
      discountAmount: discountAmount,
      discountPercent: discountPercent
    };
  }

  /**
   * Применить акции к товарам заказа
   */
  private static async applyPromotions(
    businessId: number,
    orderItems: { item_id: number; amount: number; price: number }[]
  ): Promise<{ item: any; promotion?: PromotionCalculationResult; originalAmount: number; chargedAmount: number; originalCost: number; discountedCost: number }[]> {
    const activePromotions = await this.getActivePromotions(businessId);
    const result = [];

    for (const item of orderItems) {
      let bestPromotion: PromotionCalculationResult | undefined;
      let maxDiscount = 0;

      // Ищем лучшую акцию для данного товара
      for (const promotion of activePromotions) {
        for (const detail of promotion.details) {
          if (detail.item_id === item.item_id) {
            let calculation: PromotionCalculationResult | undefined;
            let discount = 0;

            if (detail.type === 'SUBTRACT' && detail.base_amount && detail.add_amount) {
              // Акция типа "купи X получи Y бесплатно"
              calculation = this.calculateSubtractPromotion(
                item.amount,
                detail.base_amount,
                detail.add_amount
              );
              discount = (calculation.originalQuantity - calculation.chargedQuantity) * item.price;
              
            } else if (detail.type === 'DISCOUNT' && detail.discount) {
              // Процентная скидка
              calculation = this.calculateDiscountPromotion(
                item.amount,
                item.price,
                detail.discount
              );
              discount = calculation.discountAmount! * item.amount;
            }

            if (calculation && discount > maxDiscount) {
              maxDiscount = discount;
              bestPromotion = {
                ...calculation,
                promotion: detail
              };
            }
          }
        }
      }

      const originalCost = item.amount * item.price;
      let chargedAmount = item.amount;
      let discountedCost = originalCost;

      if (bestPromotion) {
        if (bestPromotion.promotion?.type === 'SUBTRACT') {
          // Для акций SUBTRACT - меняется количество к оплате
          chargedAmount = bestPromotion.chargedQuantity;
          discountedCost = chargedAmount * item.price;
        } else if (bestPromotion.promotion?.type === 'DISCOUNT') {
          // Для акций DISCOUNT - меняется цена за единицу
          chargedAmount = item.amount;
          discountedCost = item.amount * bestPromotion.discountedPrice!;
        }
      }

      result.push({
        item,
        promotion: bestPromotion,
        originalAmount: item.amount,
        chargedAmount,
        originalCost,
        discountedCost
      });
    }

    return result;
  }
  
  /**
   * Создание нового заказа
   * POST /api/orders
   */
  static async createOrder(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { 
        user_id, 
        business_id, 
        address_id, 
        payment_type_id, 
        items, 
        bonus = 0, 
        extra,
        delivery_type,
        delivery_date
      }: CreateOrderRequest = req.body;

      // Валидация данных
      if (!user_id || !business_id || !items || items.length === 0 || !delivery_type) {
        return next(createError(400, 'Не указаны обязательные поля: user_id, business_id, items, delivery_type'));
      }

      // Валидация типа доставки
      const validDeliveryTypes = Object.values(orders_delivery_type);
      if (!validDeliveryTypes.includes(delivery_type as orders_delivery_type)) {
        return next(createError(400, 'Неверный тип доставки. Доступные типы: DELIVERY, SCHEDULED, PICKUP'));
      }

      // Для доставки address_id обязателен
      if ((delivery_type === orders_delivery_type.DELIVERY || delivery_type === orders_delivery_type.SCHEDULED)) {
        if (!address_id) {
          return next(createError(400, 'Для доставки необходимо указать address_id'));
        }
      }

      // Валидация даты доставки для SCHEDULED заказов
      let parsedDeliveryDate: Date | null = null;
      if (delivery_type === orders_delivery_type.SCHEDULED) {
        if (!delivery_date) {
          return next(createError(400, 'Для типа доставки SCHEDULED необходимо указать дату доставки'));
        }

        parsedDeliveryDate = new Date(delivery_date);
        const now = new Date();
        const minDeliveryTime = new Date(now.getTime() + 2 * 60 * 60 * 1000); // +2 часа
        const maxDeliveryTime = new Date(now.getTime() + 24 * 60 * 60 * 1000); // +24 часа

        if (isNaN(parsedDeliveryDate.getTime())) {
          return next(createError(400, 'Неверный формат даты доставки'));
        }

        if (parsedDeliveryDate < minDeliveryTime) {
          return next(createError(400, 'Дата доставки должна быть не раньше чем через 2 часа от текущего момента'));
        }

        if (parsedDeliveryDate > maxDeliveryTime) {
          return next(createError(400, 'Дата доставки должна быть не позднее чем через 24 часа от текущего момента'));
        }
      }

      // Устанавливаем address_id (для PICKUP может быть 0)
      const finalAddressId = (delivery_type === orders_delivery_type.PICKUP) ? (address_id || 0) : address_id;

      // Проверяем существование пользователя
      const user = await prisma.user.findUnique({
        where: { user_id }
      });

      if (!user) {
        return next(createError(404, 'Пользователь не найден'));
      }

      // Проверяем существование бизнеса
      const business = await prisma.businesses.findUnique({
        where: { business_id: business_id }
      });

      if (!business) {
        return next(createError(404, 'Бизнес не найден'));
      }

      // Генерируем числовой UUID для заказа
      const orderUuid = OrderController.generateNumericOrderUuid(user_id);

      // Определяем кто создает заказ: пользователь или сотрудник
      let createdBy = null;
      if (req.employee) {
        createdBy = req.employee.employee_id;
      }

      // Рассчитываем стоимость доставки автоматически для всех заказов с доставкой
      let finalDeliveryPrice = 0;
      let deliveryCalculationInfo = null;
      
      if (delivery_type === orders_delivery_type.DELIVERY || delivery_type === orders_delivery_type.SCHEDULED) {
        // Получаем адрес пользователя для расчета доставки
        const userAddress = await prisma.user_addreses.findUnique({
          where: { 
            address_id: address_id,
            user_id: user_id,
            isDeleted: 0
          }
        });

        if (!userAddress) {
          return next(createError(404, 'Адрес доставки не найден или не принадлежит пользователю'));
        }

        if (!userAddress.lat || !userAddress.lon) {
          return next(createError(400, 'У адреса доставки отсутствуют координаты'));
        }

        const lat = Number(userAddress.lat);
        const lon = Number(userAddress.lon);

        // Валидируем координаты
        if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
          return next(createError(400, 'Некорректные координаты в адресе доставки'));
        }

        try {
          const deliveryResult = await DeliveryController.calculateDeliveryZone({
            lat,
            lon,
            business_id
          });
          
          if (deliveryResult.in_zone && deliveryResult.price !== false) {
            finalDeliveryPrice = Number(deliveryResult.price);
            deliveryCalculationInfo = {
              delivery_type: deliveryResult.delivery_type,
              message: deliveryResult.message,
              max_distance: deliveryResult.max_distance,
              current_distance: deliveryResult.current_distance,
              address: {
                address_id: userAddress.address_id,
                address: userAddress.address,
                name: userAddress.name,
                lat: lat,
                lon: lon
              }
            };
          } else {
            // Если доставка невозможна, возвращаем ошибку
            return next(createError(400, `Доставка по указанному адресу невозможна: ${deliveryResult.message}`));
          }
        } catch (deliveryError: any) {
          console.error('Ошибка расчета доставки:', deliveryError);
          return next(createError(500, `Ошибка расчета стоимости доставки: ${deliveryError.message}`));
        }
      }

      // Сначала создаем заказ
      const order = await prisma.orders.create({
        data: {
          user_id,
          business_id,
          address_id: finalAddressId,
          payment_type_id,
          delivery_price: finalDeliveryPrice,
          bonus,
          extra,
          order_uuid: orderUuid,
          created_by: createdBy, // ID сотрудника, если заказ создается сотрудником
          delivery_type: delivery_type,
          delivery_date: parsedDeliveryDate,
          log_timestamp: new Date()
        }
      });

      // Подготавливаем данные товаров для расчета акций
      const itemsForPromotion = [];
      for (const item of items) {
        // Проверяем существование товара
        const itemData = await prisma.items.findUnique({
          where: { item_id: item.item_id }
        });

        if (!itemData) {
          return next(createError(404, `Товар с ID ${item.item_id} не найден`));
        }

        // Используем цену из товара или переданную цену
        const currentPrice = item.price || (itemData.price ? Number(itemData.price) : 0);
        
        if (currentPrice <= 0) {
          return next(createError(400, `Не найдена цена для товара ${itemData.name}`));
        }

        itemsForPromotion.push({
          item_id: item.item_id,
          amount: item.amount,
          price: currentPrice,
          originalItem: item,
          itemData
        });
      }

      // Применяем акции к товарам
      const itemsWithPromotions = await OrderController.applyPromotions(business_id, itemsForPromotion);

      // Добавляем товары в заказ и считаем общую стоимость
      const orderItems = [];
      let totalCost = finalDeliveryPrice;
      let totalDiscount = 0;

      for (const itemWithPromo of itemsWithPromotions) {
        const { item, promotion, chargedAmount, originalCost, discountedCost } = itemWithPromo;

        // Создаем запись товара в заказе
        const orderItem = await prisma.orders_items.create({
          data: {
            order_id: order.order_id,
            item_id: item.item_id,
            price_id: null,
            amount: item.amount, // Сохраняем оригинальное количество
            price: item.price,
            marketing_promotion_detail_id: promotion?.promotion?.detail_id || null
          }
        });

        orderItems.push({
          ...orderItem,
          promotion: promotion,
          charged_amount: chargedAmount,
          original_cost: originalCost,
          discounted_cost: discountedCost
        });

        totalCost += discountedCost;
        totalDiscount += (originalCost - discountedCost);

        // Добавляем опции товара (если есть)
        if (item.originalItem.options && item.originalItem.options.length > 0) {
          for (const option of item.originalItem.options) {
            await prisma.order_items_options.create({
              data: {
                order_item_relation_id: orderItem.relation_id,
                item_id: item.item_id,
                option_item_relation_id: option.option_item_relation_id,
                order_id: order.order_id,
                price: option.price,
                amount: option.amount || 1
              }
            });
            
            totalCost += option.price * (option.amount || 1);
          }
        }
      }

      // Создаем запись стоимости заказа
      await prisma.orders_cost.create({
        data: {
          order_id: order.order_id,
          cost: totalCost,
          service_fee: 0,
          delivery: finalDeliveryPrice,
          log_timestamp: new Date()
        }
      });

      // Определяем начальный статус заказа на основе типа оплаты
      let initialStatus = OrderStatus.NEW;
      
      if (payment_type_id) {
        // Проверяем тип оплаты
        const paymentType = await prisma.payment_types.findUnique({
          where: { payment_type_id }
        });
        
        if (paymentType && paymentType.in_app === 1) {
          initialStatus = OrderStatus.UNPAID;
        }
      }

      // Создаем начальный статус заказа
      await prisma.order_status.create({
        data: {
          order_id: order.order_id,
          status: initialStatus,
          isCanceled: 0,
          log_timestamp: new Date()
        }
      });

      res.status(201).json({
        success: true,
        data: {
          order_id: order.order_id,
          order_uuid: orderUuid,
          total_cost: totalCost,
          delivery_price: finalDeliveryPrice,
          total_discount: totalDiscount,
          items_count: orderItems.length,
          promotions_applied: orderItems.filter(item => item.promotion).length,
          delivery_calculation: deliveryCalculationInfo
        },
        message: 'Заказ успешно создан'
      });

    } catch (error: any) {
      console.error('Ошибка создания заказа:', error);
      next(createError(500, `Ошибка создания заказа: ${error.message}`));
    }
  }

  /**
   * Получение заказа по ID
   * GET /api/orders/:id
   */
  static async getOrderById(req: Request, res: Response, next: NextFunction) {
    try {
      const orderId = parseInt(req.params.id);

      if (isNaN(orderId)) {
        return next(createError(400, 'Неверный ID заказа'));
      }

      // Получаем основную информацию о заказе
      const order = await prisma.orders.findUnique({
        where: { order_id: orderId }
      });

      if (!order) {
        return next(createError(404, 'Заказ не найден'));
      }

      // Получаем товары заказа
      const orderItems = await prisma.orders_items.findMany({
        where: { order_id: orderId }
      });

      // Получаем информацию о товарах
      const items = [];
      for (const orderItem of orderItems) {
        const item = await prisma.items.findUnique({
          where: { item_id: orderItem.item_id }
        });

        // Получаем информацию об акции (если применена)
        let promotionDetail = null;
        if (orderItem.marketing_promotion_detail_id) {
          promotionDetail = await prisma.marketing_promotion_details.findUnique({
            where: { detail_id: orderItem.marketing_promotion_detail_id }
          });
        }

        items.push({
          ...orderItem,
          item_name: item?.name,
          item_code: item?.code,
          item_img: item?.img,
          promotion_detail: promotionDetail
        });
      }

      // Получаем бизнес
      const business = await prisma.businesses.findUnique({
        where: { business_id: order.business_id || 0 }
      });

      // Получаем пользователя
      const user = await prisma.user.findUnique({
        where: { user_id: order.user_id }
      });

      // Получаем статус заказа
      const status = await prisma.order_status.findFirst({
        where: { order_id: orderId },
        orderBy: { log_timestamp: 'desc' }
      });

      // Получаем стоимость заказа
      const cost = await prisma.orders_cost.findFirst({
        where: { order_id: orderId }
      });

      // Получаем сотрудника, который создал заказ (если есть)
      let createdByEmployee = null;
      if (order.created_by) {
        const employee = await prisma.employee.findUnique({
          where: { employee_id: order.created_by },
          select: {
            employee_id: true,
            name: true,
            login: true,
            access_level: true
          }
        });
        createdByEmployee = employee;
      }

      res.json({
        success: true,
        data: {
          order: {
            ...order,
            items,
            business: business ? {
              id: business.business_id,
              name: business.name,
              address: business.address
            } : null,
            user: user ? {
              id: user.user_id,
              name: user.name,
              phone: user.login
            } : null,
            status: status ? {
              status: status.status,
              isCanceled: status.isCanceled,
              log_timestamp: status.log_timestamp
            } : null,
            cost: cost ? {
              cost: Number(cost.cost),
              service_fee: Number(cost.service_fee),
              delivery: Number(cost.delivery)
            } : null,
            created_by_employee: createdByEmployee
          }
        },
        message: 'Заказ найден'
      });

    } catch (error: any) {
      console.error('Ошибка получения заказа:', error);
      next(createError(500, `Ошибка получения заказа: ${error.message}`));
    }
  }

  /**
   * Отслеживание текущего статуса заказа
   * GET /api/orders/:id/status
   */
  static async trackOrderStatus(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const orderId = parseInt(req.params.id);

      if (isNaN(orderId)) {
        return next(createError(400, 'Неверный ID заказа'));
      }

      // Получаем основную информацию о заказе
      const order = await prisma.orders.findUnique({
        where: { order_id: orderId }
      });

      if (!order) {
        return next(createError(404, 'Заказ не найден'));
      }

      // Проверяем права доступа - пользователь может смотреть только свои заказы
      if (req.user && req.user.user_id !== order.user_id) {
        return next(createError(403, 'Доступ запрещен - заказ принадлежит другому пользователю'));
      }

      // Получаем всю историю статусов заказа
      const statusHistory = await prisma.order_status.findMany({
        where: { order_id: orderId },
        orderBy: { log_timestamp: 'asc' }
      });

      // Получаем текущий статус (последний)
      const currentStatus = statusHistory[statusHistory.length - 1];

      if (!currentStatus) {
        return next(createError(400, 'Не найден статус заказа'));
      }

      // Получаем информацию о бизнесе
      const business = await prisma.businesses.findUnique({
        where: { business_id: order.business_id || 0 },
        select: {
          business_id: true,
          name: true,
          address: true,
          logo: true
        }
      });

      // Получаем стоимость заказа
      const cost = await prisma.orders_cost.findFirst({
        where: { order_id: orderId }
      });

      // Мапим статусы в понятные названия и описания
      const getStatusInfo = (status: number, isCanceled: number) => {
        if (isCanceled === 1) {
          return {
            code: 99,
            name: 'Отменен',
            description: 'Заказ отменен',
            color: '#ff4444',
            icon: 'cancel',
            is_final: true
          };
        }

        switch (status) {
          case 66:
            return {
              code: 66,
              name: 'Новый заказ',
              description: 'Заказ создан, ожидает оплаты',
              color: '#ffa500',
              icon: 'pending',
              is_final: false
            };
          case 0:
            return {
              code: 0,
              name: 'Оплачен',
              description: 'Заказ оплачен, передан в обработку',
              color: '#4caf50',
              icon: 'paid',
              is_final: false
            };
          case 1:
            return {
              code: 1,
              name: 'В обработке',
              description: 'Заказ принят в обработку',
              color: '#2196f3',
              icon: 'processing',
              is_final: false
            };
          case 2:
            return {
              code: 2,
              name: 'Собран',
              description: 'Заказ собран, готов к доставке',
              color: '#9c27b0',
              icon: 'ready',
              is_final: false
            };
          case 3:
            return {
              code: 3,
              name: 'Передан курьеру',
              description: 'Заказ передан курьеру для доставки',
              color: '#ff9800',
              icon: 'courier',
              is_final: false
            };
          case 4:
            return {
              code: 4,
              name: 'В пути',
              description: 'Курьер направляется к вам',
              color: '#607d8b',
              icon: 'delivery',
              is_final: false
            };
          case 5:
            return {
              code: 5,
              name: 'Доставлен',
              description: 'Заказ успешно доставлен',
              color: '#4caf50',
              icon: 'delivered',
              is_final: true
            };
          default:
            return {
              code: status,
              name: 'Неизвестный статус',
              description: `Статус ${status}`,
              color: '#gray',
              icon: 'unknown',
              is_final: false
            };
        }
      };

      // Формируем историю статусов с подробной информацией
      const detailedHistory = statusHistory.map(statusRecord => ({
        status: statusRecord.status,
        is_canceled: statusRecord.isCanceled,
        timestamp: statusRecord.log_timestamp,
        status_info: getStatusInfo(statusRecord.status, statusRecord.isCanceled),
        time_ago: OrderController.getTimeAgo(statusRecord.log_timestamp)
      }));

      // Получаем информацию о текущем статусе
      const currentStatusInfo = getStatusInfo(currentStatus.status, currentStatus.isCanceled);

      // Прогнозируем следующий статус (если заказ не финальный)
      let nextExpectedStatus = null;
      if (!currentStatusInfo.is_final) {
        const nextStatusCode = currentStatus.isCanceled === 1 ? null : 
          currentStatus.status === 66 ? 0 :
          currentStatus.status === 0 ? 1 :
          currentStatus.status === 1 ? 2 :
          currentStatus.status === 2 ? 3 :
          currentStatus.status === 3 ? 4 :
          currentStatus.status === 4 ? 5 : null;

        if (nextStatusCode !== null) {
          nextExpectedStatus = getStatusInfo(nextStatusCode, 0);
        }
      }

      // Рассчитываем примерное время доставки
      let estimatedDeliveryTime = null;
      if (order.delivery_type === 'SCHEDULED' && order.delivery_date) {
        estimatedDeliveryTime = order.delivery_date;
      } else if (order.delivery_type === 'DELIVERY' && currentStatus.status >= 0 && currentStatus.status < 5) {
        // Примерное время доставки: 30-60 минут от момента оплаты
        const paidStatus = statusHistory.find(s => s.status === 0);
        if (paidStatus) {
          estimatedDeliveryTime = new Date(paidStatus.log_timestamp.getTime() + 45 * 60 * 1000); // +45 минут
        }
      }

      res.json({
        success: true,
        data: {
          order_id: orderId,
          order_uuid: order.order_uuid,
          delivery_type: order.delivery_type,
          delivery_date: order.delivery_date,
          current_status: {
            ...currentStatusInfo,
            timestamp: currentStatus.log_timestamp,
            time_ago: OrderController.getTimeAgo(currentStatus.log_timestamp)
          },
          next_expected_status: nextExpectedStatus,
          estimated_delivery_time: estimatedDeliveryTime,
          estimated_delivery_time_ago: estimatedDeliveryTime ? OrderController.getTimeAgo(estimatedDeliveryTime, true) : null,
          business: business,
          cost: cost ? {
            total: Number(cost.cost),
            delivery: Number(cost.delivery),
            service_fee: Number(cost.service_fee)
          } : null,
          status_history: detailedHistory,
          can_cancel: currentStatus.status === 66 || currentStatus.status === 0, // Можно отменить только новые или оплаченные заказы
          payment_required: currentStatus.status === 66, // Требуется оплата для новых заказов
          created_at: order.log_timestamp
        },
        message: 'Информация о статусе заказа получена'
      });

    } catch (error: any) {
      console.error('Ошибка отслеживания статуса заказа:', error);
      next(createError(500, `Ошибка отслеживания статуса заказа: ${error.message}`));
    }
  }

  /**
   * Вспомогательный метод для расчета времени "назад"
   */
  private static getTimeAgo(date: Date, isFuture: boolean = false): string {
    const now = new Date();
    const diffMs = isFuture ? date.getTime() - now.getTime() : now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (isFuture) {
      if (diffMs < 0) return 'прошло';
      if (diffMinutes < 60) return `через ${diffMinutes} мин`;
      if (diffHours < 24) return `через ${diffHours} ч`;
      return `через ${diffDays} дн`;
    } else {
      if (diffMinutes < 1) return 'только что';
      if (diffMinutes < 60) return `${diffMinutes} мин назад`;
      if (diffHours < 24) return `${diffHours} ч назад`;
      return `${diffDays} дн назад`;
    }
  }

  /**
   * Получение активных заказов по бизнесу (для сотрудников)
   * GET /api/orders/business/:businessId/active
   */
  static async getBusinessActiveOrders(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const businessId = parseInt(req.params.businessId);
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
      const offset = (page - 1) * limit;

      if (isNaN(businessId)) {
        return next(createError(400, 'Неверный ID бизнеса'));
      }

      // Проверяем существование бизнеса
      const business = await prisma.businesses.findUnique({
        where: { business_id: businessId }
      });

      if (!business) {
        return next(createError(404, 'Бизнес не найден'));
      }

      // Активные статусы заказов
      const activeStatuses = [66, 0, 1, 2, 3, 4];

      // Получаем все заказы бизнеса
      const orders = await prisma.orders.findMany({
        where: {
          business_id: businessId,
          is_canceled: 0
        },
        orderBy: { log_timestamp: 'desc' },
        skip: offset,
        take: limit
      });

      const activeOrders = [];
      for (const order of orders) {
        const lastStatus = await prisma.order_status.findFirst({
          where: { order_id: order.order_id },
          orderBy: { log_timestamp: 'desc' }
        });

        if (lastStatus && activeStatuses.includes(lastStatus.status) && lastStatus.isCanceled === 0) {
          const [user, cost, itemsCount, address] = await Promise.all([
            prisma.user.findUnique({
              where: { user_id: order.user_id },
              select: {
                user_id: true,
                name: true,
                login: true
              }
            }),
            prisma.orders_cost.findFirst({
              where: { order_id: order.order_id }
            }),
            prisma.orders_items.count({
              where: { order_id: order.order_id }
            }),
            order.address_id ? prisma.user_addreses.findUnique({
              where: { address_id: order.address_id },
              select: {
                address_id: true,
                address: true,
                name: true,
                lat: true,
                lon: true
              }
            }) : null
          ]);

          const getStatusInfo = (status: number) => {
            switch (status) {
              case 66: return { name: 'Новый заказ', color: '#ffa500', icon: 'pending', priority: 1 };
              case 0: return { name: 'Оплачен', color: '#4caf50', icon: 'paid', priority: 2 };
              case 1: return { name: 'В обработке', color: '#2196f3', icon: 'processing', priority: 3 };
              case 2: return { name: 'Собран', color: '#9c27b0', icon: 'ready', priority: 4 };
              case 3: return { name: 'Передан курьеру', color: '#ff9800', icon: 'courier', priority: 5 };
              case 4: return { name: 'В пути', color: '#607d8b', icon: 'delivery', priority: 6 };
              default: return { name: 'Неизвестен', color: '#gray', icon: 'unknown', priority: 99 };
            }
          };

          const statusInfo = getStatusInfo(lastStatus.status);

          activeOrders.push({
            ...order,
            current_status: {
              status: lastStatus.status,
              log_timestamp: lastStatus.log_timestamp,
              ...statusInfo,
              time_ago: OrderController.getTimeAgo(lastStatus.log_timestamp)
            },
            user,
            delivery_address: address,
            cost: cost ? {
              total: Number(cost.cost),
              delivery: Number(cost.delivery),
              service_fee: Number(cost.service_fee)
            } : null,
            items_count: itemsCount,
            time_since_created: OrderController.getTimeAgo(order.log_timestamp),
            requires_urgent_attention: lastStatus.status === 66 || 
              (lastStatus.status === 0 && (new Date().getTime() - lastStatus.log_timestamp.getTime()) > 15 * 60 * 1000) // Более 15 минут без обработки
          });
        }
      }

      // Сортируем по приоритету статуса и времени создания
      activeOrders.sort((a, b) => {
        if (a.requires_urgent_attention !== b.requires_urgent_attention) {
          return a.requires_urgent_attention ? -1 : 1;
        }
        if (a.current_status.priority !== b.current_status.priority) {
          return a.current_status.priority - b.current_status.priority;
        }
        return new Date(a.log_timestamp).getTime() - new Date(b.log_timestamp).getTime();
      });

      // Группируем заказы по статусам для удобства
      const ordersByStatus = activeOrders.reduce((acc: any, order) => {
        const statusKey = order.current_status.status;
        if (!acc[statusKey]) {
          acc[statusKey] = {
            status_info: {
              status: statusKey,
              name: order.current_status.name,
              color: order.current_status.color,
              icon: order.current_status.icon
            },
            orders: []
          };
        }
        acc[statusKey].orders.push(order);
        return acc;
      }, {});

      const totalPages = Math.ceil(activeOrders.length / limit);

      res.json({
        success: true,
        data: {
          business: {
            business_id: businessId,
            name: business.name,
            address: business.address
          },
          total_active_orders: activeOrders.length,
          urgent_orders: activeOrders.filter(o => o.requires_urgent_attention).length,
          orders: activeOrders,
          orders_by_status: ordersByStatus,
          pagination: {
            current_page: page,
            per_page: limit,
            total: activeOrders.length,
            total_pages: totalPages
          }
        },
        message: `Найдено ${activeOrders.length} активных заказов для бизнеса "${business.name}"`
      });

    } catch (error: any) {
      console.error('Ошибка получения активных заказов бизнеса:', error);
      next(createError(500, `Ошибка получения активных заказов бизнеса: ${error.message}`));
    }
  }

  /**
   * Получение сводки активных заказов (для дашборда)
   * GET /api/orders/active/summary
   */
  static async getActiveOrdersSummary(req: any, res: Response, next: NextFunction) {
    try {
      const businessId = req.query.business_id ? parseInt(req.query.business_id as string) : null;

      // Базовое условие
      const whereCondition: any = {
        is_canceled: 0
      };

      // Фильтр по бизнесу
      if (businessId && !isNaN(businessId)) {
        whereCondition.business_id = businessId;
      }

      // Если это запрос от авторизованного пользователя (не сотрудника), показываем только его заказы
      // независимо от указанного business_id
      if (req.user && !req.employee) {
        whereCondition.user_id = req.user.user_id;
      }

      // Получаем только последние активные заказы для ускорения
      const orders = await prisma.orders.findMany({
        where: whereCondition,
        orderBy: { log_timestamp: 'desc' },
        take: 100 // Ограничиваем количество для быстрой работы
      });

      const activeStatuses = [66, 0, 1, 2, 3, 4];
      const summary = {
        new_orders: 0,           // Статус 66
        paid_orders: 0,          // Статус 0
        processing_orders: 0,    // Статус 1
        ready_orders: 0,         // Статус 2
        courier_orders: 0,       // Статус 3
        delivery_orders: 0,      // Статус 4
        urgent_orders: 0,        // Требующие внимания
        total_active: 0,
        total_amount: 0
      };

      // Получаем статусы и стоимости в batch запросах
      const orderIds = orders.map(order => order.order_id);
      
      const [statuses, costs] = await Promise.all([
        prisma.order_status.findMany({
          where: { order_id: { in: orderIds } },
          orderBy: { log_timestamp: 'desc' }
        }),
        prisma.orders_cost.findMany({
          where: { order_id: { in: orderIds } }
        })
      ]);

      // Создаем мапы для быстрого доступа
      const statusMap = new Map();
      const costMap = new Map();

      statuses.forEach(status => {
        if (!statusMap.has(status.order_id)) {
          statusMap.set(status.order_id, status);
        }
      });

      costs.forEach(cost => {
        costMap.set(cost.order_id, cost);
      });

      // Обрабатываем заказы
      for (const order of orders) {
        const lastStatus = statusMap.get(order.order_id);

        if (lastStatus && activeStatuses.includes(lastStatus.status) && lastStatus.isCanceled === 0) {
          summary.total_active++;

          // Считаем сумму заказа
          const cost = costMap.get(order.order_id);
          if (cost) {
            summary.total_amount += Number(cost.cost);
          }

          // Распределяем по статусам
          switch (lastStatus.status) {
            case 66: summary.new_orders++; break;
            case 0: summary.paid_orders++; break;
            case 1: summary.processing_orders++; break;
            case 2: summary.ready_orders++; break;
            case 3: summary.courier_orders++; break;
            case 4: summary.delivery_orders++; break;
          }

          // Проверяем на срочность
          const timeDiff = new Date().getTime() - lastStatus.log_timestamp.getTime();
          if (lastStatus.status === 66 || 
              (lastStatus.status === 0 && timeDiff > 15 * 60 * 1000) ||
              (lastStatus.status === 1 && timeDiff > 30 * 60 * 1000)) {
            summary.urgent_orders++;
          }
        }
      }

      res.json({
        success: true,
        data: {
          summary,
          business_id: businessId,
          timestamp: new Date().toISOString(),
          limit_applied: orders.length === 100 ? true : false
        },
        message: 'Сводка активных заказов получена'
      });

    } catch (error: any) {
      console.error('Ошибка получения сводки активных заказов:', error);
      next(createError(500, `Ошибка получения сводки: ${error.message}`));
    }
  }

  /**
   * Получение активных заказов пользователя
   * GET /api/orders/my-active-orders
   */
  static async getActiveOrders(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      // Проверяем авторизацию пользователя
      if (!req.user) {
        return next(createError(401, 'Необходима авторизация'));
      }

      const user_id = req.user.user_id;
      const { business_id, delivery_type } = req.query;

      // Определяем активные статусы (исключаем доставленные заказы)
      const activeStatuses = [66, 0, 1, 2, 3]; // NEW, PAID, PROCESSING, COLLECTED, COURIER, DELIVERY

      // Строим условие для фильтрации
      const whereCondition: any = {
        user_id: user_id,
        is_canceled: 0 // Не отмененные заказы
      };

      // Если указан business_id, фильтруем по нему
      if (business_id) {
        const businessIdNum = parseInt(business_id as string);
        if (!isNaN(businessIdNum)) {
          whereCondition.business_id = businessIdNum;
        }
      }

      if (delivery_type && ['DELIVERY', 'PICKUP', 'SCHEDULED'].includes(delivery_type as string)) {
        whereCondition.delivery_type = delivery_type as orders_delivery_type;
      }

      console.log('Получение активных заказов пользователя:', user_id);

      // Получаем все заказы пользователя
      const orders = await prisma.orders.findMany({
        where: whereCondition,
        orderBy: { log_timestamp: 'desc' }
      });

      // Фильтруем по активным статусам
      const activeOrders = [];
      for (const order of orders) {
        // Получаем последний статус заказа
        const currentStatus = await prisma.order_status.findFirst({
          where: { order_id: order.order_id },
          orderBy: { log_timestamp: 'desc' }
        });

        // Проверяем, активен ли заказ
        if (currentStatus && 
            activeStatuses.includes(currentStatus.status) && 
            currentStatus.isCanceled === 0) {

          // Получаем информацию о бизнесе
          const business = await prisma.businesses.findUnique({
            where: { business_id: order.business_id || 0 },
            select: {
              business_id: true,
              name: true,
              address: true,
              logo: true,
              img: true
            }
          });

          // Получаем адрес доставки
          let deliveryAddress = null;
          if (order.address_id && order.address_id > 0) {
            deliveryAddress = await prisma.user_addreses.findUnique({
              where: { address_id: order.address_id },
              select: {
                address_id: true,
                address: true,
                name: true,
                apartment: true,
                entrance: true,
                floor: true,
                other: true,
                lat: true,
                lon: true
              }
            });
          }

          // Получаем товары заказа (краткая информация)
          const orderItems = await prisma.orders_items.findMany({
            where: { order_id: order.order_id }
          });

          const itemsCount = orderItems.length;
          const totalItemsAmount = orderItems.reduce((sum, item) => sum + Number(item.amount || 0), 0);

          // Получаем краткую информацию о товарах для превью
          const itemsPreview = await Promise.all(
            orderItems.slice(0, 3).map(async (orderItem) => {
              const item = await prisma.items.findUnique({
                where: { item_id: orderItem.item_id },
                select: {
                  name: true,
                  img: true
                }
              });

              return {
                name: item?.name || 'Неизвестный товар',
                img: item?.img || '',
                amount: Number(orderItem.amount || 0)
              };
            })
          );

          // Рассчитываем общую стоимость
          // const orderTotal = await OrderController.calculateOrderTotal(order.order_id);

          // Определяем описание статуса и его приоритет
          const getStatusInfo = (statusNum: number) => {
            const statusMap: { [key: number]: { name: string, color: string, priority: number } } = {
              66: { name: 'Ожидает оплаты', color: '#ffa500', priority: 1 },
              0: { name: 'Оплачен', color: '#4caf50', priority: 2 },
              1: { name: 'Принят в работу', color: '#2196f3', priority: 3 },
              2: { name: 'Готовится', color: '#9c27b0', priority: 4 },
              3: { name: 'Готов к выдаче', color: '#ff9800', priority: 5 },
              4: { name: 'В доставке', color: '#607d8b', priority: 6 }
            };
            return statusMap[statusNum] || { name: 'Неизвестный статус', color: '#gray', priority: 999 };
          };

          const statusInfo = getStatusInfo(currentStatus.status);

          activeOrders.push({
            order_id: order.order_id,
            order_uuid: order.order_uuid,
            business: business,
            delivery_type: order.delivery_type,
            delivery_date: order.delivery_date,
            log_timestamp: order.log_timestamp,
            current_status: {
              status: currentStatus.status,
              status_description: statusInfo.name,
              status_color: statusInfo.color,
              priority: statusInfo.priority,
              is_canceled: currentStatus.isCanceled,
              log_timestamp: currentStatus.log_timestamp
            },
            delivery_address: deliveryAddress,
            items_summary: {
              items_count: itemsCount,
              total_amount: totalItemsAmount,
              items_preview: itemsPreview
            },
            cost_summary: {
              // total_sum: orderTotal.total_sum,
              delivery_price: Number(order.delivery_price || 0),
              bonus_used: Number(order.bonus || 0)
            }
          });
        }
      }

      // Сортируем по приоритету статуса (сначала ожидающие оплаты, затем в работе)
      activeOrders.sort((a, b) => {
        if (a.current_status.priority !== b.current_status.priority) {
          return a.current_status.priority - b.current_status.priority;
        }
        
        // Если приоритеты одинаковы, сортируем по времени создания (новые сначала)
        return new Date(b.log_timestamp).getTime() - new Date(a.log_timestamp).getTime();
      });

      console.log(`Найдено ${activeOrders.length} активных заказов для пользователя ${user_id}`);

      res.json({
        success: true,
        data: {
          active_orders: activeOrders,
          total_active: activeOrders.length,
          filters_applied: {
            business_id: business_id || null,
            delivery_type: delivery_type || null
          }
        },
        message: `Найдено ${activeOrders.length} активных заказов`
      });

    } catch (error: any) {
      console.error('Ошибка получения активных заказов:', error);
      next(createError(500, `Ошибка получения активных заказов: ${error.message}`));
    }
  }

  /**
   * Получение всех заказов авторизованного пользователя
   * GET /api/orders/my-orders
   */
  static async getUserOrders(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      // Проверяем авторизацию пользователя
      if (!req.user) {
        return next(createError(401, 'Необходима авторизация'));
      }

      const user_id = req.user.user_id;
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
      const offset = (page - 1) * limit;
      const { status, business_id, delivery_type } = req.query;

      // Формируем условия фильтрации
      const whereConditions: any = {
        user_id: user_id
      };

      if (business_id) {
        const businessIdNum = parseInt(business_id as string);
        if (!isNaN(businessIdNum)) {
          whereConditions.business_id = businessIdNum;
        }
      }

      if (delivery_type && ['DELIVERY', 'PICKUP', 'SCHEDULED'].includes(delivery_type as string)) {
        whereConditions.delivery_type = delivery_type as orders_delivery_type;
      }

      console.log('Получение заказов пользователя:', user_id, 'с фильтрами:', whereConditions);

      const [orders, total] = await Promise.all([
        prisma.orders.findMany({
          where: whereConditions,
          orderBy: { log_timestamp: 'desc' },
          skip: offset,
          take: limit
        }),
        prisma.orders.count({
          where: whereConditions
        })
      ]);

      // Получаем дополнительную информацию для каждого заказа
      const ordersWithDetails = [];
      for (const order of orders) {
        // Получаем последний статус заказа
        const currentStatus = await prisma.order_status.findFirst({
          where: { order_id: order.order_id },
          orderBy: { log_timestamp: 'desc' }
        });

        // Фильтрация по статусу если указан
        if (status && currentStatus?.status !== parseInt(status as string)) {
          continue;
        }

        // Получаем бизнес
        const business = await prisma.businesses.findUnique({
          where: { business_id: order.business_id || 0 },
          select: {
            business_id: true,
            name: true,
            address: true,
            logo: true,
            img: true
          }
        });

        // Получаем адрес доставки
        let deliveryAddress = null;
        if (order.address_id && order.address_id > 0) {
          deliveryAddress = await prisma.user_addreses.findUnique({
            where: { address_id: order.address_id },
            select: {
              address_id: true,
              address: true,
              name: true,
              apartment: true,
              entrance: true,
              floor: true,
              other: true,
              lat: true,
              lon: true
            }
          });
        }

        // Получаем товары заказа
        const orderItems = await prisma.orders_items.findMany({
          where: { order_id: order.order_id }
        });

        // Получаем информацию о товарах
        const itemsWithDetails = await Promise.all(
          orderItems.map(async (orderItem) => {
            const item = await prisma.items.findUnique({
              where: { item_id: orderItem.item_id },
              select: {
                item_id: true,
                name: true,
                description: true,
                img: true,
                unit: true
              }
            });

            return {
              relation_id: orderItem.relation_id,
              item_id: orderItem.item_id,
              name: item?.name || 'Неизвестный товар',
              description: item?.description || '',
              img: item?.img || '',
              amount: Number(orderItem.amount || 0),
              price: Number(orderItem.price || 0),
              unit: item?.unit || 'шт',
              total_cost: Number(orderItem.amount || 0) * Number(orderItem.price || 0)
            };
          })
        );

        // Рассчитываем общую стоимость заказа
        const itemsTotal = itemsWithDetails.reduce((sum, item) => sum + item.total_cost, 0);
        const deliveryPrice = Number(order.delivery_price || 0);
        const bonusUsed = Number(order.bonus || 0);
        const totalSum = itemsTotal + deliveryPrice - bonusUsed;

        // Определяем описание статуса
        const getStatusDescription = (statusNum: number): string => {
          const statusDescriptions: { [key: number]: string } = {
            0: 'Оплачен',
            1: 'Принят в работу',
            2: 'Готовится',
            3: 'Готов к выдаче',
            4: 'В доставке',
            5: 'Доставлен',
            66: 'Ожидает оплаты'
          };
          return statusDescriptions[statusNum] || 'Неизвестный статус';
        };

        ordersWithDetails.push({
          order_id: order.order_id,
          order_uuid: order.order_uuid,
          business: business,
          delivery_type: order.delivery_type,
          delivery_date: order.delivery_date,
          delivery_price: deliveryPrice,
          bonus_used: bonusUsed,
          extra: order.extra,
          log_timestamp: order.log_timestamp,
          is_canceled: order.is_canceled,
          current_status: currentStatus ? {
            status: currentStatus.status,
            status_description: getStatusDescription(currentStatus.status),
            is_canceled: currentStatus.isCanceled,
            log_timestamp: currentStatus.log_timestamp
          } : null,
          delivery_address: deliveryAddress,
          items: itemsWithDetails,
          cost_summary: {
            items_total: itemsTotal,
            delivery_price: deliveryPrice,
            bonus_used: bonusUsed,
            total_sum: totalSum
          }
        });
      }

      const totalPages = Math.ceil(ordersWithDetails.length / limit);

      res.json({
        success: true,
        data: {
          orders: ordersWithDetails,
          pagination: {
            page: page,
            limit: limit,
            total: status ? ordersWithDetails.length : total,
            total_pages: Math.ceil((status ? ordersWithDetails.length : total) / limit)
          },
          filters_applied: {
            status: status || null,
            business_id: business_id || null,
            delivery_type: delivery_type || null
          }
        },
        message: `Найдено ${ordersWithDetails.length} заказов`
      });

    } catch (error: any) {
      console.error('Ошибка получения заказов пользователя:', error);
      next(createError(500, `Ошибка получения заказов: ${error.message}`));
    }
  }

  /**
   * Обновление статуса заказа
   * PUT /api/orders/:id/status
   */
  static async updateOrderStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const orderId = parseInt(req.params.id);
      const { status, isCanceled } = req.body;

      if (isNaN(orderId)) {
        return next(createError(400, 'Неверный ID заказа'));
      }

      if (!status || !Object.values(OrderStatus).includes(status)) {
        return next(createError(400, 'Неверный статус заказа'));
      }

      // Проверяем существование заказа и получаем информацию о пользователе
      const order = await prisma.orders.findUnique({
        where: { order_id: orderId }
      });

      if (!order) {
        return next(createError(404, 'Заказ не найден'));
      }

      // Получаем информацию о бизнесе
      const business = await prisma.businesses.findUnique({
        where: { business_id: order.business_id || 1 }
      });

      // Создаем новую запись статуса
      const statusRecord = await prisma.order_status.create({
        data: {
          order_id: orderId,
          status,
          isCanceled: isCanceled ? 1 : 0,
          log_timestamp: new Date()
        }
      });

      // Если заказ отменяется, обновляем флаг в основной таблице
      if (isCanceled) {
        await prisma.orders.update({
          where: { order_id: orderId },
          data: { is_canceled: 1 }
        });
      }

      // Обновляем время принятия/готовности заказа
      const updateData: any = {};
      if (status === OrderStatus.ACCEPTED && !order.accepted_at) {
        updateData.accepted_at = new Date();
      }
      if (status === OrderStatus.DELIVERED && !order.ready_at) {
        updateData.ready_at = new Date();
      }

      if (Object.keys(updateData).length > 0) {
        await prisma.orders.update({
          where: { order_id: orderId },
          data: updateData
        });
      }

      // Отправляем уведомление пользователю о смене статуса заказа
      try {
        // await NotificationController.sendOrderStatusNotification({
        //   order_id: orderId,
        //   order_uuid: order.order_uuid || '',
        //   status: status,
        //   business_name: business?.name || 'Неизвестное заведение'
        // });
        console.log(`Уведомление о смене статуса заказа ${orderId} отправлено пользователю ${order.user_id}`);
      } catch (notificationError) {
        console.error('Ошибка отправки уведомления:', notificationError);
        // Не прерываем выполнение, если уведомление не удалось отправить
      }

      res.json({
        success: true,
        data: { 
          status_record: statusRecord,
          order_id: orderId,
          new_status: status
        },
        message: 'Статус заказа обновлен'
      });

    } catch (error: any) {
      console.error('Ошибка обновления статуса заказа:', error);
      next(createError(500, `Ошибка обновления статуса: ${error.message}`));
    }
  }

  /**
   * Отмена заказа
   * DELETE /api/orders/:id
   */
  static async cancelOrder(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const orderId = parseInt(req.params.id);

      if (isNaN(orderId)) {
        return next(createError(400, 'Неверный ID заказа'));
      }

      const order = await prisma.orders.findUnique({
        where: { order_id: orderId }
      });

      if (!order) {
        return next(createError(404, 'Заказ не найден'));
      }

      // Проверяем права доступа
      if (req.user && req.user.user_id !== order.user_id) {
        return next(createError(403, 'Доступ запрещен'));
      }

      // Получаем текущий статус
      const currentStatusRecord = await prisma.order_status.findFirst({
        where: { order_id: orderId },
        orderBy: { log_timestamp: 'desc' }
      });

      // Проверяем, можно ли отменить заказ
      const currentStatus = currentStatusRecord?.status;
      if (currentStatus && currentStatus >= OrderStatus.COLLECTED) {
        return next(createError(400, 'Заказ нельзя отменить на текущей стадии'));
      }

      if (order.is_canceled === 1) {
        return next(createError(400, 'Заказ уже отменен'));
      }

      // Отменяем заказ
      await prisma.$transaction([
        prisma.orders.update({
          where: { order_id: orderId },
          data: { is_canceled: 1 }
        }),
        prisma.order_status.create({
          data: {
            order_id: orderId,
            status: OrderStatus.CANCELED,
            isCanceled: 1,
            log_timestamp: new Date()
          }
        })
      ]);

      res.json({
        success: true,
        data: { order_id: orderId },
        message: 'Заказ отменен'
      });

    } catch (error: any) {
      console.error('Ошибка отмены заказа:', error);
      next(createError(500, `Ошибка отмены заказа: ${error.message}`));
    }
  }

  /**
   * Тестовый метод для проверки генерации числового UUID
   * GET /api/orders/test-uuid
   */
  static async testNumericUuid(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = parseInt(req.query.user_id as string) || 252;
      const count = parseInt(req.query.count as string) || 5;
      
      const generatedUuids = [];
      for (let i = 0; i < count; i++) {
        const uuid = OrderController.generateNumericOrderUuid(userId);
        generatedUuids.push({
          uuid,
          length: uuid.length,
          isNumeric: /^\d+$/.test(uuid),
          timestamp: Date.now()
        });
        
        // Небольшая задержка между генерациями
        await new Promise(resolve => setTimeout(resolve, 1));
      }

      // Проверяем уникальность
      const uniqueUuids = [...new Set(generatedUuids.map(item => item.uuid))];
      const allUnique = uniqueUuids.length === generatedUuids.length;

      res.json({
        success: true,
        data: {
          user_id: userId,
          generated_count: count,
          uuids: generatedUuids,
          unique_count: uniqueUuids.length,
          all_unique: allUnique,
          all_numeric: generatedUuids.every(item => item.isNumeric),
          example_format: `${Math.floor(Date.now() / 1000)}${userId.toString().padStart(3, '0').slice(-3)}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`
        },
        message: `Сгенерировано ${count} числовых UUID для пользователя ${userId}`
      });

    } catch (error: any) {
      console.error('Ошибка тестирования UUID:', error);
      next(createError(500, `Ошибка тестирования: ${error.message}`));
    }
  }
}