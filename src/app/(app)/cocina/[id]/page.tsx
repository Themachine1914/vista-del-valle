import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { RecipeScaler } from "@/components/app/RecipeScaler";
import { toMoney } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function RecetaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (session?.user.role === "CAMARERO") redirect("/ventas");
  const { id } = await params;
  const recipe = await prisma.recipe.findUnique({
    where: { dishId: id },
    include: {
      dish: true,
      ingredients: { include: { ingredient: true } },
    },
  });
  if (!recipe) notFound();
  const pasos = Array.isArray(recipe.pasos)
    ? (recipe.pasos as string[])
    : [];

  return (
    <RecipeScaler
      nombre={recipe.dish.nombre}
      minutos={recipe.tiempoPreparacion}
      basePorciones={recipe.porcionesQueRinde}
      pasos={pasos}
      items={recipe.ingredients.map((i) => ({
        nombre: i.ingredient.nombre,
        unidad: i.ingredient.unidadMedida,
        cantidad: toMoney(i.cantidad),
      }))}
    />
  );
}
