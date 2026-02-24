import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@ojakh.ru';
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin123!';
  const adminName = process.env.ADMIN_NAME || 'Admin';

  // ── Create admin user ──────────────────────────────────────────────────────
  const hashedPassword = await bcrypt.hash(adminPassword, 10);
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      password: hashedPassword,
      name: adminName,
      role: 'admin',
    },
  });
  console.log(`Admin user created: ${adminEmail}`);

  // ── Products ───────────────────────────────────────────────────────────────
  const products = [
    // Хинкали
    {
      name: 'Хинкали',
      category: 'хинкали',
      flavor: 'говядина-свинина',
      unit: 'шт',
      price: 12000,
      description: 'Хинкали с начинкой говядина-свинина',
    },
    {
      name: 'Хинкали',
      category: 'хинкали',
      flavor: 'говядина',
      unit: 'шт',
      price: 13000,
      description: 'Хинкали с начинкой говядина',
    },
    {
      name: 'Хинкали',
      category: 'хинкали',
      flavor: 'баранина',
      unit: 'шт',
      price: 14000,
      description: 'Хинкали с начинкой баранина',
    },

    // Пельмени
    {
      name: 'Пельмени',
      category: 'пельмени',
      flavor: 'говядина',
      unit: 'кг',
      price: 85000,
      description: 'Пельмени с говядиной',
    },
    {
      name: 'Пельмени',
      category: 'пельмени',
      flavor: 'свинина-говядина',
      unit: 'кг',
      price: 75000,
      description: 'Пельмени со свининой-говядиной',
    },

    // Блинчики
    {
      name: 'Блинчики',
      category: 'блинчики',
      flavor: 'курица',
      unit: 'шт',
      price: 8000,
      description: 'Блинчики с курицей',
    },
    {
      name: 'Блинчики',
      category: 'блинчики',
      flavor: 'говядина',
      unit: 'шт',
      price: 10000,
      description: 'Блинчики с говядиной',
    },
    {
      name: 'Блинчики',
      category: 'блинчики',
      flavor: 'творог',
      unit: 'шт',
      price: 8000,
      description: 'Блинчики с творогом',
    },

    // Хлеб на закваске
    {
      name: 'Хлеб на закваске',
      category: 'хлеб',
      size: 'S',
      weightGrams: 400,
      unit: 'шт',
      price: 35000,
      description: 'Хлеб на закваске, 400 г',
    },
    {
      name: 'Хлеб на закваске',
      category: 'хлеб',
      size: 'M',
      weightGrams: 750,
      unit: 'шт',
      price: 45000,
      description: 'Хлеб на закваске, 750 г',
    },
    {
      name: 'Хлеб на закваске',
      category: 'хлеб',
      size: 'L',
      weightGrams: 950,
      unit: 'шт',
      price: 60000,
      description: 'Хлеб на закваске, 950 г',
    },

    // Десерты
    {
      name: 'Пахлава',
      category: 'десерты',
      unit: 'кг',
      price: 300000,
      description: 'Домашняя пахлава',
    },
    {
      name: 'Гата',
      category: 'десерты',
      unit: 'кг',
      price: 150000,
      description: 'Армянская гата',
    },
    {
      name: 'Эклеры',
      category: 'десерты',
      unit: 'шт',
      price: 15000,
      description: 'Эклеры',
    },
    {
      name: 'Пончики с заварным кремом',
      category: 'десерты',
      unit: 'шт',
      price: 15000,
      description: 'Пончики с заварным кремом',
    },

    // Торты
    {
      name: 'Торт Медовик',
      category: 'торты',
      unit: 'кг',
      price: 150000,
      description: 'Классический медовик',
    },
    {
      name: 'Торт Молочная девочка',
      category: 'торты',
      unit: 'кг',
      price: 150000,
      description: 'Торт Молочная девочка',
    },
    {
      name: 'Торт Птичье молоко',
      category: 'торты',
      unit: 'кг',
      price: 150000,
      description: 'Торт Птичье молоко',
    },
    {
      name: 'Торт Красный бархат',
      category: 'торты',
      unit: 'кг',
      price: 250000,
      description: 'Торт Красный бархат',
    },
    {
      name: 'Торт Рафаэлло',
      category: 'торты',
      unit: 'кг',
      price: 250000,
      description: 'Торт Рафаэлло',
    },
    {
      name: 'Торт Сникерс',
      category: 'торты',
      unit: 'кг',
      price: 300000,
      description: 'Торт Сникерс',
    },
    {
      name: 'Торт Избушка',
      category: 'торты',
      unit: 'кг',
      price: 300000,
      description: 'Торт Избушка',
    },
  ];

  for (const product of products) {
    await prisma.product.create({ data: product });
  }
  console.log(`Seeded ${products.length} products.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
