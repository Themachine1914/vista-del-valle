"use client";

import {
  createCategoryAction,
  createDishAction,
  createIngredientAction,
  deleteIngredientAction,
  deletePrepRecipeAction,
  savePrepRecipeAction,
  saveRecipeAction,
  updateDishAction,
  updateIngredientAction,
  uploadDishPhotoAction,
} from "@/app/actions/admin";
import { borrarVentaAction } from "@/app/actions/ventas";
import { formatQty, formatRD } from "@/lib/money";
import { useRouter } from "next/navigation";
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
  stockActual: number;
  stockMinimo: number;
};
type Rec = {
  dishId: string;
  dishNombre: string;
  tiempoPreparacion: number | null;
  pasos: string[];
  items: { ingredientId: string; cantidad: number }[];
};
type Prep = {
  id: string;
  nombre: string;
  outputIngredientId: string;
  rendimiento: number;
  tiempoPreparacion: number | null;
  pasos: string[];
  items: { ingredientId: string; cantidad: number }[];
};
type VentaAdmin = {
  id: string;
  fecha: string;
  turno: "DESAYUNO" | "ALMUERZO" | "CENA";
  nombre: string;
  garnish: string | null;
  cantidad: number;
  total: number;
  camarero: string | null;
};

export function AdminPanel({
  categories,
  dishes,
  ingredients,
  recipes,
  prepRecipes,
  ventas,
  ventasFecha,
  initialTab,
}: {
  categories: Cat[];
  dishes: Dish[];
  ingredients: Ing[];
  recipes: Rec[];
  prepRecipes: Prep[];
  ventas: VentaAdmin[];
  ventasFecha: string;
  initialTab: "platos" | "ventas";
}) {
  const router = useRouter();
  const [tab, setTab] = useState<
    | "platos"
    | "ingredientes"
    | "categorias"
    | "recetas"
    | "preparaciones"
    | "ventas"
  >(initialTab);

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
            ["preparaciones", "Preparaciones"],
            ["ventas", "Ventas"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setTab(id);
              if (id === "ventas") {
                router.replace(`/admin?tab=ventas&ventasFecha=${ventasFecha}`);
              }
            }}
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
        {tab === "preparaciones" ? (
          <Preparaciones ingredients={ingredients} recipes={prepRecipes} />
        ) : null}
        {tab === "ventas" ? (
          <VentasAdmin ventas={ventas} ventasFecha={ventasFecha} />
        ) : null}
      </div>
    </div>
  );
}

const TURNO_LABEL: Record<VentaAdmin["turno"], string> = {
  DESAYUNO: "Desayuno",
  ALMUERZO: "Almuerzo",
  CENA: "Cena",
};

function VentasAdmin({
  ventas,
  ventasFecha,
}: {
  ventas: VentaAdmin[];
  ventasFecha: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const visible = ventas.filter((v) => {
    const hay = `${v.nombre} ${v.garnish ?? ""} ${v.camarero ?? ""}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  });

  async function borrar(v: VentaAdmin) {
    const detalle = `${v.cantidad}× ${v.nombre}${v.garnish ? ` + ${v.garnish}` : ""}`;
    if (
      !window.confirm(
        `¿Borrar ${detalle} del ${v.fecha}? Se quita de las ventas y se devuelve al inventario.`,
      )
    ) {
      return;
    }
    setPending(v.id);
    setMsg(null);
    const res = await borrarVentaAction({ saleItemId: v.id });
    setPending(null);
    if (!res.ok) {
      setMsg(res.error);
      return;
    }
    setMsg(`Borrada: ${detalle}. Inventario repuesto.`);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-fa-muted">
        Borra una venta registrada por error. El plato y la guarnición vuelven al inventario.
        También puedes borrar desde Ventas eligiendo el día.
      </p>
      <div className="flex flex-wrap gap-2">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar plato, guarnición o camarero…"
          className="w-full max-w-xs rounded-[10px] border border-fa-border px-3 py-2 text-sm"
        />
        <input
          type="date"
          value={ventasFecha}
          onChange={(e) => {
            const next = e.target.value;
            if (!next) return;
            router.push(`/admin?tab=ventas&ventasFecha=${next}`);
          }}
          className="rounded-[10px] border border-fa-border px-3 py-2 text-sm"
        />
      </div>
      {msg ? <p className="text-sm text-fa-muted">{msg}</p> : null}
      <div className="overflow-x-auto rounded-[10px] border border-fa-border bg-fa-surface">
        <table className="w-full text-left text-sm">
          <thead className="bg-fa-bg text-fa-muted">
            <tr>
              <th className="px-3 py-2">Fecha</th>
              <th className="px-3 py-2">Turno</th>
              <th className="px-3 py-2">Venta</th>
              <th className="px-3 py-2">Total</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {visible.map((v) => (
              <tr key={v.id} className="border-t border-fa-border">
                <td className="px-3 py-2 whitespace-nowrap">{v.fecha}</td>
                <td className="px-3 py-2">{TURNO_LABEL[v.turno]}</td>
                <td className="px-3 py-2">
                  {v.cantidad}× {v.nombre}
                  {v.garnish ? ` + ${v.garnish}` : ""}
                  {v.camarero ? (
                    <span className="block text-xs text-fa-muted">{v.camarero}</span>
                  ) : null}
                </td>
                <td className="px-3 py-2">{formatRD(v.total)}</td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    disabled={pending === v.id}
                    onClick={() => void borrar(v)}
                    className="rounded-md border border-red-300 px-2 py-1 text-xs text-red-700 disabled:opacity-50"
                  >
                    Borrar
                  </button>
                </td>
              </tr>
            ))}
            {visible.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-fa-muted" colSpan={5}>
                  No hay ventas con ese filtro.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
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
              <th className="px-3 py-2">Stock actual</th>
              <th className="px-3 py-2">Mínimo</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {ingredients.map((i) => (
              <tr key={i.id} className="border-t border-fa-border">
                <td className="px-3 py-2" colSpan={5}>
                  <form action={updateIngredientAction} className="flex flex-wrap items-center gap-2">
                    <input type="hidden" name="id" value={i.id} />
                    <input
                      name="nombre"
                      defaultValue={i.nombre}
                      className="min-w-40 flex-1 rounded-md border border-fa-border px-2 py-1"
                    />
                    <select
                      name="unidadMedida"
                      defaultValue={i.unidadMedida}
                      className="rounded-md border border-fa-border px-2 py-1"
                    >
                      <option value="G">g</option>
                      <option value="ML">ml</option>
                      <option value="UD">ud</option>
                    </select>
                    <input
                      name="stockActual"
                      type="number"
                      step="0.001"
                      defaultValue={i.stockActual}
                      className="w-28 rounded-md border border-fa-border px-2 py-1"
                    />
                    <input
                      name="stockMinimo"
                      type="number"
                      step="0.001"
                      defaultValue={i.stockMinimo}
                      className="w-28 rounded-md border border-fa-border px-2 py-1"
                    />
                    <button className="rounded-md bg-fa-primary px-2 py-1 text-xs text-white">
                      Guardar
                    </button>
                  </form>
                  <form
                    action={deleteIngredientAction}
                    className="mt-1 inline"
                    onSubmit={(e) => {
                      if (
                        !window.confirm(
                          `¿Borrar "${i.nombre}"? Esto también elimina sus líneas de receta o preparación y su historial de movimientos.`,
                        )
                      ) {
                        e.preventDefault();
                      }
                    }}
                  >
                    <input type="hidden" name="id" value={i.id} />
                    <button className="rounded-md border border-red-300 px-2 py-1 text-xs text-red-700">
                      Borrar
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

function Preparaciones({
  ingredients,
  recipes,
}: {
  ingredients: Ing[];
  recipes: Prep[];
}) {
  const [recipeId, setRecipeId] = useState(recipes[0]?.id ?? "");
  const current = recipes.find((r) => r.id === recipeId);
  const usedOutputs = new Set(
    recipes.filter((r) => r.id !== recipeId).map((r) => r.outputIngredientId),
  );
  const outputOptions = ingredients.filter((i) => !usedOutputs.has(i.id));
  const [nombre, setNombre] = useState(current?.nombre ?? "");
  const [outputId, setOutputId] = useState(
    current?.outputIngredientId ?? outputOptions[0]?.id ?? "",
  );
  const [rendimiento, setRendimiento] = useState(current?.rendimiento ?? 3785);
  const [pasos, setPasos] = useState(current?.pasos.join("\n") ?? "");
  const [items, setItems] = useState(
    current?.items ?? [{ ingredientId: ingredients[0]?.id ?? "", cantidad: 1 }],
  );
  const [minutos, setMinutos] = useState(current?.tiempoPreparacion ?? 0);
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();
  const output = ingredients.find((i) => i.id === outputId);

  function load(id: string) {
    setRecipeId(id);
    const r = recipes.find((x) => x.id === id);
    setNombre(r?.nombre ?? "");
    setOutputId(r?.outputIngredientId ?? outputOptions[0]?.id ?? "");
    setRendimiento(r?.rendimiento ?? 3785);
    setPasos(r?.pasos.join("\n") ?? "");
    setItems(r?.items ?? [{ ingredientId: ingredients[0]?.id ?? "", cantidad: 1 }]);
    setMinutos(r?.tiempoPreparacion ?? 0);
    setMsg(null);
  }

  function nueva() {
    const libre = ingredients.find((i) => !recipes.some((r) => r.outputIngredientId === i.id));
    setRecipeId("");
    setNombre("");
    setOutputId(libre?.id ?? ingredients[0]?.id ?? "");
    setRendimiento(3785);
    setPasos("");
    setItems([{ ingredientId: ingredients[0]?.id ?? "", cantidad: 1 }]);
    setMinutos(0);
    setMsg(null);
  }

  async function save() {
    const res = await savePrepRecipeAction({
      id: recipeId || undefined,
      nombre: nombre.trim() || output?.nombre || "Preparación",
      outputIngredientId: outputId,
      rendimiento,
      tiempoPreparacion: minutos || null,
      pasos: pasos
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
      items,
    });
    setMsg(res.ok ? "Preparación guardada" : res.error);
    if (res.ok) router.refresh();
  }

  async function borrar() {
    if (!recipeId) return;
    if (!window.confirm(`¿Borrar la preparación "${nombre}"?`)) return;
    const res = await deletePrepRecipeAction(recipeId);
    setMsg(res.ok ? "Preparación borrada" : res.error);
    if (res.ok) {
      setRecipeId("");
      router.refresh();
    }
  }

  return (
    <div className="space-y-4 rounded-[10px] border border-fa-border bg-fa-surface p-4">
      <p className="text-sm text-fa-muted">
        Receta de lote interno: al prepararla se descuentan estos ingredientes y entra el
        producto terminado (la salsa) al inventario. Primero crea el producto en
        Ingredientes si aún no existe.
      </p>
      <div className="flex flex-wrap gap-2">
        <select
          value={recipeId}
          onChange={(e) => load(e.target.value)}
          className="min-w-56 flex-1 rounded-[10px] border border-fa-border px-3 py-2 text-sm"
        >
          {recipes.length === 0 ? (
            <option value="">Nueva preparación</option>
          ) : null}
          {recipes.map((r) => (
            <option key={r.id} value={r.id}>
              {r.nombre}
            </option>
          ))}
        </select>
        <button type="button" onClick={nueva} className="text-sm text-fa-accent">
          + Nueva
        </button>
      </div>
      <label className="block text-sm">
        Nombre
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          className="mt-1 w-full rounded-md border border-fa-border px-2 py-1"
        />
      </label>
      <label className="block text-sm">
        Producto que produce
        <select
          value={outputId}
          onChange={(e) => {
            setOutputId(e.target.value);
            const ing = ingredients.find((i) => i.id === e.target.value);
            if (ing && !nombre.trim()) setNombre(ing.nombre);
          }}
          className="mt-1 w-full rounded-md border border-fa-border px-2 py-1 text-sm"
        >
          {outputOptions.map((i) => (
            <option key={i.id} value={i.id}>
              {i.nombre}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        Rendimiento de 1 lote
        {output ? (
          <span className="text-fa-muted">
            {" "}
            ({output.unidadMedida === "ML" ? "ml" : output.unidadMedida === "G" ? "g" : "ud"})
          </span>
        ) : null}
        <input
          type="number"
          step="0.01"
          min={0.01}
          value={rendimiento}
          onChange={(e) => setRendimiento(Number(e.target.value))}
          className="mt-1 w-40 rounded-md border border-fa-border px-2 py-1"
        />
        {output ? (
          <span className="ml-2 text-xs text-fa-muted">
            {formatQty(rendimiento, output.unidadMedida)}
          </span>
        ) : null}
      </label>
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
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void save()}
          className="rounded-[10px] bg-fa-primary px-4 py-2 text-sm text-white"
        >
          Guardar preparación
        </button>
        {recipeId ? (
          <button
            type="button"
            onClick={() => void borrar()}
            className="rounded-[10px] border border-fa-border px-4 py-2 text-sm text-red-700"
          >
            Borrar
          </button>
        ) : null}
      </div>
      {msg ? <p className="text-sm text-fa-muted">{msg}</p> : null}
    </div>
  );
}
