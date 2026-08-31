/**
 * Lista lo que hay que pedirle al cocinero, cruzando la carta con las recetas del cuaderno.
 *
 *   npx tsx scripts/generar-recetas-faltantes.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  categories,
  dishes,
  historicalUnits,
  recipes,
} from "../prisma/catalog";

const COCINA = new Set([
  "entradas",
  "especialidades",
  "cortes",
  "ensaladas",
  "caldos",
  "picaderas",
  "pastas",
  "arroces",
  "pescados",
  "postres",
  "guarniciones",
  "desayunos",
  "salsas",
]);

/** Recetas que ya existen pero el cuaderno dejó un hueco. */
const INCOMPLETAS: { id: string; pedir: string }[] = [
  { id: "salsa-alfredo-blanca", pedir: "Ingredientes y cantidades del galón (el cuaderno solo dice que rinde 18 pastas o 26 pechugas)" },
  { id: "salsa-del-rey", pedir: "Cantidades del lote (morrón, cebolla, ají habanero, parmesano, vino)" },
  { id: "salsa-blue-cheese", pedir: "Cuánto queso azul lleva el lote" },
  { id: "salsa-del-bosque", pedir: "Cuántos oz o galones rinde el lote" },
  { id: "conejo", pedir: "Peso de la porción de conejo (ahora está 8 oz por analogía con los filetes)" },
  { id: "filete-res-parrilla", pedir: "Receta de chimichurri: ingredientes y cantidades" },
];

const SALSAS_PEDIR = [
  ["Chimichurri", "Filete de res a la parrilla"],
  ["BBQ de la casa", "Costillas de cerdo"],
  ["Mostaza y especias", "Filete de cerdo en salsa de mostaza"],
  ["Finas hierbas", "Ribeye"],
  ["Salsa de almendras", "Camarones rostizados"],
  ["Salsa criolla", "Lambí y camarones a la criolla"],
  ["Salsa de la casa", "Chivo del Valle y gallina criolla"],
  ["Vinagreta", "Lambí a la vinagreta"],
  ["Alfredo / crema blanca", "Ya hay rendimiento; faltan los ingredientes del galón"],
];

const PRIMARY: [number, number, number] = [11, 58, 110];
const MUTED: [number, number, number] = [71, 85, 105];

const recipeIds = new Set(recipes.map((r) => r.dishId));
const catNombre = Object.fromEntries(categories.map((c) => [c.id, c.nombre]));
const dishById = Object.fromEntries(dishes.map((d) => [d.id, d]));

const cocinaDishes = dishes.filter((d) => COCINA.has(d.categoryId));
const conReceta = cocinaDishes.filter((d) => recipeIds.has(d.id));
const sinReceta = cocinaDishes.filter((d) => !recipeIds.has(d.id));

function ventas(id: string): number {
  return historicalUnits[id] ?? 0;
}

function porCategoria(lista: typeof dishes) {
  const groups: { categoryId: string; nombre: string; items: typeof dishes }[] = [];
  const seen = new Set<string>();
  for (const d of lista) {
    if (!seen.has(d.categoryId)) {
      seen.add(d.categoryId);
      groups.push({
        categoryId: d.categoryId,
        nombre: catNombre[d.categoryId] ?? d.categoryId,
        items: lista.filter((x) => x.categoryId === d.categoryId),
      });
    }
  }
  return groups;
}

const prioritarios = [...sinReceta].sort((a, b) => ventas(b.id) - ventas(a.id)).slice(0, 15);

function mdEscape(s: string) {
  return s.replace(/\|/g, "\\|");
}

function buildMarkdown() {
  const fecha = new Intl.DateTimeFormat("es-DO", {
    timeZone: "America/Santo_Domingo",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  const lines: string[] = [
    "# Recetas que hay que pedirle al cocinero",
    "",
    `Vista del Valle - ${fecha}`,
    "",
    "Cruce de la **carta impresa** con lo que ya está en el cuaderno de cocina. Esto no es para inventar recetas: es la lista para que el cocinero las anote.",
    "",
    "## Cómo anotar cada receta",
    "",
    "Para cada plato o salsa, por favor escribir:",
    "",
    "1. **Porción** de proteína o pieza (oz, lb o unidades).",
    "2. **Cada ingrediente con cantidad** (g, oz, cucharada, unidad, lata, paquete).",
    "3. **Qué salsa usa** y cuántas oz van en el plato.",
    "4. Si la salsa es de **lote**: receta del lote y cuánto rinde (galón, oz, platos).",
    "",
    `En el sistema ya hay **${conReceta.length} recetas** del cuaderno (platos, guarniciones y salsas). Faltan **${sinReceta.length}** de la carta de cocina. Además, **${INCOMPLETAS.length}** recetas del cuaderno están incompletas.`,
    "",
    "## 1. Completar lo que ya empezamos",
    "",
    "Estas recetas ya están cargadas. Solo falta un dato.",
    "",
    "| Plato / salsa | Qué hay que preguntar |",
    "|---|---|",
  ];

  for (const row of INCOMPLETAS) {
    const nombre = dishById[row.id]?.nombre ?? row.id;
    lines.push(`| ${mdEscape(nombre)} | ${mdEscape(row.pedir)} |`);
  }

  lines.push(
    "",
    "## 2. Pedir primero (los que más se venden y no tienen receta)",
    "",
    "Unidades vendidas junio-julio 2026. Empezar por arriba.",
    "",
    "| # | Plato | Sección | Ventas |",
    "|---|---|---|---|",
  );

  prioritarios.forEach((d, i) => {
    lines.push(`| ${i + 1} | ${mdEscape(d.nombre)} | ${mdEscape(catNombre[d.categoryId] ?? "")} | ${ventas(d.id)} |`);
  });

  lines.push(
    "",
    "## 3. Salsas que hay que pedir",
    "",
    "Además de las salsas del cuaderno (tamarindo, Bosque, ajillo, pomodoro, romero), la carta nombra estas y no tienen receta:",
    "",
    "| Salsa | Se usa en |",
    "|---|---|",
  );
  for (const [salsa, uso] of SALSAS_PEDIR) {
    lines.push(`| ${salsa} | ${uso} |`);
  }

  lines.push(
    "",
    "## 4. Toda la carta de cocina sin receta",
    "",
    "No incluye tragos, vinos, cervezas ni refrescos (eso es barra). Tampoco menú de empleados ni huéspedes.",
    "",
  );

  for (const group of porCategoria(sinReceta)) {
    lines.push(`### ${group.nombre}`, "");
    lines.push("| Plato | Ventas jun-jul | Anotado |");
    lines.push("|---|---|---|");
    for (const d of group.items) {
      const v = ventas(d.id);
      lines.push(`| [ ] ${mdEscape(d.nombre)} | ${v || "-"} |  |`);
    }
    lines.push("");
  }

  lines.push(
    "## Ya están (no volver a pedir)",
    "",
    "Guarniciones: tostones, casabe, papas fritas, papas salteadas, aguacate.",
    "",
    "Platos: bistec encebollado, arroz con mariscos, salmón del Bosque, canastitas de pollo y de camarones, asopao de camarones y de mariscos, pasta pomodoro / pomodoro con camarones / tocineta, pasta Alfredo pollo y camarones, filete de res en queso azul, filete de res a la parrilla (falta chimichurri), pechuga a la crema, pechuga del Rey, conejo (falta el peso).",
    "",
    "Salsas: tamarindo, del Bosque, ajillo, pomodoro, romero. Alfredo, Rey y blue cheese están a medias (ver sección 1).",
    "",
    "---",
    "",
    "Cocinero: ________________________________    Fecha: ______________",
    "",
  );

  return lines.join("\n");
}

function buildPdf() {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const dia = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santo_Domingo" }).format(new Date());
  const fecha = new Intl.DateTimeFormat("es-DO", {
    timeZone: "America/Santo_Domingo",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...PRIMARY);
  doc.text("Vista del Valle", 14, 18);

  doc.setFontSize(13);
  doc.text("Recetas que hay que pedirle al cocinero", 14, 26);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(fecha, 14, 32);

  doc.setTextColor(30, 41, 59);
  doc.setFontSize(9.5);
  const intro = [
    "Lista sacada de la carta. El cuaderno ya cubre 22 platos/guarniciones y 8 salsas.",
    "Esto es lo que falta anotar: no inventar, preguntar al cocinero.",
    "",
    "Para cada receta escribir: porción (oz/lb/ud) · cada ingrediente con cantidad ·",
    "salsa que usa y oz por plato · si es lote, receta del lote y cuánto rinde.",
  ];
  let y = 38;
  for (const line of intro) {
    doc.text(line, 14, y);
    y += 5;
  }

  autoTable(doc, {
    startY: y + 2,
    margin: { left: 14, right: 14 },
    head: [["1. Completar (ya está a medias)", "Qué preguntar"]],
    body: INCOMPLETAS.map((row) => [dishById[row.id]?.nombre ?? row.id, row.pedir]),
    theme: "grid",
    styles: { fontSize: 8.2, cellPadding: 2, textColor: [15, 23, 42], valign: "top" },
    headStyles: { fillColor: PRIMARY, textColor: [255, 255, 255], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: { 0: { cellWidth: 58, fontStyle: "bold" } },
  });

  autoTable(doc, {
    startY: (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8,
    margin: { left: 14, right: 14 },
    head: [["2. Pedir primero", "Sección", "Ventas*"]],
    body: prioritarios.map((d, i) => [
      `${i + 1}. ${d.nombre}`,
      catNombre[d.categoryId] ?? "",
      String(ventas(d.id)),
    ]),
    theme: "grid",
    styles: { fontSize: 8.2, cellPadding: 1.8, textColor: [15, 23, 42] },
    headStyles: { fillColor: PRIMARY, textColor: [255, 255, 255], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: { 0: { cellWidth: 92 }, 2: { cellWidth: 22, halign: "right" } },
  });

  autoTable(doc, {
    startY: (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8,
    margin: { left: 14, right: 14 },
    head: [["3. Salsas que hay que pedir", "Se usa en"]],
    body: SALSAS_PEDIR,
    theme: "grid",
    styles: { fontSize: 8.2, cellPadding: 1.8, textColor: [15, 23, 42] },
    headStyles: { fillColor: PRIMARY, textColor: [255, 255, 255], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: { 0: { cellWidth: 58, fontStyle: "bold" } },
  });

  doc.addPage();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...PRIMARY);
  doc.text("4. Carta de cocina sin receta (para ir tachando)", 14, 18);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  doc.text("Marque cuando el cocinero la entregue. *Ventas = unidades junio-julio 2026.", 14, 24);

  let firstMissingTable = true;
  for (const group of porCategoria(sinReceta)) {
    autoTable(doc, {
      startY: firstMissingTable
        ? 28
        : (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6,
      margin: { left: 14, right: 14 },
      head: [[group.nombre, "Ventas*", "Anotado"]],
      body: group.items.map((d) => [d.nombre, ventas(d.id) ? String(ventas(d.id)) : "-", "[   ]"]),
      theme: "grid",
      styles: { fontSize: 8, cellPadding: 1.6, textColor: [15, 23, 42] },
      headStyles: { fillColor: PRIMARY, textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: { 1: { cellWidth: 22, halign: "right" }, 2: { cellWidth: 24, halign: "center" } },
    });
    firstMissingTable = false;
  }

  const finalY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59);
  if (finalY < doc.internal.pageSize.getHeight() - 28) {
    doc.text("Cocinero: ________________________________", 14, finalY);
    doc.text("Fecha: ____________________", 14, finalY + 10);
  }

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i += 1) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(
      `Vista del Valle - Recetas faltantes - ${dia} - ${i}/${pages}`,
      14,
      doc.internal.pageSize.getHeight() - 8,
    );
  }

  return Buffer.from(doc.output("arraybuffer"));
}

function main() {
  mkdirSync(join(process.cwd(), "docs"), { recursive: true });
  mkdirSync(join(process.cwd(), "Receta"), { recursive: true });

  const mdPath = join(process.cwd(), "docs", "recetas-faltantes-cocinero.md");
  const pdfPath = join(process.cwd(), "Receta", "Recetas faltantes para el cocinero.pdf");

  writeFileSync(mdPath, buildMarkdown(), "utf8");
  writeFileSync(pdfPath, buildPdf());

  console.log(`Markdown: ${mdPath}`);
  console.log(`PDF: ${pdfPath}`);
  console.log(`Carta cocina: ${cocinaDishes.length} · con receta: ${conReceta.length} · faltan: ${sinReceta.length} · incompletas: ${INCOMPLETAS.length}`);
}

main();
