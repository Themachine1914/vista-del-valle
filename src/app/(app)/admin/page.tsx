import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { toMoney, todayISO } from "@/lib/money";
import { homeForRole, isAdmin } from "@/lib/roles";
import { redirect } from "next/navigation";
import { AdminPanel } from "@/components/app/AdminPanel";

export const dynamic = "force-dynamic";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ ventasFecha?: string; tab?: string }>;
}) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.role)) {
    redirect(session?.user ? homeForRole(session.user.role) : "/login");
  }

  const sp = await searchParams;
  const fechaFiltro =
    sp.ventasFecha && /^\d{4}-\d{2}-\d{2}$/.test(sp.ventasFecha)
      ? sp.ventasFecha
      : todayISO();
  const [y, m, d] = fechaFiltro.split("-").map(Number);
  const day = new Date(Date.UTC(y, m - 1, d));
  const nextDay = new Date(Date.UTC(y, m - 1, d + 1));

  const [categories, dishes, ingredients, recipes, prepRecipes, saleItems] = await Promise.all([
    prisma.category.findMany({ orderBy: { orden: "asc" } }),
    prisma.dish.findMany({
      include: { category: true },
      orderBy: [{ category: { orden: "asc" } }, { nombre: "asc" }],
    }),
    prisma.ingredient.findMany({ orderBy: { nombre: "asc" } }),
    prisma.recipe.findMany({
      include: { dish: true, ingredients: true },
    }),
    prisma.prepRecipe.findMany({
      include: { ingredients: true },
      orderBy: { nombre: "asc" },
    }),
    prisma.saleItem.findMany({
      where: { sale: { fecha: { gte: day, lt: nextDay } } },
      include: {
        dish: { select: { nombre: true } },
        garnish: { select: { nombre: true } },
        sale: { select: { fecha: true, turno: true } },
        user: { select: { name: true } },
      },
      orderBy: [{ createdAt: "desc" }],
    }),
  ]);

  return (
    <AdminPanel
      categories={categories.map((c) => ({
        id: c.id,
        nombre: c.nombre,
        tipo: c.tipo,
        esInterna: c.esInterna,
        orden: c.orden,
      }))}
      dishes={dishes.map((d) => ({
        id: d.id,
        nombre: d.nombre,
        descripcion: d.descripcion,
        precio: d.precio === null ? null : toMoney(d.precio),
        foto: d.foto,
        categoryId: d.categoryId,
        categoryNombre: d.category.nombre,
        disponible: d.disponible,
        destacado: d.destacado,
        incluyeGuarnicion: d.incluyeGuarnicion,
      }))}
      ingredients={ingredients.map((i) => ({
        id: i.id,
        nombre: i.nombre,
        unidadMedida: i.unidadMedida,
        stockActual: toMoney(i.stockActual),
        stockMinimo: toMoney(i.stockMinimo),
      }))}
      recipes={recipes.map((r) => ({
        dishId: r.dishId,
        dishNombre: r.dish.nombre,
        tiempoPreparacion: r.tiempoPreparacion,
        pasos: Array.isArray(r.pasos) ? (r.pasos as string[]) : [],
        items: r.ingredients.map((x) => ({
          ingredientId: x.ingredientId,
          cantidad: toMoney(x.cantidad),
        })),
      }))}
      prepRecipes={prepRecipes.map((r) => ({
        id: r.id,
        nombre: r.nombre,
        outputIngredientId: r.outputIngredientId,
        rendimiento: toMoney(r.rendimiento),
        tiempoPreparacion: r.tiempoPreparacion,
        pasos: Array.isArray(r.pasos) ? (r.pasos as string[]) : [],
        items: r.ingredients.map((x) => ({
          ingredientId: x.ingredientId,
          cantidad: toMoney(x.cantidad),
        })),
      }))}
      initialTab={sp.tab === "ventas" ? "ventas" : "platos"}
      ventasFecha={fechaFiltro}
      ventas={saleItems.map((it) => ({
        id: it.id,
        fecha: it.sale.fecha.toISOString().slice(0, 10),
        turno: it.sale.turno,
        nombre: it.dish.nombre,
        garnish: it.garnish?.nombre ?? null,
        cantidad: it.cantidad,
        total: it.cantidad * toMoney(it.precioUnitario),
        camarero: it.user?.name ?? null,
      }))}
    />
  );
}
