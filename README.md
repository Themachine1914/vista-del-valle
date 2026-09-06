# Vista del Valle

App web del restaurante **Vista del Valle** (Casabito, República Dominicana): carta pública, registro de ventas por día, inventario con descuento automático según receta, recetas de cocina y dashboard.

## Arranque local

```bash
npm install
npx prisma db push
npx tsx prisma/seed.ts
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
- `/cocina` — Recetas de plato (escalador de porciones) y preparaciones internas (registrar lote de salsa)
- `/admin` — CRUD de platos (con foto), ingredientes, categorías, recetas y preparaciones

## Datos

El seed carga el menú del PDF, ingredientes, recetas estimadas (el chef debe calibrarlas) y las unidades vendidas de junio–julio 2026 repartidas en 61 días.

Pendiente con el restaurante: precios de bebidas y guarniciones, recetas de cócteles, conteo físico de stock.

## Fotos

Instagram (`@vistadelvallecasabito`) exige login para bajar el perfil. La carta usa ilustraciones de categoría; en **Admin → Platos** se sube la foto real de cada plato. Si más adelante exportas el perfil de Instagram, copia los JPG a `public/images/platos/{id-del-plato}.jpg` y vuelve a correr el seed.

## Base de datos

Por defecto usa **SQLite** (`prisma/dev.db`) para poder trabajar sin Docker. El `docker-compose.yml` deja PostgreSQL listo: cambia `DATABASE_URL` y el `provider` en `prisma/schema.prisma` a `postgresql` cuando lo tengas.

## Stack

Next.js 15 · TypeScript · Tailwind · Prisma · Auth.js · Recharts
