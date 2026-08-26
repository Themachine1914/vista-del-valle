import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function CocinaPage() {
  const session = await auth();
  if (session?.user.role === "CAMARERO") redirect("/ventas");
  const recipes = await prisma.recipe.findMany({
    include: { dish: { include: { category: true } } },
    orderBy: { dish: { nombre: "asc" } },
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold text-fa-primary">Recetas</h1>
      <p className="mt-1 text-sm text-fa-muted">
        Vista de cocina. Abre un plato para ver pasos y escalar porciones.
      </p>
      <ul className="mt-6 divide-y divide-fa-border rounded-[10px] border border-fa-border bg-fa-surface">
        {recipes.map((r) => (
          <li key={r.id}>
            <Link
              href={`/cocina/${r.dishId}`}
              className="flex items-center justify-between px-4 py-3 hover:bg-fa-bg"
            >
              <span>
                <span className="font-medium">{r.dish.nombre}</span>
                <span className="ml-2 text-xs text-fa-muted">
                  {r.dish.category.nombre}
                </span>
              </span>
              <span className="text-sm text-fa-muted">
                {r.tiempoPreparacion ? `${r.tiempoPreparacion} min` : "—"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
