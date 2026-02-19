import { Router } from 'express';
import userRoutes from './users';
import businessRoutes from './businesses';
import authRoutes from './auth';
import orderRoutes from './orders';
import employeeAuthRoutes from './employeeAuth';
import employeeRoutes from './employee';
import categoryRoutes from './categories';
import deliveryRoutes from './delivery';
import addressRoutes from './addresses';
import paymentRoutes from './payments';
import userCardsRoutes from './userCards';
import bonusRoutes from './bonuses';
import notificationRoutes from './notifications';
import courierAuthRoutes from './courierAuth';
import courierRoutes from './courier';
import adminCourierRoutes from './adminCourier';
import { businessOrderRoutes } from './businessOrderRoutes';
import glovoRoutes from './glovo';
import developerRoutes from './developer';
import tvRoutes from './tv';

const router = Router();

// API root — не раскрываем список эндпоинтов
router.get('/', (req, res) => {
  res.json({
    message: 'Naliv Backend API',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Подключение модулей API
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/businesses', businessRoutes);
router.use('/business', businessOrderRoutes);
router.use('/orders', orderRoutes);
router.use('/categories', categoryRoutes);
router.use('/items', require('./items').default);
router.use('/promotions', require('./promotions').default);
router.use('/delivery', deliveryRoutes);
router.use('/addresses', addressRoutes);
router.use('/payments', paymentRoutes);
router.use('/user', userCardsRoutes);
router.use('/bonuses', bonusRoutes);
router.use('/notifications', notificationRoutes);
router.use('/employee/auth', employeeAuthRoutes);
router.use('/employee', employeeRoutes);
router.use('/courier/auth', courierAuthRoutes);
router.use('/courier', courierRoutes);
router.use('/admin/courier', adminCourierRoutes);
router.use('/glovo', glovoRoutes);
router.use('/developer', developerRoutes);
router.use('/tv', tvRoutes);

export default router;
