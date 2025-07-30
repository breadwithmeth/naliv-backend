import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { errorHandler } from './middleware/errorHandler';
import apiRoutes from './routes/api';
import { connectDatabase } from './database';

// Загрузка переменных окружения
dotenv.config();

class App {
  public app: Application;
  private port: string | number;

  constructor() {
    this.app = express();
    this.port = process.env.PORT || 3000;
    
    this.initializeMiddlewares();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  private initializeMiddlewares(): void {
    // Безопасность
    this.app.use(helmet());
    
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
    
    // Расширенное логирование запросов с информацией об IP
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      const ip = req.ip || req.connection.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';
      const timestamp = new Date().toISOString();
      
      console.log(`${timestamp} - ${req.method} ${req.path} | IP: ${ip} | UA: ${userAgent.substring(0, 50)}`);
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
