import prisma from './src/lib/prisma.ts';

async function main() {
  const category = await prisma.category.create({
    data: {
      name: 'Comida General',
      slug: 'comida-general',
    },
  }).catch((e) => prisma.category.findFirst());

  const products = [
    { name: 'Hamburguesa Clásica', price: 12.00, image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&h=300&fit=crop', categoryId: category.id },
    { name: 'Pizza Pepperoni', price: 15.00, image: 'https://images.unsplash.com/photo-1628840042765-356cda07504e?w=400&h=300&fit=crop', categoryId: category.id },
    { name: 'Tacos al Pastor', price: 10.00, image: 'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?w=400&h=300&fit=crop', categoryId: category.id },
    { name: 'Papas Fritas', price: 5.00, image: 'https://images.unsplash.com/photo-1630384060421-cb20d0e0649d?w=400&h=300&fit=crop', categoryId: category.id },
    { name: 'Coca Cola', price: 2.50, image: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=400&h=300&fit=crop', categoryId: category.id },
    { name: 'Cerveza Artesanal', price: 6.00, image: 'https://images.unsplash.com/photo-1535958636474-b021ee887b13?w=400&h=300&fit=crop', categoryId: category.id },
  ];

  for (const p of products) {
    const existing = await prisma.product.findFirst({ where: { name: p.name } });
    if (!existing) {
      await prisma.product.create({ data: p });
    }
  }

  const users = [
    { username: 'admin', password: '123', role: 'ADMIN' },
    { username: 'mesero1', password: '123', role: 'MESERO' },
    { username: 'mesero2', password: '123', role: 'MESERO' },
    { username: 'cocina1', password: '123', role: 'COCINA' },
  ];

  for (const u of users) {
    const eu = await prisma.user.findUnique({ where: { username: u.username } });
    if (!eu) {
      await prisma.user.create({ data: u });
    }
  }
}

main().then(() => console.log('Seeded database with default products!')).catch(console.error).finally(() => prisma.$disconnect());
