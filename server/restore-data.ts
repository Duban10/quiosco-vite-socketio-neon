import fs from 'fs';
import path from 'path';
import prisma from './src/lib/prisma.ts';

interface SeedData {
  categories: Array<{ id: number; name: string; slug: string }>;
  products: Array<{ id: number; name: string; price: number; image: string; stock: number; categoryId: number }>;
  users: Array<{ id: number; username: string; password: string; role: string }>;
  tables: Array<{ id: number; name: string }>;
  appConfig: Array<{ id: number; logoUrl?: string; companyName?: string; startingCash?: number }>;
  expenses: Array<{ id: number; amount: number; description: string; category: string; date: string; userId?: number | null }>;
}

async function restoreData() {
  try {
    console.log('📂 Leyendo archivo de datos de prueba...');
    const dataPath = path.join(process.cwd(), 'data', 'seed-data.json');
    const rawData = fs.readFileSync(dataPath, 'utf-8');
    const data: SeedData = JSON.parse(rawData);

    console.log('🗑️ Limpiando BD...');
    // Limpiar en orden de dependencias (FK)
    await prisma.expense.deleteMany({});
    await prisma.orderProducts.deleteMany({});
    await prisma.order.deleteMany({});
    await prisma.product.deleteMany({});
    await prisma.category.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.table.deleteMany({});
    await prisma.appConfig.deleteMany({});

    console.log('📝 Restaurando Categorías...');
    const categoryMap = new Map();
    for (const cat of data.categories) {
      const createdCat = await prisma.category.create({ data: { name: cat.name, slug: cat.slug } });
      categoryMap.set(cat.id, createdCat.id); // Mapear ID original -> ID real
    }

    console.log('📝 Restaurando Productos...');
    for (const prod of data.products) {
      const realCategoryId = categoryMap.get(prod.categoryId);
      if (!realCategoryId) {
        throw new Error(`Categoría con ID ${prod.categoryId} no encontrada`);
      }
      await prisma.product.create({
        data: {
          name: prod.name,
          price: prod.price,
          image: prod.image,
          stock: prod.stock,
          categoryId: realCategoryId
        }
      });
    }

    console.log('📝 Restaurando Usuarios...');
    const userMap = new Map();
    for (const user of data.users) {
      const createdUser = await prisma.user.create({
        data: {
          username: user.username,
          password: user.password,
          role: user.role
        }
      });
      userMap.set(user.id, createdUser.id); // Mapear ID original -> ID real
    }

    console.log('📝 Restaurando Mesas...');
    for (const table of data.tables) {
      await prisma.table.create({
        data: { name: table.name }
      });
    }

    console.log('📝 Restaurando Configuración...');
    for (const config of data.appConfig) {
      await prisma.appConfig.create({
        data: {
          logoUrl: config.logoUrl || null,
          companyName: config.companyName || null,
          startingCash: Number.isFinite(config.startingCash) ? config.startingCash : 0
        }
      });
    }

    console.log('📝 Restaurando Gastos...');
    for (const expense of data.expenses) {
      const realUserId = expense.userId ? userMap.get(expense.userId) : null;
      await prisma.expense.create({
        data: {
          amount: expense.amount,
          description: expense.description,
          category: expense.category,
          date: new Date(expense.date),
          userId: realUserId
        }
      });
    }

    console.log('✅ BD restaurada exitosamente!');
  } catch (error) {
    console.error('❌ Error al restaurar datos:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

restoreData();
