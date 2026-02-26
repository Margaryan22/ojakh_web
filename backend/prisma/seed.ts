import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // ── Admin user (idempotent upsert) ────────────────────────────────────────
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@ojakh.ru';
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin123!';
  const adminName = process.env.ADMIN_NAME || 'Admin';

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
  console.log(`✓ Admin: ${adminEmail}`);

  // ── Products (skip if already seeded) ────────────────────────────────────
  const productCount = await prisma.product.count();
  if (productCount > 0) {
    console.log(`✓ Products already seeded (${productCount} found), skipping.`);
    return;
  }

  // Цены в копейках (рубли × 100)
  const products = [
    // ── Хинкали ─────────────────────────────────────────────────────────────
    // поштучно, мин. 1 шт, целое количество
    {
      name: 'Хинкали',
      category: 'хинкали',
      flavor: 'говядина-свинина',
      unit: 'шт',
      price: 12000,      // 120 ₽/шт
      minQty: 1,
      step: 1,
      description: 'Хинкали с начинкой говядина-свинина',
    },
    {
      name: 'Хинкали',
      category: 'хинкали',
      flavor: 'говядина',
      unit: 'шт',
      price: 13000,      // 130 ₽/шт
      minQty: 1,
      step: 1,
      description: 'Хинкали с начинкой говядина',
    },
    {
      name: 'Хинкали',
      category: 'хинкали',
      flavor: 'баранина',
      unit: 'шт',
      price: 14000,      // 140 ₽/шт
      minQty: 1,
      step: 1,
      description: 'Хинкали с начинкой баранина',
    },

    // ── Пельмени ────────────────────────────────────────────────────────────
    // килограммами, мин. 1 кг, целые килограммы
    {
      name: 'Пельмени',
      category: 'пельмени',
      flavor: 'говядина',
      unit: 'кг',
      price: 85000,      // 850 ₽/кг
      minQty: 1,
      step: 1,
      description: 'Пельмени с говядиной',
    },
    {
      name: 'Пельмени',
      category: 'пельмени',
      flavor: 'свинина-говядина',
      unit: 'кг',
      price: 75000,      // 750 ₽/кг
      minQty: 1,
      step: 1,
      description: 'Пельмени со свининой-говядиной',
    },

    // ── Блинчики ────────────────────────────────────────────────────────────
    // поштучно, мин. 1 шт, целое количество
    {
      name: 'Блинчики',
      category: 'блинчики',
      flavor: 'курица',
      unit: 'шт',
      price: 8000,       // 80 ₽/шт
      minQty: 1,
      step: 1,
      description: 'Блинчики с курицей',
    },
    {
      name: 'Блинчики',
      category: 'блинчики',
      flavor: 'говядина',
      unit: 'шт',
      price: 10000,      // 100 ₽/шт
      minQty: 1,
      step: 1,
      description: 'Блинчики с говядиной',
    },
    {
      name: 'Блинчики',
      category: 'блинчики',
      flavor: 'творог',
      unit: 'шт',
      price: 8000,       // 80 ₽/шт
      minQty: 1,
      step: 1,
      description: 'Блинчики с творогом',
    },

    // ── Хлеб на закваске ────────────────────────────────────────────────────
    // штучно, по одному изделию каждого размера
    {
      name: 'Хлеб на закваске',
      category: 'хлеб',
      size: 'S',
      weightGrams: 400,
      unit: 'шт',
      price: 35000,      // 350 ₽/шт
      minQty: 1,
      step: 1,
      description: 'Хлеб на закваске S, 400 г',
    },
    {
      name: 'Хлеб на закваске',
      category: 'хлеб',
      size: 'M',
      weightGrams: 750,
      unit: 'шт',
      price: 45000,      // 450 ₽/шт
      minQty: 1,
      step: 1,
      description: 'Хлеб на закваске M, 750 г',
    },
    {
      name: 'Хлеб на закваске',
      category: 'хлеб',
      size: 'L',
      weightGrams: 950,
      unit: 'шт',
      price: 60000,      // 600 ₽/шт
      minQty: 1,
      step: 1,
      description: 'Хлеб на закваске L, 950 г',
    },

    // ── Десерты ─────────────────────────────────────────────────────────────
    {
      name: 'Пахлава',
      category: 'десерты',
      unit: 'кг',
      price: 300000,     // 3 000 ₽/кг
      minQty: 1,
      step: 1,
      description: 'Домашняя пахлава, минимум 1 кг',
    },
    {
      name: 'Гата',
      category: 'десерты',
      unit: 'кг',
      price: 150000,     // 1 500 ₽/кг
      minQty: 1,
      step: 1,
      description: 'Армянская гата, минимум 1 кг',
    },
    {
      name: 'Эклеры',
      category: 'десерты',
      unit: 'шт',
      price: 15000,      // 150 ₽/шт
      minQty: 1,
      step: 1,
      description: 'Эклеры с кремом',
    },
    {
      name: 'Пончики с заварным кремом',
      category: 'десерты',
      unit: 'шт',
      price: 15000,      // 150 ₽/шт
      minQty: 1,
      step: 1,
      description: 'Пончики с заварным кремом',
    },

    // ── Торты ───────────────────────────────────────────────────────────────
    // килограммами, шаг 0.5 кг, минимум 1 кг
    {
      name: 'Медовик',
      category: 'торты',
      unit: 'кг',
      price: 150000,     // 1 500 ₽/кг
      minQty: 1,
      step: 0.5,
      description: 'Классический медовик, от 1 кг',
    },
    {
      name: 'Молочная девочка',
      category: 'торты',
      unit: 'кг',
      price: 150000,     // 1 500 ₽/кг
      minQty: 1,
      step: 0.5,
      description: 'Торт Молочная девочка, от 1 кг',
    },
    {
      name: 'Птичье молоко',
      category: 'торты',
      unit: 'кг',
      price: 150000,     // 1 500 ₽/кг
      minQty: 1,
      step: 0.5,
      description: 'Торт Птичье молоко, от 1 кг',
    },
    {
      name: 'Красный бархат',
      category: 'торты',
      unit: 'кг',
      price: 250000,     // 2 500 ₽/кг
      minQty: 1,
      step: 0.5,
      description: 'Торт Красный бархат, от 1 кг',
    },
    {
      name: 'Рафаэлло',
      category: 'торты',
      unit: 'кг',
      price: 250000,     // 2 500 ₽/кг
      minQty: 1,
      step: 0.5,
      description: 'Торт Рафаэлло, от 1 кг',
    },
    {
      name: 'Сникерс',
      category: 'торты',
      unit: 'кг',
      price: 300000,     // 3 000 ₽/кг
      minQty: 1,
      step: 0.5,
      description: 'Торт Сникерс, от 1 кг',
    },
    {
      name: 'Избушка',
      category: 'торты',
      unit: 'кг',
      price: 300000,     // 3 000 ₽/кг
      minQty: 1,
      step: 0.5,
      description: 'Торт Избушка, от 1 кг',
    },
  ];

  await prisma.product.createMany({ data: products });
  console.log(`✓ Seeded ${products.length} products.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
