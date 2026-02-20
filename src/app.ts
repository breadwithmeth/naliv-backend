import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { createError, errorHandler } from './middleware/errorHandler';
import apiRoutes from './routes/api';
import { connectDatabase } from './database';
import FirebaseAdminService from './services/firebaseAdmin';

dotenv.config();

class App {
  public app: Application;
  private port: string | number;

  constructor() {
    this.app = express();
    this.port = process.env.PORT || 3000;
    
    this.initializeFirebase();
    this.initializeMiddlewares();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  private initializeFirebase(): void {
    try {
      const firebaseService = FirebaseAdminService.getInstance();
      firebaseService.initialize();
    } catch (error: any) {
      console.warn('Firebase Admin SDK не удалось инициализировать:', error.message);
      console.warn('Push-уведомления будут недоступны');
    }
  }

  private initializeMiddlewares(): void {
    // Безопасность с настройками для Halyk Bank API
    const isProd = process.env.NODE_ENV === 'production';
    const halykHosts = [
      'https://epay.homebank.kz',
      'https://api.homebank.kz',
      'https://secure.homebank.kz'
    ];

    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: isProd
            ? ["'self'", ...halykHosts]
            : ["'self'", ...halykHosts, "'unsafe-inline'", "'unsafe-eval'"],
          styleSrc: isProd
            ? ["'self'"]
            : ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'", ...halykHosts],
          frameSrc: ["'self'", ...halykHosts],
          formAction: ["'self'", ...halykHosts],
          upgradeInsecureRequests: isProd ? [] : null
        }
      },
      hsts: isProd ? { maxAge: 31536000, includeSubDomains: true, preload: true } : undefined,
      frameguard: { action: 'deny' },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
    }));
    
    // CORS - разрешаем запросы из всех источников
    this.app.use(cors({
      origin: '*', // Разрешаем все источники
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Developer-Key', 'X-API-Key', 'X-Request-Id'],
      maxAge: 86400 // Access-Control-Max-Age: 86400 секунд (24 часа)
    }));
    
    // Парсинг JSON
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));
    
    // Корреляция запросов: X-Request-Id (без access-логов, чтобы не утекали токены/PII из query string)
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      const requestId = (req.headers['x-request-id'] as string | undefined)?.trim() || crypto.randomUUID();
      res.setHeader('X-Request-Id', requestId);
      next();
    });
  }

  private initializeRoutes(): void {
    // Базовый route для проверки здоровья
    this.app.get('/health', (req: Request, res: Response) => {
      res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      });
    });

    // API routes
    this.app.use('/api', apiRoutes);
    
    // 404 handler
    this.app.use('*', (req: Request, res: Response) => {
      // единый формат через errorHandler
      throw createError(404, 'Route not found');
    });
  }

  private initializeErrorHandling(): void {
    this.app.use(errorHandler);
  }

  public async listen(): Promise<void> {
    try {
      // Подключение к базе данных
      await connectDatabase();
      
      this.app.listen(this.port, () => {



});
    } catch (error) {
      console.error('❌ Ошибка запуска сервера:', error);
      process.exit(1);
    }
  }
}

export default App;
