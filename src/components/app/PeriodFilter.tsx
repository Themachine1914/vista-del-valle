"use client";

import { useRouter } from "next/navigation";
import { yearsAround, type PeriodoFiltro, type PeriodoModo, periodoQuery } from "@/lib/period";

const MODOS: { id: PeriodoModo; label: string }[] = [
  { id: "dia", label: "Día" },
  { id: "mes", label: "Mes" },
  { id: "anio", label: "Año" },
  { id: "rango", label: "Rango" },
];

export function PeriodFilter({
  basePath,
  periodo,
  extra,
}: {
  basePath: string;
  periodo: PeriodoFiltro;
  extra?: Record<string, string | undefined>;
}) {
  const router = useRouter();

  function go(next: Partial<PeriodoFiltro> & { modo?: PeriodoModo }) {
    const merged: PeriodoFiltro = { ...periodo, ...next, modo: next.modo ?? periodo.modo };
    router.push(`${basePath}?${periodoQuery(merged, extra)}`);
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="flex flex-wrap gap-1">
        {MODOS.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => go({ modo: m.id })}
            className={`rounded-[10px] px-3 py-2 text-sm ${
              periodo.modo === m.id
                ? "bg-fa-primary text-white"
                : "border border-fa-border"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>
      {periodo.modo === "dia" ? (
        <input
          type="date"
          value={periodo.fecha}
          onChange={(e) => go({ fecha: e.target.value, modo: "dia" })}
          className="rounded-[10px] border border-fa-border px-3 py-2 text-sm"
        />
      ) : null}
      {periodo.modo === "mes" ? (
        <input
          type="month"
          value={periodo.mes}
          onChange={(e) => go({ mes: e.target.value, modo: "mes" })}
          className="rounded-[10px] border border-fa-border px-3 py-2 text-sm"
        />
      ) : null}
      {periodo.modo === "anio" ? (
        <select
          value={periodo.anio}
          onChange={(e) => go({ anio: e.target.value, modo: "anio" })}
          className="rounded-[10px] border border-fa-border px-3 py-2 text-sm"
        >
          {yearsAround(periodo.fecha).map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      ) : null}
      {periodo.modo === "rango" ? (
        <>
          <label className="text-sm text-fa-muted">
            Desde
            <input
              type="date"
              value={periodo.desde}
              onChange={(e) => go({ desde: e.target.value, modo: "rango" })}
              className="ml-2 rounded-[10px] border border-fa-border px-3 py-2 text-sm text-fa-text"
            />
          </label>
          <label className="text-sm text-fa-muted">
            Hasta
            <input
              type="date"
              value={periodo.hasta}
              onChange={(e) => go({ hasta: e.target.value, modo: "rango" })}
              className="ml-2 rounded-[10px] border border-fa-border px-3 py-2 text-sm text-fa-text"
            />
          </label>
        </>
      ) : null}
    </div>
  );
}
