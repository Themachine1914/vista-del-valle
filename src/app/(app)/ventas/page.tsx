import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { toMoney } from "@/lib/money";
import { canRegisterSales, homeForRole } from "@/lib/roles";
import { redirect } from "next/navigation";
import { VentasClient, type DishOption, type SaleLine } from "@/components/app/VentasClient";

export const dynamic = "force-dynamic";

function todayISO() {
  const n = new Date();
  return n.toISOString().slice(0, 10);
}

export default async function VentasPage({
  searchParams,
}: {
  searchParams: Promise<{ fecha?: string; turno?: string }>;
}) {
  const session = await auth();
  if (!session?.user || !canRegisterSales(session.user.role)) {
    redirect(session?.user ? homeForRole(session.user.role) : "/login");
  }

  const sp = await searchParams;
  const fecha = sp.fecha && /^\d{4}-\d{2}-\d{2}$/.test(sp.fecha) ? sp.fecha : todayISO();
  const turno =
    sp.turno === "DESAYUNO" || sp.turno === "CENA" || sp.turno === "ALMUERZO"
      ? sp.turno
      : "ALMUERZO";

  const [y, m, d] = fecha.split("-").map(Number);
  const day = new Date(Date.UTC(y, m - 1, d));

  const [dishes, sale, users] = await Promise.all([
    prisma.dish.findMany({
      where: { disponible: true },
      include: { category: true },
      orderBy: [{ category: { orden: "asc" } }, { nombre: "asc" }],
    }),
    prisma.sale.findUnique({
      where: { fecha_turno: { fecha: day, turno } },
      include: {
        items: {
          include: { dish: true, garnish: true },
          orderBy: { id: "desc" },
        },
      },
    }),
    prisma.user.findMany({ select: { id: true, name: true } }),
  ]);

  const options: DishOption[] = dishes.map((d) => ({
    id: d.id,
    nombre: d.nombre,
    precio: d.precio === null ? null : toMoney(d.precio),
    categoryId: d.categoryId,
    categoryNombre: d.category.nombre,
    esInterna: d.category.esInterna,
    incluyeGuarnicion: d.incluyeGuarnicion,
  }));

  const garnishes = options.filter((d) => d.categoryId === "guarniciones");

  const userMap = new Map(users.map((u) => [u.id, u.name]));
  const lines: SaleLine[] =
    sale?.items.map((it) => ({
      id: it.id,
      nombre: it.dish.nombre,
      cantidad: it.cantidad,
      precioUnitario: toMoney(it.precioUnitario),
      garnish: it.garnish?.nombre ?? null,
      camarero: it.userId ? (userMap.get(it.userId) ?? null) : null,
    })) ?? [];

  const totalDiaRows = await prisma.sale.findMany({
    where: { fecha: day },
    include: { items: true },
  });
  const totalDia = totalDiaRows.reduce(
    (acc, s) =>
      acc +
      s.items.reduce((a, it) => a + it.cantidad * toMoney(it.precioUnitario), 0),
    0,
  );

  return (
      <VentasClient
        fecha={fecha}
        turno={turno}
        dishes={options}
        garnishes={garnishes}
        lines={lines}
        totalDia={totalDia}
      />
  );
}
