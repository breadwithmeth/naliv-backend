import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { createError } from '../middleware/errorHandler';
import axios from 'axios';

const prisma = new PrismaClient();

// Кеш для расчетов доставки в памяти приложения для ускорения
const deliveryCache = new Map<string, any>();
const addressCache = new Map<string, any>(); // Дополнительный кеш для адресов
const CACHE_TTL = 5 * 60 * 1000; // 5 минут
const ADDRESS_CACHE_TTL = 2 * 60 * 1000; // 2 минуты для адресов

// Счетчик активных запросов для мониторинга производительности
let activeDeliveryRequests = 0;
const MAX_CONCURRENT_DELIVERY_REQUESTS = 5;

// Очистка устаревших записей кеша каждые 10 минут
setInterval(() => {
  const now = Date.now();
  let cleanedCount = 0;
  
  // Очистка кеша доставки
  for (const [key, value] of deliveryCache.entries()) {
    if ((now - value.timestamp) > CACHE_TTL) {
      deliveryCache.delete(key);
      cleanedCount++;
    }
  }
  
  // Очистка кеша адресов
  for (const [key, value] of addressCache.entries()) {
    if ((now - value.timestamp) > ADDRESS_CACHE_TTL) {
      addressCache.delete(key);
      cleanedCount++;
    }
  }
  
  if (cleanedCount > 0) {
    console.log(`🧹 Очищено ${cleanedCount} устаревших записей из кеша доставки`);
  }
}, 10 * 60 * 1000); // 10 минут

interface AuthRequest extends Request {
  user?: {
    user_id: number;
    login: string;
  };
}

interface CreateAddressRequest {
  lat: number;
  lon: number;
  address: string;
  name: string;
  apartment?: string;
  entrance?: string;
  floor?: string;
  other?: string;
  city_id?: number;
}

interface UpdateAddressRequest {
  lat?: number;
  lon?: number;
  address?: string;
  name?: string;
  apartment?: string;
  entrance?: string;
  floor?: string;
  other?: string;
  city_id?: number;
}

export class AddressController {
  /**
   * Поиск адресов через Яндекс.Карты
   * GET /api/addresses/search?query=улица+пушкина
   */
  static async searchAddresses(req: Request, res: Response, next: NextFunction) {
    try {
      console.log('🔍 Запрос поиска адресов:', req.query);
      const { query } = req.query;

      if (!query || typeof query !== 'string') {
        console.log('❌ Ошибка: отсутствует параметр query');
        return next(createError(400, 'Параметр query обязателен'));
      }

      console.log('🌍 Пытаемся использовать Yandex API для поиска:', query);

      // Сначала пробуем использовать Yandex API
      try {
        const endpoint = 'https://geocode-maps.yandex.ru/1.x';
        const params = {
          apikey: '7e1b6231-620b-4f24-87fa-c85027f630ab',
          geocode: query,
          format: 'json',
          lang: 'ru_RU'
         
        };

        const url = `${endpoint}?${new URLSearchParams(params)}`;
        console.log('📡 Отправляем запрос к Yandex API:', url);

        const response = await axios.get(url, {
          timeout: 1000 // 1 секунда таймаут для быстрого фейлбека
        });

        console.log('✅ Получен ответ от Yandex API:', response.status);

        const geodata = response.data;
        
        if (!geodata?.response?.GeoObjectCollection?.featureMember) {
          throw new Error('Пустой ответ от API');
        }
        
        const items = geodata.response.GeoObjectCollection.featureMember;

        const formattedItems = items.map((item: any) => {
          const geoObject = item.GeoObject;
          const point = geoObject.Point.pos.split(' ');
          
          return {
            name: geoObject.metaDataProperty.GeocoderMetaData.Address.formatted,
            point: {
              lat: parseFloat(point[1]),
              lon: parseFloat(point[0])
            },
            description: geoObject.description || '',
            kind: geoObject.metaDataProperty.GeocoderMetaData.kind || 'house',
            precision: geoObject.metaDataProperty.GeocoderMetaData.precision || 'exact'
          };
        });

        // Проверяем релевантность результатов
        const isRelevant = AddressController.checkResultsRelevance(query, formattedItems);
        
        if (!isRelevant) {
          console.log('🔄 Результаты Yandex API не релевантны, используем локальные данные');
          throw new Error('Результаты не релевантны запросу');
        }

        res.json({
          success: true,
          data: formattedItems,
          message: 'Адреса найдены'
        });

      } catch (apiError: any) {
        console.warn('⚠️  Yandex API недоступен, используем локальную базу:', apiError.message);
        
        // Возвращаем моковые данные
        const mockData = AddressController.getMockAddressData(query.toString().toLowerCase());
        
        console.log('� Ищем в моковых данных по запросу:', `"${query.toString().toLowerCase()}"`);
        console.log('�📦 Возвращаем моковые данные:', mockData.length, 'элементов');
        
        res.json({
          success: true,
        //   data: mockData,
        //   message: mockData.length > 0 ? 'Адреса найдены (локальная база)' : 'Адреса не найдены (локальная база)'
        });
      }

    } catch (error: any) {
      console.error('Ошибка поиска адресов:', error);
      next(createError(500, `Ошибка поиска адресов: ${error.message}`));
    }
  }

  /**
   * Моковые данные для поиска адресов
   */
  private static getMockAddressData(query: string): any[] {
    const mockAddresses: { [key: string]: any[] } = {
      'москва': [
        {
          name: 'Россия, Москва',
          point: { lat: 55.755864, lon: 37.617698 },
          description: 'Столица России',
          kind: 'locality',
          precision: 'exact'
        }
      ],
      'алматы': [
        {
          name: 'Казахстан, Алматы',
          point: { lat: 43.238293, lon: 76.945465 },
          description: 'Крупнейший город Казахстана',
          kind: 'locality',
          precision: 'exact'
        }
      ],
      'павлодар': [
        {
          name: 'Казахстан, Павлодар',
          point: { lat: 52.285446, lon: 76.970107 },
          description: 'Город в Казахстане',
          kind: 'locality',
          precision: 'exact'
        },
        {
          name: 'Казахстан, Павлодар, улица Пахомова, 72',
          point: { lat: 52.2854, lon: 76.9701 },
          description: 'Улица Пахомова, Павлодар, Казахстан',
          kind: 'house',
          precision: 'exact'
        },
        {
          name: 'Казахстан, Павлодар, улица Пахомова',
          point: { lat: 52.2850, lon: 76.9705 },
          description: 'Улица в Павлодаре, Казахстан',
          kind: 'street',
          precision: 'exact'
        }
      ],
      'астана': [
        {
          name: 'Казахстан, Нур-Султан',
          point: { lat: 51.128422, lon: 71.430564 },
          description: 'Столица Казахстана',
          kind: 'locality',
          precision: 'exact'
        }
      ],
      'пушкина': [
        {
          name: 'Россия, Москва, улица Пушкина',
          point: { lat: 55.749792, lon: 37.632495 },
          description: 'Улица в Москве',
          kind: 'street',
          precision: 'exact'
        }
      ]
    };

    // Улучшенный поиск по ключевым словам
    const queryWords = query.toLowerCase().split(/\s+/).filter(word => word.length > 2);
    
    // Сначала пробуем точное совпадение городов
    for (const [key, addresses] of Object.entries(mockAddresses)) {
      if (query.toLowerCase().includes(key) || key.includes(query.toLowerCase())) {
        return addresses;
      }
    }

    // Потом поиск по отдельным словам для более сложных запросов
    for (const [key, addresses] of Object.entries(mockAddresses)) {
      const cityMatch = queryWords.some(word => word.includes(key) || key.includes(word));
      if (cityMatch) {
        // Фильтруем адреса по дополнительным критериям
        const filteredAddresses = addresses.filter(addr => {
          const addrText = (addr.name + ' ' + addr.description).toLowerCase();
          return queryWords.some(word => addrText.includes(word));
        });
        
        if (filteredAddresses.length > 0) {
          return filteredAddresses;
        }
        
        // Если нет точных совпадений, возвращаем все адреса города
        return addresses;
      }
    }

    return [];
  }

  /**
   * Проверка релевантности результатов поиска
   */
  private static checkResultsRelevance(query: string, results: any[]): boolean {
    const queryLower = query.toLowerCase().trim();
    
    // Если результатов нет, то не релевантно
    if (!results || results.length === 0) {
      return false;
    }

    // Ключевые слова для поиска в Казахстане
    const kazakhCities = ['павлодар', 'алматы', 'астана', 'нур-султан', 'шымкент', 'караганда', 'тараз', 'актобе', 'семей', 'усть-каменогорск', 'кызылорда', 'атырау', 'костанай', 'актау', 'петропавловск'];
    
    // Проверяем, содержит ли запрос казахстанский город
    const isKazakhQuery = kazakhCities.some(city => queryLower.includes(city));
    
    if (isKazakhQuery) {
      // Если запрос про Казахстан, проверяем есть ли казахстанские результаты
      const hasKazakhResults = results.some(item => 
        item.name.toLowerCase().includes('казахстан') || 
        item.description.toLowerCase().includes('казахстан')
      );
      
      // Если нет казахстанских результатов для казахстанского запроса - не релевантно
      if (!hasKazakhResults) {
        return false;
      }
    }

    // Проверяем релевантность по ключевым словам запроса
    const queryWords = queryLower.split(/\s+/).filter(word => word.length > 2);
    
    if (queryWords.length === 0) {
      return true; // Если нет конкретных слов, считаем релевантным
    }

    // Считаем результат релевантным, если хотя бы 30% результатов содержат слова из запроса
    let relevantCount = 0;
    
    for (const item of results) {
      const itemText = (item.name + ' ' + item.description).toLowerCase();
      const matchingWords = queryWords.filter(word => itemText.includes(word));
      
      if (matchingWords.length > 0) {
        relevantCount++;
      }
    }

    const relevanceRatio = relevantCount / results.length;
    return relevanceRatio >= 0.3; // Минимум 30% релевантных результатов
  }

  /**
   * Добавить новый адрес пользователя
   * POST /api/addresses
   */
  static async addAddress(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.user_id;
      const { name, address, lat, lon, apartment, entrance, floor, other } = req.body;

      // Валидация обязательных полей
      if (!name || !address || lat === undefined || lon === undefined) {
        return next(createError(400, 'Обязательные поля: name, address, lat, lon'));
      }

      // Валидация координат
      if (typeof lat !== 'number' || typeof lon !== 'number') {
        return next(createError(400, 'Координаты должны быть числами'));
      }

      if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
        return next(createError(400, 'Некорректные координаты'));
      }

      // Создаем новый адрес
      const newAddress = await prisma.user_addreses.create({
        data: {
          user_id: userId,
          name: name.trim(),
          address: address.trim(),
          lat: lat,
          lon: lon,
          apartment: apartment?.trim() || '',
          entrance: entrance?.trim() || '',
          floor: floor?.trim() || '',
          other: other?.trim() || ''
        }
      });

      res.status(201).json({
        success: true,
        data: newAddress,
        message: 'Адрес успешно добавлен'
      });

    } catch (error: any) {
      console.error('Ошибка добавления адреса:', error);
      next(createError(500, `Ошибка добавления адреса: ${error.message}`));
    }
  }

  /**
   * Обновить адрес пользователя
   * PUT /api/addresses/:id
   */
  static async updateAddress(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.user_id;
      const addressId = parseInt(req.params.id);
      const { name, address, lat, lon, apartment, entrance, floor, other } = req.body;

      if (!addressId || isNaN(addressId)) {
        return next(createError(400, 'Некорректный ID адреса'));
      }

      // Проверяем существование адреса и принадлежность пользователю
      const existingAddress = await prisma.user_addreses.findFirst({
        where: {
          address_id: addressId,
          user_id: userId
        }
      });

      if (!existingAddress) {
        return next(createError(404, 'Адрес не найден или не принадлежит пользователю'));
      }

      // Подготавливаем данные для обновления
      const updateData: any = {};

      if (name !== undefined) {
        if (!name.trim()) {
          return next(createError(400, 'Название адреса не может быть пустым'));
        }
        updateData.name = name.trim();
      }

      if (address !== undefined) {
        if (!address.trim()) {
          return next(createError(400, 'Адрес не может быть пустым'));
        }
        updateData.address = address.trim();
      }

      if (lat !== undefined) {
        if (typeof lat !== 'number' || lat < -90 || lat > 90) {
          return next(createError(400, 'Некорректная широта'));
        }
        updateData.lat = lat;
      }

      if (lon !== undefined) {
        if (typeof lon !== 'number' || lon < -180 || lon > 180) {
          return next(createError(400, 'Некорректная долгота'));
        }
        updateData.lon = lon;
      }

      if (apartment !== undefined) {
        updateData.apartment = apartment?.trim() || '';
      }

      if (entrance !== undefined) {
        updateData.entrance = entrance?.trim() || '';
      }

      if (floor !== undefined) {
        updateData.floor = floor?.trim() || '';
      }

      if (other !== undefined) {
        updateData.other = other?.trim() || '';
      }

      // Обновляем адрес
      const updatedAddress = await prisma.user_addreses.update({
        where: { address_id: addressId },
        data: updateData
      });

      res.json({
        success: true,
        data: updatedAddress,
        message: 'Адрес успешно обновлен'
      });

    } catch (error: any) {
      console.error('Ошибка обновления адреса:', error);
      next(createError(500, `Ошибка обновления адреса: ${error.message}`));
    }
  }

  /**
   * Удалить адрес пользователя
   * DELETE /api/addresses/:id
   */
  static async deleteAddress(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.user_id;
      const addressId = parseInt(req.params.id);

      if (!addressId || isNaN(addressId)) {
        return next(createError(400, 'Некорректный ID адреса'));
      }

      // Проверяем существование адреса и принадлежность пользователю
      const existingAddress = await prisma.user_addreses.findFirst({
        where: {
          address_id: addressId,
          user_id: userId
        }
      });

      if (!existingAddress) {
        return next(createError(404, 'Адрес не найден или не принадлежит пользователю'));
      }

      // Проверяем, используется ли адрес в заказах
      const ordersWithAddress = await prisma.orders.findFirst({
        where: {
          address_id: addressId,
          user_id: userId
        }
      });

      if (ordersWithAddress) {
        return next(createError(400, 'Нельзя удалить адрес, используемый в заказах'));
      }

      // Удаляем адрес
      await prisma.user_addreses.delete({
        where: { address_id: addressId }
      });

      res.json({
        success: true,
        data: { address_id: addressId },
        message: 'Адрес успешно удален'
      });

    } catch (error: any) {
      console.error('Ошибка удаления адреса:', error);
      next(createError(500, `Ошибка удаления адреса: ${error.message}`));
    }
  }

  /**
   * Получить конкретный адрес пользователя
   * GET /api/addresses/:id
   */
  static async getAddress(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.user_id;
      const addressId = parseInt(req.params.id);

      if (!addressId || isNaN(addressId)) {
        return next(createError(400, 'Некорректный ID адреса'));
      }

      const address = await prisma.user_addreses.findFirst({
        where: {
          address_id: addressId,
          user_id: userId
        }
      });

      if (!address) {
        return next(createError(404, 'Адрес не найден или не принадлежит пользователю'));
      }

      res.json({
        success: true,
        data: address,
        message: 'Адрес получен'
      });

    } catch (error: any) {
      console.error('Ошибка получения адреса:', error);
      next(createError(500, `Ошибка получения адреса: ${error.message}`));
    }
  }

  /**
   * Получение всех адресов пользователя
   * GET /api/addresses/user
   */
  static async getUserAddresses(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return next(createError(401, 'Требуется авторизация'));
      }

      const addresses = await prisma.user_addreses.findMany({
        where: {
          user_id: req.user.user_id,
          isDeleted: 0
        },
        orderBy: {
          log_timestamp: 'desc'
        }
      });

      res.json({
        success: true,
        data: {
          addresses: addresses.map(address => ({
            address_id: address.address_id,
            lat: address.lat,
            lon: address.lon,
            address: address.address,
            name: address.name,
            apartment: address.apartment,
            entrance: address.entrance,
            floor: address.floor,
            other: address.other,
            city_id: address.city_id,
            created_at: address.log_timestamp
          }))
        },
        message: `Найдено ${addresses.length} адресов`
      });

    } catch (error: any) {
      console.error('Ошибка получения адресов:', error);
      next(createError(500, `Ошибка получения адресов: ${error.message}`));
    }
  }

  /**
   * Получение конкретного адреса пользователя с опциональной проверкой доставки
   * GET /api/addresses/user/:id?business_id=1
   */
  static async getUserAddressById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return next(createError(401, 'Требуется авторизация'));
      }

      const addressId = parseInt(req.params.id);
      const businessId = req.query.business_id ? parseInt(req.query.business_id as string) : null;
      
      if (isNaN(addressId)) {
        return next(createError(400, 'Неверный ID адреса'));
      }

      const address = await prisma.user_addreses.findFirst({
        where: {
          address_id: addressId,
          user_id: req.user.user_id,
          isDeleted: 0
        }
      });

      if (!address) {
        return next(createError(404, 'Адрес не найден или не принадлежит пользователю'));
      }

      let deliveryInfo = null;

      // Если передан business_id, проверяем доставку
      if (businessId && address.lat && address.lon) {
        const cacheKey = `delivery_${businessId}_${address.lat}_${address.lon}_${address.address_id}`;
        const cachedResult = deliveryCache.get(cacheKey);
        
        if (cachedResult && (Date.now() - cachedResult.timestamp) < CACHE_TTL) {
          deliveryInfo = cachedResult.data;
        } else {
          try {
            const { DeliveryController } = await import('./deliveryController');
            
            const deliveryResult = await DeliveryController.calculateDeliveryZone({
              lat: Number(address.lat),
              lon: Number(address.lon),
              business_id: businessId,
              address_id: address.address_id
            });

            deliveryInfo = {
              available: deliveryResult.in_zone,
              price: deliveryResult.price,
              delivery_type: deliveryResult.delivery_type,
              message: deliveryResult.message,
              distance: deliveryResult.current_distance
            };

            // Сохраняем в кеш
            deliveryCache.set(cacheKey, {
              data: deliveryInfo,
              timestamp: Date.now()
            });

          } catch (deliveryError) {
            console.error('Ошибка проверки доставки:', deliveryError);
            deliveryInfo = {
              available: false,
              price: false,
              message: 'Ошибка проверки доставки',
              distance: null
            };
          }
        }
      }

      const responseData: any = {
        address: {
          address_id: address.address_id,
          lat: address.lat,
          lon: address.lon,
          address: address.address,
          name: address.name,
          apartment: address.apartment,
          entrance: address.entrance,
          floor: address.floor,
          other: address.other,
          city_id: address.city_id,
          created_at: address.log_timestamp
        }
      };

      if (deliveryInfo) {
        responseData.address.delivery = deliveryInfo;
        responseData.business_id = businessId;
      }

      res.json({
        success: true,
        data: responseData,
        message: deliveryInfo ? 'Адрес найден с информацией о доставке' : 'Адрес найден'
      });

    } catch (error: any) {
      console.error('Ошибка получения адреса:', error);
      next(createError(500, `Ошибка получения адреса: ${error.message}`));
    }
  }

  /**
   * Получить выбранный адрес пользователя (последний выбранный)
   * GET /api/addresses/user/selected?business_id=1
   */
  static async getSelectedAddress(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return next(createError(401, 'Требуется авторизация'));
      }

      const businessId = req.query.business_id ? parseInt(req.query.business_id as string) : null;

      // Получаем последний выбранный адрес
      const selectedRecord = await prisma.selected_address.findFirst({
        where: {
          user_id: req.user.user_id
        },
        orderBy: {
          log_timestamp: 'desc'
        }
      });

      if (!selectedRecord) {
        return next(createError(404, 'У пользователя нет выбранного адреса'));
      }

      // Получаем полную информацию об адресе
      const address = await prisma.user_addreses.findFirst({
        where: {
          address_id: selectedRecord.address_id,
          user_id: req.user.user_id,
          isDeleted: 0
        }
      });

      if (!address) {
        return next(createError(404, 'Выбранный адрес не найден или был удален'));
      }

      let deliveryInfo = null;

      // Если передан business_id, проверяем доставку
      if (businessId && address.lat && address.lon) {
        const cacheKey = `delivery_${businessId}_${address.lat}_${address.lon}_${address.address_id}`;
        const cachedResult = deliveryCache.get(cacheKey);
        
        if (cachedResult && (Date.now() - cachedResult.timestamp) < CACHE_TTL) {
          deliveryInfo = cachedResult.data;
        } else {
          try {
            const { DeliveryController } = await import('./deliveryController');
            
            const deliveryResult = await DeliveryController.calculateDeliveryZone({
              lat: Number(address.lat),
              lon: Number(address.lon),
              business_id: businessId,
              address_id: address.address_id
            });

            deliveryInfo = {
              available: deliveryResult.in_zone,
              price: deliveryResult.price,
              delivery_type: deliveryResult.delivery_type,
              message: deliveryResult.message,
              distance: deliveryResult.current_distance
            };

            // Сохраняем в кеш
            deliveryCache.set(cacheKey, {
              data: deliveryInfo,
              timestamp: Date.now()
            });

          } catch (deliveryError) {
            console.error('Ошибка проверки доставки:', deliveryError);
            deliveryInfo = {
              available: false,
              price: false,
              message: 'Ошибка проверки доставки',
              distance: null
            };
          }
        }
      }

      const responseData: any = {
        selected_address: {
          address_id: address.address_id,
          lat: address.lat,
          lon: address.lon,
          address: address.address,
          name: address.name,
          apartment: address.apartment,
          entrance: address.entrance,
          floor: address.floor,
          other: address.other,
          city_id: address.city_id,
          created_at: address.log_timestamp,
          selected_at: selectedRecord.log_timestamp
        }
      };

      if (deliveryInfo) {
        responseData.selected_address.delivery = deliveryInfo;
        responseData.business_id = businessId;
      }

      res.json({
        success: true,
        data: responseData,
        message: deliveryInfo ? 'Выбранный адрес найден с информацией о доставке' : 'Выбранный адрес найден'
      });

    } catch (error: any) {
      console.error('Ошибка получения выбранного адреса:', error);
      next(createError(500, `Ошибка получения выбранного адреса: ${error.message}`));
    }
  }

  /**
   * Установить выбранный адрес пользователя
   * POST /api/addresses/user/select
   * Body: { address_id: number }
   */
  static async selectAddress(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return next(createError(401, 'Требуется авторизация'));
      }

      const { address_id } = req.body;

      if (!address_id || isNaN(parseInt(address_id))) {
        return next(createError(400, 'Не указан корректный address_id'));
      }

      const addressId = parseInt(address_id);

      // Проверяем, что адрес существует и принадлежит пользователю
      const address = await prisma.user_addreses.findFirst({
        where: {
          address_id: addressId,
          user_id: req.user.user_id,
          isDeleted: 0
        }
      });

      if (!address) {
        return next(createError(404, 'Адрес не найден или не принадлежит пользователю'));
      }

      // Создаем новую запись о выбранном адресе
      const selectedAddress = await prisma.selected_address.create({
        data: {
          user_id: req.user.user_id,
          address_id: addressId
        }
      });

      res.json({
        success: true,
        data: {
          selected_address_id: selectedAddress.relation_id,
          address_id: addressId,
          user_id: req.user.user_id,
          selected_at: selectedAddress.log_timestamp
        },
        message: 'Адрес успешно выбран'
      });

    } catch (error: any) {
      console.error('Ошибка выбора адреса:', error);
      next(createError(500, `Ошибка выбора адреса: ${error.message}`));
    }
  }

  /**
   * Создание нового адреса
   * POST /api/addresses/user
   */
  static async createUserAddress(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return next(createError(401, 'Требуется авторизация'));
      }

      const {
        lat,
        lon,
        address,
        name,
        apartment = '',
        entrance = '',
        floor = '',
        other = '',
        city_id
      }: CreateAddressRequest = req.body;

      // Валидация обязательных полей
      if (!lat || !lon || !address || !name) {
        return next(createError(400, 'Не указаны обязательные поля: lat, lon, address, name'));
      }

      // Валидация координат
      if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
        return next(createError(400, 'Некорректные координаты'));
      }

      // Проверяем количество адресов пользователя (лимит)
      const existingAddresses = await prisma.user_addreses.count({
        where: {
          user_id: req.user.user_id,
          isDeleted: 0
        }
      });

      if (existingAddresses >= 10) {
        return next(createError(400, 'Превышен лимит адресов (максимум 10)'));
      }

      const newAddress = await prisma.user_addreses.create({
        data: {
          user_id: req.user.user_id,
          lat: lat,
          lon: lon,
          address: address.trim(),
          name: name.trim(),
          apartment: apartment.trim(),
          entrance: entrance.trim(),
          floor: floor.trim(),
          other: other.trim(),
          city_id: city_id || null,
          log_timestamp: new Date()
        }
      });

      res.status(201).json({
        success: true,
        data: {
          address: {
            address_id: newAddress.address_id,
            lat: newAddress.lat,
            lon: newAddress.lon,
            address: newAddress.address,
            name: newAddress.name,
            apartment: newAddress.apartment,
            entrance: newAddress.entrance,
            floor: newAddress.floor,
            other: newAddress.other,
            city_id: newAddress.city_id,
            created_at: newAddress.log_timestamp
          }
        },
        message: 'Адрес успешно создан'
      });

    } catch (error: any) {
      console.error('Ошибка создания адреса:', error);
      next(createError(500, `Ошибка создания адреса: ${error.message}`));
    }
  }

  /**
   * Обновление адреса
   * PUT /api/addresses/user/:id
   */
  static async updateUserAddress(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return next(createError(401, 'Требуется авторизация'));
      }

      const addressId = parseInt(req.params.id);
      if (isNaN(addressId)) {
        return next(createError(400, 'Неверный ID адреса'));
      }

      const {
        lat,
        lon,
        address,
        name,
        apartment,
        entrance,
        floor,
        other,
        city_id
      }: UpdateAddressRequest = req.body;

      // Проверяем существование адреса и права доступа
      const existingAddress = await prisma.user_addreses.findFirst({
        where: {
          address_id: addressId,
          user_id: req.user.user_id,
          isDeleted: 0
        }
      });

      if (!existingAddress) {
        return next(createError(404, 'Адрес не найден'));
      }

      // Валидация координат (если переданы)
      if ((lat !== undefined && (lat < -90 || lat > 90)) || 
          (lon !== undefined && (lon < -180 || lon > 180))) {
        return next(createError(400, 'Некорректные координаты'));
      }

      // Подготавливаем данные для обновления
      const updateData: any = {};
      if (lat !== undefined) updateData.lat = lat;
      if (lon !== undefined) updateData.lon = lon;
      if (address !== undefined) updateData.address = address.trim();
      if (name !== undefined) updateData.name = name.trim();
      if (apartment !== undefined) updateData.apartment = apartment.trim();
      if (entrance !== undefined) updateData.entrance = entrance.trim();
      if (floor !== undefined) updateData.floor = floor.trim();
      if (other !== undefined) updateData.other = other.trim();
      if (city_id !== undefined) updateData.city_id = city_id;

      const updatedAddress = await prisma.user_addreses.update({
        where: { address_id: addressId },
        data: updateData
      });

      res.json({
        success: true,
        data: {
          address: {
            address_id: updatedAddress.address_id,
            lat: updatedAddress.lat,
            lon: updatedAddress.lon,
            address: updatedAddress.address,
            name: updatedAddress.name,
            apartment: updatedAddress.apartment,
            entrance: updatedAddress.entrance,
            floor: updatedAddress.floor,
            other: updatedAddress.other,
            city_id: updatedAddress.city_id,
            created_at: updatedAddress.log_timestamp
          }
        },
        message: 'Адрес успешно обновлен'
      });

    } catch (error: any) {
      console.error('Ошибка обновления адреса:', error);
      next(createError(500, `Ошибка обновления адреса: ${error.message}`));
    }
  }

  /**
   * Удаление адреса (мягкое удаление)
   * DELETE /api/addresses/user/:id
   */
  static async deleteUserAddress(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return next(createError(401, 'Требуется авторизация'));
      }

      const addressId = parseInt(req.params.id);
      if (isNaN(addressId)) {
        return next(createError(400, 'Неверный ID адреса'));
      }

      // Проверяем существование адреса и права доступа
      const existingAddress = await prisma.user_addreses.findFirst({
        where: {
          address_id: addressId,
          user_id: req.user.user_id,
          isDeleted: 0
        }
      });

      if (!existingAddress) {
        return next(createError(404, 'Адрес не найден'));
      }

      // Мягкое удаление
      await prisma.user_addreses.update({
        where: { address_id: addressId },
        data: { isDeleted: 1 }
      });

      res.json({
        success: true,
        data: { address_id: addressId },
        message: 'Адрес успешно удален'
      });

    } catch (error: any) {
      console.error('Ошибка удаления адреса:', error);
      next(createError(500, `Ошибка удаления адреса: ${error.message}`));
    }
  }

  /**
   * Проверка возможности доставки по адресу
   * POST /api/addresses/check-delivery
   */
  static async checkDeliveryAvailability(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { lat, lon, business_id } = req.body;

      if (!lat || !lon || !business_id) {
        return next(createError(400, 'Не указаны обязательные поля: lat, lon, business_id'));
      }

      // Валидация координат
      if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
        return next(createError(400, 'Некорректные координаты'));
      }

      // Импортируем DeliveryController для проверки зоны доставки
      const { DeliveryController } = await import('./deliveryController');
      
      const deliveryResult = await DeliveryController.calculateDeliveryZone({
        lat: Number(lat),
        lon: Number(lon),
        business_id: Number(business_id)
      });

      res.json({
        success: true,
        data: {
          delivery_available: deliveryResult.in_zone,
          delivery_price: deliveryResult.price,
          delivery_type: deliveryResult.delivery_type,
          message: deliveryResult.message,
          max_distance: deliveryResult.max_distance,
          current_distance: deliveryResult.current_distance
        },
        message: deliveryResult.in_zone ? 'Доставка доступна' : 'Доставка недоступна'
      });

    } catch (error: any) {
      console.error('Ошибка проверки доставки:', error);
      next(createError(500, `Ошибка проверки доставки: ${error.message}`));
    }
  }

  /**
   * Получение адресов с информацией о доставке
   * GET /api/addresses/user/with-delivery?business_id=1
   */
  static async getUserAddressesWithDelivery(req: AuthRequest, res: Response, next: NextFunction) {
    const startTime = Date.now();
    try {
      if (!req.user) {
        return next(createError(401, 'Требуется авторизация'));
      }

      const businessId = req.query.business_id ? parseInt(req.query.business_id as string) : null;
      const limit = req.query.limit ? Math.min(parseInt(req.query.limit as string), 50) : 20; // Максимум 50 адресов

      console.log(`📍 Загрузка адресов пользователя ${req.user.user_id} с доставкой для бизнеса ${businessId}`);

      const addresses = await prisma.user_addreses.findMany({
        where: {
          user_id: req.user.user_id,
          isDeleted: 0
        },
        orderBy: {
          log_timestamp: 'desc'
        },
        take: limit // Ограничиваем количество для производительности
      });

      // Используем параллельные запросы вместо последовательных для ускорения
      const addressesWithDeliveryPromises = addresses.map(async (address) => {
        let deliveryInfo = null;

        if (businessId && address.lat && address.lon) {
          // Создаем ключ для кеша
          const cacheKey = `delivery_${businessId}_${address.lat}_${address.lon}_${address.address_id}`;
          const cachedResult = deliveryCache.get(cacheKey);
          
          // Проверяем кеш
          if (cachedResult && (Date.now() - cachedResult.timestamp) < CACHE_TTL) {
            console.log(`🚀 Используем кеш для адреса ${address.address_id}`);
            deliveryInfo = cachedResult.data;
          } else {
            try {
              const { DeliveryController } = await import('./deliveryController');
              
              const deliveryResult = await DeliveryController.calculateDeliveryZone({
                lat: Number(address.lat),
                lon: Number(address.lon),
                business_id: businessId,
                address_id: address.address_id // Передаем address_id для кеширования
              });

              deliveryInfo = {
                available: deliveryResult.in_zone,
                price: deliveryResult.price,
                delivery_type: deliveryResult.delivery_type,
                message: deliveryResult.message,
                distance: deliveryResult.current_distance
              };

              // Сохраняем в кеш
              deliveryCache.set(cacheKey, {
                data: deliveryInfo,
                timestamp: Date.now()
              });

            } catch (deliveryError) {
              console.error('Ошибка проверки доставки для адреса:', address.address_id, deliveryError);
              deliveryInfo = {
                available: false,
                price: false,
                message: 'Ошибка проверки доставки',
                distance: null
              };
            }
          }
        }

        return {
          address_id: address.address_id,
          lat: address.lat,
          lon: address.lon,
          address: address.address,
          name: address.name,
          apartment: address.apartment,
          entrance: address.entrance,
          floor: address.floor,
          other: address.other,
          city_id: address.city_id,
          created_at: address.log_timestamp,
          delivery: deliveryInfo
        };
      });

      // Ожидаем завершения всех параллельных запросов
      const addressesWithDelivery = await Promise.all(addressesWithDeliveryPromises);

      const executionTime = Date.now() - startTime;
      console.log(`⚡ Запрос адресов с доставкой выполнен за ${executionTime}мс`);

      res.json({
        success: true,
        data: {
          addresses: addressesWithDelivery,
          business_id: businessId,
          execution_time_ms: executionTime
        },
        message: `Найдено ${addresses.length} адресов`
      });

    } catch (error: any) {
      const executionTime = Date.now() - startTime;
      console.error(`❌ Ошибка получения адресов с информацией о доставке (${executionTime}мс):`, error);
      next(createError(500, `Ошибка получения адресов: ${error.message}`));
    }
  }
}
