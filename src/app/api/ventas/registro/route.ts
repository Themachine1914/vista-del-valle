import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { formatFechaCorta, toMoney } from "@/lib/money";
import { parsePeriodo } from "@/lib/period";
import { canRegisterSales } from "@/lib/roles";
import { buildVentasPdf, ventasPdfFilename } from "@/lib/ventas-pdf";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user || !canRegisterSales(session.user.role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const sp = Object.fromEntries(new URL(request.url).searchParams.entries());
  const periodo = parsePeriodo(sp);
  const range = { gte: periodo.gte, lt: periodo.lt };

  const [sales, users] = await Promise.all([
    prisma.sale.findMany({
      where: { fecha: range },
      include: {
        items: {
          include: { dish: true, garnish: true },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { fecha: "asc" },
    }),
    prisma.user.findMany({ select: { id: true, name: true } }),
  ]);

  const userMap = new Map(users.map((u) => [u.id, u.name]));
  let total = 0;
  let unidades = 0;
  const buckets = new Map<string, { total: number; unidades: number }>();
  const lineas: {
    fecha: string;
    turno: string;
    plato: string;
    garnish: string;
    cantidad: number;
    precio: number;
    total: number;
    camarero: string;
  }[] = [];

  for (const s of sales) {
    const iso = s.fecha.toISOString().slice(0, 10);
    const clave =
      periodo.modo === "dia"
        ? s.turno
        : periodo.modo === "anio"
          ? iso.slice(0, 7)
          : iso;
    for (const it of s.items) {
      const precio = toMoney(it.precioUnitario);
      const lineTotal = it.cantidad * precio;
      total += lineTotal;
      unidades += it.cantidad;
      const b = buckets.get(clave) ?? { total: 0, unidades: 0 };
      b.total += lineTotal;
      b.unidades += it.cantidad;
      buckets.set(clave, b);
      lineas.push({
        fecha: formatFechaCorta(s.fecha).slice(0, 10),
        turno: s.turno,
        plato: it.dish.nombre,
        garnish: it.garnish?.nombre ?? "",
        cantidad: it.cantidad,
        precio,
        total: lineTotal,
        camarero: it.userId ? (userMap.get(it.userId) ?? "") : "",
      });
    }
  }

  const TURNO_ORDEN = ["DESAYUNO", "ALMUERZO", "CENA"];
  const desglose = [...buckets.entries()]
    .map(([clave, v]) => ({ clave, ...v }))
    .sort((a, b) => {
      if (periodo.modo === "dia") {
        return TURNO_ORDEN.indexOf(a.clave) - TURNO_ORDEN.indexOf(b.clave);
      }
      return a.clave.localeCompare(b.clave);
    });

  const bytes = buildVentasPdf({
    generadoPor: session.user.name ?? session.user.email ?? "Staff",
    periodoLabel: periodo.label,
    desgloseModo: periodo.modo,
    total,
    unidades,
    desglose,
    lineas,
  });

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${ventasPdfFilename(periodo.desde, periodo.hasta)}"`,
      "Cache-Control": "no-store",
    },
  });
}
