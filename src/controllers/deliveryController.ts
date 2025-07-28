import { Request, Response, NextFunction } from 'express';
import prisma from '../database';
import { createError } from '../middleware/errorHandler';
import mysql from 'mysql2/promise';

interface DeliveryCheckRequest {
  lat: number;
  lon: number;
  business_id: number;
}

interface DeliveryResult {
  in_zone: boolean;
  price: number | false;
  delivery_type: 'distance' | 'area' | 'yandex';
  message: string;
  max_distance?: number;
  current_distance?: number;
}

// Создаем прямое подключение к MySQL для геометрических запросов
const createMySQLConnection = async () => {
  return await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'naliv',
    port: parseInt(process.env.DB_PORT || '3306')
  });
};

interface DeliveryCheckRequest {
  lat: number;
  lon: number;
  business_id: number;
}

interface DeliveryResult {
  in_zone: boolean;
  price: number | false;
  delivery_type: 'distance' | 'area' | 'yandex';
  message: string;
  max_distance?: number;
  current_distance?: number;
}

export class DeliveryController {
  
  /**
   * Проверка зоны доставки и расчет стоимости
   * POST /api/delivery/check
   * Body: { lat: number, lon: number, business_id: number }
   */
  static async checkDeliveryZone(req: Request, res: Response, next: NextFunction) {
    try {
      const { lat, lon, business_id }: DeliveryCheckRequest = req.body;

      // Валидация входных данных
      if (!lat || !lon || !business_id) {
        return next(createError(400, 'Параметры lat, lon и business_id обязательны'));
      }

      if (typeof lat !== 'number' || typeof lon !== 'number' || typeof business_id !== 'number') {
        return next(createError(400, 'Параметры lat, lon и business_id должны быть числами'));
      }

      // Проверяем валидность координат
      if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
        return next(createError(400, 'Некорректные координаты'));
      }

      const result = await DeliveryController.calculateDeliveryZone({
        lat,
        lon,
        business_id
      });

      res.json({
        success: true,
        data: result,
        message: result.message
      });

    } catch (error: any) {
      console.error('Ошибка проверки зоны доставки:', error);
      next(createError(500, `Ошибка проверки зоны доставки: ${error.message}`));
    }
  }

  /**
   * Основная функция расчета стоимости доставки
   */
  static async calculateDeliveryZone(data: DeliveryCheckRequest): Promise<DeliveryResult> {
    const { lat, lon, business_id } = data;

    try {
      // Получаем информацию о городе бизнеса
      const businessWithCity = await prisma.$queryRaw<any[]>`
        SELECT 
          cities.city_id, cities.name, cities.delivery_type,
          businesses.lat as b_lat, businesses.lon as b_lon,
          businesses.city
        FROM businesses 
        LEFT JOIN cities ON cities.city_id = businesses.city 
        WHERE business_id = ${business_id}
      `;

      if (!businessWithCity || businessWithCity.length === 0) {
        return {
          in_zone: false,
          price: false,
          delivery_type: 'yandex',
          message: 'Бизнес не найден'
        };
      }

      const city = businessWithCity[0];
      const business_lat = city.b_lat;
      const business_lon = city.b_lon;

      // Обработка типа доставки DISTANCE
      if (city.delivery_type === 'DISTANCE') {
        return await DeliveryController.handleDistanceDelivery(
          city, lat, lon, business_lat, business_lon, business_id
        );
      }
      // Обработка типа доставки AREA
      else if (city.delivery_type === 'AREA') {
        return await DeliveryController.handleAreaDelivery(
          city, lat, lon, business_lat, business_lon, business_id
        );
      }
      
      // Если тип доставки неизвестен, пробуем через Яндекс
      const yandex_price = await DeliveryController.checkPriceYandex(
        business_lat, business_lon, lat, lon
      );
      
      return {
        in_zone: yandex_price !== false,
        price: yandex_price,
        delivery_type: 'yandex',
        message: yandex_price !== false ? 'Доставка возможна через Яндекс' : 'Доставка невозможна'
      };

    } catch (error: any) {
      console.error('Ошибка расчета доставки:', error);
      return {
        in_zone: false,
        price: false,
        delivery_type: 'yandex',
        message: `Ошибка расчета доставки: ${error.message}`
      };
    }
  }

  /**
   * Обработка доставки по расстоянию (DISTANCE)
   */
  static async handleDistanceDelivery(
    city: any,
    lat: number,
    lon: number,
    business_lat: number,
    business_lon: number,
    business_id: number
  ): Promise<DeliveryResult> {
    
    let connection;
    try {
      connection = await createMySQLConnection();
      
      // Проверяем, находится ли адрес в границах города
      const point_delivery = `POINT(${lon} ${lat})`;
      const [cityBorderRows] = await connection.execute(`
        SELECT ST_Contains(city_border, ST_PointFromText(?)) as in_city 
        FROM cities WHERE city_id = ?
      `, [point_delivery, city.city_id]);

      const cityBorderCheck = cityBorderRows as any[];
      const in_city = cityBorderCheck[0]?.in_city || 0;
      
      if (!in_city) {
        // Если адрес за пределами города, проверяем доставку через Яндекс
        const yandex_price = await DeliveryController.checkPriceYandex(
          business_lat, business_lon, lat, lon
        );
        return {
          in_zone: yandex_price !== false,
          price: yandex_price,
          delivery_type: 'yandex',
          message: yandex_price !== false ? 'Доставка возможна через Яндекс' : 'Адрес находится за пределами зоны доставки'
        };
      }

      // Получаем настройки доставки для города
      const delivery_rate = await prisma.delivery_rates.findFirst({
        where: { city_id: city.city_id }
      });
      
      // Получаем расстояние до бизнеса
      const distance = await DeliveryController.getDistanceToBusinesses(lat, lon, business_id);
      const max_distance = delivery_rate?.base_distance ? Number(delivery_rate.base_distance) * 1000 : 30000; // 30 км по умолчанию
      
      if (distance > max_distance) {
        // Если расстояние больше максимального, пробуем через Яндекс
        const yandex_price = await DeliveryController.checkPriceYandex(
          business_lat, business_lon, lat, lon
        );
        return {
          in_zone: yandex_price !== false,
          price: yandex_price,
          delivery_type: 'yandex',
          message: yandex_price !== false ? 'Доставка возможна через Яндекс' : 'Адрес находится слишком далеко',
          max_distance,
          current_distance: distance
        };
      }
      
      // Рассчитываем стоимость доставки по расстоянию
      let delivery_price = 0;
      
      if (delivery_rate?.base_distance_price) {
        // Если есть базовая цена за расстояние, используем её
        delivery_price = Number(delivery_rate.base_distance_price);
      } else {
        // Если нет настроек, используем фиксированную цену по умолчанию
        delivery_price = 500; // 500 тенге по умолчанию
        
        // Дополнительная плата за каждый км сверх 5 км
        const base_distance_default = 5000; // 5 км в метрах
        if (distance > base_distance_default) {
          const extra_distance = distance - base_distance_default;
          const extra_km = Math.ceil(extra_distance / 1000);
          delivery_price += extra_km * 100; // 100 тенге за каждый дополнительный км
        }
      }
      
      return {
        in_zone: true,
        price: delivery_price,
        delivery_type: 'distance',
        message: 'Адрес находится в зоне доставки',
        max_distance,
        current_distance: distance
      };

    } catch (error: any) {
      console.error('Ошибка обработки доставки по расстоянию:', error);
      const yandex_price = await DeliveryController.checkPriceYandex(
        business_lat, business_lon, lat, lon
      );
      return {
        in_zone: yandex_price !== false,
        price: yandex_price,
        delivery_type: 'yandex',
        message: yandex_price !== false ? 'Доставка возможна через Яндекс' : 'Ошибка проверки зоны доставки'
      };
    } finally {
      if (connection) {
        await connection.end();
      }
    }
  }

  /**
   * Обработка доставки по зонам (AREA)
   */
  static async handleAreaDelivery(
    city: any,
    lat: number,
    lon: number,
    business_lat: number,
    business_lon: number,
    business_id: number
  ): Promise<DeliveryResult> {
    
    let connection;
    try {
      connection = await createMySQLConnection();
      
      // Получаем информацию о бизнесе
      const business = await prisma.businesses.findUnique({
        where: { business_id },
        select: { lon: true, lat: true }
      });

      if (!business) {
        return {
          in_zone: false,
          price: false,
          delivery_type: 'yandex',
          message: 'Бизнес не найден'
        };
      }

      // Создаем точку для бизнеса
      const point_business = `POINT(${business.lon} ${business.lat})`;
      
      // Находим зону самовывоза для бизнеса
      const [pickUpRows] = await connection.execute(`
        SELECT pick_up_area_id FROM pick_up_areas 
        WHERE ST_Contains(borders, ST_PointFromText(?))
      `, [point_business]);

      const pick_up_area = pickUpRows as any[];
      
      if (!pick_up_area || pick_up_area.length === 0) {
        // Если бизнес не в зоне самовывоза, пробуем через Яндекс
        const yandex_price = await DeliveryController.checkPriceYandex(
          business_lat, business_lon, lat, lon
        );
        return {
          in_zone: yandex_price !== false,
          price: yandex_price,
          delivery_type: 'yandex',
          message: yandex_price !== false ? 'Доставка возможна через Яндекс' : 'Доставка невозможна'
        };
      }

      const pickUpAreaId = pick_up_area[0].pick_up_area_id;

      // Проверяем, находится ли адрес в зоне доставки
      const point_delivery = `POINT(${lon} ${lat})`;
      const [deliveryRows] = await connection.execute(`
        SELECT * FROM delivery_areas 
        WHERE pick_up_area_id = ?
        AND ST_Contains(borders, ST_PointFromText(?))
        ORDER BY price ASC LIMIT 1
      `, [pickUpAreaId, point_delivery]);

      const delivery_area = deliveryRows as any[];
      
      if (!delivery_area || delivery_area.length === 0) {
        // Если адрес не в зоне доставки, пробуем через Яндекс
        const yandex_price = await DeliveryController.checkPriceYandex(
          business_lat, business_lon, lat, lon
        );
        return {
          in_zone: yandex_price !== false,
          price: yandex_price,
          delivery_type: 'yandex',
          message: yandex_price !== false ? 'Доставка возможна через Яндекс' : 'Адрес находится вне зоны доставки'
        };
      }

      return {
        in_zone: true,
        price: Number(delivery_area[0].price),
        delivery_type: 'area',
        message: 'Адрес находится в зоне доставки'
      };

    } catch (error: any) {
      console.error('Ошибка обработки доставки по зонам:', error);
      const yandex_price = await DeliveryController.checkPriceYandex(
        business_lat, business_lon, lat, lon
      );
      return {
        in_zone: yandex_price !== false,
        price: yandex_price,
        delivery_type: 'yandex',
        message: yandex_price !== false ? 'Доставка возможна через Яндекс' : 'Ошибка проверки зоны доставки'
      };
    } finally {
      if (connection) {
        await connection.end();
      }
    }
  }

  /**
   * Расчет расстояния до бизнеса в метрах
   */
  static async getDistanceToBusinesses(lat: number, lon: number, business_id: number): Promise<number> {
    try {
      // Проверяем, есть ли уже рассчитанное расстояние в таблице delivery_distance
      // Для этого нам нужен address_id, но поскольку у нас только координаты,
      // рассчитываем расстояние напрямую
      
      const business = await prisma.businesses.findUnique({
        where: { business_id },
        select: { lat: true, lon: true }
      });

      if (!business) {
        throw new Error('Бизнес не найден');
      }

      // Рассчитываем расстояние по формуле Haversine
      const distance = DeliveryController.calculateHaversineDistance(
        lat, lon, business.lat, business.lon
      );

      return distance;
    } catch (error: any) {
      console.error('Ошибка расчета расстояния:', error);
      return 999999; // Возвращаем большое число в случае ошибки
    }
  }

  /**
   * Расчет расстояния по формуле Haversine (в метрах)
   */
  static calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // Радиус Земли в метрах
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return Math.round(R * c);
  }

  /**
   * Проверка стоимости доставки через Яндекс
   * В данной реализации возвращаем фиксированную стоимость,
   * в продакшене здесь должен быть запрос к API Яндекс.Доставки
   */
  static async checkPriceYandex(
    business_lat: number,
    business_lon: number,
    delivery_lat: number,
    delivery_lon: number
  ): Promise<number | false> {
    try {
      // Базовая проверка расстояния - если слишком далеко, доставка невозможна
      const distance = DeliveryController.calculateHaversineDistance(
        business_lat, business_lon, delivery_lat, delivery_lon
      );
      
      // Максимальное расстояние для Яндекс доставки - 50 км
      if (distance > 50000) {
        return false;
      }

      // Базовая стоимость + стоимость за километр
      const basePrice = 300; // 300 тенге базовая стоимость
      const pricePerKm = 50; // 50 тенге за километр
      const distanceKm = distance / 1000;
      
      const totalPrice = basePrice + (distanceKm * pricePerKm);
      
      // В реальном приложении здесь должен быть запрос к API Яндекс.Доставки
      // const yandexResponse = await fetch('https://api.yandex.delivery/...', {
      //   method: 'POST',
      //   headers: { 'Authorization': 'Bearer YOUR_TOKEN' },
      //   body: JSON.stringify({
      //     from: { lat: business_lat, lon: business_lon },
      //     to: { lat: delivery_lat, lon: delivery_lon }
      //   })
      // });
      
      return Math.round(totalPrice);
    } catch (error: any) {
      console.error('Ошибка запроса к Яндекс.Доставка:', error);
      return false;
    }
  }

  /**
   * Получение информации о зонах доставки для бизнеса
   * GET /api/delivery/zones/:business_id
   */
  static async getDeliveryZones(req: Request, res: Response, next: NextFunction) {
    try {
      const business_id = parseInt(req.params.business_id);

      if (isNaN(business_id)) {
        return next(createError(400, 'Неверный ID бизнеса'));
      }

      // Получаем информацию о бизнесе и городе
      const businessWithCity = await prisma.$queryRaw<any[]>`
        SELECT businesses.*, cities.name as city_name, cities.delivery_type
        FROM businesses 
        LEFT JOIN cities ON cities.city_id = businesses.city 
        WHERE businesses.business_id = ${business_id}
      `;

      if (!businessWithCity || businessWithCity.length === 0) {
        return next(createError(404, 'Бизнес не найден'));
      }

      const business = businessWithCity[0];
      let zones: any = {};

      if (business.delivery_type === 'AREA') {
        // Получаем зоны доставки для AREA типа
        const point_business = `POINT(${business.lon} ${business.lat})`;
        
        const pick_up_area = await prisma.$queryRaw<any[]>`
          SELECT pick_up_area_id FROM pick_up_areas 
          WHERE ST_Contains(borders, ST_PointFromText(${point_business}))
        `;

        if (pick_up_area && pick_up_area.length > 0) {
          const areas = await prisma.delivery_areas.findMany({
            where: { pick_up_area_id: pick_up_area[0].pick_up_area_id },
            orderBy: { price: 'asc' }
          });
          zones.areas = areas;
        }
      } else if (business.delivery_type === 'DISTANCE') {
        // Получаем настройки доставки по расстоянию
        const delivery_rate = await prisma.delivery_rates.findFirst({
          where: { city_id: business.city }
        });
        zones.distance_settings = delivery_rate;
      }

      res.json({
        success: true,
        data: {
          business: {
            business_id: business.business_id,
            name: business.name,
            city_name: business.city_name,
            delivery_type: business.delivery_type,
            lat: business.lat,
            lon: business.lon
          },
          zones
        },
        message: 'Информация о зонах доставки получена'
      });

    } catch (error: any) {
      console.error('Ошибка получения зон доставки:', error);
      next(createError(500, `Ошибка получения зон доставки: ${error.message}`));
    }
  }

  /**
   * Расчет стоимости доставки по business_id и address_id
   * GET /api/delivery/calculate-by-address
   * Query: { business_id: number, address_id: number }
   */
  static async calculateDeliveryByAddress(req: Request, res: Response, next: NextFunction) {
    try {
      const { business_id, address_id } = req.query;

      // Валидация входных данных
      if (!business_id || !address_id) {
        return next(createError(400, 'Параметры business_id и address_id обязательны'));
      }

      const businessId = parseInt(business_id as string);
      const addressId = parseInt(address_id as string);

      if (isNaN(businessId) || isNaN(addressId)) {
        return next(createError(400, 'Параметры business_id и address_id должны быть числами'));
      }

      // Получаем адрес пользователя
      const userAddress = await prisma.user_addreses.findUnique({
        where: {
          address_id: addressId
        }
      });

      if (!userAddress) {
        return next(createError(404, 'Адрес не найден'));
      }

      if (userAddress.isDeleted === 1) {
        return next(createError(400, 'Адрес удален'));
      }

      // Проверяем что адрес имеет координаты
      if (!userAddress.lat || !userAddress.lon) {
        return next(createError(400, 'У адреса отсутствуют координаты'));
      }

      // Вызываем существующий метод расчета доставки
      const deliveryResult = await DeliveryController.calculateDeliveryZone({
        lat: userAddress.lat,
        lon: userAddress.lon,
        business_id: businessId
      });

      res.json({
        success: true,
        data: {
          delivery_type: deliveryResult.delivery_type.toUpperCase(),
          distance: deliveryResult.current_distance,
          delivery_cost: deliveryResult.price,
          zone_name: deliveryResult.message,
          coordinates: {
            lat: userAddress.lat,
            lon: userAddress.lon
          },
          address: {
            address_id: userAddress.address_id,
            name: userAddress.name,
            address: userAddress.address,
            apartment: userAddress.apartment,
            entrance: userAddress.entrance,
            floor: userAddress.floor,
            other: userAddress.other
          }
        },
        message: deliveryResult.in_zone ? 'Доставка возможна' : 'Доставка невозможна'
      });

    } catch (error: any) {
      console.error('Ошибка расчета доставки по адресу:', error);
      next(createError(500, `Ошибка расчета доставки: ${error.message}`));
    }
  }
}
