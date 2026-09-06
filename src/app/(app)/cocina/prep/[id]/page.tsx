import { auth } from "@/auth";
import { PrepBatchClient } from "@/components/app/PrepBatchClient";
import { formatFechaCorta, toMoney } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function PrepRecetaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (session?.user.role === "CAMARERO") redirect("/ventas");
  const { id } = await params;
  const recipe = await prisma.prepRecipe.findUnique({
    where: { id },
    include: {
      outputIngredient: true,
      ingredients: { include: { ingredient: true } },
      batches: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { user: { select: { name: true } } },
      },
    },
  });
  if (!recipe) notFound();
  const pasos = Array.isArray(recipe.pasos) ? (recipe.pasos as string[]) : [];

  return (
    <PrepBatchClient
      recipeId={recipe.id}
      nombre={recipe.nombre}
      minutos={recipe.tiempoPreparacion}
      rendimiento={toMoney(recipe.rendimiento)}
      unidadSalida={recipe.outputIngredient.unidadMedida}
      etiquetaSalida={recipe.outputIngredient.unidadEtiqueta}
      output={{
        ingredientId: recipe.outputIngredient.id,
        nombre: recipe.outputIngredient.nombre,
        unidad: recipe.outputIngredient.unidadMedida,
        unidadEtiqueta: recipe.outputIngredient.unidadEtiqueta,
        stockActual: toMoney(recipe.outputIngredient.stockActual),
        stockMinimo: toMoney(recipe.outputIngredient.stockMinimo),
      }}
      pasos={pasos}
      items={recipe.ingredients.map((i) => ({
        ingredientId: i.ingredientId,
        nombre: i.ingredient.nombre,
        unidad: i.ingredient.unidadMedida,
        unidadEtiqueta: i.ingredient.unidadEtiqueta,
        cantidad: toMoney(i.cantidad),
        stockActual: toMoney(i.ingredient.stockActual),
        stockMinimo: toMoney(i.ingredient.stockMinimo),
      }))}
      lotesRecientes={recipe.batches.map((b) => ({
        id: b.id,
        lotes: toMoney(b.lotes),
        fecha: formatFechaCorta(b.createdAt),
        usuario: b.user?.name ?? null,
        anulado: b.anulado,
      }))}
    />
  );
}
