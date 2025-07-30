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
import { NotificationController } from './notificationController';

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
        delivery = false, // boolean для доставки
        bonus = false, // boolean для использования бонусов
        extra = '',
        card_id, // ID сохраненной карты (аналог card_id в PHP)
        address_id // Опциональный конкретный ID адреса для доставки
      } = req.body;

      // Проверяем авторизацию пользователя
      if (!req.user) {
        return next(createError(401, 'Необходима авторизация'));
      }

      const user_id = req.user.user_id;

      // Входные проверки как в PHP
      if (!business_id || !items || items.length === 0) {
        return next(createError(400, 'Не все обязательные поля заполнены'));
      }

      console.log('Начинаем создание заказа для пользователя:', user_id);

      // Получаем адрес для доставки - ДО транзакции
      let selectedAddress = null;
      
      // Если передан конкретный address_id, используем его
      if (address_id && delivery) {
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
      else if (delivery) {
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

      if (!selectedAddress && delivery) {
        return next(createError(400, 'Не найден адрес для доставки'));
      }

      // Рассчитываем стоимость доставки (аналог getDistanceToBusinesses4) - ДО транзакции
      let deliveryPrice = 0;
      if (delivery && selectedAddress) {
        try {
          const deliveryResult = await DeliveryController.calculateDeliveryZone({
            lat: Number(selectedAddress.lat),
            lon: Number(selectedAddress.lon),
            business_id
          });
          
          if (deliveryResult.in_zone && deliveryResult.price !== false) {
            deliveryPrice = Number(deliveryResult.price);
          } else {
            return next(createError(400, `Доставка недоступна: ${deliveryResult.message}`));
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
          // Добавляем основной товар в заказ
          const orderItem = await tx.orders_items.create({
            data: {
              order_id: order.order_id,
              item_id: validatedItem.item_id,
              price_id: null, // Не используем price_id, цена из items
              amount: validatedItem.amount,
              price: validatedItem.itemPrice // Цена из таблицы items
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

        console.log('ID карты:', card_id);

        // Возвращаем успешный результат
        return {
          success: true,
          order_id: order.order_id,
          order_uuid: order_uuid
        };
      }, {
        maxWait: 10000, // максимальное время ожидания транзакции - 10 секунд
        timeout: 15000  // таймаут выполнения транзакции - 15 секунд
      });

      // Обрабатываем платеж после завершения транзакции
      if (card_id) {
        console.log('⚠️  ВНИМАНИЕ: card_id передан, но оплата не будет выполнена');
        console.log('Используйте отдельный endpoint POST /api/orders/:id/pay для оплаты заказа');
      }

      // Отправляем уведомление о создании заказа
      try {
        // Получаем информацию о бизнесе для уведомления
        const businessInfo = await prisma.businesses.findUnique({
          where: { business_id: business_id }
        });

        await NotificationController.sendOrderStatusNotification({
          order_id: orderResult.order_id,
          order_uuid: orderResult.order_uuid,
          status: 'created',
          business_name: businessInfo?.name || 'Неизвестное заведение'
        });
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
          message: card_id ? 'Заказ создан. Для оплаты используйте POST /api/orders/' + orderResult.order_id + '/pay' : 'Заказ успешно создан'
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
    
    // Считаем стоимость товаров
    for (const item of orderItems) {
      sumBeforeDelivery += Number(item.price || 0) * Number(item.amount || 0);
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
    
    // Считаем стоимость товаров
    for (const item of orderItems) {
      sumBeforeDelivery += Number(item.price || 0) * Number(item.amount || 0);
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
   */
  static async payOrder(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const orderId = parseInt(req.params.id);
      const { card_id, payment_type = 'card' } = req.body;

      if (isNaN(orderId)) {
        return next(createError(400, 'Неверный ID заказа'));
      }

      // Валидация типа оплаты
      if (!['card', 'page'].includes(payment_type)) {
        return next(createError(400, 'Неверный тип оплаты. Доступны: "card" (сохраненная карта), "page" (страница оплаты)'));
      }

      // Для оплаты сохраненной картой card_id обязателен
      if (payment_type === 'card' && !card_id) {
        return next(createError(400, 'Для оплаты сохраненной картой необходимо указать card_id'));
      }

      // Проверяем авторизацию пользователя
      if (!req.user) {
        return next(createError(401, 'Необходима авторизация'));
      }

      const user_id = req.user.user_id;

      // Проверяем существование заказа и права доступа
      const order = await prisma.orders.findUnique({
        where: { order_id: orderId }
      });

      if (!order) {
        return next(createError(404, 'Заказ не найден'));
      }

      if (order.user_id !== user_id) {
        return next(createError(403, 'Доступ запрещен - заказ принадлежит другому пользователю'));
      }

      // Проверяем статус заказа
      const currentStatus = await prisma.order_status.findFirst({
        where: { order_id: orderId },
        orderBy: { log_timestamp: 'desc' }
      });

      if (!currentStatus) {
        return next(createError(400, 'Не найден статус заказа'));
      }

      // Проверяем, можно ли оплачивать заказ
      if (currentStatus.status === 0) {
        return res.json({
          success: true,
          data: { message: 'Заказ уже оплачен' },
          message: 'Заказ уже оплачен'
        });
      }

      if (currentStatus.isCanceled === 1) {
        return next(createError(400, 'Нельзя оплатить отмененный заказ'));
      }

      // Оплачивать можно только новые заказы (статус 66)
      if (currentStatus.status !== 66) {
        if (currentStatus.status >= 1 && currentStatus.status <= 5) {
          return next(createError(400, 'Заказ уже в процессе выполнения или доставлен'));
        } else {
          return next(createError(400, 'Заказ находится в неподходящем для оплаты статусе'));
        }
      }

      console.log('Начинаем оплату заказа:', orderId, 'типом:', payment_type);

      try {
        let paymentResult;

        if (payment_type === 'card') {
          // Оплата сохраненной картой
          console.log('Оплата сохраненной картой:', card_id);
          paymentResult = await OrderController.processCardPayment(orderId, user_id, card_id);
        } else {
          // Создание ссылки для оплаты на странице
          console.log('Создание ссылки для оплаты на странице');
          paymentResult = await OrderController.createPaymentPage(orderId, user_id);
        }

        console.log('Результат платежа:', paymentResult);

        res.json({
          success: true,
          data: {
            order_id: orderId,
            payment_type: payment_type,
            payment_result: paymentResult
          },
          message: paymentResult.status === 'ok' || paymentResult.status === 'redirect' 
            ? (payment_type === 'card' ? 'Заказ успешно оплачен' : 'Ссылка для оплаты создана')
            : 'Ошибка при оплате заказа'
        });

      } catch (paymentError: any) {
        console.error('Ошибка обработки платежа:', paymentError);
        res.status(500).json({
          success: false,
          error: paymentError.message,
          message: 'Ошибка при обработке платежа'
        });
      }

    } catch (error: any) {
      console.error('Ошибка оплаты заказа:', error);
      next(createError(500, `Ошибка оплаты заказа: ${error.message}`));
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
   * Обработка платежа картой (аналог pay2 PHP)
   */
  private static async processCardPayment(orderId: number, userId: number, cardId: number): Promise<any> {
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

      // Получаем данные карты
      const card = await prisma.halyk_saved_cards.findFirst({
        where: {
          user_id: userId,
          card_id: cardId
        }
      });

      if (!card) {
        throw new Error('Карта не найдена');
      }

      // Получаем стоимость заказа
      const orderTotal = await OrderController.calculateOrderTotal(orderId);
      const amount = Math.round(orderTotal.total_sum * 1); // В тийинах

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

      // Формируем данные для платежа (точно как в PHP)
      const paymentData = {
        amount: amount,
        currency: 'KZT',
        name: user.name || user.login,
        terminalId: 'bb4dec49-6e30-41d0-b16b-8ba1831a854b',
        invoiceId: order.order_uuid,
        description: 'Доставка алкоголя',
        accountId: user.user_id.toString(),
        backLink: 'https://chorenn.naliv.kz/success',
        failureBackLink: 'https://chorenn.naliv.kz/failure',
        postLink: 'https://chorenn.naliv.kz/api/payment.php',
        language: 'rus',
        paymentType: 'cardId',
        cardId: { id: card.halyk_card_id }
      };

      console.log('Отправляем данные платежа в Halyk Bank:');
      console.log('- Сумма:', amount, 'тийин');
      console.log('- Валюта:', paymentData.currency);
      console.log('- Invoice ID:', paymentData.invoiceId);
      console.log('- Card ID:', card.halyk_card_id);

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
        
        // Обновляем статус заказа и payment_id (как в PHP)
        await prisma.order_status.create({
          data: {
            order_id: orderId,
            status: 0, // Статус 0 как в PHP - оплачено
            isCanceled: 0,
            log_timestamp: new Date()
          }
        });

        if (halykResponse.id) {
          await prisma.orders.update({
            where: { order_id: orderId },
            data: { payment_id: halykResponse.id }
          });
          console.log('Обновлен payment_id заказа:', halykResponse.id);
        }

        return { 
          status: 'ok', 
          payment_id: halykResponse.id,
          bank_response: halykResponse
        };
      } else {
        console.error('Ошибка платежа. Статус:', response.status, 'Ответ:', responseText);
        
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
            console.error('Код ошибки банка (карта):', bankErrorCode, 'Сообщение:', bankErrorMessage);
            console.log('Обработанная ошибка:', halykErrorInfo);
          }
        } catch (parseError) {
          console.log('Не удалось парсить ответ банка как JSON');
        }
        
        // Определяем тип ошибки на основе кода банка
        let errorType = 'unknown';
        let userMessage = 'Ошибка при обработке платежа в банке';
        
        if (halykErrorInfo) {
          errorType = halykErrorInfo.status;
          userMessage = halykErrorInfo.message;
        } else if (response.status === 400) {
          errorType = 'bad_request';
        } else if (response.status === 402) {
          errorType = 'insufficient_funds';
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
      console.error('Ошибка обработки платежа:', error);
      return { status: 'unknown', error: error.message };
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
        scope: 'payment',
        client_id: 'NALIV.KZ',
        client_secret: 'B5Y56*Hw9hxcvwwY',
        invoiceID: orderUuid,
        amount: amount.toString(),
        currency: 'KZT',
        terminal: 'bb4dec49-6e30-41d0-b16b-8ba1831a854b'
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
   * Получение активных заказов
   * GET /api/orders/active
   */
  static async getActiveOrders(req: any, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const offset = (page - 1) * limit;
      const businessId = req.query.business_id ? parseInt(req.query.business_id as string) : null;

      // Определяем активные статусы (не отмененные и не доставленные)
      const activeStatuses = [66, 0, 1, 2, 3, 4]; // NEW, PAID, PROCESSING, COLLECTED, COURIER, DELIVERY

      // Строим условие для фильтрации
      const whereCondition: any = {
        is_canceled: 0 // Не отмененные заказы
      };

      // Если указан business_id, фильтруем по нему
      if (businessId && !isNaN(businessId)) {
        whereCondition.business_id = businessId;
      }

      // Если это запрос от авторизованного пользователя (не сотрудника), показываем только его заказы
      // независимо от указанного business_id
      if (req.user && !req.employee) {
        whereCondition.user_id = req.user.user_id;
      }

      // Получаем заказы и общее количество
      const [orders, total] = await Promise.all([
        prisma.orders.findMany({
          where: whereCondition,
          orderBy: { log_timestamp: 'desc' },
          skip: offset,
          take: limit
        }),
        prisma.orders.count({
          where: whereCondition
        })
      ]);

      // Фильтруем по активным статусам
      const activeOrders = [];
      for (const order of orders) {
        // Получаем последний статус заказа
        const lastStatus = await prisma.order_status.findFirst({
          where: { order_id: order.order_id },
          orderBy: { log_timestamp: 'desc' }
        });

        // Проверяем, активен ли заказ
        if (lastStatus && activeStatuses.includes(lastStatus.status) && lastStatus.isCanceled === 0) {
          // Получаем дополнительную информацию
          const [business, cost, itemsCount] = await Promise.all([
            prisma.businesses.findUnique({
              where: { business_id: order.business_id || 0 },
              select: {
                business_id: true,
                name: true,
                address: true,
                logo: true
              }
            }),
            prisma.orders_cost.findFirst({
              where: { order_id: order.order_id }
            }),
            prisma.orders_items.count({
              where: { order_id: order.order_id }
            })
          ]);

          // Получаем информацию о пользователе (если запрос от сотрудника)
          let user = null;
          if (req.employee || !req.user) {
            const userData = await prisma.user.findUnique({
              where: { user_id: order.user_id },
              select: {
                user_id: true,
                name: true,
                login: true
              }
            });
            user = userData;
          }

          // Мапим статус в понятное описание
          const getStatusInfo = (status: number) => {
            switch (status) {
              case 66: return { name: 'Новый заказ', color: '#ffa500', icon: 'pending' };
              case 0: return { name: 'Оплачен', color: '#4caf50', icon: 'paid' };
              case 1: return { name: 'В обработке', color: '#2196f3', icon: 'processing' };
              case 2: return { name: 'Собран', color: '#9c27b0', icon: 'ready' };
              case 3: return { name: 'Передан курьеру', color: '#ff9800', icon: 'courier' };
              case 4: return { name: 'В пути', color: '#607d8b', icon: 'delivery' };
              default: return { name: 'Неизвестен', color: '#gray', icon: 'unknown' };
            }
          };

          const statusInfo = getStatusInfo(lastStatus.status);

          activeOrders.push({
            ...order,
            current_status: {
              status: lastStatus.status,
              isCanceled: lastStatus.isCanceled,
              log_timestamp: lastStatus.log_timestamp,
              ...statusInfo,
              time_ago: OrderController.getTimeAgo(lastStatus.log_timestamp)
            },
            business,
            user,
            cost: cost ? {
              total: Number(cost.cost),
              delivery: Number(cost.delivery),
              service_fee: Number(cost.service_fee)
            } : null,
            items_count: itemsCount,
            time_since_created: OrderController.getTimeAgo(order.log_timestamp)
          });
        }
      }

      const totalPages = Math.ceil(activeOrders.length / limit);

      res.json({
        success: true,
        data: {
          orders: activeOrders,
          pagination: {
            current_page: page,
            per_page: limit,
            total: activeOrders.length,
            total_pages: totalPages,
            total_all_orders: total
          },
          filters: {
            business_id: businessId,
            only_user_orders: req.user && !req.employee ? req.user.user_id : null
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
   * Получение заказов пользователя
   * GET /api/orders/user/:userId
   */
  static async getUserOrders(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = parseInt(req.params.userId);
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const offset = (page - 1) * limit;

      if (isNaN(userId)) {
        return next(createError(400, 'Неверный ID пользователя'));
      }

      // Проверяем права доступа
      if (req.user && req.user.user_id !== userId) {
        return next(createError(403, 'Доступ запрещен'));
      }

      const [orders, total] = await Promise.all([
        prisma.orders.findMany({
          where: { user_id: userId },
          orderBy: { log_timestamp: 'desc' },
          skip: offset,
          take: limit
        }),
        prisma.orders.count({
          where: { user_id: userId }
        })
      ]);

      // Получаем дополнительную информацию для каждого заказа
      const ordersWithDetails = [];
      for (const order of orders) {
        // Получаем бизнес
        const business = await prisma.businesses.findUnique({
          where: { business_id: order.business_id || 0 }
        });

        // Получаем последний статус
        const status = await prisma.order_status.findFirst({
          where: { order_id: order.order_id },
          orderBy: { log_timestamp: 'desc' }
        });

        // Получаем стоимость
        const cost = await prisma.orders_cost.findFirst({
          where: { order_id: order.order_id }
        });

        // Считаем количество товаров
        const itemsCount = await prisma.orders_items.count({
          where: { order_id: order.order_id }
        });

        ordersWithDetails.push({
          ...order,
          business: business ? {
            id: business.business_id,
            name: business.name,
            address: business.address,
            logo: business.logo
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
          items_count: itemsCount
        });
      }

      const totalPages = Math.ceil(total / limit);

      res.json({
        success: true,
        data: {
          orders: ordersWithDetails,
          pagination: {
            current_page: page,
            per_page: limit,
            total,
            total_pages: totalPages
          }
        },
        message: `Найдено ${total} заказов`
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
        await NotificationController.sendOrderStatusNotification({
          order_id: orderId,
          order_uuid: order.order_uuid || '',
          status: status,
          business_name: business?.name || 'Неизвестное заведение'
        });
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
