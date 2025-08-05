import { Router } from 'express';
import userRoutes from './users';
import businessRoutes from './businesses';
import authRoutes from './auth';
import orderRoutes from './orders';
import employeeAuthRoutes from './employeeAuth';
import categoryRoutes from './categories';
import deliveryRoutes from './delivery';
import addressRoutes from './addresses';
import paymentRoutes from './payments';
import userCardsRoutes from './userCards';
import bonusRoutes from './bonuses';

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
      addresses: '/api/addresses',
      payments: '/api/payments',
      user_cards: '/api/user/cards',
      bonuses: '/api/bonuses',
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
    },
    address_info: {
      search_addresses: 'GET /api/addresses/search?query=address',
      get_user_addresses: 'GET /api/addresses',
      add_address: 'POST /api/addresses',
      update_address: 'PUT /api/addresses/:id',
      delete_address: 'DELETE /api/addresses/:id'
    },
    payment_info: {
      get_payment_methods: 'GET /api/payments/methods',
      get_active_payment_methods: 'GET /api/payments/methods/active',
      get_payment_method: 'GET /api/payments/methods/:id',
      init_card_save: 'POST /api/payments/save-card/init',
      card_save_postlink: 'POST /api/payments/save-card/postlink'
    },
    user_cards_info: {
      get_saved_cards: 'GET /api/user/cards',
      get_card_by_id: 'GET /api/user/cards/:cardId',
      delete_card: 'DELETE /api/user/cards/:cardId'
    },
    bonus_info: {
      get_user_bonuses: 'GET /api/bonuses',
      create_bonus_card: 'POST /api/bonuses/card',
      add_bonuses: 'POST /api/bonuses/add',
      get_bonus_history: 'GET /api/bonuses/history'
    }
  });
});

// Подключение модулей API
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/businesses', businessRoutes);
router.use('/orders', orderRoutes);
router.use('/categories', categoryRoutes);
router.use('/items', require('./items').default);
router.use('/promotions', require('./promotions').default);
router.use('/delivery', deliveryRoutes);
router.use('/addresses', addressRoutes);
router.use('/payments', paymentRoutes);
router.use('/user', userCardsRoutes);
router.use('/bonuses', bonusRoutes);
router.use('/employee/auth', employeeAuthRoutes);

export default router;
