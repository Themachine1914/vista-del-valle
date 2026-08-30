/**
 * Genera un PDF corto con lo que TODAVÍA falta confirmar del recetario, después de que la mayoría
 * de las recetas (v3) ya quedaron cargadas en el sistema (ver scripts/aplicar-recetario-real.ts).
 * No repite lo ya resuelto — solo los puntos que siguen abiertos.
 *
 * Uso: npx tsx scripts/generar-pendientes-validacion.ts
 */
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { writeFileSync } from "fs";
import { join } from "path";

const PRIMARY: [number, number, number] = [11, 58, 110];
const MUTED: [number, number, number] = [71, 85, 105];
const HEAD_TEXT: [number, number, number] = [255, 255, 255];
const ALT_ROW: [number, number, number] = [248, 250, 252];
const ACCENT: [number, number, number] = [180, 83, 9];

type Pendiente = { titulo: string; detalle: string; porQue: string };

const pendientes: Pendiente[] = [
  {
    titulo: "Porción de conejo (Conejo con Salsa de Romero)",
    detalle:
      "Aún no está definido cuánto conejo crudo lleva la porción. El dato de \"20 lb rinden 25 servicios\" NO aplica aquí — corresponde a costilla de chivo, no a conejo.",
    porQue: "Sin este dato, el sistema sigue usando el valor anterior (350 g) sin confirmar.",
  },
  {
    titulo: "Salsa chimichurri (Filete de Res a la Parrilla)",
    detalle:
      "No existe ninguna receta de esta salsa en las notas originales. Falta por completo: ingredientes y cantidades.",
    porQue: "El plato está cargado en el sistema sin la salsa — solo con la carne.",
  },
  {
    titulo: "Base de Lambí (\"rinde 22\")",
    detalle:
      "No se sabe de cuánto lambí crudo sale ese rendimiento, ni si \"22\" son porciones o unidades.",
    porQue: "No se pudo cargar ninguna cantidad de lambí crudo por porción.",
  },
  {
    titulo: "Unidades de Balitas de Queso",
    detalle:
      "Falta el tamaño real del bloque de queso mozzarella y la cantidad de miga de pan (\"0.15\" sin unidad).",
    porQue: "La receta cargada en el sistema sigue siendo la anterior, sin actualizar.",
  },
  {
    titulo: "Unidades de Croquetas de Pollo",
    detalle: "\"2.90 de pechuga\" y \"1 1/2 de harina\" no dicen la unidad (¿libras?).",
    porQue: "La receta cargada en el sistema sigue siendo la anterior, sin actualizar.",
  },
  {
    titulo: "Unidades de Hamburguesa de Res (la carne, no las papas)",
    detalle: "\"1/2 de miga de pan\" no dice la unidad.",
    porQue: "Solo se corrigió la papa frita del lado (0.65 lb); la carne de la hamburguesa sigue con la receta anterior.",
  },
  {
    titulo: "Rendimiento total de la Salsa del Bosque",
    detalle:
      "No se sabe cuántas oz o galones produce la receta completa de esta salsa.",
    porQue: "Sin este dato no se puede calcular el costo por porción de los platos que la usan (Ajillo, Salmón, ambos Asopaos, Arroz con Mariscos).",
  },
  {
    titulo: "NUEVO — Porción de Salsa del Rey por plato",
    detalle:
      "El recetario solo da la proporción del LOTE (4 oz de cada componente: morrón, cebollín, ají cubanela, parmesano, vino, base Alfredo). No dice cuánto va servido en un plato de \"Pechuga con Salsa del Rey\".",
    porQue: "Al cargarlo al sistema usé 4 oz por plato por consistencia con las demás salsas (Bosque, Tamarindo, Blue Cheese), pero es una suposición mía, no algo que el cocinero haya confirmado.",
  },
];

function main() {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const dia = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santo_Domingo" }).format(new Date());
  const fechaLegible = new Intl.DateTimeFormat("es-DO", {
    timeZone: "America/Santo_Domingo",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date());

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...PRIMARY);
  doc.text("Vista del Valle", 14, 22);

  doc.setFontSize(14);
  doc.setTextColor(...MUTED);
  doc.text("Recetario — Pendientes de Validación", 14, 31);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Generado: ${fechaLegible}`, 14, 38);

  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59);
  const intro = [
    "La mayoría de las recetas del recetario ya quedaron validadas y cargadas en el sistema (23 platos",
    "actualizados, 5 salsas nuevas registradas como producto). Este documento no repite eso — solo",
    "lista lo que TODAVÍA necesita que el cocinero confirme antes de poder terminar de cargarlo.",
  ];
  let y = 45;
  for (const line of intro) {
    doc.text(line, 14, y);
    y += 5;
  }

  y += 6;
  autoTable(doc, {
    startY: y,
    margin: { left: 14, right: 14 },
    head: [["Punto pendiente", "Qué falta", "Por qué importa"]],
    body: pendientes.map((p) => [p.titulo, p.detalle, p.porQue]),
    theme: "grid",
    styles: { fontSize: 8.5, cellPadding: 2.2, textColor: [15, 23, 42], valign: "top" },
    headStyles: { fillColor: PRIMARY, textColor: HEAD_TEXT, fontStyle: "bold" },
    alternateRowStyles: { fillColor: ALT_ROW },
    columnStyles: {
      0: { cellWidth: 42, fontStyle: "bold" },
      2: { cellWidth: 44 },
    },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 0 && String(data.cell.raw).startsWith("NUEVO")) {
        data.cell.styles.textColor = ACCENT;
      }
    },
  });

  const finalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable!.finalY + 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59);
  doc.text("Nombre del cocinero: _________________________________________________", 14, finalY);
  doc.text(
    "Firma: ________________________________________     Fecha: _____________________",
    14,
    finalY + 14,
  );

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i += 1) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(
      `Vista del Valle · Recetario · pendientes de validación · ${dia} · ${i}/${pages}`,
      14,
      doc.internal.pageSize.getHeight() - 8,
    );
  }

  const outPath = join(process.cwd(), "Receta", "Recetario Vista del Valle - Pendientes.pdf");
  writeFileSync(outPath, Buffer.from(doc.output("arraybuffer")));
  console.log(`PDF generado en: ${outPath}`);
}

main();
