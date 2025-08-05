import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { createError } from '../middleware/errorHandler';
import axios from 'axios';

const prisma = new PrismaClient();

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

      // Поиск через Nominatim
      try {
        const endpoint = 'http://68.183.23.112:8080/search.php';
        const params = {
          q: query as string,
          addressdetails: '1',
          namedetails: '1',
          format: 'geocodejson'

        };
        const url = `${endpoint}?${new URLSearchParams(params)}`;
        console.log('📡 Отправляем запрос к Nominatim:', url);

        const response = await axios.get(url, { timeout: 2000, headers: { 'Accept-Language': 'ru' } });
        console.log('✅ Получен ответ от Nominatim:', response.status);
        console.log('📊 Данные от Nominatim:', response.data);
        
        

        res.json({
          success: true,
          data: response.data,
        });

      } catch (apiError: any) {
        console.warn('⚠️  Nominatim недоступен, используем локальную базу:', apiError.message);
        const mockData = AddressController.getMockAddressData((query as string).toLowerCase());
        res.json({
          success: true,
          data: mockData,
          message: mockData.length > 0 ? 'Адреса найдены (локальная база)' : 'Адреса не найдены (локальная база)'
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
   * Получить все адреса пользователя
   * GET /api/addresses
   */
  static async getUserAddresses(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.user_id;

      const addresses = await prisma.user_addreses.findMany({
        where: { user_id: userId },
        orderBy: { address_id: 'desc' }
      });

      res.json({
        success: true,
        data: addresses,
        message: 'Адреса получены'
      });

    } catch (error: any) {
      console.error('Ошибка получения адресов:', error);
      next(createError(500, `Ошибка получения адресов: ${error.message}`));
    }
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
   * Обратный геокодинг по координатам
   * GET /api/addresses/reverse?lat={lat}&lon={lon}
   */
  static async reverseGeocode(req: Request, res: Response, next: NextFunction) {
    try {
      const { lat, lon } = req.query;
      if (!lat || !lon || isNaN(Number(lat)) || isNaN(Number(lon))) {
        return next(createError(400, 'Параметры lat и lon обязателены и должны быть числами'));
      }
      const endpoint = 'http://68.183.23.112:8080/reverse.php';
      const params = {
        lat: lat as string,
        lon: lon as string,
        format: 'geocodejson',
        addressdetails: '1',
        namedetails: '1'
      };
      const url = `${endpoint}?${new URLSearchParams(params)}`;
      console.log('📡 Отправляем запрос к Nominatim reverse:', url);
      const response = await axios.get(url, { timeout: 2000, headers: { 'Accept-Language': 'ru' } });
      console.log('✅ Ответ Nominatim reverse:', response.status);
      const data = response.data;
      
      
      res.json({
        success: true,
        data: data,
        message: 'Адрес получен по координатам'
      });
    } catch (error: any) {
      console.error('Ошибка обратного геокодинга:', error);
      next(createError(500, `Ошибка геокодирования: ${error.message}`));
    }
  }
}
