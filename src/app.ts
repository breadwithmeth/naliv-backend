import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { errorHandler } from './middleware/errorHandler';
import apiRoutes from './routes/api';
import { connectDatabase } from './database';
import FirebaseAdminService from './services/firebaseAdmin';

// Загрузка переменных окружения
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
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: [
            "'self'",
            "'unsafe-inline'", // Разрешаем inline скрипты для Halyk Bank
            "'unsafe-eval'", // Разрешаем eval для динамических скриптов
            "https://epay.homebank.kz", // Halyk Bank API
            "https://api.homebank.kz", // Дополнительный домен Halyk Bank
            "https://secure.homebank.kz" // Secure домен Halyk Bank
          ],
          styleSrc: [
            "'self'",
            "'unsafe-inline'" // Разрешаем inline стили
          ],
          imgSrc: [
            "'self'",
            "data:",
            "https:", // Разрешаем загрузку изображений по HTTPS
            "http:" // Разрешаем загрузку изображений по HTTP (для разработки)
          ],
          connectSrc: [
            "'self'",
            "https://epay.homebank.kz",
            "https://api.homebank.kz",
            "https://secure.homebank.kz"
          ],
          frameSrc: [
            "'self'",
            "https://epay.homebank.kz",
            "https://api.homebank.kz",
            "https://secure.homebank.kz"
          ],
          formAction: [
            "'self'",
            "https://epay.homebank.kz",
            "https://api.homebank.kz"
          ]
        }
      }
    }));
    
    // CORS - разрешаем запросы из всех источников
    this.app.use(cors({
      origin: '*', // Разрешаем все источники
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      maxAge: 86400 // Access-Control-Max-Age: 86400 секунд (24 часа)
    }));
    
    // Парсинг JSON
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));
    
    // Логирование запросов
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
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
      res.status(404).json({
        error: 'Route not found',
        method: req.method,
        path: req.path
      });
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
        console.log(`🚀 Server is running on port ${this.port}`);
        console.log(`📊 Health check: http://localhost:${this.port}/health`);
        console.log(`🔗 API base URL: http://localhost:${this.port}/api`);
        console.log(`🗄️ Database: MySQL через Prisma`);
      });
    } catch (error) {
      console.error('❌ Ошибка запуска сервера:', error);
      process.exit(1);
    }
  }
}

export default App;
