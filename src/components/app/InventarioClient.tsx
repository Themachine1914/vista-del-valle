"use client";

import { ajustarInventarioAction } from "@/app/actions/inventario";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Row = {
  id: string;
  nombre: string;
  unidadMedida: "G" | "ML" | "UD";
  stockActual: number;
  stockMinimo: number;
  bajo: boolean;
  etiqueta: string;
};

export function InventarioClient({
  rows,
  canAdjust,
}: {
  rows: Row[];
  canAdjust: boolean;
}) {
  const router = useRouter();
  const [soloAlertas, setSoloAlertas] = useState(false);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(rows[0]?.id ?? "");
  const [tipo, setTipo] = useState<"ENTRADA" | "AJUSTE">("ENTRADA");
  const [cantidad, setCantidad] = useState(0);
  const [nota, setNota] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const visible = rows.filter((r) => {
    if (soloAlertas && !r.bajo) return false;
    return r.nombre.toLowerCase().includes(q.toLowerCase());
  });

  async function submit() {
    const res = await ajustarInventarioAction({
      ingredientId: sel,
      tipo,
      cantidad,
      nota,
    });
    if (!res.ok) {
      setMsg(res.error);
      return;
    }
    setMsg("Stock actualizado");
    setCantidad(0);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-fa-primary">Inventario</h1>
          <p className="text-sm text-fa-muted">
            {rows.filter((r) => r.bajo).length} ingredientes bajo el mínimo
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={soloAlertas}
            onChange={(e) => setSoloAlertas(e.target.checked)}
          />
          Solo alertas
        </label>
      </div>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar ingrediente"
        className="w-full max-w-sm rounded-[10px] border border-fa-border px-3 py-2 text-sm"
      />

      {canAdjust ? (
        <form
          className="grid gap-2 rounded-[10px] border border-fa-border bg-fa-surface p-4 sm:grid-cols-5"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <select
            value={sel}
            onChange={(e) => setSel(e.target.value)}
            className="rounded-[10px] border border-fa-border px-2 py-2 text-sm sm:col-span-2"
          >
            {rows.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nombre}
              </option>
            ))}
          </select>
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as "ENTRADA" | "AJUSTE")}
            className="rounded-[10px] border border-fa-border px-2 py-2 text-sm"
          >
            <option value="ENTRADA">Entrada (+)</option>
            <option value="AJUSTE">Ajuste (+/−)</option>
          </select>
          <input
            type="number"
            step="0.001"
            value={cantidad}
            onChange={(e) => setCantidad(Number(e.target.value))}
            className="rounded-[10px] border border-fa-border px-2 py-2 text-sm"
            placeholder="Cantidad"
          />
          <button
            type="submit"
            className="rounded-[10px] bg-fa-primary px-3 py-2 text-sm font-medium text-white"
          >
            Aplicar
          </button>
          <input
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Nota (opcional)"
            className="rounded-[10px] border border-fa-border px-2 py-2 text-sm sm:col-span-5"
          />
          {msg ? <p className="text-sm text-fa-muted sm:col-span-5">{msg}</p> : null}
        </form>
      ) : (
        <p className="text-sm text-fa-muted">Solo administración puede ajustar stock.</p>
      )}

      <div className="overflow-x-auto rounded-[10px] border border-fa-border bg-fa-surface">
        <table className="w-full text-left text-sm">
          <thead className="bg-fa-bg text-fa-muted">
            <tr>
              <th className="px-3 py-2">Ingrediente</th>
              <th className="px-3 py-2">Stock</th>
              <th className="px-3 py-2">Mínimo</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr
                key={r.id}
                className={r.bajo ? "bg-red-50 text-red-900" : "border-t border-fa-border"}
              >
                <td className="px-3 py-2 font-medium">{r.nombre}</td>
                <td className="px-3 py-2">{r.etiqueta}</td>
                <td className="px-3 py-2">
                  {r.stockMinimo} {r.unidadMedida.toLowerCase()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
