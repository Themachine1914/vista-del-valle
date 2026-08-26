import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatFechaCorta, formatRD, todayISO } from "./money";
import { etiquetaDesglose, TURNO_LABEL } from "./ventas-desglose";

export type VentasPdfDesglose = {
  clave: string;
  unidades: number;
  total: number;
};

export type VentasPdfLinea = {
  fecha: string;
  turno: string;
  plato: string;
  garnish: string;
  cantidad: number;
  precio: number;
  total: number;
  camarero: string;
};

const PRIMARY: [number, number, number] = [11, 58, 110];
const MUTED: [number, number, number] = [71, 85, 105];
const HEAD_TEXT: [number, number, number] = [255, 255, 255];
const ALT_ROW: [number, number, number] = [248, 250, 252];

function tableStartY(doc: jsPDF): number {
  const last = (
    doc as jsPDF & { lastAutoTable?: { finalY: number } }
  ).lastAutoTable;
  return (last?.finalY ?? 36) + 12;
}

export function buildVentasPdf(input: {
  generadoPor: string;
  periodoLabel: string;
  desgloseModo: "dia" | "mes" | "anio" | "rango";
  total: number;
  unidades: number;
  desglose: VentasPdfDesglose[];
  lineas: VentasPdfLinea[];
}): ArrayBuffer {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const fecha = formatFechaCorta(new Date());
  const dia = todayISO();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...PRIMARY);
  doc.text("Vista del Valle", 14, 16);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(...MUTED);
  doc.text("Registro de ventas", 14, 23);
  doc.setFontSize(9);
  doc.text(
    `Periodo: ${input.periodoLabel}  ·  Total: ${formatRD(input.total)}  ·  ${input.unidades} platos y bebidas  ·  ${fecha}  ·  ${input.generadoPor}`,
    14,
    29,
  );

  const colDesglose =
    input.desgloseModo === "dia" ? "Turno" : input.desgloseModo === "anio" ? "Mes" : "Día";

  autoTable(doc, {
    startY: 34,
    head: [[colDesglose, "Unidades", "Total"]],
    body:
      input.desglose.length === 0
        ? [["—", "0", "Sin ventas"]]
        : input.desglose.map((row) => [
            etiquetaDesglose(row.clave, input.desgloseModo),
            String(row.unidades),
            formatRD(row.total),
          ]),
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 1.6, textColor: [15, 23, 42] },
    headStyles: { fillColor: PRIMARY, textColor: HEAD_TEXT, fontStyle: "bold" },
    alternateRowStyles: { fillColor: ALT_ROW },
  });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...PRIMARY);
  doc.text("Detalle", 14, tableStartY(doc) - 4);

  autoTable(doc, {
    startY: tableStartY(doc),
    head: [["Fecha", "Turno", "Plato", "Guarnición", "Cant.", "Precio", "Total", "Camarero"]],
    body:
      input.lineas.length === 0
        ? [["—", "—", "Sin ventas en este periodo", "—", "—", "—", "—", "—"]]
        : input.lineas.map((l) => [
            l.fecha,
            TURNO_LABEL[l.turno] ?? l.turno,
            l.plato,
            l.garnish || "—",
            String(l.cantidad),
            formatRD(l.precio),
            formatRD(l.total),
            l.camarero || "—",
          ]),
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 1.4, textColor: [15, 23, 42] },
    headStyles: { fillColor: PRIMARY, textColor: HEAD_TEXT, fontStyle: "bold" },
    alternateRowStyles: { fillColor: ALT_ROW },
    columnStyles: {
      0: { cellWidth: 32 },
      1: { cellWidth: 24 },
      4: { cellWidth: 16 },
      5: { cellWidth: 26 },
      6: { cellWidth: 28 },
      7: { cellWidth: 32 },
    },
  });

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i += 1) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(
      `Vista del Valle  ·  ${dia}  ·  ${i}/${pages}`,
      14,
      doc.internal.pageSize.getHeight() - 8,
    );
  }

  return doc.output("arraybuffer");
}

export function ventasPdfFilename(desde: string, hasta: string): string {
  return desde === hasta ? `ventas-${desde}.pdf` : `ventas-${desde}-a-${hasta}.pdf`;
}
