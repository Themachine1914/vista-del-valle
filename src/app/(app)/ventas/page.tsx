import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { toMoney } from "@/lib/money";
import { parsePeriodo, type PeriodoFiltro } from "@/lib/period";
import { canRegisterSales, homeForRole } from "@/lib/roles";
import { redirect } from "next/navigation";
import {
  VentasClient,
  type DishOption,
  type DishRecipeInfo,
  type SaleLine,
  type VentasDesglose,
} from "@/components/app/VentasClient";

export const dynamic = "force-dynamic";

export default async function VentasPage({
  searchParams,
}: {
  searchParams: Promise<{
    fecha?: string;
    turno?: string;
    periodo?: string;
    mes?: string;
    anio?: string;
    desde?: string;
    hasta?: string;
  }>;
}) {
  const session = await auth();
  if (!session?.user || !canRegisterSales(session.user.role)) {
    redirect(session?.user ? homeForRole(session.user.role) : "/login");
  }

  const sp = await searchParams;
  const periodo = parsePeriodo(sp);
  const fecha = periodo.fecha;
  const turno =
    sp.turno === "DESAYUNO" || sp.turno === "CENA" || sp.turno === "ALMUERZO"
      ? sp.turno
      : "ALMUERZO";

  const [y, m, d] = fecha.split("-").map(Number);
  const day = new Date(Date.UTC(y, m - 1, d));

  const [dishes, sale, users, recipes, salesPeriodo] = await Promise.all([
    prisma.dish.findMany({
      where: { disponible: true },
      include: { category: true },
      orderBy: [{ category: { orden: "asc" } }, { nombre: "asc" }],
    }),
    prisma.sale.findUnique({
      where: { fecha_turno: { fecha: day, turno } },
      include: {
        items: {
          include: { dish: true, garnish: true },
          orderBy: { id: "desc" },
        },
      },
    }),
    prisma.user.findMany({ select: { id: true, name: true } }),
    prisma.recipe.findMany({
      include: { ingredients: { include: { ingredient: true } } },
    }),
    prisma.sale.findMany({
      where: { fecha: { gte: periodo.gte, lt: periodo.lt } },
      include: { items: true },
      orderBy: { fecha: "asc" },
    }),
  ]);

  const recipesByDish: Record<string, DishRecipeInfo> = {};
  for (const r of recipes) {
    recipesByDish[r.dishId] = {
      porcionesQueRinde: r.porcionesQueRinde,
      ingredients: r.ingredients.map((line) => ({
        ingredientId: line.ingredientId,
        nombre: line.ingredient.nombre,
        unidadMedida: line.ingredient.unidadMedida,
        unidadEtiqueta: line.ingredient.unidadEtiqueta,
        cantidadPorReceta: toMoney(line.cantidad),
        stockActual: toMoney(line.ingredient.stockActual),
        stockMinimo: toMoney(line.ingredient.stockMinimo),
      })),
    };
  }

  const options: DishOption[] = dishes.map((d) => ({
    id: d.id,
    nombre: d.nombre,
    precio: d.precio === null ? null : toMoney(d.precio),
    categoryId: d.categoryId,
    categoryNombre: d.category.nombre,
    esInterna: d.category.esInterna,
    incluyeGuarnicion: d.incluyeGuarnicion,
  }));

  const garnishes = options.filter((d) => d.categoryId === "guarniciones");

  const userMap = new Map(users.map((u) => [u.id, u.name]));
  const lines: SaleLine[] =
    sale?.items.map((it) => ({
      id: it.id,
      nombre: it.dish.nombre,
      cantidad: it.cantidad,
      precioUnitario: toMoney(it.precioUnitario),
      garnish: it.garnish?.nombre ?? null,
      camarero: it.userId ? (userMap.get(it.userId) ?? null) : null,
    })) ?? [];

  let totalPeriodo = 0;
  let unidadesPeriodo = 0;
  const buckets = new Map<string, { total: number; unidades: number }>();

  for (const s of salesPeriodo) {
    const iso = s.fecha.toISOString().slice(0, 10);
    const clave =
      periodo.modo === "dia"
        ? s.turno
        : periodo.modo === "anio"
          ? iso.slice(0, 7)
          : iso;
    for (const it of s.items) {
      const lineTotal = it.cantidad * toMoney(it.precioUnitario);
      totalPeriodo += lineTotal;
      unidadesPeriodo += it.cantidad;
      const b = buckets.get(clave) ?? { total: 0, unidades: 0 };
      b.total += lineTotal;
      b.unidades += it.cantidad;
      buckets.set(clave, b);
    }
  }

  const TURNO_ORDEN = ["DESAYUNO", "ALMUERZO", "CENA"];
  const desglose: VentasDesglose[] = [...buckets.entries()]
    .map(([clave, v]) => ({ clave, ...v }))
    .sort((a, b) => {
      if (periodo.modo === "dia") {
        return TURNO_ORDEN.indexOf(a.clave) - TURNO_ORDEN.indexOf(b.clave);
      }
      return a.clave.localeCompare(b.clave);
    });

  const filtro: PeriodoFiltro = {
    modo: periodo.modo,
    fecha: periodo.fecha,
    mes: periodo.mes,
    anio: periodo.anio,
    desde: periodo.desde,
    hasta: periodo.hasta,
    label: periodo.label,
  };

  return (
    <VentasClient
      fecha={fecha}
      turno={turno}
      periodo={filtro}
      dishes={options}
      garnishes={garnishes}
      lines={lines}
      totalPeriodo={totalPeriodo}
      unidadesPeriodo={unidadesPeriodo}
      desglose={desglose}
      recipesByDish={recipesByDish}
    />
  );
}
