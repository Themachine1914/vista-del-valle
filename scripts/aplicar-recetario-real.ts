/**
 * Aplica al recetario real (validado en Receta/Recetariov3.pdf) sobre la base de datos EN VIVO.
 * NO borra nada existente (usuarios, ventas, movimientos de inventario, productos).
 * Solo:
 *  - crea Ingredient nuevos para las salsas preparadas en lote que aún no existen como producto
 *  - reemplaza las líneas de RecipeIngredient de los platos cubiertos por el recetario validado
 *    (borra solo las líneas de ESE plato, no toca otras recetas)
 *  - crea Recipe donde el plato no tenía ninguna
 *
 * No toca los platos/ingredientes cuya cantidad real sigue pendiente de confirmar
 * (porción de conejo, chimichurri, base de Lambí, unidades de Balitas/Croquetas/Hamburguesa,
 * rendimiento total de la Salsa del Bosque).
 *
 * Uso:
 *   npx tsx scripts/aplicar-recetario-real.ts            (dry-run: solo imprime el plan)
 *   npx tsx scripts/aplicar-recetario-real.ts --apply    (escribe de verdad)
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

const OZ = 28.3495; // gramos por onza
const LB = 453.592; // gramos por libra
const GAL_ML = 3785.41; // ml por galón
const SHRIMP_G = LB / 43.5; // "paquete de 42 a 45 camarones" leído como talla comercial (camarones por libra)

function oz(n: number) {
  return Math.round(n * OZ);
}
function shrimp(count: number) {
  return Math.round(count * SHRIMP_G);
}

// ---------------------------------------------------------------------------
// 1. Ingredientes nuevos (salsas preparadas en lote que hoy no existen como producto)
// ---------------------------------------------------------------------------
type NewIngredient = {
  id: string;
  nombre: string;
  unidad: "G" | "ML" | "UD";
  unidadEtiqueta: string;
  contenidoPorItem: number;
  stockMinimo: number;
};

const NEW_INGREDIENTS: NewIngredient[] = [
  {
    id: "salsa-alfredo-blanca",
    nombre: "Salsa Alfredo Blanca",
    unidad: "ML",
    unidadEtiqueta: "galón",
    contenidoPorItem: GAL_ML,
    stockMinimo: GAL_ML,
  },
  {
    id: "salsa-del-bosque",
    nombre: "Salsa del Bosque",
    unidad: "ML",
    unidadEtiqueta: "",
    contenidoPorItem: 1,
    stockMinimo: 1000,
  },
  {
    id: "salsa-de-tamarindo",
    nombre: "Salsa de Tamarindo",
    unidad: "ML",
    unidadEtiqueta: "galón",
    contenidoPorItem: GAL_ML,
    stockMinimo: GAL_ML,
  },
  {
    id: "salsa-del-rey",
    nombre: "Salsa del Rey",
    unidad: "ML",
    unidadEtiqueta: "",
    contenidoPorItem: 1,
    stockMinimo: 1000,
  },
  {
    id: "salsa-blue-cheese",
    nombre: "Salsa Blue Cheese",
    unidad: "ML",
    unidadEtiqueta: "",
    contenidoPorItem: 1,
    stockMinimo: 1000,
  },
];

// IDs reales ya existentes en la base (evitar duplicar productos que el admin ya agregó)
const ACEITE_CRISOL = "aceite-crisol-mteuon0w";
const SALSA_POMODORO = "salsa-pomodoro-mtet4vt7"; // unidad G
const SALSA_CHINA = "salsa-china-mteuktkk"; // unidad G

// ---------------------------------------------------------------------------
// 2. Actualizaciones de receta por plato (solo lo confirmado / no listado como pendiente en v3)
// ---------------------------------------------------------------------------
type Linea = { ingredientId: string; cantidad: number };
type RecetaUpdate = {
  dishId: string;
  tiempoPreparacion?: number;
  pasos?: string[];
  items: Linea[];
  nota: string; // para el resumen legible, no se guarda en DB
};

const RECETA_UPDATES: RecetaUpdate[] = [
  {
    dishId: "pasta-alfredo-pollo",
    items: [
      { ingredientId: "pasta", cantidad: 120 },
      { ingredientId: "pechuga", cantidad: oz(2) },
      { ingredientId: "parmesano", cantidad: 5 },
      { ingredientId: "salsa-alfredo-blanca", cantidad: oz(5) },
    ],
    nota: "Pollo 1/4 de porción de 8oz (2oz), 1 cda parmesano, 5oz salsa Alfredo (estándar confirmado). Se quita mantequilla/crema/ajo sueltos: ya están dentro de la salsa Alfredo preparada.",
  },
  {
    dishId: "pasta-alfredo-camarones",
    items: [
      { ingredientId: "pasta", cantidad: 120 },
      { ingredientId: "camarones", cantidad: shrimp(5) },
      { ingredientId: "parmesano", cantidad: 5 },
      { ingredientId: "salsa-alfredo-blanca", cantidad: oz(5) },
    ],
    nota: "5 camarones (talla 42-45/lb), 1 cda parmesano (v3 corrigió de cdta a cda), 5oz salsa Alfredo.",
  },
  {
    dishId: "pasta-tomate",
    items: [
      { ingredientId: "pasta", cantidad: 120 },
      { ingredientId: SALSA_POMODORO, cantidad: oz(4) },
      { ingredientId: "parmesano", cantidad: 15 },
    ],
    nota: "Salsa pomodoro 4oz + 3 cda parmesano. Se quita albahaca/aceite sueltos: ya están dentro de la pomodoro preparada.",
  },
  {
    dishId: "pasta-tomate-camarones",
    items: [
      { ingredientId: "pasta", cantidad: 120 },
      { ingredientId: SALSA_POMODORO, cantidad: oz(4) },
      { ingredientId: "camarones", cantidad: shrimp(5) },
    ],
    nota: "El original solo decía \"base de pomodoro con camarones\", sin más detalle — se usa el mismo estándar propuesto (4oz pomodoro + 5 camarones) que la pasta Alfredo con camarones.",
  },
  {
    dishId: "canastitas-pollo",
    items: [
      { ingredientId: "platano-verde", cantidad: 1.5 },
      { ingredientId: "pechuga", cantidad: oz(2) },
      { ingredientId: "cebolla", cantidad: 30 },
      { ingredientId: "aji-morron-mteot9pj", cantidad: 30 },
      { ingredientId: ACEITE_CRISOL, cantidad: oz(1) },
      { ingredientId: "salsa-alfredo-blanca", cantidad: oz(4) },
    ],
    nota: "1.5 plátano, 2oz pollo, vegetales cebolla+ají morrón, 1oz aceite Crisol, 4oz salsa Alfredo (reemplaza la crema de leche que faltaba en el original).",
  },
  {
    dishId: "canastitas-camarones",
    items: [
      { ingredientId: "platano-verde", cantidad: 1.5 },
      { ingredientId: "camarones", cantidad: shrimp(6) },
      { ingredientId: "cebolla", cantidad: 30 },
      { ingredientId: "aji-morron-mteot9pj", cantidad: 30 },
      { ingredientId: ACEITE_CRISOL, cantidad: oz(1) },
      { ingredientId: "salsa-alfredo-blanca", cantidad: oz(4) },
    ],
    nota: "1.5 plátano, 6 camarones, vegetales cebolla+ají morrón, 1oz aceite Crisol, 4oz salsa Alfredo.",
  },
  {
    dishId: "pechuga-crema",
    tiempoPreparacion: 20,
    pasos: ["Grillar pechuga", "Napar con salsa a la crema (base salsa Alfredo blanca)"],
    items: [
      { ingredientId: "pechuga", cantidad: oz(8) },
      { ingredientId: "salsa-alfredo-blanca", cantidad: oz(5) },
    ],
    nota: "No tenía receta cargada. 8oz pechuga + 5oz salsa Alfredo (calculado de \"1 galón rinde 26 pechugas\" ≈ 4.9oz, redondeado al estándar de 5oz).",
  },
  {
    dishId: "conejo",
    pasos: ["Sazonar", "Cocer", "Terminar a la parrilla con salsa de romero (base Alfredo blanca + vino + romero + salsa china)"],
    items: [
      { ingredientId: "conejo", cantidad: 350 },
      { ingredientId: "ajo", cantidad: 10 },
      { ingredientId: "aceite-oliva", cantidad: 20 },
      { ingredientId: "sal", cantidad: 3 },
      { ingredientId: "salsa-alfredo-blanca", cantidad: oz(4) },
      { ingredientId: SALSA_CHINA, cantidad: 5 },
    ],
    nota: "La porción de conejo (350g) NO se toca — sigue pendiente de confirmar según v3. Solo se agrega el componente de salsa de romero ya confirmado (Alfredo blanca 4oz + salsa china).",
  },
  {
    dishId: "filete-res-parrilla",
    items: [
      { ingredientId: "filete-res", cantidad: oz(8) },
      { ingredientId: "sal", cantidad: 3 },
      { ingredientId: "mantequilla", cantidad: 10 },
    ],
    nota: "8oz de filete confirmado (era 250g). La salsa chimichurri sigue pendiente — no se agrega.",
  },
  {
    dishId: "filete-res-queso-azul",
    items: [
      { ingredientId: "filete-res", cantidad: oz(8) },
      { ingredientId: "salsa-blue-cheese", cantidad: oz(4) },
    ],
    nota: "8oz de filete + 4oz de salsa Blue Cheese (blue cheese + queso azul ya mezclados, porción confirmada en v3). Se quita crema-leche/queso-azul sueltos: ya están dentro de la salsa preparada.",
  },
  {
    dishId: "salmon-parrilla",
    items: [
      { ingredientId: "salmon", cantidad: oz(8) },
      { ingredientId: "sal", cantidad: 2 },
      { ingredientId: "mantequilla", cantidad: 10 },
      { ingredientId: "limon", cantidad: 0.25 },
    ],
    nota: "8oz de salmón confirmado (era 220g).",
  },
  {
    dishId: "salmon-bosque",
    items: [
      { ingredientId: "salmon", cantidad: oz(8) },
      { ingredientId: "salsa-del-bosque", cantidad: oz(4) },
    ],
    nota: "8oz salmón + 4oz salsa del Bosque. Se quita champiñones/crema/finas hierbas sueltos: ya están dentro de la salsa del Bosque preparada.",
  },
  {
    dishId: "pechuga-parrilla",
    items: [
      { ingredientId: "pechuga", cantidad: oz(8) },
      { ingredientId: "ajo", cantidad: 5 },
      { ingredientId: "sal", cantidad: 3 },
      { ingredientId: "aceite-oliva", cantidad: 10 },
    ],
    nota: "8oz de pechuga confirmado (era 250g).",
  },
  {
    dishId: "pechuga-salsa-rey",
    items: [
      { ingredientId: "pechuga", cantidad: oz(8) },
      { ingredientId: "salsa-del-rey", cantidad: oz(4) },
    ],
    nota: "8oz pechuga + 4oz salsa del Rey. ATENCIÓN: v3 solo da la proporción del LOTE de la salsa del Rey (4oz de cada componente), no cuánto va por plato — los 4oz por plato aquí son una propuesta mía (por consistencia con las demás salsas), no algo confirmado. Se quita champiñones/cebolla/crema sueltos: eran el placeholder viejo.",
  },
  {
    dishId: "bistec-encebollado",
    items: [
      { ingredientId: "bistec-res", cantidad: oz(8) },
      { ingredientId: "cebolla", cantidad: 100 },
      { ingredientId: "ajo", cantidad: 5 },
      { ingredientId: "salsa-de-tamarindo", cantidad: oz(4) },
      { ingredientId: ACEITE_CRISOL, cantidad: oz(1) },
    ],
    nota: "8oz bistec + 4oz salsa de tamarindo + 1oz aceite Crisol (ninguno de los dos estaba en la receta actual).",
  },
  {
    dishId: "camarones-ajillo",
    items: [
      { ingredientId: "camarones", cantidad: 200 },
      { ingredientId: "ajo", cantidad: 15 },
      { ingredientId: "aceite-oliva", cantidad: 30 },
      { ingredientId: "perejil", cantidad: 5 },
      { ingredientId: "salsa-del-bosque", cantidad: oz(4) },
    ],
    nota: "Se agrega la salsa al ajillo (4oz de salsa del Bosque + ajo + vino, vino no se rastrea en inventario) sin tocar el resto de la receta actual.",
  },
  {
    dishId: "asopao-camarones",
    items: [
      { ingredientId: "arroz", cantidad: 120 },
      { ingredientId: "camarones", cantidad: shrimp(8) },
      { ingredientId: SALSA_POMODORO, cantidad: oz(4) },
      { ingredientId: "salsa-del-bosque", cantidad: oz(4) },
    ],
    nota: "8 camarones, 4oz pomodoro + 4oz salsa del Bosque (no estaban en la receta actual). Se quita la cebolla suelta: no aparece en el recetario real para este plato.",
  },
  {
    dishId: "asopao-mariscos",
    items: [
      { ingredientId: "arroz", cantidad: 120 },
      { ingredientId: "camarones", cantidad: shrimp(4) },
      { ingredientId: "mix-mariscos", cantidad: oz(3) },
      { ingredientId: SALSA_POMODORO, cantidad: oz(4) },
      { ingredientId: "salsa-del-bosque", cantidad: oz(4) },
    ],
    nota: "4 camarones + 3oz de marisco + 4oz pomodoro + 4oz salsa del Bosque.",
  },
  {
    dishId: "arroz-mariscos",
    items: [
      { ingredientId: "arroz", cantidad: oz(4) },
      { ingredientId: "camarones", cantidad: shrimp(4) },
      { ingredientId: "mix-mariscos", cantidad: oz(3) },
      { ingredientId: "aji-morron-mteot9pj", cantidad: 30 },
      { ingredientId: "cebolla", cantidad: 30 },
      { ingredientId: ACEITE_CRISOL, cantidad: oz(1) },
      { ingredientId: "salsa-del-bosque", cantidad: oz(4) },
    ],
    nota: "1/4 lb arroz, 4 camarones, recorte de marisco (3oz), morrón y cebolla, 1oz aceite Crisol, 4oz salsa del Bosque.",
  },
  {
    dishId: "papas-fritas",
    items: [{ ingredientId: "papa", cantidad: Math.round(0.65 * LB) }],
    nota: "0.65 lb por servicio confirmado en v3 (era 150g → ahora 295g).",
  },
  {
    dishId: "papas-salteadas",
    items: [{ ingredientId: "papa", cantidad: oz(8) }],
    nota: "2 papas de tamaño normal ≈ 8oz total (propuesto, no rechazado en v3).",
  },
  {
    dishId: "hamburguesa-especial",
    items: [
      { ingredientId: "carne-molida", cantidad: 180 },
      { ingredientId: "gouda", cantidad: 30 },
      { ingredientId: "lechuga", cantidad: 20 },
      { ingredientId: "cebolla", cantidad: 20 },
      { ingredientId: "pepinillos", cantidad: 15 },
      { ingredientId: "papa", cantidad: Math.round(0.65 * LB) },
    ],
    nota: "Solo se corrige la porción de papas fritas del lado (0.65 lb, igual que Papas Fritas). La receta de la carne de la hamburguesa (6 lb / 19 unidades) sigue con unidades sin definir (miga de pan) — no se toca.",
  },
  {
    dishId: "hamburguesa-pollo",
    items: [
      { ingredientId: "pechuga", cantidad: 180 },
      { ingredientId: "gouda", cantidad: 30 },
      { ingredientId: "lechuga", cantidad: 20 },
      { ingredientId: "cebolla", cantidad: 20 },
      { ingredientId: "pepinillos", cantidad: 15 },
      { ingredientId: "papa", cantidad: Math.round(0.65 * LB) },
    ],
    nota: "Igual: solo se corrige la porción de papas fritas del lado a 0.65 lb.",
  },
];

async function main() {
  console.log(APPLY ? "MODO: aplicar cambios de verdad\n" : "MODO: dry-run (no se escribe nada)\n");

  const existingIngredients = await prisma.ingredient.findMany({
    select: { id: true, nombre: true },
  });
  const existingIds = new Set(existingIngredients.map((i) => i.id));
  const existingNames = new Set(existingIngredients.map((i) => i.nombre.toLowerCase()));

  console.log("=== Ingredientes nuevos a crear ===");
  const toCreate = NEW_INGREDIENTS.filter(
    (n) => !existingIds.has(n.id) && !existingNames.has(n.nombre.toLowerCase()),
  );
  for (const n of NEW_INGREDIENTS) {
    const skip = existingIds.has(n.id) || existingNames.has(n.nombre.toLowerCase());
    console.log(`  ${skip ? "[YA EXISTE, se omite]" : "[CREAR]"} ${n.nombre} (${n.unidad})`);
  }
  if (APPLY && toCreate.length) {
    await prisma.ingredient.createMany({
      data: toCreate.map((n) => ({
        id: n.id,
        nombre: n.nombre,
        unidadMedida: n.unidad,
        unidadEtiqueta: n.unidadEtiqueta,
        contenidoPorItem: n.contenidoPorItem,
        stockActual: 0,
        stockMinimo: n.stockMinimo,
      })),
    });
  }

  // referencia de ingredientes disponibles tras la posible creación
  const allIngredientIds = new Set([...existingIds, ...toCreate.map((n) => n.id)]);

  const dishes = await prisma.dish.findMany({
    where: { id: { in: RECETA_UPDATES.map((r) => r.dishId) } },
    include: { recipe: true },
  });
  const dishById = new Map(dishes.map((d) => [d.id, d]));

  console.log("\n=== Recetas a actualizar ===");
  for (const upd of RECETA_UPDATES) {
    const dish = dishById.get(upd.dishId);
    if (!dish) {
      console.log(`  [PLATO NO EXISTE, se omite] ${upd.dishId}`);
      continue;
    }
    const missing = upd.items.filter((it) => !allIngredientIds.has(it.ingredientId));
    if (missing.length) {
      console.log(`  [INGREDIENTE FALTANTE, se omite] ${upd.dishId}: ${missing.map((m) => m.ingredientId).join(", ")}`);
      continue;
    }
    const accion = dish.recipe ? "actualizar" : "crear";
    console.log(`\n  ${dish.nombre} (${upd.dishId}) — ${accion} receta`);
    console.log(`    ${upd.nota}`);
    for (const it of upd.items) {
      console.log(`    - ${it.ingredientId}: ${it.cantidad}`);
    }

    if (APPLY) {
      let recipeId = dish.recipe?.id;
      if (!recipeId) {
        const created = await prisma.recipe.create({
          data: {
            dishId: dish.id,
            porcionesQueRinde: 1,
            tiempoPreparacion: upd.tiempoPreparacion,
            pasos: upd.pasos ?? [],
          },
        });
        recipeId = created.id;
      } else if (upd.pasos || upd.tiempoPreparacion) {
        await prisma.recipe.update({
          where: { id: recipeId },
          data: {
            ...(upd.pasos ? { pasos: upd.pasos } : {}),
            ...(upd.tiempoPreparacion ? { tiempoPreparacion: upd.tiempoPreparacion } : {}),
          },
        });
      }
      await prisma.recipeIngredient.deleteMany({ where: { recipeId } });
      await prisma.recipeIngredient.createMany({
        data: upd.items.map((it) => ({
          recipeId: recipeId!,
          ingredientId: it.ingredientId,
          cantidad: it.cantidad,
        })),
      });
    }
  }

  console.log(`\n${APPLY ? "Listo. Cambios aplicados." : "Fin del dry-run. Ejecuta con --apply para escribir de verdad."}`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
