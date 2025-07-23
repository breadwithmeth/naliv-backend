import { Router } from 'express';
import userRoutes from './users';
import businessRoutes from './businesses';
import authRoutes from './auth';
import orderRoutes from './orders';
import employeeAuthRoutes from './employeeAuth';
import categoryRoutes from './categories';
import deliveryRoutes from './delivery';

const router = Router();

// API версия
router.get('/', (req, res) => {
  res.json({
    message: 'Naliv Backend API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    endpoints: {
      auth: '/api/auth',
      users: '/api/users',
      businesses: '/api/businesses',
      orders: '/api/orders',
      categories: '/api/categories',
      delivery: '/api/delivery',
      employee_auth: '/api/employee/auth',
      health: '/health'
    },
    auth_info: {
      user_registration: 'POST /api/auth/register',
      user_login: 'POST /api/auth/login',
      employee_registration: 'POST /api/employee/auth/register',
      employee_login: 'POST /api/employee/auth/login',
      phone_format: '+77077707600'
    },
    delivery_info: {
      check_delivery_zone: 'POST /api/delivery/check',
      get_delivery_zones: 'GET /api/delivery/zones/:business_id',
      check_body_format: '{ lat: number, lon: number, business_id: number }'
    }
  });
});

// Подключение модулей API
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/businesses', businessRoutes);
router.use('/orders', orderRoutes);
router.use('/categories', categoryRoutes);
router.use('/delivery', deliveryRoutes);
router.use('/employee/auth', employeeAuthRoutes);

export default router;
