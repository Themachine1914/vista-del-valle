import { auth } from "@/auth";
import { formatQty, toMoney } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function CocinaPage() {
  const session = await auth();
  if (session?.user.role === "CAMARERO") redirect("/ventas");
  const [recipes, preps] = await Promise.all([
    prisma.recipe.findMany({
      include: { dish: { include: { category: true } } },
      orderBy: { dish: { nombre: "asc" } },
    }),
    prisma.prepRecipe.findMany({
      include: { outputIngredient: true },
      orderBy: { nombre: "asc" },
    }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-fa-primary">Cocina</h1>
        <p className="mt-1 text-sm text-fa-muted">
          Recetas de plato y preparaciones internas (salsas de lote).
        </p>
      </div>

      <section>
        <h2 className="text-lg font-semibold text-fa-primary">Preparaciones internas</h2>
        <p className="mt-1 text-sm text-fa-muted">
          Al registrar un lote se descuentan los crudos y entra la salsa al inventario.
        </p>
        {preps.length === 0 ? (
          <p className="mt-3 text-sm text-fa-muted">
            Aún no hay preparaciones. La administradora las carga en Admin → Preparaciones.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-fa-border rounded-[10px] border border-fa-border bg-fa-surface">
            {preps.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/cocina/prep/${p.id}`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-fa-bg"
                >
                  <span>
                    <span className="font-medium">{p.nombre}</span>
                    <span className="ml-2 text-xs text-fa-muted">
                      1 lote = {formatQty(p.rendimiento, p.outputIngredient.unidadMedida)}
                    </span>
                  </span>
                  <span className="text-sm text-fa-muted">
                    {formatQty(
                      toMoney(p.outputIngredient.stockActual),
                      p.outputIngredient.unidadMedida,
                    )}{" "}
                    en stock
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold text-fa-primary">Recetas de plato</h2>
        <p className="mt-1 text-sm text-fa-muted">
          Abre un plato para ver pasos y escalar porciones.
        </p>
        <ul className="mt-3 divide-y divide-fa-border rounded-[10px] border border-fa-border bg-fa-surface">
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
      </section>
    </div>
  );
}
