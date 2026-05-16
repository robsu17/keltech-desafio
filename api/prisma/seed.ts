import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { hash } from 'bcryptjs';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const password = await hash('password123', 10);

  await prisma.user.upsert({
    where: { email: 'operator@keltech.com' },
    update: {},
    create: {
      name: 'Operator User',
      email: 'operator@keltech.com',
      passwordHash: password,
      role: 'OPERATOR',
    },
  });

  await prisma.user.upsert({
    where: { email: 'manager@keltech.com' },
    update: {},
    create: {
      name: 'Manager User',
      email: 'manager@keltech.com',
      passwordHash: password,
      role: 'MANAGER',
    },
  });

  await prisma.user.upsert({
    where: { email: 'admin@keltech.com' },
    update: {},
    create: {
      name: 'Admin User',
      email: 'admin@keltech.com',
      passwordHash: password,
      role: 'ADMIN',
    },
  });

  console.log('Seed concluído com sucesso.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
