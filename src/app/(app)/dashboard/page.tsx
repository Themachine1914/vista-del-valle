import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { formatRD, toMoney } from "@/lib/money";
import { homeForRole, isAdmin } from "@/lib/roles";
import { redirect } from "next/navigation";
import { DashboardCharts } from "@/components/app/DashboardCharts";
import { LiveRefresh } from "@/components/app/LiveRefresh";

export const dynamic = "force-dynamic";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.role)) {
    redirect(session?.user ? homeForRole(session.user.role) : "/login");
  }

  const [y, m, d] = todayISO().split("-").map(Number);
  const today = new Date(Date.UTC(y, m - 1, d));

  const [sales, byCategory] = await Promise.all([
    prisma.sale.findMany({
      include: { items: true },
      orderBy: { fecha: "asc" },
    }),
    prisma.saleItem.groupBy({
      by: ["dishId"],
      _sum: { cantidad: true, precioUnitario: true },
    }),
  ]);

  const low = await prisma.ingredient.findMany();
  const alertas = low.filter(
    (i) => toMoney(i.stockActual) < toMoney(i.stockMinimo),
  );

  const dailyMap = new Map<string, number>();
  for (const sale of sales) {
    const key = sale.fecha.toISOString().slice(0, 10);
    const total = sale.items.reduce(
      (acc, it) => acc + it.cantidad * toMoney(it.precioUnitario),
      0,
    );
    dailyMap.set(key, (dailyMap.get(key) ?? 0) + total);
  }
  const daily = [...dailyMap.entries()].map(([fecha, total]) => ({
    fecha,
    total,
  }));

  const dishes = await prisma.dish.findMany({
    include: { category: true },
  });
  const dishMap = new Map(dishes.map((d) => [d.id, d]));

  const ranked = byCategory
    .map((row) => {
      const dish = dishMap.get(row.dishId);
      return {
        nombre: dish?.nombre ?? row.dishId,
        categoria: dish?.category.nombre ?? "",
        unidades: row._sum.cantidad ?? 0,
        ingreso: (row._sum.cantidad ?? 0) * 0,
      };
    })
    .sort((a, b) => b.unidades - a.unidades);

  const ingresos = await prisma.saleItem.findMany({
    include: { dish: { include: { category: true } } },
  });
  const catTotals = new Map<string, number>();
  let grand = 0;
  for (const it of ingresos) {
    const t = it.cantidad * toMoney(it.precioUnitario);
    grand += t;
    const name = it.dish.category.nombre;
    catTotals.set(name, (catTotals.get(name) ?? 0) + t);
  }
  const categoryChart = [...catTotals.entries()]
    .map(([nombre, total]) => ({ nombre, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  const top = ranked.slice(0, 10);
  const bottom = [...ranked].filter((r) => r.unidades > 0).slice(-10).reverse();

  const users = await prisma.user.findMany({ select: { id: true, name: true } });
  const userMap = new Map(users.map((u) => [u.id, u.name]));
  const todayKey = today.toISOString().slice(0, 10);
  const todaysSales = sales.filter(
    (s) => s.fecha.toISOString().slice(0, 10) === todayKey,
  );
  const liveItems = todaysSales
    .flatMap((s) =>
      s.items.map((it) => ({
        id: it.id,
        cantidad: it.cantidad,
        total: it.cantidad * toMoney(it.precioUnitario),
        nombre: dishMap.get(it.dishId)?.nombre ?? it.dishId,
        garnish: it.garnishId ? (dishMap.get(it.garnishId)?.nombre ?? null) : null,
        turno: s.turno,
        camarero: it.userId ? (userMap.get(it.userId) ?? null) : null,
      })),
    )
    .reverse()
    .slice(0, 20);
  const totalHoy = todaysSales.reduce(
    (acc, s) =>
      acc + s.items.reduce((a, it) => a + it.cantidad * toMoney(it.precioUnitario), 0),
    0,
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold text-fa-primary">Dashboard</h1>
          <p className="text-sm text-fa-muted">
            Lo que marca el camarero aparece aquí al momento.
          </p>
        </div>
        <LiveRefresh />
      </div>

      <section className="rounded-[10px] border border-fa-border bg-fa-surface p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-medium text-fa-primary">Hoy</h2>
          <p className="text-lg font-semibold text-fa-primary">{formatRD(totalHoy)}</p>
        </div>
        {liveItems.length === 0 ? (
          <p className="mt-3 text-sm text-fa-muted">Aún no hay ventas registradas hoy.</p>
        ) : (
          <ul className="mt-3 divide-y divide-fa-border text-sm">
            {liveItems.slice(0, 20).map((it) => (
              <li key={it.id} className="flex justify-between gap-3 py-2">
                <span>
                  {it.cantidad}× {it.nombre}
                  {it.garnish ? ` + ${it.garnish}` : ""}
                  <span className="block text-xs text-fa-muted">
                    {it.turno}
                    {it.camarero ? ` · ${it.camarero}` : ""}
                  </span>
                </span>
                <span className="font-medium">{formatRD(it.total)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Ventas del período" value={formatRD(grand)} />
        <Stat label="Días con registro" value={String(dailyMap.size)} />
        <Stat
          label="Ingredientes bajo mínimo"
          value={String(alertas.length)}
          alert={alertas.length > 0}
        />
      </div>

      {alertas.length > 0 ? (
        <section className="rounded-[10px] border border-red-200 bg-red-50 p-4">
          <h2 className="font-medium text-red-800">Alertas de stock</h2>
          <ul className="mt-2 grid gap-1 text-sm text-red-900 sm:grid-cols-2">
            {alertas.slice(0, 12).map((i) => (
              <li key={i.id}>
                {i.nombre}: {toMoney(i.stockActual)} / mín. {toMoney(i.stockMinimo)}{" "}
                {i.unidadMedida.toLowerCase()}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <DashboardCharts daily={daily} byCategory={categoryChart} />

      <div className="grid gap-6 md:grid-cols-2">
        <RankTable title="Top 10 más vendidos" rows={top} />
        <RankTable title="Top 10 menos vendidos" rows={bottom} />
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  alert,
}: {
  label: string;
  value: string;
  alert?: boolean;
}) {
  return (
    <div className="rounded-[10px] border border-fa-border bg-fa-surface p-4">
      <p className="text-sm text-fa-muted">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${alert ? "text-red-700" : "text-fa-primary"}`}>
        {value}
      </p>
    </div>
  );
}

function RankTable({
  title,
  rows,
}: {
  title: string;
  rows: { nombre: string; categoria: string; unidades: number }[];
}) {
  return (
    <section className="rounded-[10px] border border-fa-border bg-fa-surface p-4">
      <h2 className="font-medium text-fa-primary">{title}</h2>
      <ol className="mt-3 space-y-2 text-sm">
        {rows.map((r, i) => (
          <li key={r.nombre} className="flex justify-between gap-3">
            <span>
              {i + 1}. {r.nombre}
              <span className="block text-xs text-fa-muted">{r.categoria}</span>
            </span>
            <span className="font-medium">{r.unidades} ud</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
