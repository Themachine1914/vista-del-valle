"use client";

import { formatQty } from "@/lib/money";
import Link from "next/link";
import { useState } from "react";

export function RecipeScaler({
  nombre,
  minutos,
  basePorciones,
  pasos,
  items,
}: {
  nombre: string;
  minutos: number | null;
  basePorciones: number;
  pasos: string[];
  items: { nombre: string; unidad: "G" | "ML" | "UD"; cantidad: number }[];
}) {
  const [porciones, setPorciones] = useState(basePorciones);
  const factor = porciones / basePorciones;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/cocina" className="text-sm text-fa-accent">
          ← Recetas
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-fa-primary">{nombre}</h1>
        <p className="text-sm text-fa-muted">
          {minutos ? `${minutos} min · ` : ""}receta para {basePorciones} porción
        </p>
      </div>
      <label className="flex items-center gap-3 text-sm">
        Porciones
        <input
          type="number"
          min={1}
          max={50}
          value={porciones}
          onChange={(e) => setPorciones(Math.max(1, Number(e.target.value)))}
          className="w-20 rounded-[10px] border border-fa-border px-3 py-2"
        />
      </label>
      <section className="rounded-[10px] border border-fa-border bg-fa-surface p-4">
        <h2 className="font-medium">Ingredientes</h2>
        <ul className="mt-3 space-y-1 text-sm">
          {items.map((i) => (
            <li key={i.nombre} className="flex justify-between">
              <span>{i.nombre}</span>
              <span>{formatQty(i.cantidad * factor, i.unidad)}</span>
            </li>
          ))}
        </ul>
      </section>
      <section className="rounded-[10px] border border-fa-border bg-fa-surface p-4">
        <h2 className="font-medium">Preparación</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm">
          {pasos.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ol>
      </section>
    </div>
  );
}
