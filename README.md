# Оджах — интернет-магазин армянской домашней кухни

Магазин еды и тортов на заказ с доставкой по Нижнему Новгороду. Покупатель
собирает корзину, выбирает слот доставки, оплачивает онлайн и получает заказ;
владелец управляет всем через админ-панель.

Прод: https://ojakh.whysargis.ru · API: https://ojakh.api.whysargis.ru

## Возможности

**Витрина.** Каталог товаров и тортов на заказ, корзина, избранное, оформление
заказа со слотами доставки, промокоды, отзывы с модерацией. Регистрация и вход
по JWT, а также через Google, Apple и Yandex.

**Оплата и доставка.** Онлайн-оплата через ЮKassa с фискальными чеками 54-ФЗ,
интеграция с Яндекс.Доставкой (создание заявок), расчёт стоимости доставки по
адресу и расстоянию.

**Уведомления.** Web-push и email-уведомления о статусе заказа, переписка по
заказу между покупателем и магазином.

**Админ-панель.** Управление заказами и товарами, календарь нагрузки по слотам,
аналитика, модерация отзывов, email-рассылки.

Все денежные суммы хранятся в **копейках** (integer) — без чисел с плавающей точкой.

## Стек

| Часть          | Технологии                                                                      |
| -------------- | ------------------------------------------------------------------------------- |
| `backend/`     | NestJS 11 (Fastify), Prisma 6, PostgreSQL 16, JWT (+ Google/Apple/Yandex), Jest |
| `frontend/`    | Next.js 16 (App Router), React 19, Tailwind CSS v4, Zustand, TanStack Query     |
| Инфраструктура | pnpm workspace, Docker Compose, nginx + Let's Encrypt, Sentry, GitHub Actions   |

Монорепозиторий на pnpm workspace. Прод развёрнут на одном VPS целиком в Docker
Compose (postgres, backend, frontend, nginx с TLS и rate limiting, certbot,
ежедневный бэкап БД и загрузок); наружу открыты только 80/443. CI на GitHub
Actions гоняет eslint, typecheck и юнит-тесты на каждый push и PR.

## Структура

```
backend/src/modules/   # auth, users, products, cart, orders, payments (+ yookassa),
                       # delivery (+ yandex claims), admin, reviews, promo,
                       # notifications, push, mail, order-messages, feedback, ...
backend/prisma/        # schema.prisma, миграции, seed
frontend/app/          # (auth) | (shop) — каталог/корзина/заказы/профиль | admin
frontend/components/   # ui (radix/shadcn-стиль), products, reviews, layout, motion
scripts/               # deploy.sh, backup.sh, restore-backup.sh, init-ssl.sh
nginx/                 # конфиг реверс-прокси
```
