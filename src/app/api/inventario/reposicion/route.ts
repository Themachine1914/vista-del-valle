import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  buildInventarioReposicionPdf,
  reposicionPdfFilename,
  type ReposicionPdfLinea,
} from "@/lib/inventory-reposicion-pdf";
import { ultimasComprasPorProducto, valorAlPrecio, type MovimientoPrecio } from "@/lib/inventory-precio";
import { formatRD, formatRDUnitario, formatStockCompra, toMoney } from "@/lib/money";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role === "CAMARERO") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const [stock, entradas] = await Promise.all([
    prisma.ingredient.findMany({ orderBy: { nombre: "asc" } }),
    prisma.inventoryMovement.findMany({
      where: { tipo: "ENTRADA" },
      orderBy: [{ fecha: "desc" }, { createdAt: "desc" }],
      include: {
        ingredient: { select: { unidadMedida: true, unidadEtiqueta: true } },
      },
    }),
  ]);

  const historial: MovimientoPrecio[] = entradas.map((m) => ({
    id: m.id,
    ingredientId: m.ingredientId,
    cantidad: toMoney(m.cantidad),
    precioTotal: m.precioTotal == null ? null : toMoney(m.precioTotal),
    fecha: m.fecha,
    createdAt: m.createdAt,
    unidadMedida: m.ingredient.unidadMedida,
    unidadEtiqueta: m.ingredient.unidadEtiqueta,
  }));
  const ultimas = ultimasComprasPorProducto(historial);

  const bajoMinimo = stock.filter(
    (i) => toMoney(i.stockActual) < toMoney(i.stockMinimo),
  );

  let totalAprox = 0;
  let sinPrecio = 0;
  const lineas: ReposicionPdfLinea[] = bajoMinimo.map((i) => {
    const stockNum = toMoney(i.stockActual);
    const minimoNum = toMoney(i.stockMinimo);
    const faltaInterna = minimoNum - stockNum;
    const ultima = ultimas[i.id];
    const costo = ultima
      ? valorAlPrecio(faltaInterna, ultima.unitario, i.unidadMedida, i.unidadEtiqueta)
      : null;
    if (costo == null) {
      sinPrecio += 1;
    } else {
      totalAprox += costo;
    }
    return {
      nombre: i.nombre,
      estado: stockNum <= 0 ? "Agotado" : "Bajo mínimo",
      stock: formatStockCompra(i.stockActual, i.unidadMedida, i.unidadEtiqueta),
      minimo: formatStockCompra(i.stockMinimo, i.unidadMedida, i.unidadEtiqueta),
      falta: formatStockCompra(faltaInterna, i.unidadMedida, i.unidadEtiqueta),
      precioUnitario: ultima
        ? `${formatRDUnitario(ultima.unitario)} / ${ultima.etiquetaUnidad}`
        : "sin precio",
      costoAprox: costo == null ? "—" : formatRD(costo),
    };
  });

  const bytes = buildInventarioReposicionPdf({
    lineas,
    generadoPor: session.user.name ?? session.user.email ?? "Staff",
    totalAprox,
    sinPrecio,
  });

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${reposicionPdfFilename()}"`,
      "Cache-Control": "no-store",
    },
  });
}
