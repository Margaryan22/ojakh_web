# Оджах — интернет-магазин армянской домашней кухни

Магазин еды и тортов на заказ с доставкой по Нижнему Новгороду:
каталог, корзина, оформление заказа со слотами доставки, онлайн-оплата ЮKassa
(с чеками 54-ФЗ), Яндекс.Доставка, отзывы, промокоды, web-push и email-уведомления,
админ-панель (заказы, товары, календарь нагрузки, аналитика, модерация, рассылки).

Прод: https://ojakh.whysargis.ru · API: https://ojakh.api.whysargis.ru

## Стек

| Часть          | Технологии                                                                      |
| -------------- | ------------------------------------------------------------------------------- |
| `backend/`     | NestJS 11 (Fastify), Prisma 6, PostgreSQL 16, JWT (+ Google/Apple/Yandex), Jest |
| `frontend/`    | Next.js 16 (App Router), React 19, Tailwind CSS v4, Zustand, TanStack Query     |
| Инфраструктура | pnpm workspace, Docker Compose, nginx + Let's Encrypt, Sentry, GitHub Actions   |

Все денежные суммы хранятся в **копейках** (integer).

## Локальный запуск

Требуются Node.js 22+, pnpm 10 (`corepack enable`) и Docker (для Postgres).

```bash
pnpm install

# 1. Postgres для разработки (порт 5432, пароль secret)
docker compose -f docker-compose.dev.yml up -d

# 2. Бекенд
cp backend/.env.example backend/.env        # заполнить DATABASE_URL и JWT-секреты
pnpm --filter backend prisma:generate
pnpm --filter backend prisma:migrate        # применяет миграции (dev)
pnpm --filter backend seed                  # админ + демо-данные
pnpm --filter backend dev                   # http://localhost:3001 (Swagger: /api)

# 3. Фронтенд (в другом терминале)
cp frontend/.env.example frontend/.env.local
pnpm --filter frontend dev                  # http://localhost:3000
```

Почти все интеграции (DaData, ЮKassa, Яндекс.Доставка, UniSender, VAPID, Sentry)
деградируют в no-op при пустых ключах — для разработки достаточно БД и JWT-секретов.
Комментарии в [backend/.env.example](backend/.env.example) и
[frontend/.env.example](frontend/.env.example) описывают каждую переменную.

## Проверки

```bash
pnpm lint         # eslint обоих пакетов
pnpm typecheck    # tsc обоих пакетов
pnpm test         # юнит-тесты бекенда (Jest, БД не нужна)
```

То же самое запускает CI ([.github/workflows/ci.yml](.github/workflows/ci.yml))
на push в main и в PR, плюс пробную сборку Docker-образов.
Pre-commit хук (husky + lint-staged) гоняет eslint/prettier по изменённым файлам.

## Деплой

Прод — один VPS, весь стек в Docker Compose (`docker-compose.yml`): postgres,
backend, frontend, nginx (TLS, security-заголовки, rate limiting), certbot,
ежедневный бэкап. Наружу открыты только 80/443 (nginx); порты приложений
привязаны к 127.0.0.1.

```bash
# на сервере, из корня репозитория
./scripts/deploy.sh    # git pull + пересборка backend/frontend + миграции
```

Перед первым запуском:

- создать `./backend/.env` (см. `.env.example`; в проде обязательны сильные
  JWT-секреты ≥32 символов — приложение откажется стартовать со слабыми);
- задать `POSTGRES_PASSWORD` в `./.env` рядом с docker-compose.yml
  (compose не стартует без него);
- выпустить TLS-сертификат: `./scripts/init-ssl.sh`.

Миграции применяются автоматически при старте контейнера бекенда
(`prisma migrate deploy`).

## Бэкапы

Сервис `backup` каждые 24 часа складывает дамп БД и архив загрузок в
`./backups` (ротация 14 суток) — см. [scripts/backup.sh](scripts/backup.sh).
Опционально: выгрузка в S3-совместимое хранилище через rclone и ping
healthchecks-сервиса (переменные описаны в скрипте).
Восстановление — [scripts/restore-backup.sh](scripts/restore-backup.sh).

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
