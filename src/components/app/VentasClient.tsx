"use client";

import { registrarVentaAction } from "@/app/actions/ventas";
import { PeriodFilter } from "@/components/app/PeriodFilter";
import { PdfDownload } from "@/components/app/PdfDownload";
import { LiveRefresh } from "@/components/app/LiveRefresh";
import { formatRD, formatStockCompra } from "@/lib/money";
import { periodoQuery, type PeriodoFiltro } from "@/lib/period";
import { etiquetaDesglose } from "@/lib/ventas-desglose";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

export type DishOption = {
  id: string;
  nombre: string;
  precio: number | null;
  categoryId: string;
  categoryNombre: string;
  esInterna: boolean;
  incluyeGuarnicion: boolean;
};

export type SaleLine = {
  id: string;
  nombre: string;
  cantidad: number;
  precioUnitario: number;
  garnish: string | null;
  camarero: string | null;
};

type TicketItem = {
  dishId: string;
  cantidad: number;
  garnishId: string | null;
  precioUnitario: number | null;
};

export type VentasDesglose = {
  clave: string;
  total: number;
  unidades: number;
};

export type DishRecipeInfo = {
  porcionesQueRinde: number;
  ingredients: {
    ingredientId: string;
    nombre: string;
    unidadMedida: "G" | "ML" | "UD";
    unidadEtiqueta: string;
    cantidadPorReceta: number;
    stockActual: number;
    stockMinimo: number;
  }[];
};

type IngredientImpact = {
  ingredientId: string;
  nombre: string;
  unidadMedida: "G" | "ML" | "UD";
  unidadEtiqueta: string;
  stockActual: number;
  stockMinimo: number;
  usado: number;
  proyectado: number;
};

// Same rule as computeDeductionQty in src/lib/inventory.ts (kept as plain
// numbers here since this only drives a client-side preview, not the write).
function proyectarUso(cantidadPorReceta: number, porcionesQueRinde: number, unidadesVendidas: number) {
  if (porcionesQueRinde <= 0) return 0;
  return cantidadPorReceta * (unidadesVendidas / porcionesQueRinde);
}

function computeInventoryImpact(
  ticket: TicketItem[],
  recipesByDish: Record<string, DishRecipeInfo>,
): IngredientImpact[] {
  const usado = new Map<string, IngredientImpact>();

  function apply(dishId: string, cantidad: number) {
    const recipe = recipesByDish[dishId];
    if (!recipe) return;
    for (const ing of recipe.ingredients) {
      const qty = proyectarUso(ing.cantidadPorReceta, recipe.porcionesQueRinde, cantidad);
      const existing = usado.get(ing.ingredientId);
      if (existing) {
        existing.usado += qty;
        existing.proyectado -= qty;
      } else {
        usado.set(ing.ingredientId, {
          ingredientId: ing.ingredientId,
          nombre: ing.nombre,
          unidadMedida: ing.unidadMedida,
          unidadEtiqueta: ing.unidadEtiqueta,
          stockActual: ing.stockActual,
          stockMinimo: ing.stockMinimo,
          usado: qty,
          proyectado: ing.stockActual - qty,
        });
      }
    }
  }

  for (const t of ticket) {
    apply(t.dishId, t.cantidad);
    if (t.garnishId) apply(t.garnishId, t.cantidad);
  }

  return [...usado.values()].sort((a, b) => {
    const severity = (x: IngredientImpact) =>
      x.proyectado < 0 ? 0 : x.proyectado < x.stockMinimo ? 1 : 2;
    return severity(a) - severity(b) || a.nombre.localeCompare(b.nombre);
  });
}

export function VentasClient({
  fecha,
  turno,
  periodo,
  dishes,
  garnishes,
  lines,
  totalPeriodo,
  unidadesPeriodo,
  desglose,
  recipesByDish,
}: {
  fecha: string;
  turno: "DESAYUNO" | "ALMUERZO" | "CENA";
  periodo: PeriodoFiltro;
  dishes: DishOption[];
  garnishes: DishOption[];
  lines: SaleLine[];
  totalPeriodo: number;
  unidadesPeriodo: number;
  desglose: VentasDesglose[];
  recipesByDish: Record<string, DishRecipeInfo>;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("todas");
  const [ticket, setTicket] = useState<TicketItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const cats = useMemo(
    () => [...new Set(dishes.map((d) => d.categoryNombre))],
    [dishes],
  );
  const filtered = dishes.filter((d) => {
    const matchQ = d.nombre.toLowerCase().includes(q.toLowerCase());
    const matchC = cat === "todas" || d.categoryNombre === cat;
    return matchQ && matchC;
  });

  function add(dish: DishOption) {
    setTicket((prev) => {
      const existing = prev.find((p) => p.dishId === dish.id && !dish.incluyeGuarnicion);
      if (existing) {
        return prev.map((p) =>
          p === existing ? { ...p, cantidad: p.cantidad + 1 } : p,
        );
      }
      return [
        ...prev,
        {
          dishId: dish.id,
          cantidad: 1,
          garnishId: dish.incluyeGuarnicion ? garnishes[0]?.id ?? null : null,
          precioUnitario: dish.precio,
        },
      ];
    });
  }

  const ticketTotal = ticket.reduce((acc, t) => {
    const dish = dishes.find((d) => d.id === t.dishId);
    const price = t.precioUnitario ?? dish?.precio ?? 0;
    return acc + price * t.cantidad;
  }, 0);

  const inventoryImpact = useMemo(
    () => computeInventoryImpact(ticket, recipesByDish),
    [ticket, recipesByDish],
  );
  const criticos = inventoryImpact.filter((i) => i.proyectado < i.stockMinimo).length;

  async function submit() {
    setPending(true);
    setError(null);
    const res = await registrarVentaAction({ fecha, turno, items: ticket });
    setPending(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setTicket([]);
    router.refresh();
  }

  function go(nextFecha: string, nextTurno: string) {
    router.push(
      `/ventas?${periodoQuery({ ...periodo, fecha: nextFecha }, { turno: nextTurno })}`,
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <section>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-semibold text-fa-primary">Ventas</h1>
          <LiveRefresh />
        </div>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <PeriodFilter
            basePath="/ventas"
            periodo={periodo}
            extra={{ turno }}
          />
          <PdfDownload
            label="Imprimir ventas PDF"
            apiPath="/api/ventas/registro"
            periodo={periodo}
          />
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-[10px] border border-fa-border bg-fa-surface p-3">
            <p className="text-xs text-fa-muted">Total · {periodo.label}</p>
            <p className="text-xl font-semibold text-fa-primary">{formatRD(totalPeriodo)}</p>
          </div>
          <div className="rounded-[10px] border border-fa-border bg-fa-surface p-3">
            <p className="text-xs text-fa-muted">Platos y bebidas</p>
            <p className="text-xl font-semibold text-fa-primary">{unidadesPeriodo}</p>
          </div>
        </div>
        {desglose.length > 0 ? (
          <div className="mt-3 overflow-x-auto rounded-[10px] border border-fa-border bg-fa-surface">
            <table className="w-full text-left text-sm">
              <thead className="bg-fa-bg text-fa-muted">
                <tr>
                  <th className="px-3 py-2">
                    {periodo.modo === "dia"
                      ? "Turno"
                      : periodo.modo === "anio"
                        ? "Mes"
                        : "Día"}
                  </th>
                  <th className="px-3 py-2">Unidades</th>
                  <th className="px-3 py-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {desglose.map((row) => (
                  <tr key={row.clave} className="border-t border-fa-border">
                    <td className="px-3 py-2">{etiquetaDesglose(row.clave, periodo.modo)}</td>
                    <td className="px-3 py-2">{row.unidades}</td>
                    <td className="px-3 py-2 font-medium">{formatRD(row.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 text-sm text-fa-muted">No hay ventas en {periodo.label}.</p>
        )}

        <h2 className="mt-6 text-sm font-semibold text-fa-primary">Registrar en un día</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {periodo.modo !== "dia" ? (
            <input
              type="date"
              value={fecha}
              onChange={(e) => go(e.target.value, turno)}
              className="rounded-[10px] border border-fa-border px-3 py-2 text-sm"
            />
          ) : null}
          {(["DESAYUNO", "ALMUERZO", "CENA"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => go(fecha, t)}
              className={`rounded-[10px] px-3 py-2 text-sm ${
                turno === t ? "bg-fa-primary text-white" : "border border-fa-border"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar plato o bebida"
            className="min-w-48 flex-1 rounded-[10px] border border-fa-border px-3 py-2 text-sm"
          />
          <select
            value={cat}
            onChange={(e) => setCat(e.target.value)}
            className="rounded-[10px] border border-fa-border px-3 py-2 text-sm"
          >
            <option value="todas">Todas las categorías</option>
            {cats.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>

        <ul className="mt-4 max-h-[28rem] overflow-auto rounded-[10px] border border-fa-border bg-fa-surface">
          {filtered.slice(0, 80).map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3 border-b border-fa-border px-3 py-2 last:border-0">
              <div>
                <p className="text-sm font-medium">{d.nombre}</p>
                <p className="text-xs text-fa-muted">
                  {d.categoryNombre}
                  {d.esInterna ? " · interno" : ""}
                  {d.incluyeGuarnicion ? " · incluye guarnición" : ""}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm">
                  {d.precio === null ? "s/precio" : formatRD(d.precio)}
                </span>
                <button
                  type="button"
                  onClick={() => add(d)}
                  className="rounded-[10px] bg-fa-accent px-3 py-1 text-sm font-medium text-white"
                >
                  Agregar
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <aside className="rounded-[10px] border border-fa-border bg-fa-surface p-4">
        <h2 className="font-medium text-fa-primary">Ticket · {turno}</h2>
        {ticket.length === 0 ? (
          <p className="mt-3 text-sm text-fa-muted">Agrega artículos para este turno.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {ticket.map((t, idx) => {
              const dish = dishes.find((d) => d.id === t.dishId);
              if (!dish) return null;
              return (
                <li key={`${t.dishId}-${idx}`} className="text-sm">
                  <div className="flex justify-between gap-2">
                    <span>{dish.nombre}</span>
                    <button
                      type="button"
                      className="text-red-700"
                      onClick={() => setTicket((p) => p.filter((_, i) => i !== idx))}
                    >
                      Quitar
                    </button>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2">
                    <input
                      type="number"
                      min={1}
                      value={t.cantidad}
                      onChange={(e) =>
                        setTicket((p) =>
                          p.map((x, i) =>
                            i === idx ? { ...x, cantidad: Number(e.target.value) } : x,
                          ),
                        )
                      }
                      className="w-16 rounded-md border border-fa-border px-2 py-1"
                    />
                    {dish.precio === null ? (
                      <input
                        type="number"
                        min={0}
                        placeholder="RD$"
                        value={t.precioUnitario ?? ""}
                        onChange={(e) =>
                          setTicket((p) =>
                            p.map((x, i) =>
                              i === idx
                                ? { ...x, precioUnitario: Number(e.target.value) }
                                : x,
                            ),
                          )
                        }
                        className="w-24 rounded-md border border-fa-border px-2 py-1"
                      />
                    ) : null}
                    {dish.incluyeGuarnicion ? (
                      <select
                        value={t.garnishId ?? ""}
                        onChange={(e) =>
                          setTicket((p) =>
                            p.map((x, i) =>
                              i === idx ? { ...x, garnishId: e.target.value } : x,
                            ),
                          )
                        }
                        className="rounded-md border border-fa-border px-2 py-1"
                      >
                        {garnishes.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.nombre}
                          </option>
                        ))}
                      </select>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-4 text-lg font-semibold">{formatRD(ticketTotal)}</p>

        {inventoryImpact.length > 0 ? (
          <div className="mt-4 rounded-[10px] border border-fa-border p-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-medium text-fa-primary">Impacto en inventario</h3>
              {criticos > 0 ? (
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                  {criticos} bajo mínimo
                </span>
              ) : null}
            </div>
            <ul className="mt-2 space-y-1.5">
              {inventoryImpact.map((i) => {
                const level =
                  i.proyectado < 0 ? "red" : i.proyectado < i.stockMinimo ? "amber" : "ok";
                return (
                  <li key={i.ingredientId} className="flex items-center justify-between gap-2 text-xs">
                    <span
                      className={
                        level === "red"
                          ? "font-medium text-red-800"
                          : level === "amber"
                            ? "font-medium text-amber-800"
                            : "text-fa-muted"
                      }
                    >
                      {i.nombre}
                    </span>
                    <span
                      className={
                        level === "red"
                          ? "text-red-800"
                          : level === "amber"
                            ? "text-amber-800"
                            : "text-fa-muted"
                      }
                    >
                      {formatStockCompra(i.stockActual, i.unidadMedida, i.unidadEtiqueta)} →{" "}
                      {formatStockCompra(Math.max(i.proyectado, 0), i.unidadMedida, i.unidadEtiqueta)}
                      {i.proyectado < 0 ? " (¡no alcanza!)" : ""}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
        <button
          type="button"
          disabled={pending || ticket.length === 0}
          onClick={() => void submit()}
          className="mt-3 w-full rounded-[10px] bg-fa-primary px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "Guardando…" : "Registrar venta"}
        </button>

        <h3 className="mt-8 text-sm font-medium text-fa-muted">Ya registrado en este turno</h3>
        {lines.length === 0 ? (
          <p className="mt-2 text-sm text-fa-muted">Nada todavía.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm">
            {lines.map((l) => (
              <li key={l.id} className="flex justify-between gap-2">
                <span>
                  {l.cantidad}× {l.nombre}
                  {l.garnish ? ` + ${l.garnish}` : ""}
                  {l.camarero ? (
                    <span className="block text-xs text-fa-muted">{l.camarero}</span>
                  ) : null}
                </span>
                <span>{formatRD(l.cantidad * l.precioUnitario)}</span>
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}
