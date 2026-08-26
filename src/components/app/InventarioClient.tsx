"use client";

import {
  ajustarInventarioAction,
  borrarProductoAction,
  guardarProductoAction,
  registrarCompraAction,
} from "@/app/actions/inventario";
import { PeriodFilter } from "@/components/app/PeriodFilter";
import { PdfDownload } from "@/components/app/PdfDownload";
import {
  customFromIngredient,
  etiquetaTipo,
  purchaseToStock,
  resolveEntrada,
  stockToDisplay,
  tipoFromIngredient,
  type TipoEntrada,
} from "@/lib/inventory-units";
import { formatStockCompra } from "@/lib/money";
import { type PeriodoFiltro } from "@/lib/period";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type Row = {
  id: string;
  nombre: string;
  unidadMedida: "G" | "ML" | "UD";
  unidadEtiqueta: string;
  stockActual: number;
  stockMinimo: number;
  bajo: boolean;
  etiqueta: string;
  minimoEtiqueta: string;
};

type AuditRow = {
  id: string;
  accion: "ALTA" | "BAJA" | "RENOMBRE" | "RESET";
  nombre: string;
  detalle: string | null;
  usuario: string;
  createdAt: string;
};

type CompraRow = {
  id: string;
  producto: string;
  nota: string | null;
  etiqueta: string;
  usuario: string;
  fecha: string;
};

const ACCION_LABEL: Record<AuditRow["accion"], string> = {
  ALTA: "Alta",
  BAJA: "Baja",
  RENOMBRE: "Cambio",
  RESET: "Cero",
};

function round3(n: number) {
  return Math.round(n * 1000) / 1000;
}

const TIPOS: { id: TipoEntrada; label: string }[] = [
  { id: "LIBRA", label: "Libra" },
  { id: "KILO", label: "Kilo" },
  { id: "LITRO", label: "Litro" },
  { id: "UNIDAD", label: "Unidad" },
  { id: "OTRO", label: "Otra (escribir)" },
];

function etiquetaVista(tipo: TipoEntrada, custom: string) {
  try {
    return resolveEntrada(tipo, custom).etiqueta;
  } catch {
    return etiquetaTipo(tipo, custom);
  }
}

function TipoCampos({
  tipo,
  custom,
  onChange,
  className,
}: {
  tipo: TipoEntrada;
  custom: string;
  onChange: (tipo: TipoEntrada, custom: string) => void;
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap gap-2 ${className ?? ""}`}>
      <select
        value={tipo}
        onChange={(e) => onChange(e.target.value as TipoEntrada, custom)}
        className="rounded-[10px] border border-fa-border bg-white px-2 py-2 text-sm text-fa-text"
      >
        {TIPOS.map((t) => (
          <option key={t.id} value={t.id}>
            {t.label}
          </option>
        ))}
      </select>
      {tipo === "OTRO" ? (
        <input
          value={custom}
          onChange={(e) => onChange(tipo, e.target.value)}
          placeholder="kg, caja, saco…"
          className="min-w-28 flex-1 rounded-[10px] border border-fa-border px-2 py-2 text-sm"
        />
      ) : null}
    </div>
  );
}

export function InventarioClient({
  rows,
  canAdjust,
  audits,
  compras,
  defaultFecha,
  periodo,
  resumen,
}: {
  rows: Row[];
  canAdjust: boolean;
  audits: AuditRow[];
  compras: CompraRow[];
  defaultFecha: string;
  periodo: PeriodoFiltro;
  resumen: { altas: number; bajas: number; cambios: number; compras: number };
}) {
  const router = useRouter();
  const [soloAlertas, setSoloAlertas] = useState(false);
  const [q, setQ] = useState("");
  const [modo, setModo] = useState<"existente" | "nuevo">("existente");
  const [sel, setSel] = useState(rows[0]?.id ?? "");
  const [nombreNuevo, setNombreNuevo] = useState("");
  const [fecha, setFecha] = useState(defaultFecha);
  const [tipoEntrada, setTipoEntrada] = useState<TipoEntrada>("LIBRA");
  const [unidadCustom, setUnidadCustom] = useState("");
  const [cantidadItems, setCantidadItems] = useState(1);
  const [contenidoPorItem, setContenidoPorItem] = useState(1);
  const [stockMinimo, setStockMinimo] = useState(0);
  const [nota, setNota] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ajusteSel, setAjusteSel] = useState(rows[0]?.id ?? "");
  const [ajusteTipo, setAjusteTipo] = useState<"ENTRADA" | "AJUSTE">("AJUSTE");
  const [ajusteCantidad, setAjusteCantidad] = useState(0);
  const [ajusteNota, setAjusteNota] = useState("");
  const [nombres, setNombres] = useState<Record<string, string>>({});
  const [tiposFila, setTiposFila] = useState<Record<string, TipoEntrada>>({});
  const [customFila, setCustomFila] = useState<Record<string, string>>({});
  const [minimos, setMinimos] = useState<Record<string, number>>({});

  useEffect(() => {
    if (rows.length === 0) return;
    if (!sel || !rows.some((r) => r.id === sel)) setSel(rows[0].id);
    if (!ajusteSel || !rows.some((r) => r.id === ajusteSel)) {
      setAjusteSel(rows[0].id);
    }
  }, [rows, sel, ajusteSel]);

  useEffect(() => {
    if (modo !== "existente") return;
    const row = rows.find((r) => r.id === sel);
    if (!row) return;
    setTipoEntrada(tipoFromIngredient(row.unidadMedida, row.unidadEtiqueta));
    setUnidadCustom(customFromIngredient(row.unidadMedida, row.unidadEtiqueta));
    setStockMinimo(round3(stockToDisplay(row.stockMinimo, row.unidadMedida, row.unidadEtiqueta)));
  }, [modo, sel, rows]);

  const unidadEtiqueta = etiquetaVista(tipoEntrada, unidadCustom);

  const preview = useMemo(() => {
    if (cantidadItems <= 0 || contenidoPorItem <= 0) return null;
    try {
      const conv = purchaseToStock({
        tipoEntrada,
        unidadCustom,
        cantidadItems,
        contenidoPorItem,
      });
      return formatStockCompra(conv.cantidadStock, conv.unidadMedida, conv.etiqueta);
    } catch {
      return null;
    }
  }, [tipoEntrada, unidadCustom, cantidadItems, contenidoPorItem]);

  const visible = rows.filter((r) => {
    if (soloAlertas && !r.bajo) return false;
    return r.nombre.toLowerCase().includes(q.toLowerCase());
  });

  const ajusteRow = rows.find((r) => r.id === ajusteSel);

  async function registrar() {
    setBusy(true);
    setMsg(null);
    const res = await registrarCompraAction({
      ingredientId: modo === "existente" ? sel : undefined,
      nombreNuevo: modo === "nuevo" ? nombreNuevo : undefined,
      tipoEntrada,
      unidadCustom,
      cantidadItems,
      contenidoPorItem,
      stockMinimo,
      fecha,
      nota,
    });
    setBusy(false);
    if (!res.ok) {
      setMsg(res.error);
      return;
    }
    setMsg(
      res.created
        ? `Producto "${res.nombre}" creado y registrado`
        : `Compra de "${res.nombre}" registrada`,
    );
    setCantidadItems(1);
    setContenidoPorItem(1);
    setNota("");
    setNombreNuevo("");
    router.refresh();
  }

  async function ajustar() {
    setBusy(true);
    setMsg(null);
    const res = await ajustarInventarioAction({
      ingredientId: ajusteSel,
      tipo: ajusteTipo,
      cantidad: ajusteCantidad,
      nota: ajusteNota,
    });
    setBusy(false);
    if (!res.ok) {
      setMsg(res.error);
      return;
    }
    setMsg("Ajuste aplicado");
    setAjusteCantidad(0);
    router.refresh();
  }

  async function guardar(id: string) {
    const row = rows.find((r) => r.id === id);
    const nombre = (nombres[id] ?? row?.nombre ?? "").trim();
    const tipo =
      tiposFila[id] ??
      (row ? tipoFromIngredient(row.unidadMedida, row.unidadEtiqueta) : "LIBRA");
    const custom =
      customFila[id] ??
      (row ? customFromIngredient(row.unidadMedida, row.unidadEtiqueta) : "");
    const minimo =
      minimos[id] ??
      (row
        ? round3(stockToDisplay(row.stockMinimo, row.unidadMedida, row.unidadEtiqueta))
        : 0);
    const res = await guardarProductoAction({
      id,
      nombre,
      tipoEntrada: tipo,
      unidadCustom: custom,
      stockMinimo: minimo,
    });
    if (!res.ok) {
      setMsg(res.error);
      return;
    }
    setMsg("Producto actualizado");
    router.refresh();
  }

  async function borrar(id: string, nombre: string) {
    if (
      !window.confirm(
        `¿Borrar "${nombre}" por completo? Se quita de recetas. El registro de alta/baja se conserva.`,
      )
    ) {
      return;
    }
    const res = await borrarProductoAction({ id });
    if (!res.ok) {
      setMsg(res.error);
      return;
    }
    setMsg(`"${nombre}" eliminado`);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-fa-primary">Inventario</h1>
          <p className="text-sm text-fa-muted">
            {rows.filter((r) => r.bajo).length} productos bajo el mínimo
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={soloAlertas}
              onChange={(e) => setSoloAlertas(e.target.checked)}
            />
            Solo alertas
          </label>
          <PdfDownload
            label="Imprimir registro PDF"
            apiPath="/api/inventario/registro"
            periodo={periodo}
          />
        </div>
      </div>

      <PeriodFilter basePath="/inventario" periodo={periodo} />
      <p className="text-sm text-fa-muted">
        {periodo.label}: {resumen.altas} altas · {resumen.bajas} bajas · {resumen.cambios}{" "}
        cambios · {resumen.compras} compras
      </p>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar producto"
        className="w-full max-w-sm rounded-[10px] border border-fa-border px-3 py-2 text-sm"
      />

      {canAdjust ? (
        <div className="space-y-4">
          <form
            className="grid gap-3 rounded-[10px] border border-fa-border bg-fa-surface p-4 sm:grid-cols-2 lg:grid-cols-4"
            onSubmit={(e) => {
              e.preventDefault();
              void registrar();
            }}
          >
            <h2 className="text-sm font-semibold text-fa-primary sm:col-span-2 lg:col-span-4">
              Registrar compra o producto
            </h2>
            <select
              value={modo}
              onChange={(e) => setModo(e.target.value as "existente" | "nuevo")}
              className="rounded-[10px] border border-fa-border px-2 py-2 text-sm"
            >
              <option value="existente">Producto existente</option>
              <option value="nuevo">Producto nuevo</option>
            </select>
            {modo === "existente" ? (
              <select
                value={sel}
                onChange={(e) => setSel(e.target.value)}
                className="rounded-[10px] border border-fa-border px-2 py-2 text-sm sm:col-span-1 lg:col-span-3"
              >
                {rows.length === 0 ? (
                  <option value="">No hay productos</option>
                ) : (
                  rows.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.nombre}
                    </option>
                  ))
                )}
              </select>
            ) : (
              <input
                value={nombreNuevo}
                onChange={(e) => setNombreNuevo(e.target.value)}
                placeholder="Nombre del producto"
                required
                className="rounded-[10px] border border-fa-border px-2 py-2 text-sm sm:col-span-1 lg:col-span-3"
              />
            )}
            <label className="text-sm">
              <span className="mb-1 block text-fa-muted">Fecha</span>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                required
                className="w-full rounded-[10px] border border-fa-border px-2 py-2 text-sm"
              />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block text-fa-muted">Entrada por</span>
              <TipoCampos
                tipo={tipoEntrada}
                custom={unidadCustom}
                onChange={(tipo, custom) => {
                  setTipoEntrada(tipo);
                  setUnidadCustom(custom);
                }}
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-fa-muted">
                Límite mínimo ({unidadEtiqueta})
              </span>
              <input
                type="number"
                min={0}
                step="0.001"
                value={stockMinimo}
                onChange={(e) => setStockMinimo(Number(e.target.value))}
                className="w-full rounded-[10px] border border-fa-border px-2 py-2 text-sm"
                placeholder="Alerta si baja de este nivel"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-fa-muted">Cantidad de ítems</span>
              <input
                type="number"
                min={0.001}
                step="0.001"
                value={cantidadItems}
                onChange={(e) => setCantidadItems(Number(e.target.value))}
                className="w-full rounded-[10px] border border-fa-border px-2 py-2 text-sm"
                placeholder="Ej. 2 sacos"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-fa-muted">
                Contenido por ítem ({unidadEtiqueta})
              </span>
              <input
                type="number"
                min={0.001}
                step="0.001"
                value={contenidoPorItem}
                onChange={(e) => setContenidoPorItem(Number(e.target.value))}
                className="w-full rounded-[10px] border border-fa-border px-2 py-2 text-sm"
                placeholder={
                  tipoEntrada === "LIBRA"
                    ? "Ej. 25 si cada saco pesa 25 lb"
                    : tipoEntrada === "KILO"
                      ? "Ej. 25 si cada saco pesa 25 kg"
                      : tipoEntrada === "LITRO"
                        ? "Ej. 1.5 si cada botella es 1.5 L"
                        : tipoEntrada === "OTRO"
                          ? "Ej. 1 o el contenido de cada ítem"
                          : "Ej. 1 o 12 si es un paquete"
                }
              />
            </label>
            <input
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Nota (opcional)"
              className="rounded-[10px] border border-fa-border px-2 py-2 text-sm sm:col-span-2"
            />
            <div className="flex flex-wrap items-center justify-between gap-2 sm:col-span-2 lg:col-span-4">
              <p className="text-sm text-fa-muted">
                {preview
                  ? `Total a sumar: ${preview} (${cantidadItems} × ${contenidoPorItem} ${unidadEtiqueta})`
                  : "Indica cantidad y contenido"}
              </p>
              <button
                type="submit"
                disabled={busy || (modo === "existente" && !sel)}
                className="rounded-[10px] bg-fa-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                Registrar
              </button>
            </div>
          </form>

          <form
            className="grid gap-2 rounded-[10px] border border-fa-border bg-fa-surface p-4 sm:grid-cols-5"
            onSubmit={(e) => {
              e.preventDefault();
              void ajustar();
            }}
          >
            <h2 className="text-sm font-semibold text-fa-primary sm:col-span-5">
              Ajuste de stock
            </h2>
            <select
              value={ajusteSel}
              onChange={(e) => setAjusteSel(e.target.value)}
              className="rounded-[10px] border border-fa-border px-2 py-2 text-sm sm:col-span-2"
            >
              {rows.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nombre}
                </option>
              ))}
            </select>
            <select
              value={ajusteTipo}
              onChange={(e) => setAjusteTipo(e.target.value as "ENTRADA" | "AJUSTE")}
              className="rounded-[10px] border border-fa-border px-2 py-2 text-sm"
            >
              <option value="ENTRADA">Entrada (+)</option>
              <option value="AJUSTE">Ajuste (+/−)</option>
            </select>
            <input
              type="number"
              step="0.001"
              value={ajusteCantidad}
              onChange={(e) => setAjusteCantidad(Number(e.target.value))}
              className="rounded-[10px] border border-fa-border px-2 py-2 text-sm"
              placeholder={
                ajusteRow
                  ? etiquetaVista(
                      tipoFromIngredient(ajusteRow.unidadMedida, ajusteRow.unidadEtiqueta),
                      customFromIngredient(ajusteRow.unidadMedida, ajusteRow.unidadEtiqueta),
                    )
                  : "Cantidad"
              }
            />
            <button
              type="submit"
              disabled={busy}
              className="rounded-[10px] bg-fa-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Aplicar
            </button>
            <input
              value={ajusteNota}
              onChange={(e) => setAjusteNota(e.target.value)}
              placeholder="Nota (opcional)"
              className="rounded-[10px] border border-fa-border px-2 py-2 text-sm sm:col-span-5"
            />
            <p className="text-xs text-fa-muted sm:col-span-5">
              La cantidad va en{" "}
              {ajusteRow
                ? etiquetaVista(
                    tipoFromIngredient(ajusteRow.unidadMedida, ajusteRow.unidadEtiqueta),
                    customFromIngredient(ajusteRow.unidadMedida, ajusteRow.unidadEtiqueta),
                  )
                : "la unidad del producto"}
              {ajusteTipo === "AJUSTE" ? " (negativo para restar)." : "."}
            </p>
          </form>
        </div>
      ) : (
        <p className="text-sm text-fa-muted">Solo administración puede registrar compras o cambiar productos.</p>
      )}

      {msg ? <p className="text-sm text-fa-muted">{msg}</p> : null}

      <div className="overflow-x-auto rounded-[10px] border border-fa-border bg-fa-surface">
        <table className="w-full text-left text-sm">
          <thead className="bg-fa-bg text-fa-muted">
            <tr>
              <th className="px-3 py-2">Producto</th>
              <th className="px-3 py-2">Stock</th>
              <th className="px-3 py-2">Entrada</th>
              <th className="px-3 py-2">Mínimo</th>
              {canAdjust ? <th className="px-3 py-2">Acciones</th> : null}
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr
                key={r.id}
                className={r.bajo ? "bg-red-50 text-red-900" : "border-t border-fa-border"}
              >
                <td className="px-3 py-2 font-medium">
                  {canAdjust ? (
                    <input
                      value={nombres[r.id] ?? r.nombre}
                      onChange={(e) =>
                        setNombres((prev) => ({ ...prev, [r.id]: e.target.value }))
                      }
                      className="w-full min-w-40 rounded-md border border-fa-border bg-white px-2 py-1 font-medium text-fa-text"
                    />
                  ) : (
                    r.nombre
                  )}
                </td>
                <td className="px-3 py-2">{r.etiqueta}</td>
                <td className="px-3 py-2">
                  {canAdjust ? (
                    <TipoCampos
                      tipo={
                        tiposFila[r.id] ??
                        tipoFromIngredient(r.unidadMedida, r.unidadEtiqueta)
                      }
                      custom={
                        customFila[r.id] ??
                        customFromIngredient(r.unidadMedida, r.unidadEtiqueta)
                      }
                      onChange={(tipo, custom) => {
                        setTiposFila((prev) => ({ ...prev, [r.id]: tipo }));
                        setCustomFila((prev) => ({ ...prev, [r.id]: custom }));
                      }}
                    />
                  ) : (
                    etiquetaVista(
                      tipoFromIngredient(r.unidadMedida, r.unidadEtiqueta),
                      customFromIngredient(r.unidadMedida, r.unidadEtiqueta),
                    )
                  )}
                </td>
                <td className="px-3 py-2">
                  {canAdjust ? (
                    <label className="flex items-center gap-1">
                      <input
                        type="number"
                        min={0}
                        step="0.001"
                        value={
                          minimos[r.id] ??
                          round3(
                            stockToDisplay(r.stockMinimo, r.unidadMedida, r.unidadEtiqueta),
                          )
                        }
                        onChange={(e) =>
                          setMinimos((prev) => ({
                            ...prev,
                            [r.id]: Number(e.target.value),
                          }))
                        }
                        className="w-24 rounded-md border border-fa-border bg-white px-2 py-1 text-fa-text"
                      />
                      <span className="text-xs text-fa-muted">
                        {etiquetaVista(
                          tiposFila[r.id] ??
                            tipoFromIngredient(r.unidadMedida, r.unidadEtiqueta),
                          customFila[r.id] ??
                            customFromIngredient(r.unidadMedida, r.unidadEtiqueta),
                        )}
                      </span>
                    </label>
                  ) : (
                    r.minimoEtiqueta
                  )}
                </td>
                {canAdjust ? (
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void guardar(r.id)}
                        className="rounded-md bg-fa-primary px-2 py-1 text-xs text-white"
                      >
                        Guardar
                      </button>
                      <button
                        type="button"
                        onClick={() => void borrar(r.id, r.nombre)}
                        className="rounded-md border border-red-300 px-2 py-1 text-xs text-red-700"
                      >
                        Borrar
                      </button>
                    </div>
                  </td>
                ) : null}
              </tr>
            ))}
            {visible.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-fa-muted" colSpan={canAdjust ? 5 : 4}>
                  No hay productos.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="overflow-x-auto rounded-[10px] border border-fa-border bg-fa-surface">
          <h2 className="border-b border-fa-border px-3 py-2 text-sm font-semibold text-fa-primary">
            Registro de altas, bajas y cambios · {periodo.label}
          </h2>
          <table className="w-full text-left text-sm">
            <thead className="bg-fa-bg text-fa-muted">
              <tr>
                <th className="px-3 py-2">Cuándo</th>
                <th className="px-3 py-2">Acción</th>
                <th className="px-3 py-2">Producto</th>
              </tr>
            </thead>
            <tbody>
              {audits.map((a) => (
                <tr key={a.id} className="border-t border-fa-border">
                  <td className="px-3 py-2 text-fa-muted">{a.createdAt}</td>
                  <td className="px-3 py-2">{ACCION_LABEL[a.accion]}</td>
                  <td className="px-3 py-2">
                    <span className="font-medium">{a.nombre}</span>
                    {a.detalle ? (
                      <span className="block text-xs text-fa-muted">{a.detalle}</span>
                    ) : null}
                    <span className="block text-xs text-fa-muted">{a.usuario}</span>
                  </td>
                </tr>
              ))}
              {audits.length === 0 ? (
                <tr>
                  <td className="px-3 py-4 text-fa-muted" colSpan={3}>
                    Aún no hay altas ni bajas.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className="overflow-x-auto rounded-[10px] border border-fa-border bg-fa-surface">
          <h2 className="border-b border-fa-border px-3 py-2 text-sm font-semibold text-fa-primary">
            Compras registradas · {periodo.label}
          </h2>
          <table className="w-full text-left text-sm">
            <thead className="bg-fa-bg text-fa-muted">
              <tr>
                <th className="px-3 py-2">Fecha</th>
                <th className="px-3 py-2">Producto</th>
                <th className="px-3 py-2">Cantidad</th>
              </tr>
            </thead>
            <tbody>
              {compras.map((c) => (
                <tr key={c.id} className="border-t border-fa-border">
                  <td className="px-3 py-2 text-fa-muted">{c.fecha}</td>
                  <td className="px-3 py-2">
                    <span className="font-medium">{c.producto}</span>
                    {c.nota ? (
                      <span className="block text-xs text-fa-muted">{c.nota}</span>
                    ) : null}
                    <span className="block text-xs text-fa-muted">{c.usuario}</span>
                  </td>
                  <td className="px-3 py-2">{c.etiqueta}</td>
                </tr>
              ))}
              {compras.length === 0 ? (
                <tr>
                  <td className="px-3 py-4 text-fa-muted" colSpan={3}>
                    Aún no hay compras.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
