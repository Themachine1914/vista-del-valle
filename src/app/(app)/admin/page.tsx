import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { toMoney } from "@/lib/money";
import { homeForRole, isAdmin } from "@/lib/roles";
import { redirect } from "next/navigation";
import { AdminPanel } from "@/components/app/AdminPanel";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.role)) {
    redirect(session?.user ? homeForRole(session.user.role) : "/login");
  }

  const [categories, dishes, ingredients, recipes] = await Promise.all([
    prisma.category.findMany({ orderBy: { orden: "asc" } }),
    prisma.dish.findMany({
      include: { category: true },
      orderBy: [{ category: { orden: "asc" } }, { nombre: "asc" }],
    }),
    prisma.ingredient.findMany({ orderBy: { nombre: "asc" } }),
    prisma.recipe.findMany({
      include: { dish: true, ingredients: true },
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
    />
  );
}
