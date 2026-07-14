# Анализ проекта Ojakh: улучшения и промты для Opus

## Контекст

Проект — интернет-магазин ojakh (еда/торты, Нижний Новгород): pnpm-монорепо, `backend/` — NestJS 11 на Fastify + Prisma 6 + PostgreSQL, `frontend/` — Next.js 16 App Router + Tailwind v4 + Zustand + React Query. Интеграции: YooKassa (с чеками 54-ФЗ), Яндекс.Доставка, DaData, UniSender, web-push. Деплой — Docker Compose на одном VPS за nginx + Let's Encrypt. Деньги хранятся в копейках (integer).

Сильные стороны: продуманная доменная логика заказов (валидация дат/слотов/лимитов), идемпотентная машина состояний платежей, magic-byte валидация загрузок, fail-fast проверка секретов в проде, аккуратные бэкап-скрипты, хороший SEO на страницах товаров, Sentry с обеих сторон.

Ниже — найденные проблемы, сгруппированные по приоритету, и готовый промт для Opus под каждую. К каждому промту стоит добавлять общий контекстный блок:

> **Общий контекст (вставлять в начало каждого промта):**
> Проект — pnpm-монорепо: `backend/` (NestJS 11 + Fastify-адаптер + Prisma 6 + PostgreSQL), `frontend/` (Next.js 16 App Router, React 19, Tailwind v4, Zustand, TanStack Query, axios-клиент в `frontend/lib/api.ts`). Все цены — в копейках (integer). UI и комментарии — на русском. Стиль коммитов — Conventional Commits на русском. После изменений прогони `pnpm lint` и `pnpm typecheck` в затронутом пакете, для backend — `pnpm test`.

---

## 🔴 Критичные (безопасность и корректность)

### 1. Цены корзины доверяются клиенту (price tampering)

`cart.service.addOrUpdateItem` принимает `price`, `name`, `unit`, `maxPerCart` из тела запроса и считает `subtotal` от клиентской цены. Цена не сверяется с БД при добавлении в корзину — переоценка есть только при «повторить заказ».

**Промт:**

```
В backend/src/modules/cart/cart.service.ts метод addOrUpdateItem доверяет
клиентским полям price, name, unit, maxPerCart из DTO — это уязвимость
подмены цены. Корзина хранится как JSON-массив в Cart.items (модель Cart
в backend/prisma/schema.prisma), ключ позиции — product_id:flavor:size.

Задача: при добавлении/обновлении позиции корзины загружай продукт из БД
по productId и бери price, name, unit, maxPerCart, available из записи
Product, игнорируя клиентские значения (из DTO оставь только productId,
flavor, size, quantity). Если продукт не найден или available=false —
кидай понятную ошибку. Также добавь пересверку актуальных цен корзины
с БД в момент создания заказа в backend/src/modules/orders/orders.service.ts
(по аналогии с существующей переоценкой в reorder) — если цена позиции
устарела, пересчитай и верни клиенту понятный ответ о том, что цены
обновились. Обнови DTO корзины и существующие тесты
cart.service.spec.ts и orders.service.spec.ts, добавь тесты на подмену
цены. Проверь, что frontend (стор корзины frontend/stores/cart.store.ts
и страница frontend/app/(shop)/cart/page.tsx) не сломается от того, что
сервер теперь сам определяет цену.
```

### 2. Backend и frontend доступны в обход nginx + нет helmet

В `docker-compose.yml` порты `3001:3001` и `3000:3000` опубликованы на хосте — API доступен напрямую, минуя nginx с его security-заголовками и TLS. В самом NestJS нет `@fastify/helmet`.

**Промт:**

```
В docker-compose.yml сервисы backend и frontend публикуют порты
3001:3001 и 3000:3000 наружу, хотя весь трафик должен идти через nginx
(сервис nginx в том же compose, конфиг nginx/nginx.conf). Также в
backend/src/main.ts не зарегистрирован @fastify/helmet.

Задача:
1) В docker-compose.yml привяжи порты backend и frontend к
   127.0.0.1 (127.0.0.1:3001:3001) или убери публикацию портов совсем,
   раз nginx общается с ними по внутренней docker-сети — проверь, что
   healthcheck'и и nginx upstream'ы продолжат работать.
2) Добавь @fastify/helmet в backend (регистрация в main.ts рядом с
   существующими @fastify/cookie и @fastify/multipart), настрой CSP так,
   чтобы не сломать Swagger в dev и отдачу статики из /static/.
3) В nginx/nginx.conf добавь client_max_body_size (загрузки до 5 МБ идут
   на бекенд), gzip для текстовых ответов и базовый rate limiting на
   /auth/ эндпоинты.
Не трогай логику приложения. Объясни в итоге, что нужно перепроверить
на сервере после деплоя.
```

### 3. Админка и приватные роуты защищены только на клиенте

`frontend/app/admin/layout.tsx` — клиентский guard через useEffect: не-админ видит вспышку UI, `middleware.ts` нет вовсе.

**Промт:**

```
Во frontend (Next.js 16 App Router) защита роутов только клиентская:
frontend/app/admin/layout.tsx редиректит не-админов в useEffect, из-за
чего защищённый UI мигает, а на уровне edge защиты нет. Auth-токен
(access) живёт в памяти zustand-стора frontend/stores/auth.store.ts,
refresh-токен — httpOnly-cookie бекенда (см. refreshCookieOptions в
backend/src/modules/auth/auth.controller.ts).

Задача: добавь frontend/middleware.ts, который для путей /admin/*,
/profile/*, /orders/*, /favorites определяет наличие сессии по
refresh-cookie и редиректит гостей на /login с параметром returnTo.
Учитывай, что содержимое JWT в middleware проверить без секрета нельзя —
достаточно проверки наличия cookie как первой линии обороны, серверная
авторизация остаётся на бекенде (guards в backend/src/common/guards).
Роль admin в cookie не видна — для /admin оставь и клиентский guard, но
убери вспышку UI: не рендери children до подтверждения роли (скелетон).
Проверь имя refresh-cookie в auth.controller.ts и совпадение доменов
(frontend и API на разных поддоменах — cookie может быть недоступна
frontend-домену; если так, честно опиши ограничение и реализуй
альтернативу: лёгкую session-cookie-метку, выставляемую при логине).
```

### 4. Генерация номеров заказов исчерпается (~9000 заказов)

`orders.service.ts:401` — случайный 4-значный номер с 20 ретраями: коллизии и отказ при росте базы.

**Промт:**

```
В backend/src/modules/orders/orders.service.ts (метод генерации номера
заказа, ~строка 401) номер заказа — случайное 4-значное число с 20
попытками при коллизии. При нескольких тысячах заказов начнутся отказы.

Задача: замени на монотонную схему без коллизий — например, PostgreSQL
sequence через Prisma-миграцию (или формат ГГММДД-NNN со счётчиком в
БД, определи что проще и надёжнее при конкурентных заказах). Требования:
номер человекочитаемый (его диктуют по телефону), уникальность
гарантируется БД, а не ретраями, существующие заказы со старыми
номерами продолжают работать. Напиши миграцию в backend/prisma/migrations,
обнови orders.service.spec.ts. Покажи, где номер отображается на
frontend, и проверь, что новый формат нигде не ломает вёрстку/поиск
(поиск по номеру есть в админке).
```

### 5. Мелкий security-hardening бекенда (одним заходом)

Несогласованный дефолт JWT (15m в модуле vs 3h в сервисе), fail-open валидация адресов DaData, неиспользуемый nodemailer и мёртвые SMTP-переменные, дефолтный пароль Postgres `secret` в compose.

**Промт:**

```
Наведи порядок в конфигурации безопасности бекенда (NestJS,
backend/src). Четыре независимых пункта:
1) JWT: в backend/src/modules/auth/auth.module.ts JwtModule
   регистрируется с дефолтом 15m, а auth.service.ts подписывает access
   с 3h — приведи к одному источнику правды (env JWT_ACCESS_EXPIRES с
   разумным дефолтом), обнови backend/.env.example.
2) DaData: validateNnAddress в backend/src/modules/delivery/delivery.service.ts
   fail-open — без ключа или при ошибке API адрес принимается. Добавь
   env-флаг ADDRESS_VALIDATION_STRICT (default false, чтобы не сломать
   прод), при true — отклонять адрес при недоступности DaData, и логируй
   каждый fail-open случай через Logger как warning.
3) Удали неиспользуемую зависимость nodemailer из backend/package.json
   (почта реально ходит через UniSender API в
   backend/src/modules/mail/mail.service.ts), убери мёртвые SMTP_* и
   SENDPULSE-переменные из backend/.env.example и устаревший комментарий
   про SENDPULSE в backend/src/modules/notifications/notifications.service.ts:41.
   Заодно вынеси захардкоженный домен ojakh.whysargis.ru из
   mail.service.ts в env (FRONTEND_URL уже существует — используй его).
4) В docker-compose.yml POSTGRES_PASSWORD имеет fallback "secret" —
   убери fallback, чтобы compose падал без заданной переменной, и
   допиши это в комментарий рядом.
Прогони pnpm test в backend после изменений.
```

### 6. Разрешены все хосты для next/image

`frontend/next.config.ts`: `remotePatterns` с `hostname: '*'` по http и https — image-proxy Next.js можно использовать для проксирования чужих картинок (SSRF-поверхность, расход трафика).

**Промт:**

```
Во frontend/next.config.ts remotePatterns для next/image разрешают
любой hostname по http и https — это открытый image-proxy. Реальные
источники картинок: собственный API-домен (продуктовые фото отдаются
бекендом из /static/, домен в NEXT_PUBLIC_API_URL, прод —
ojakh.api.whysargis.ru) и localhost:3001 в dev.

Задача: сузь remotePatterns до этих источников (протокол https для
прода, http://localhost:3001 для dev), проверь по коду все места
использования next/image (grep по Image from 'next/image'), чтобы не
осталось внешних URL картинок. Если найдутся другие источники — добавь
их явно. Заодно добавь sizes там, где его нет у fill-изображений, чтобы
убрать предупреждения Next.js.
```

---

## 🟠 Важные (инфраструктура и качество)

### 7. Нет CI/CD

Ни одного пайплайна: lint/typecheck/test не запускаются автоматически, деплой — ручной `scripts/deploy.sh` по SSH.

**Промт:**

```
В репозитории (pnpm-монорепо: backend NestJS + frontend Next.js) нет
никакого CI. Есть готовые скрипты в обоих package.json: lint, typecheck,
format:check, у backend ещё test (Jest). Деплой — ручной scripts/deploy.sh
на VPS (git pull + docker compose up -d --build), менять его не нужно.

Задача: создай .github/workflows/ci.yml — на push в main и на PR:
установка pnpm (версию возьми из packageManager в корневом package.json
или зафиксируй), кэш pnpm store, затем параллельные джобы для backend и
frontend: lint, typecheck, для backend — test, и сборка (next build для
frontend потребует значения NEXT_PUBLIC_* — передай безопасные
плейсхолдеры через env). Для backend-тестов БД не нужна (юнит-тесты с
моками Prisma). Добавь также джобу docker-build (docker build обоих
Dockerfile без пуша) — она ловит расхождения зависимостей. Файл должен
проходить с первого раза: перед сдачей мысленно проверь каждый шаг
на соответствие реальным скриптам в package.json.
```

### 8. Dockerfile'ы собирают через npm, а репозиторий — pnpm workspace

Оба Dockerfile делают `npm ci --legacy-peer-deps` по `package-lock.json`, игнорируя коммитнутый `pnpm-lock.yaml` — сборки невоспроизводимы относительно lockfile, которым пользуются локально.

**Промт:**

```
Репозиторий — pnpm workspace (корневые pnpm-workspace.yaml и
pnpm-lock.yaml), но backend/Dockerfile и frontend/Dockerfile используют
npm ci --legacy-peer-deps с package-lock.json — Docker-сборка игнорирует
настоящий lockfile.

Задача: переведи оба Dockerfile на pnpm с использованием corepack и
pnpm fetch/pnpm install --frozen-lockfile от корневого pnpm-lock.yaml
(контекст сборки в docker-compose.yml сейчас — подкаталоги backend/ и
frontend/; поменяй context на корень репозитория с dockerfile-путями,
это нужно для доступа к корневому lockfile). Сохрани текущую двухэтапную
структуру (builder → runner на node:22-alpine), BuildKit cache mounts,
запуск prisma migrate deploy в CMD backend'а и standalone-вывод Next.
Удали package-lock.json из обоих пакетов. Проверь итог локальной сборкой
docker compose build backend frontend и опиши, что проверить после
деплоя.
```

### 9. Пагинация и кэширование отсутствуют

Пагинация есть только у `orders.getOrders`. Каталог, списки админки, уведомления, отзывы — без ограничений или с фиксированным `take: 50`. Кэша нет вовсе — каталог и настройки бьют в БД на каждый запрос.

**Промт:**

```
В backend (NestJS + Prisma) пагинация есть только в orders.getOrders.
Остальные списки либо без лимита, либо с фиксированным take:50:
products.findAll (backend/src/modules/products/products.service.ts),
admin.getOrders и admin.listUsers (backend/src/modules/admin/),
notifications.getForUser, reviews.list, favorites.

Задача:
1) Добавь единый переиспользуемый паттерн пагинации (page/limit с
   максимумом, meta с total) — общий DTO в backend/src/common — и
   применяй его в admin.getOrders, admin.listUsers, reviews.list,
   notifications.getForUser. Каталог продуктов небольшой (десятки
   позиций) — его не трогай.
2) Кэширование: подключи @nestjs/cache-manager с in-memory стором (Redis
   не добавляем — один VPS) для products.findAll/findOne и
   settings (StoreSettings-синглтон), TTL 60с, с инвалидацией при
   admin-мутациях продуктов и настроек.
3) Обнови фронтовые вызовы этих эндпоинтов (React Query в страницах
   admin/*) под новый формат ответа с meta; добавь UI пагинации в
   admin/page.tsx (заказы) и списки, где её потребует новый API.
Обнови существующие spec-тесты затронутых сервисов.
```

### 10. Healthcheck — статичная заглушка

`GET /health` возвращает `{status:'ok'}` не проверяя БД — повисшая БД не уронит healthcheck compose.

**Промт:**

```
backend/src/modules/health/health.controller.ts возвращает статичный
{status:'ok'}. Docker-compose healthcheck опирается на него, но
недоступность PostgreSQL он не ловит.

Задача: добавь в health-эндпоинт проверку БД через PrismaService
(SELECT 1 с таймаутом ~2с), верни { status, db } и HTTP 503 при
недоступности БД. Без @nestjs/terminus — модуль крошечный, сделай
руками. Учти, что healthcheck дёргается каждые несколько секунд —
запрос должен быть дешёвым. Добавь health.controller.spec.ts.
```

### 11. Нет README и документации env фронтенда

README нет вообще; `frontend/.env.example` не существует (переменные фронта нигде не задокументированы).

**Промт:**

```
В репозитории нет README и нет frontend/.env.example. Изучи проект:
корневые package.json/pnpm-workspace.yaml/docker-compose.yml, скрипты в
scripts/ (deploy.sh, backup.sh, restore-backup.sh, init-ssl.sh),
backend/.env.example (он подробный — образец стиля), фактически
используемые NEXT_PUBLIC_* переменные (grep по frontend/ и по args в
docker-compose.yml).

Задача:
1) Напиши корневой README.md на русском: что за проект (магазин ojakh),
   стек, структура монорепо, локальный запуск (pnpm install, поднятие
   Postgres через docker-compose.dev.yml, prisma migrate + seed, dev
   обоих пакетов), переменные окружения (ссылками на .env.example),
   тесты/линт, деплой (кратко: scripts/deploy.sh на VPS), бэкапы.
   Без воды, фактам из кода доверяй больше, чем предположениям.
2) Создай frontend/.env.example со всеми реально используемыми
   NEXT_PUBLIC_* переменными и комментариями в стиле backend/.env.example.
```

### 12. Нет git-хуков — линт и формат не форсируются

Скрипты lint/format есть, но ничто не запускает их до коммита; CI тоже нет (см. п.7).

**Промт:**

```
В pnpm-монорепо есть скрипты lint/format/typecheck в backend и frontend,
но нет git-хуков. Настрой husky + lint-staged в корне: prepare-скрипт,
pre-commit прогоняет lint-staged (eslint --fix по затронутым .ts/.tsx
соответствующего пакета через его eslint.config.mjs, prettier --write по
остальным поддерживаемым файлам, соблюдая корневой .prettierignore).
Typecheck и тесты в хук не включай — долго; они уйдут в CI. Проверь, что
хук работает и на частичном staged-состоянии. ESLint-конфиги уже flat
(eslint 9) — учитывай это в командах lint-staged.
```

### 13. Тестовые слепые зоны

Бекенд: только юнит-тесты сервисов; guards, контроллеры, вся интеграция Яндекс.Доставки (`delivery/claims`), reviews, promo, push, order-messages, uploads — без тестов. Фронтенд: тестов нет вообще.

**Промт:**

```
В backend (NestJS 11, Jest 30) есть 11 spec-файлов уровня сервисов, но
нулевое покрытие критичных мест. Напиши тесты (только юнит, без e2e и
реальной БД — моки Prisma по образцу существующих spec, например
backend/src/modules/orders/orders.service.spec.ts):
1) Guards: backend/src/common/guards/jwt.guard.ts, admin.guard.ts,
   optional-jwt.guard.ts — валидный/просроченный/отсутствующий токен,
   не-админ на админ-эндпоинте.
2) reviews.service.ts и promo.service.ts — основные сценарии (upsert
   отзыва, права на удаление; валидация промокода: истёкший,
   исчерпанный, minAmount).
3) delivery/claims — машина статусов Яндекс-заявок и обработка ошибок
   API (мок axios).
Смотри на существующие spec-файлы как на образец стиля моков. Cel —
осмысленные проверки поведения, а не снапшоты; каждый тест должен
падать при реальной регрессии. Прогони pnpm test и добейся зелёного.
```

### 14. Гигантские страницы и отсутствие loading/error-границ на фронте

`app/(shop)/cart/page.tsx` — 1411 строк; ни одного `loading.tsx`, единственный `error.tsx` — корневой (ошибка в админке роняет всё дерево).

**Промт:**

```
Во frontend (Next.js App Router) две проблемы:
1) app/(shop)/cart/page.tsx — 1411 строк: корзина, шаги оформления,
   адрес, слоты доставки, промокод, оплата — всё в одном клиентском
   компоненте. Разбей его на компоненты в components/cart/ (шаг корзины,
   шаг оформления, блок адреса, блок слотов, блок промокода, блок
   итогов) без изменения поведения — это чистый рефакторинг, состояние
   подними/оставь в page.tsx или вынеси в существующий cart.store.ts
   только если это упрощает код. Сравни поведение до/после вручную по
   шагам оформления.
2) Добавь error.tsx для сегментов app/admin и app/(shop) (в стиле
   существующего app/error.tsx, на русском) и loading.tsx со
   скелетонами для app/(shop)/catalog и app/admin (используй
   существующие components/ui/skeleton.tsx и
   components/products/product-grid-skeleton.tsx).
Ничего не меняй в логике API-вызовов. После рефакторинга pnpm lint и
pnpm typecheck должны быть зелёными.
```

---

## 🟢 Фичи и полировка

### 15. Поиск и фильтры в каталоге

Фича была и её откатили (`6081c39 revert(catalog)`). Стоит вернуть аккуратно.

**Промт:**

```
В каталоге (frontend/app/(shop)/catalog, компоненты в
components/products/, бекенд backend/src/modules/products/) нет поиска и
сортировки — фичу однажды откатили (git show 6081c39 покажет старую
реализацию и, вероятно, причину отката — изучи её перед началом).

Задача: реализуй поиск по названию (серверный, Prisma contains
insensitive, параметр search в products.findAll) и сортировку
(цена ↑/↓, новинки) с состоянием в URL searchParams, чтобы ссылки
шарились. UI — строка поиска с debounce 300мс и селект сортировки над
сеткой товаров, в существующем стиле (Tailwind-токены из
app/globals.css, компоненты из components/ui/). Категорийная навигация
(category-nav.tsx) уже есть — фильтры должны с ней сочетаться. Пустой
результат — дружелюбное состояние на русском. Добавь тест в
products.service.spec.ts на поиск/сортировку.
```

### 16. SSE вместо поллинга для чата и уведомлений

Админка поллит unread-summary каждые 3с, хедер — уведомления каждые 30с. На Fastify проще и надёжнее SSE, чем WebSocket.

**Промт:**

```
Сейчас realtime сделан поллингом: frontend/app/admin/layout.tsx и
admin/page.tsx опрашивают /admin/messages/unread-summary каждые 3с,
хедер (components/layout/header.tsx) — уведомления каждые 30с. Чат
заказа — components/order-chat.tsx. Бекенд — NestJS на Fastify-адаптере.

Задача: добавь SSE-эндпоинт(ы) на бекенде (@Sse в NestJS работает и на
Fastify) с авторизацией через существующий JWT (учти: EventSource не
шлёт заголовки — передавай access-токен query-параметром и валидируй
его тем же кодом, что jwt.guard.ts, либо используй cookie). События:
новое сообщение в чате заказа, новое уведомление пользователя, для
админа — новый заказ и новое сообщение. Источник событий — внутренний
EventEmitter (@nestjs/event-emitter), события эмить из
order-messages.service, notifications.service и orders.service в местах
создания записей. На фронте замени refetchInterval на подписку
EventSource с автопереподключением и fallback на текущий поллинг при
ошибке соединения. Существующий звуковой сигнал нового заказа в админке
должен продолжить работать. Nginx (nginx/nginx.conf) потребует
proxy_buffering off для SSE-локейшена — добавь.
```

### 17. Достроить PWA

`public/sw.js` и пуш-подписки есть, но нет `manifest.webmanifest` — «установить на экран» не работает.

**Промт:**

```
Во frontend PWA собрана наполовину: есть public/sw.js и
components/push-notifications.tsx (web-push через VAPID, бекенд-модуль
backend/src/modules/push), но нет манифеста.

Задача: добавь app/manifest.ts (Next.js metadata route) — name/short_name
«Оджах», описание на русском, theme/background в цветах бренда (тёплая
бежевая палитра — точные токены возьми из app/globals.css @theme),
иконки 192/512 (сгенерируй из существующего app/icon.jpg, положи в
public/), display standalone, start_url /catalog. Проверь, что sw.js
регистрируется и не конфликтует с манифестом, и что Lighthouse-критерии
installable выполняются. Кэширование в sw не добавляй — только то, что
нужно для installability и уже работающих пушей.
```

### 18. Отзывы без подтверждения покупки

Любой залогиненный может оставить отзыв на любой товар.

**Промт:**

```
В backend/src/modules/reviews/reviews.service.ts отзыв может оставить
любой авторизованный пользователь. Заказы хранят items как JSON-снапшот
(Order.items, поле product_id в элементах — проверь точную структуру по
orders.service.ts).

Задача: при создании/обновлении отзыва проверяй, что у пользователя есть
завершённый заказ (status 'completed') содержащий этот productId; иначе
403 с понятным русским сообщением. Добавь эндпоинт или поле в ответ
products/:id, чтобы фронт знал, может ли текущий юзер оставить отзыв
(frontend/components/reviews/review-form.tsx — скрой форму или покажи
подсказку «Отзывы могут оставлять только покупатели»). Пометь отзыв
бейджем «Подтверждённая покупка» в review-list.tsx. Существующие отзывы
не удаляй. Добавь reviews.service.spec.ts.
```

### 19. SEO: главная-редирект и слабая OG-картинка

`/` — просто `redirect('/catalog')`, ранжироваться нечему; OG — логотип 512×512 с `card: summary`.

**Промт:**

```
Во frontend две SEO-задачи:
1) app/page.tsx — это redirect('/catalog'); главной страницы нет.
   Сделай лендинг на /: hero с брендом «Оджах» (армянская домашняя
   кухня, торты на заказ, доставка по Нижнему Новгороду), 4-6 популярных
   товаров (серверный fetch через существующий lib/server-fetch.ts с
   ISR), блок «как заказать», ссылки в каталог. Стиль — существующая
   тёплая палитра из app/globals.css, компоненты из components/ui/,
   анимации из components/motion/. Обнови app/sitemap.ts (приоритет 1.0
   главной) и метаданные в app/layout.tsx при необходимости.
2) Добавь app/opengraph-image.tsx (ImageResponse, 1200×630: логотип,
   название, слоган на русском в фирменных цветах) и переключи Twitter
   card на summary_large_image. Для страниц товара сгенерируй
   opengraph-image через generateImageMetadata или используй фото
   товара — выбери подход попроще, работающий с текущим SSR в
   app/(shop)/catalog/[id]/page.tsx.
```

### 20. Автоматические оффсайт-бэкапы и мониторинг аптайма

Бэкапы лежат на том же VPS (SPOF); мониторинга кроме Sentry нет.

**Промт:**

```
Бэкапы (scripts/backup.sh — pg_dump+uploads, ротация 14 дней, крутится
сервисом backup в docker-compose.yml) остаются на том же VPS — при
потере сервера теряется всё.

Задача:
1) Допиши в scripts/backup.sh отправку свежего бэкапа во внешнее
   S3-совместимое хранилище через rclone (конфиг из env: RCLONE_REMOTE,
   опционально; без него скрипт работает как раньше — не ломай текущее
   поведение). Учти, что скрипт запускается внутри контейнера
   postgres:16-alpine — rclone туда нужно доставить (отдельный
   лёгкий контейнер-сайдкар или apk add в command сервиса backup —
   выбери надёжнее). Ротация в remote — тоже 14 дней.
2) Добавь в scripts/backup.sh ping healthcheck-сервиса (curl
   $HEALTHCHECK_URL после успешного бэкапа, healthchecks.io-совместимо,
   опционально по env) — так пропавшие бэкапы станут заметны.
3) Обнови комментарии в скрипте и docker-compose.yml, задокументируй
   новые переменные.
Скрипты в этом репо написаны очень аккуратно с подробными комментариями
на русском — выдержи тот же стиль.
```

---

## Порядок выполнения (рекомендация)

1. Сначала 🔴 п.1 (цены корзины) и п.2 (порты/helmet) — реальные дыры.
2. Затем п.7 (CI) и п.8 (pnpm в Docker) — чтобы всё дальнейшее шло через проверки.
3. Остальные 🔴/🟠 в любом порядке; 🟢 — по продуктовым приоритетам.

Промты независимы — каждый можно запускать в чистой сессии Opus. Перед каждым вставлять «Общий контекст» из начала документа.

## Верификация

- Backend: `pnpm --filter backend lint && pnpm --filter backend typecheck && pnpm --filter backend test`
- Frontend: `pnpm --filter frontend lint && pnpm --filter frontend typecheck && pnpm --filter frontend build`
- Инфраструктурные пункты (2, 8, 20): `docker compose build` локально + чек-лист после деплоя, который каждый промт просит сформировать.
