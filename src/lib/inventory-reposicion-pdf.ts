import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatFechaCorta, formatRD, todayISO } from "./money";

export type ReposicionPdfLinea = {
  nombre: string;
  estado: "Agotado" | "Bajo mínimo";
  stock: string;
  minimo: string;
  falta: string;
  precioUnitario: string;
  costoAprox: string;
};

const PRIMARY: [number, number, number] = [11, 58, 110];
const MUTED: [number, number, number] = [71, 85, 105];
const HEAD_TEXT: [number, number, number] = [255, 255, 255];
const ALT_ROW: [number, number, number] = [248, 250, 252];

export function buildInventarioReposicionPdf(input: {
  lineas: ReposicionPdfLinea[];
  generadoPor: string;
  totalAprox: number;
  sinPrecio: number;
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
  doc.text("Lista de reposición", 14, 25);
  doc.setFontSize(9);
  doc.text(`Generado: ${fecha}  ·  ${input.generadoPor}`, 14, 31);
  doc.text(
    `Total aproximado a comprar: ${formatRD(input.totalAprox)}${
      input.sinPrecio > 0
        ? `  ·  ${input.sinPrecio} producto(s) sin precio registrado (no incluidos en el total)`
        : ""
    }`,
    14,
    36,
  );

  autoTable(doc, {
    startY: 42,
    head: [["Producto", "Estado", "Stock", "Mínimo", "Falta", "RD$/unidad", "Costo aprox."]],
    body:
      input.lineas.length === 0
        ? [["—", "—", "—", "—", "—", "—", "Nada por debajo del mínimo"]]
        : input.lineas.map((l) => [
            l.nombre,
            l.estado,
            l.stock,
            l.minimo,
            l.falta,
            l.precioUnitario,
            l.costoAprox,
          ]),
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 1.6, textColor: [15, 23, 42] },
    headStyles: { fillColor: PRIMARY, textColor: HEAD_TEXT, fontStyle: "bold" },
    alternateRowStyles: { fillColor: ALT_ROW },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 1 && data.cell.raw === "Agotado") {
        data.cell.styles.textColor = [153, 27, 27];
        data.cell.styles.fontStyle = "bold";
      }
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

export function reposicionPdfFilename(): string {
  return `reposicion-inventario-${todayISO()}.pdf`;
}
