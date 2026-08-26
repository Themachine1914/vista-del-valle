import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatFechaCorta, todayISO } from "./money";

export type RegistroPdfAudit = {
  createdAt: string;
  accion: string;
  nombre: string;
  detalle: string;
  usuario: string;
};

export type RegistroPdfCompra = {
  fecha: string;
  producto: string;
  etiqueta: string;
  precio: string;
  unitario: string;
  nota: string;
  usuario: string;
};

export type RegistroPdfStock = {
  nombre: string;
  stock: string;
  minimo: string;
};

const ACCION: Record<string, string> = {
  ALTA: "Alta",
  BAJA: "Baja",
  RENOMBRE: "Cambio",
  RESET: "Cero",
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

export function buildInventarioRegistroPdf(input: {
  audits: RegistroPdfAudit[];
  compras: RegistroPdfCompra[];
  stock: RegistroPdfStock[];
  generadoPor: string;
  periodoLabel?: string;
}): ArrayBuffer {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const fecha = formatFechaCorta(new Date());
  const dia = todayISO();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...PRIMARY);
  doc.text("Vista del Valle", 14, 18);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(...MUTED);
  doc.text("Registro de inventario", 14, 25);
  doc.setFontSize(9);
  doc.text(
    `Periodo: ${input.periodoLabel ?? "todo"}  ·  Generado: ${fecha}  ·  ${input.generadoPor}`,
    14,
    31,
  );

  autoTable(doc, {
    startY: 38,
    head: [["Cuándo", "Acción", "Producto", "Detalle", "Usuario"]],
    body:
      input.audits.length === 0
        ? [["—", "—", "Sin altas ni bajas", "—", "—"]]
        : input.audits.map((a) => [
            a.createdAt,
            ACCION[a.accion] ?? a.accion,
            a.nombre,
            a.detalle,
            a.usuario,
          ]),
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 1.6, textColor: [15, 23, 42] },
    headStyles: { fillColor: PRIMARY, textColor: HEAD_TEXT, fontStyle: "bold" },
    alternateRowStyles: { fillColor: ALT_ROW },
    columnStyles: {
      0: { cellWidth: 32 },
      1: { cellWidth: 18 },
      2: { cellWidth: 40 },
      3: { cellWidth: 62 },
      4: { cellWidth: 28 },
    },
  });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...PRIMARY);
  doc.text("Compras registradas", 14, tableStartY(doc) - 4);

  autoTable(doc, {
    startY: tableStartY(doc),
    head: [["Fecha", "Producto", "Cantidad", "Precio", "RD$/ud"]],
    body:
      input.compras.length === 0
        ? [["—", "Sin compras", "—", "—", "—"]]
        : input.compras.map((c) => [
            c.fecha,
            c.nota ? `${c.producto}\n${c.nota}` : c.producto,
            c.etiqueta,
            c.precio,
            c.unitario,
          ]),
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 1.6, textColor: [15, 23, 42] },
    headStyles: { fillColor: PRIMARY, textColor: HEAD_TEXT, fontStyle: "bold" },
    alternateRowStyles: { fillColor: ALT_ROW },
    columnStyles: {
      0: { cellWidth: 32 },
      1: { cellWidth: 48 },
      2: { cellWidth: 28 },
      3: { cellWidth: 32 },
      4: { cellWidth: 40 },
    },
  });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...PRIMARY);
  doc.text("Stock actual", 14, tableStartY(doc) - 4);

  autoTable(doc, {
    startY: tableStartY(doc),
    head: [["Producto", "Stock", "Mínimo"]],
    body: input.stock.map((s) => [s.nombre, s.stock, s.minimo]),
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 1.6, textColor: [15, 23, 42] },
    headStyles: { fillColor: PRIMARY, textColor: HEAD_TEXT, fontStyle: "bold" },
    alternateRowStyles: { fillColor: ALT_ROW },
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

export function registroPdfFilename(): string {
  return `registro-inventario-${todayISO()}.pdf`;
}
