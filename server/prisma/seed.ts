import { PrismaClient } from '../src/generated/prisma/client.ts';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter });

async function main() {
  // Crear AppConfig (logo)
  await prisma.appConfig.upsert({
    where: { id: 1 },
    update: {},
    create: {
      logoUrl: null,
      startingCash: 0
    },
  });

  // Crear categorías
  const bebidas = await prisma.category.upsert({
    where: { slug: 'bebidas' },
    update: {},
    create: {
      name: 'Bebidas',
      slug: 'bebidas',
    },
  });

  const comidas = await prisma.category.upsert({
    where: { slug: 'comidas' },
    update: {},
    create: {
      name: 'Comidas',
      slug: 'comidas',
    },
  });

  // Crear productos
  await prisma.product.upsert({
    where: { id: 1 },
    update: {},
    create: {
      name: 'Coca Cola',
      price: 2.50,
      image: 'https://res.cloudinary.com/dzx4gszzl/image/upload/v1716920000/coca_cola.png',
      categoryId: bebidas.id,
    },
  });

  await prisma.product.upsert({
    where: { id: 2 },
    update: {},
    create: {
      name: 'Hamburguesa Clásica',
      price: 8.00,
      image: 'https://res.cloudinary.com/dzx4gszzl/image/upload/v1716920000/hamburguesa.png',
      categoryId: comidas.id,
    },
  });

  // Crear usuario administrador
  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      password: 'admin', // En un entorno real, usar hash de contraseñas
      role: 'ADMIN',
    },
  });

  // Crear usuarios meseros
  await prisma.user.upsert({
    where: { username: 'mesero1' },
    update: {},
    create: {
      username: 'mesero1',
      password: 'pass',
      role: 'MESERO',
    },
  });

  await prisma.user.upsert({
    where: { username: 'cocina1' },
    update: {},
    create: {
      username: 'cocina1',
      password: 'pass',
      role: 'COCINA',
    },
  });

  // Crear mesas
  await prisma.table.upsert({
    where: { name: 'Mesa 1' },
    update: {},
    create: { name: 'Mesa 1' },
  });

  await prisma.table.upsert({
    where: { name: 'Mesa 2' },
    update: {},
    create: { name: 'Mesa 2' },
  });

  await prisma.table.upsert({
    where: { name: 'Barra' },
    update: {},
    create: { name: 'Barra' },
  });

  console.log('Seed data created successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
