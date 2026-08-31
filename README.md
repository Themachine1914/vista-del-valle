# Vista del Valle

App web del restaurante **Vista del Valle** (Casabito, República Dominicana): carta pública, registro de ventas por día, inventario con descuento automático según receta, recetas de cocina y dashboard.

## Arranque local

El proyecto de Supabase ya está creado: [Vista del Valle](https://tdoeqgyxjdpxmghuirox.supabase.co) (`us-west-2`).

1. Copia `.env.example` a `.env` y sustituye `[YOUR-PASSWORD]` por la contraseña de **Project Settings → Database**.
2. Pega `NEXT_PUBLIC_SUPABASE_ANON_KEY` (publishable) y `SUPABASE_SERVICE_ROLE_KEY` desde **Settings → API Keys**.
3. Genera `AUTH_SECRET` con `openssl rand -base64 32`.
4. Instala, empuja el esquema y carga el seed:

```bash
npm install
npm run db:setup
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

| Usuario | Email | Contraseña | Rol |
|---|---|---|---|
| Administradora | `admin@vistadelvalle.local` | `ValleAdmin2026` | Ve dashboard, inventario y todo al instante |
| Camarero | `camarero@vistadelvalle.local` | `ValleCamarero2026` | Solo marca ventas |
| Cocina | `cocina@vistadelvalle.local` | `ValleCocina2026` | Recetas e inventario |

## Qué hay dentro

- `/` — Carta pública (solo platos con precio, sin categorías internas)
- `/ventas` — Registrar ventas por fecha y turno; descuenta inventario
- `/inventario` — Stock, alertas en rojo, entrada/ajuste
- `/dashboard` — Top 10, ventas por categoría y por día
- `/cocina` — Recetas con escalador de porciones
- `/admin` — CRUD de platos (con foto), ingredientes, categorías y recetas

## Datos

El seed carga el menú del PDF, ingredientes, recetas estimadas (el chef debe calibrarlas) y las unidades vendidas de junio–julio 2026 repartidas en 61 días.

Pendiente con el restaurante: precios de bebidas y guarniciones, recetas de cócteles, conteo físico de stock.

## Fotos

Instagram (`@vistadelvallecasabito`) exige login para bajar el perfil. La carta usa ilustraciones de categoría; en **Admin → Platos** se sube la foto real de cada plato a **Supabase Storage**. Si más adelante exportas el perfil de Instagram, copia los JPG a `public/images/platos/{id-del-plato}.jpg` y vuelve a correr el seed.

## Base de datos (Supabase)

Postgres alojado en **Supabase**. Prisma sigue siendo el ORM: el esquema vive en `prisma/schema.prisma`.

| Variable | Uso |
|---|---|
| `DATABASE_URL` | Pooler transaccional (6543) para la app en Vercel |
| `DIRECT_URL` | Conexión de sesión / directa (5432) para `prisma db push` |
| `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` | Storage: fotos de platos en el bucket público `platos` |

Tras crear el proyecto, en Vercel configura las mismas variables. Luego:

```bash
npx prisma db push
npx tsx prisma/seed.ts
npm run db:storage
```

`db:storage` crea el bucket `platos` (también puedes pegar `supabase/storage.sql` en el SQL Editor). Las fotos nuevas se suben ahí; en local, si faltan las claves, se guardan en `public/uploads`.

Postgres local con Docker sigue disponible (`npm run db:up`) si no quieres un proyecto de Supabase para desarrollar.

## Stack

Next.js 15 · TypeScript · Tailwind · Prisma · Supabase (Postgres + Storage) · Auth.js · Recharts
