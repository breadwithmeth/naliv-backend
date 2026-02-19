import { Router } from 'express';
import { authenticateCourier, requireAdminCourier } from '../middleware/courierAuth';
import { listCouriers, updateCourierType, revokeCourierTokens, getCourierSummary, createCourier, getCourierLocation, changeCourierPassword, listCourierLocations } from '../controllers/adminCourierController';

const router = Router();

router.use(authenticateCourier, requireAdminCourier);

router.get('/couriers', listCouriers);
router.get('/couriers/locations', listCourierLocations);
router.get('/couriers/summary', getCourierSummary);
router.get('/couriers/:courierId/location', getCourierLocation);
router.patch('/couriers/:courierId/type', updateCourierType);
router.post('/couriers/:courierId/password', changeCourierPassword);
router.post('/couriers/:courierId/revoke-tokens', revokeCourierTokens);
router.post('/couriers', createCourier);

export default router;
