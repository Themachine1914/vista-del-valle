"use client";

import {
  createCategoryAction,
  createDishAction,
  createIngredientAction,
  saveRecipeAction,
  updateDishAction,
  updateIngredientAction,
  uploadDishPhotoAction,
} from "@/app/actions/admin";
import { formatRD } from "@/lib/money";
import { useState } from "react";

type Cat = {
  id: string;
  nombre: string;
  tipo: "COMIDA" | "BEBIDA";
  esInterna: boolean;
  orden: number;
};
type Dish = {
  id: string;
  nombre: string;
  descripcion: string | null;
  precio: number | null;
  foto: string | null;
  categoryId: string;
  categoryNombre: string;
  disponible: boolean;
  destacado: boolean;
  incluyeGuarnicion: boolean;
};
type Ing = {
  id: string;
  nombre: string;
  unidadMedida: "G" | "ML" | "UD";
  stockMinimo: number;
};
type Rec = {
  dishId: string;
  dishNombre: string;
  tiempoPreparacion: number | null;
  pasos: string[];
  items: { ingredientId: string; cantidad: number }[];
};

export function AdminPanel({
  categories,
  dishes,
  ingredients,
  recipes,
}: {
  categories: Cat[];
  dishes: Dish[];
  ingredients: Ing[];
  recipes: Rec[];
}) {
  const [tab, setTab] = useState<"platos" | "ingredientes" | "categorias" | "recetas">(
    "platos",
  );

  return (
    <div>
      <h1 className="text-2xl font-semibold text-fa-primary">Administración</h1>
      <div className="mt-4 flex flex-wrap gap-2">
        {(
          [
            ["platos", "Platos"],
            ["ingredientes", "Ingredientes"],
            ["categorias", "Categorías"],
            ["recetas", "Recetas"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-[10px] px-3 py-1.5 text-sm ${
              tab === id ? "bg-fa-primary text-white" : "border border-fa-border"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="mt-6">
        {tab === "platos" ? (
          <Platos dishes={dishes} categories={categories} />
        ) : null}
        {tab === "ingredientes" ? <Ingredientes ingredients={ingredients} /> : null}
        {tab === "categorias" ? <Categorias /> : null}
        {tab === "recetas" ? (
          <Recetas dishes={dishes} ingredients={ingredients} recipes={recipes} />
        ) : null}
      </div>
    </div>
  );
}

function Platos({ dishes, categories }: { dishes: Dish[]; categories: Cat[] }) {
  const [q, setQ] = useState("");
  const visible = dishes.filter((d) =>
    d.nombre.toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <div className="space-y-6">
      <form
        action={createDishAction}
        className="grid gap-2 rounded-[10px] border border-fa-border bg-fa-surface p-4 sm:grid-cols-4"
      >
        <input name="id" placeholder="id-kebab" required className="rounded-[10px] border border-fa-border px-2 py-2 text-sm" />
        <input name="nombre" placeholder="Nombre" required className="rounded-[10px] border border-fa-border px-2 py-2 text-sm" />
        <select name="categoryId" className="rounded-[10px] border border-fa-border px-2 py-2 text-sm">
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
        <input name="precio" type="number" placeholder="Precio RD$ (vacío = oculto en carta)" className="rounded-[10px] border border-fa-border px-2 py-2 text-sm" />
        <button className="rounded-[10px] bg-fa-accent px-3 py-2 text-sm text-white sm:col-span-4">
          Crear plato
        </button>
      </form>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Filtrar platos"
        className="w-full max-w-sm rounded-[10px] border border-fa-border px-3 py-2 text-sm"
      />
      <div className="space-y-3">
        {visible.slice(0, 40).map((d) => (
          <article
            key={d.id}
            className="grid gap-3 rounded-[10px] border border-fa-border bg-fa-surface p-3 md:grid-cols-[96px_1fr]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={d.foto ?? ""}
              alt=""
              className="h-24 w-full rounded-md object-cover md:h-full"
            />
            <div>
              <form action={updateDishAction} className="grid gap-2 sm:grid-cols-2">
                <input type="hidden" name="id" value={d.id} />
                <input
                  name="nombre"
                  defaultValue={d.nombre}
                  className="rounded-md border border-fa-border px-2 py-1 text-sm"
                />
                <input
                  name="precio"
                  type="number"
                  defaultValue={d.precio ?? ""}
                  placeholder="Precio"
                  className="rounded-md border border-fa-border px-2 py-1 text-sm"
                />
                <input
                  name="descripcion"
                  defaultValue={d.descripcion ?? ""}
                  placeholder="Descripción"
                  className="rounded-md border border-fa-border px-2 py-1 text-sm sm:col-span-2"
                />
                <label className="text-xs">
                  <input name="disponible" type="checkbox" defaultChecked={d.disponible} />{" "}
                  Disponible
                </label>
                <label className="text-xs">
                  <input name="destacado" type="checkbox" defaultChecked={d.destacado} />{" "}
                  Favorito
                </label>
                <label className="text-xs">
                  <input
                    name="incluyeGuarnicion"
                    type="checkbox"
                    defaultChecked={d.incluyeGuarnicion}
                  />{" "}
                  Incluye guarnición
                </label>
                <button className="rounded-md bg-fa-primary px-2 py-1 text-xs text-white">
                  Guardar {d.precio !== null ? `· ${formatRD(d.precio)}` : ""}
                </button>
              </form>
              <form
                action={uploadDishPhotoAction}
                className="mt-2 flex items-center gap-2 text-xs"
              >
                <input type="hidden" name="id" value={d.id} />
                <input type="file" name="file" accept="image/*" required />
                <button className="rounded-md border border-fa-border px-2 py-1">
                  Subir foto
                </button>
              </form>
              <p className="mt-1 text-xs text-fa-muted">{d.categoryNombre}</p>
            </div>
          </article>
        ))}
        {visible.length > 40 ? (
          <p className="text-sm text-fa-muted">
            Mostrando 40 de {visible.length}. Usa el filtro para el resto.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function Ingredientes({ ingredients }: { ingredients: Ing[] }) {
  return (
    <div className="space-y-6">
      <form
        action={createIngredientAction}
        className="grid gap-2 rounded-[10px] border border-fa-border bg-fa-surface p-4 sm:grid-cols-4"
      >
        <input name="id" placeholder="id" required className="rounded-[10px] border border-fa-border px-2 py-2 text-sm" />
        <input name="nombre" placeholder="Nombre" required className="rounded-[10px] border border-fa-border px-2 py-2 text-sm" />
        <select name="unidadMedida" className="rounded-[10px] border border-fa-border px-2 py-2 text-sm">
          <option value="G">g</option>
          <option value="ML">ml</option>
          <option value="UD">ud</option>
        </select>
        <input name="stockMinimo" type="number" placeholder="Stock mín." className="rounded-[10px] border border-fa-border px-2 py-2 text-sm" />
        <button className="rounded-[10px] bg-fa-accent px-3 py-2 text-sm text-white sm:col-span-4">
          Crear ingrediente
        </button>
      </form>
      <div className="overflow-x-auto rounded-[10px] border border-fa-border bg-fa-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-fa-bg text-left text-fa-muted">
              <th className="px-3 py-2">Nombre</th>
              <th className="px-3 py-2">Unidad</th>
              <th className="px-3 py-2">Mínimo</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {ingredients.map((i) => (
              <tr key={i.id} className="border-t border-fa-border">
                <td className="px-3 py-2" colSpan={4}>
                  <form action={updateIngredientAction} className="flex flex-wrap items-center gap-2">
                    <input type="hidden" name="id" value={i.id} />
                    <input
                      name="nombre"
                      defaultValue={i.nombre}
                      className="min-w-40 flex-1 rounded-md border border-fa-border px-2 py-1"
                    />
                    <span className="text-fa-muted">{i.unidadMedida}</span>
                    <input
                      name="stockMinimo"
                      type="number"
                      defaultValue={i.stockMinimo}
                      className="w-28 rounded-md border border-fa-border px-2 py-1"
                    />
                    <button className="rounded-md bg-fa-primary px-2 py-1 text-xs text-white">
                      Guardar
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Categorias() {
  return (
    <form
      action={createCategoryAction}
      className="grid max-w-xl gap-2 rounded-[10px] border border-fa-border bg-fa-surface p-4"
    >
      <h2 className="font-medium">Nueva categoría</h2>
      <input name="id" placeholder="id-kebab" required className="rounded-[10px] border border-fa-border px-3 py-2 text-sm" />
      <input name="nombre" placeholder="Nombre" required className="rounded-[10px] border border-fa-border px-3 py-2 text-sm" />
      <select name="tipo" className="rounded-[10px] border border-fa-border px-3 py-2 text-sm">
        <option value="COMIDA">Comida</option>
        <option value="BEBIDA">Bebida</option>
      </select>
      <input name="orden" type="number" defaultValue={50} className="rounded-[10px] border border-fa-border px-3 py-2 text-sm" />
      <label className="text-sm">
        <input name="esInterna" type="checkbox" /> Interna (no sale en la carta)
      </label>
      <button className="rounded-[10px] bg-fa-primary px-3 py-2 text-sm text-white">
        Crear categoría
      </button>
    </form>
  );
}

function Recetas({
  dishes,
  ingredients,
  recipes,
}: {
  dishes: Dish[];
  ingredients: Ing[];
  recipes: Rec[];
}) {
  const [dishId, setDishId] = useState(recipes[0]?.dishId ?? dishes[0]?.id ?? "");
  const current = recipes.find((r) => r.dishId === dishId);
  const [pasos, setPasos] = useState(current?.pasos.join("\n") ?? "");
  const [items, setItems] = useState(
    current?.items ?? [{ ingredientId: ingredients[0]?.id ?? "", cantidad: 1 }],
  );
  const [minutos, setMinutos] = useState(current?.tiempoPreparacion ?? 0);
  const [msg, setMsg] = useState<string | null>(null);

  function load(id: string) {
    setDishId(id);
    const r = recipes.find((x) => x.dishId === id);
    setPasos(r?.pasos.join("\n") ?? "");
    setItems(r?.items ?? [{ ingredientId: ingredients[0]?.id ?? "", cantidad: 1 }]);
    setMinutos(r?.tiempoPreparacion ?? 0);
    setMsg(null);
  }

  async function save() {
    const res = await saveRecipeAction({
      dishId,
      tiempoPreparacion: minutos || null,
      pasos: pasos
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
      items,
    });
    setMsg(res.ok ? "Receta guardada" : res.error);
  }

  return (
    <div className="space-y-4 rounded-[10px] border border-fa-border bg-fa-surface p-4">
      <select
        value={dishId}
        onChange={(e) => load(e.target.value)}
        className="w-full rounded-[10px] border border-fa-border px-3 py-2 text-sm"
      >
        {dishes.map((d) => (
          <option key={d.id} value={d.id}>
            {d.nombre}
          </option>
        ))}
      </select>
      <label className="block text-sm">
        Minutos
        <input
          type="number"
          value={minutos}
          onChange={(e) => setMinutos(Number(e.target.value))}
          className="mt-1 w-32 rounded-md border border-fa-border px-2 py-1"
        />
      </label>
      <label className="block text-sm">
        Pasos (uno por línea)
        <textarea
          value={pasos}
          onChange={(e) => setPasos(e.target.value)}
          rows={5}
          className="mt-1 w-full rounded-md border border-fa-border px-2 py-1"
        />
      </label>
      <div className="space-y-2">
        {items.map((it, idx) => (
          <div key={idx} className="flex gap-2">
            <select
              value={it.ingredientId}
              onChange={(e) =>
                setItems((p) =>
                  p.map((x, i) =>
                    i === idx ? { ...x, ingredientId: e.target.value } : x,
                  ),
                )
              }
              className="flex-1 rounded-md border border-fa-border px-2 py-1 text-sm"
            >
              {ingredients.map((ing) => (
                <option key={ing.id} value={ing.id}>
                  {ing.nombre}
                </option>
              ))}
            </select>
            <input
              type="number"
              step="0.01"
              value={it.cantidad}
              onChange={(e) =>
                setItems((p) =>
                  p.map((x, i) =>
                    i === idx ? { ...x, cantidad: Number(e.target.value) } : x,
                  ),
                )
              }
              className="w-24 rounded-md border border-fa-border px-2 py-1 text-sm"
            />
            <button
              type="button"
              onClick={() => setItems((p) => p.filter((_, i) => i !== idx))}
              className="text-sm text-red-700"
            >
              Quitar
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            setItems((p) => [
              ...p,
              { ingredientId: ingredients[0]?.id ?? "", cantidad: 1 },
            ])
          }
          className="text-sm text-fa-accent"
        >
          + Ingrediente
        </button>
      </div>
      <button
        type="button"
        onClick={() => void save()}
        className="rounded-[10px] bg-fa-primary px-4 py-2 text-sm text-white"
      >
        Guardar receta
      </button>
      {msg ? <p className="text-sm text-fa-muted">{msg}</p> : null}
    </div>
  );
}
