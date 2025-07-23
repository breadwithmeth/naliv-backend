import { Router } from 'express';
import { DeliveryController } from '../controllers/deliveryController';

const router = Router();

/**
 * @route POST /api/delivery/check
 * @desc Проверка зоны доставки и расчет стоимости
 * @body { lat: number, lon: number, business_id: number }
 * @returns { success: boolean, data: DeliveryResult, message: string }
 */
router.post('/check', DeliveryController.checkDeliveryZone);

/**
 * @route GET /api/delivery/zones/:business_id
 * @desc Получение информации о зонах доставки для бизнеса
 * @param business_id - ID бизнеса
 * @returns { success: boolean, data: { business: object, zones: object }, message: string }
 */
router.get('/zones/:business_id', DeliveryController.getDeliveryZones);

export default router;
