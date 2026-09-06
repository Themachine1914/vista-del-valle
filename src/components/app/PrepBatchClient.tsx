"use client";

import { anularLoteAction, registrarLoteAction } from "@/app/actions/cocina";
import { formatQty, formatStockCompra } from "@/lib/money";
import { etiquetaLotes } from "@/lib/prep-recipe";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type Unidad = "G" | "ML" | "UD";

type Item = {
  ingredientId: string;
  nombre: string;
  unidad: Unidad;
  unidadEtiqueta: string;
  cantidad: number;
  stockActual: number;
  stockMinimo: number;
};

type Lote = {
  id: string;
  lotes: number;
  fecha: string;
  usuario: string | null;
  anulado: boolean;
};

type Impacto = {
  ingredientId: string;
  nombre: string;
  unidad: Unidad;
  unidadEtiqueta: string;
  stockActual: number;
  stockMinimo: number;
  delta: number;
  proyectado: number;
  esSalida: boolean;
};

function proyectarImpacto(
  items: Item[],
  output: {
    ingredientId: string;
    nombre: string;
    unidad: Unidad;
    unidadEtiqueta: string;
    stockActual: number;
    stockMinimo: number;
    rendimiento: number;
  },
  lotes: number,
): Impacto[] {
  if (!(lotes > 0)) return [];
  const rows: Impacto[] = items.map((i) => {
    const usado = i.cantidad * lotes;
    return {
      ingredientId: i.ingredientId,
      nombre: i.nombre,
      unidad: i.unidad,
      unidadEtiqueta: i.unidadEtiqueta,
      stockActual: i.stockActual,
      stockMinimo: i.stockMinimo,
      delta: -usado,
      proyectado: i.stockActual - usado,
      esSalida: true,
    };
  });
  rows.push({
    ingredientId: output.ingredientId,
    nombre: output.nombre,
    unidad: output.unidad,
    unidadEtiqueta: output.unidadEtiqueta,
    stockActual: output.stockActual,
    stockMinimo: output.stockMinimo,
    delta: output.rendimiento * lotes,
    proyectado: output.stockActual + output.rendimiento * lotes,
    esSalida: false,
  });
  return rows.sort((a, b) => Number(b.esSalida) - Number(a.esSalida) || a.nombre.localeCompare(b.nombre));
}

export function PrepBatchClient({
  recipeId,
  nombre,
  minutos,
  rendimiento,
  unidadSalida,
  etiquetaSalida,
  output,
  pasos,
  items,
  lotesRecientes,
}: {
  recipeId: string;
  nombre: string;
  minutos: number | null;
  rendimiento: number;
  unidadSalida: Unidad;
  etiquetaSalida: string;
  output: {
    ingredientId: string;
    nombre: string;
    unidad: Unidad;
    unidadEtiqueta: string;
    stockActual: number;
    stockMinimo: number;
  };
  pasos: string[];
  items: Item[];
  lotesRecientes: Lote[];
}) {
  const router = useRouter();
  const [lotes, setLotes] = useState(1);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const impacto = useMemo(
    () => proyectarImpacto(items, { ...output, rendimiento }, lotes),
    [items, output, rendimiento, lotes],
  );
  const criticos = impacto.filter((i) => i.esSalida && i.proyectado < i.stockMinimo).length;

  async function registrar() {
    setPending(true);
    setError(null);
    setMsg(null);
    const res = await registrarLoteAction({ recipeId, lotes });
    setPending(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setMsg(`Registrado ${etiquetaLotes(lotes)} de ${res.nombre}.`);
    router.refresh();
  }

  async function anular(lote: Lote) {
    if (
      !window.confirm(
        `¿Anular ${etiquetaLotes(lote.lotes)} de ${nombre}? Se devuelven los crudos y se quita la salsa entrada.`,
      )
    ) {
      return;
    }
    setPending(true);
    setError(null);
    setMsg(null);
    const res = await anularLoteAction(lote.id);
    setPending(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setMsg(`Se anuló el lote de ${res.nombre}.`);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/cocina" className="text-sm text-fa-accent">
          ? Recetas
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-fa-primary">{nombre}</h1>
        <p className="text-sm text-fa-muted">
          {minutos ? `${minutos} min · ` : ""}1 lote produce{" "}
          {formatQty(rendimiento, unidadSalida)}
          {etiquetaSalida ? ` (${etiquetaSalida})` : ""}
        </p>
        <p className="mt-1 text-sm text-fa-muted">
          Stock actual:{" "}
          {formatStockCompra(output.stockActual, output.unidad, output.unidadEtiqueta)}
        </p>
      </div>

      <label className="flex items-center gap-3 text-sm">
        Lotes a preparar
        <input
          type="number"
          min={0.25}
          max={50}
          step={0.25}
          value={lotes}
          onChange={(e) => setLotes(Math.max(0.25, Number(e.target.value)))}
          className="w-24 rounded-[10px] border border-fa-border px-3 py-2"
        />
      </label>

      <section className="rounded-[10px] border border-fa-border bg-fa-surface p-4">
        <h2 className="font-medium">Ingredientes del lote</h2>
        <ul className="mt-3 space-y-1 text-sm">
          {items.map((i) => (
            <li key={i.ingredientId} className="flex justify-between">
              <span>{i.nombre}</span>
              <span>{formatQty(i.cantidad * lotes, i.unidad)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 flex justify-between text-sm font-medium">
          <span>Entra {output.nombre}</span>
          <span>{formatQty(rendimiento * lotes, unidadSalida)}</span>
        </p>
      </section>

      {impacto.length > 0 ? (
        <section className="rounded-[10px] border border-fa-border bg-fa-surface p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-medium">Impacto en inventario</h2>
            {criticos > 0 ? (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                {criticos} bajo mínimo
              </span>
            ) : null}
          </div>
          <ul className="mt-3 space-y-1.5 text-sm">
            {impacto.map((i) => {
              const level = i.esSalida
                ? i.proyectado < 0
                  ? "red"
                  : i.proyectado < i.stockMinimo
                    ? "amber"
                    : "ok"
                : "in";
              return (
                <li key={i.ingredientId} className="flex justify-between gap-2">
                  <span
                    className={
                      level === "red"
                        ? "font-medium text-red-800"
                        : level === "amber"
                          ? "font-medium text-amber-800"
                          : level === "in"
                            ? "font-medium text-fa-primary"
                            : "text-fa-muted"
                    }
                  >
                    {i.esSalida ? "Sale" : "Entra"} {i.nombre}
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
                    {formatStockCompra(i.stockActual, i.unidad, i.unidadEtiqueta)} ?{" "}
                    {formatStockCompra(
                      Math.max(i.proyectado, 0),
                      i.unidad,
                      i.unidadEtiqueta,
                    )}
                    {i.proyectado < 0 ? " (¡no alcanza!)" : ""}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {pasos.length > 0 ? (
        <section className="rounded-[10px] border border-fa-border bg-fa-surface p-4">
          <h2 className="font-medium">Preparación</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm">
            {pasos.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ol>
        </section>
      ) : null}

      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {msg ? <p className="text-sm text-fa-muted">{msg}</p> : null}
      <button
        type="button"
        disabled={pending || items.length === 0}
        onClick={() => void registrar()}
        className="rounded-[10px] bg-fa-primary px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Guardando…" : `Registrar ${etiquetaLotes(lotes)}`}
      </button>

      <section>
        <h2 className="text-sm font-medium text-fa-muted">Lotes recientes</h2>
        {lotesRecientes.length === 0 ? (
          <p className="mt-2 text-sm text-fa-muted">Todavía no se ha registrado ningún lote.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm">
            {lotesRecientes.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-2">
                <span>
                  {etiquetaLotes(l.lotes)}
                  {l.anulado ? " · anulado" : ""}
                  <span className="block text-xs text-fa-muted">
                    {l.fecha}
                    {l.usuario ? ` · ${l.usuario}` : ""}
                  </span>
                </span>
                {!l.anulado ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => void anular(l)}
                    className="text-sm text-red-700 disabled:opacity-50"
                  >
                    Anular
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
