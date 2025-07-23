import { PrismaClient } from '@prisma/client';

// Создаем глобальный экземпляр Prisma Client
declare global {
  var prisma: PrismaClient | undefined;
}

const prisma = globalThis.prisma || new PrismaClient();

if (process.env.NODE_ENV === 'development') {
  globalThis.prisma = prisma;
}

export default prisma;

// Функция для подключения к базе данных
export async function connectDatabase(): Promise<void> {
  try {
    await prisma.$connect();
    console.log('✅ База данных MySQL подключена через Prisma');
  } catch (error) {
    console.error('❌ Ошибка подключения к базе данных:', error);
    process.exit(1);
  }
}

// Функция для отключения от базы данных
export async function disconnectDatabase(): Promise<void> {
  try {
    await prisma.$disconnect();
    console.log('✅ Отключение от базы данных MySQL');
  } catch (error) {
    console.error('❌ Ошибка отключения от базы данных:', error);
  }
}
