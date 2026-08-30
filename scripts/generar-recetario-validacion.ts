/**
 * Genera un PDF de validación del recetario transcrito en Receta/Recetario vista del valle.pdf
 * Toma las cantidades ambiguas o incompletas del original y propone un valor estándar de cocina
 * (marcado como "AJUSTADO"), señala conflictos entre datos del propio original ("CONFLICTO")
 * y marca lo que falta por completo ("FALTA"). El cocinero valida marcando cada renglón.
 *
 * Uso: npx tsx scripts/generar-recetario-validacion.ts
 */
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { writeFileSync } from "fs";
import { join } from "path";

type Estado = "OK" | "AJUSTADO" | "FALTA" | "CONFLICTO";

type Item = { nombre: string; cantidad: string; estado: Estado };

type Receta = {
  titulo: string;
  rendimiento?: string;
  usoNota?: string;
  alerta?: string;
  items: Item[];
};

type Seccion = { titulo: string; recetas: Receta[] };

const PRIMARY: [number, number, number] = [11, 58, 110];
const MUTED: [number, number, number] = [71, 85, 105];
const HEAD_TEXT: [number, number, number] = [255, 255, 255];
const ALT_ROW: [number, number, number] = [248, 250, 252];
const ALERT_BG: [number, number, number] = [255, 247, 237];
const ALERT_TEXT: [number, number, number] = [154, 52, 18];

const ESTADO_COLOR: Record<Estado, [number, number, number]> = {
  OK: [22, 101, 52],
  AJUSTADO: [180, 83, 9],
  FALTA: [153, 27, 27],
  CONFLICTO: [124, 45, 18],
};

const secciones: Seccion[] = [
  {
    titulo: "1. Salsas Base",
    recetas: [
      {
        titulo: "Salsa Alfredo Blanca",
        rendimiento: "Rinde 2 galones (256 oz)",
        usoNota: "Base para pastas Alfredo (camarones o pollo).",
        items: [
          { nombre: "Leche", cantidad: "2 litros (~67.6 oz)", estado: "OK" },
          { nombre: "Crema de leche", cantidad: "2 litros (~67.6 oz)", estado: "OK" },
          { nombre: "Agua", cantidad: "2 1/2 litros (~84.5 oz)", estado: "OK" },
          { nombre: "Mantequilla", cantidad: "1/2 libra (8 oz)", estado: "OK" },
          { nombre: "Cebolla blanca", cantidad: "1 unidad", estado: "OK" },
          { nombre: "Sazonador en sopita", cantidad: "2 unidades", estado: "OK" },
          {
            nombre: "Sal, pimienta, laurel y vino",
            cantidad: "Propuesto: 1 cda sal, 1/2 cda pimienta, 2 hojas de laurel, 2 oz de vino blanco",
            estado: "AJUSTADO",
          },
          { nombre: "Harina", cantidad: "1/4 libra (4 oz)", estado: "OK" },
        ],
      },
      {
        titulo: "Salsa de Romero",
        rendimiento: "Se hace al instante, por porción.",
        usoNota: "Exclusiva para conejo con salsa de romero.",
        items: [
          { nombre: "Vino (toque)", cantidad: "Propuesto: 1 oz", estado: "AJUSTADO" },
          { nombre: "Romero", cantidad: "1 rama", estado: "OK" },
          { nombre: "Salsa china", cantidad: "Propuesto: 1 cdta (5 ml)", estado: "AJUSTADO" },
        ],
      },
      {
        titulo: "Salsa del Rey",
        usoNota: "Pechuga con salsa del Rey.",
        alerta: "El original no trae ninguna cantidad. El cocinero debe aportar las medidas completas de esta receta.",
        items: [
          { nombre: "Morrón", cantidad: "— (falta cantidad)", estado: "FALTA" },
          { nombre: "Cebollín", cantidad: "— (falta cantidad)", estado: "FALTA" },
          { nombre: "Ají cubanela", cantidad: "— (falta cantidad)", estado: "FALTA" },
          { nombre: "Parmesano rallado", cantidad: "— (falta cantidad)", estado: "FALTA" },
          { nombre: "Vino", cantidad: "— (falta cantidad)", estado: "FALTA" },
        ],
      },
      {
        titulo: "Salsa Blue Cheese (Queso Azul)",
        usoNota: "Uso exclusivo: filete de res.",
        alerta: "El original solo dice “blue cheese + queso azul”, sin cantidades ni proporción.",
        items: [
          { nombre: "Blue cheese (salsa/dressing)", cantidad: "— (falta cantidad)", estado: "FALTA" },
          { nombre: "Queso azul (trozos/desmenuzado)", cantidad: "— (falta cantidad)", estado: "FALTA" },
        ],
      },
      {
        titulo: "Salsa Pomodoro",
        rendimiento: "Rinde 1 galón",
        alerta:
          "Hay dos versiones registradas en el original. Se toma como vigente la versión más reciente (primeros renglones). La versión anterior queda abajo solo de referencia — confirmar cuál se usa realmente en cocina.",
        items: [
          {
            nombre: "Tomate pomodoro (lata)",
            cantidad: "1 lata — Propuesto: lata #10 (~6 lb / 96 oz); confirmar tamaño de lata usado",
            estado: "AJUSTADO",
          },
          { nombre: "Agua", cantidad: "1/2 lata (misma lata del tomate)", estado: "OK" },
          { nombre: "Ajo", cantidad: "2 cabezas", estado: "OK" },
          { nombre: "Cebolla", cantidad: "2 unidades", estado: "OK" },
          {
            nombre: "Albahaca",
            cantidad: "1/2 paquete — Propuesto: 1/2 manojo (~0.5 oz)",
            estado: "AJUSTADO",
          },
          { nombre: "Aceite verde", cantidad: "1/4 taza (2 oz)", estado: "OK" },
          { nombre: "Sal y pimienta", cantidad: "Propuesto: 1 cda sal, 1 cdta pimienta", estado: "AJUSTADO" },
          { nombre: "[Versión anterior, no vigente] Aceite de oliva", cantidad: "6 oz", estado: "CONFLICTO" },
          { nombre: "[Versión anterior, no vigente] Sal", cantidad: "2 cda", estado: "CONFLICTO" },
          { nombre: "[Versión anterior, no vigente] Pimienta", cantidad: "1/2 cda", estado: "CONFLICTO" },
        ],
      },
      {
        titulo: "Salsa del Bosque",
        alerta:
          "Dato de referencia del original: 1 caja de calamar trae 4 kg (~8.8 lb). No se especifica el rendimiento total de esta salsa (cuántas oz o galones produce la receta completa) — confirmar para poder calcular el costo por porción.",
        items: [
          {
            nombre: "Calamar completo",
            cantidad: "1 unidad — Propuesto: ~1 lb por calamar; confirmar",
            estado: "AJUSTADO",
          },
          { nombre: "Mejillones", cantidad: "2 unidades", estado: "OK" },
          { nombre: "Recorte de marisco", cantidad: "Propuesto: 4 oz", estado: "AJUSTADO" },
          { nombre: "Cebolla", cantidad: "2 unidades", estado: "OK" },
          { nombre: "Ajo", cantidad: "2 cabezas", estado: "OK" },
          { nombre: "Sal", cantidad: "2 cucharadas", estado: "OK" },
          { nombre: "Pimienta", cantidad: "1 cucharada", estado: "OK" },
          { nombre: "Sazonador en sopita", cantidad: "2 unidades", estado: "OK" },
          { nombre: "Sazón Goya", cantidad: "1 sobre", estado: "OK" },
          { nombre: "Harina blanca", cantidad: "3 oz", estado: "OK" },
        ],
      },
      {
        titulo: "Salsa al Ajillo",
        items: [
          { nombre: "Salsa del Bosque", cantidad: "4 oz", estado: "OK" },
          { nombre: "Ajo", cantidad: "3 granos", estado: "OK" },
          { nombre: "Vino (toque)", cantidad: "Propuesto: 1 oz", estado: "AJUSTADO" },
        ],
      },
      {
        titulo: "Salsa de Tamarindo",
        rendimiento: "Rinde 1 galón",
        alerta:
          "Hay dos versiones registradas en el original. Se toma como vigente la versión más reciente (primeros renglones). La versión anterior queda abajo solo de referencia — confirmar cuál se usa realmente en cocina.",
        items: [
          {
            nombre: "Tamarindo (paquete)",
            cantidad: "1 paquete — Propuesto: 1 lb (16 oz); confirmar tamaño de paquete usado",
            estado: "AJUSTADO",
          },
          { nombre: "Ajo asado", cantidad: "2 cabezas", estado: "OK" },
          { nombre: "Mostaza Dijon", cantidad: "3 cucharadas", estado: "OK" },
          {
            nombre: "Sal, pimienta y vino",
            cantidad: "Propuesto: 1 cda sal, 1/2 cda pimienta, 2 oz de vino",
            estado: "AJUSTADO",
          },
          { nombre: "Harina", cantidad: "1/4 libra (4 oz)", estado: "OK" },
          { nombre: "[Versión anterior, no vigente] Tamarindo", cantidad: "2 lb", estado: "CONFLICTO" },
          { nombre: "[Versión anterior, no vigente] Ajo (crudo)", cantidad: "3 cabezas", estado: "CONFLICTO" },
          { nombre: "[Versión anterior, no vigente] Sal", cantidad: "2 cda", estado: "CONFLICTO" },
          { nombre: "[Versión anterior, no vigente] Pimienta", cantidad: "1/2 cda", estado: "CONFLICTO" },
          { nombre: "[Versión anterior, no vigente] Salsa china", cantidad: "1 porción", estado: "CONFLICTO" },
          { nombre: "[Versión anterior, no vigente] Harina", cantidad: "No llevaba", estado: "CONFLICTO" },
        ],
      },
      {
        titulo: "Salsa Tártara",
        items: [
          { nombre: "Mayonesa", cantidad: "1/4 galón (32 oz)", estado: "OK" },
          { nombre: "Perejil picado", cantidad: "1 taza (8 oz)", estado: "OK" },
          { nombre: "Pepinillo", cantidad: "8 oz", estado: "OK" },
          {
            nombre: "“Hojas de aceitunas”",
            cantidad: "Texto ambiguo en el original — Propuesto: 8 aceitunas picadas; confirmar qué se quiso decir",
            estado: "AJUSTADO",
          },
          { nombre: "Limón", cantidad: "2 unidades", estado: "OK" },
          { nombre: "Miel", cantidad: "1 taza (8 oz)", estado: "OK" },
          { nombre: "Queso parmesano", cantidad: "1 taza (8 oz)", estado: "OK" },
          { nombre: "Aceite verde", cantidad: "1/4 taza (2 oz)", estado: "OK" },
          {
            nombre: "“1 pote de parmesano” (adicional)",
            cantidad: "Posible duplicado del parmesano de arriba — confirmar si es una cantidad aparte",
            estado: "CONFLICTO",
          },
        ],
      },
    ],
  },
  {
    titulo: "2. Pastas",
    recetas: [
      {
        titulo: "Tipos de pasta disponibles",
        items: [
          { nombre: "Penne", cantidad: "1 paquete = 4 porciones", estado: "OK" },
          {
            nombre: "Linguini",
            cantidad: "Propuesto: 1 paquete = 4 porciones (igual que penne)",
            estado: "AJUSTADO",
          },
          {
            nombre: "Spaghetti",
            cantidad: "Propuesto: 1 paquete = 4 porciones (igual que penne)",
            estado: "AJUSTADO",
          },
        ],
      },
      {
        titulo: "Pasta Alfredo con Pollo",
        items: [
          { nombre: "Pechuga de pollo", cantidad: "1/4 de la porción de 8 oz = 2 oz", estado: "OK" },
          { nombre: "Parmesano", cantidad: "1 cucharada", estado: "OK" },
          {
            nombre: "Salsa Alfredo",
            cantidad: "Propuesto: 5 oz por porción (ver “Rendimiento de salsa Alfredo”)",
            estado: "AJUSTADO",
          },
        ],
      },
      {
        titulo: "Pasta Alfredo con Camarones",
        items: [
          { nombre: "Camarones", cantidad: "5 unidades (paquete de 42 a 45 camarones)", estado: "OK" },
          {
            nombre: "Parmesano",
            cantidad: "1 cucharadita — confirmar si es cdta (las demás pastas usan cda)",
            estado: "CONFLICTO",
          },
          { nombre: "Salsa Alfredo", cantidad: "Propuesto: 5 oz por porción", estado: "AJUSTADO" },
        ],
      },
      {
        titulo: "Pasta de Tomate Fresco con Camarones",
        alerta: "El original no da cantidades — solo dice “base de salsa pomodoro con camarones”.",
        items: [
          { nombre: "Salsa pomodoro", cantidad: "Propuesto: 4-5 oz por porción", estado: "AJUSTADO" },
          {
            nombre: "Camarones",
            cantidad: "Propuesto: 5 unidades (igual que pasta Alfredo con camarones)",
            estado: "AJUSTADO",
          },
        ],
      },
      {
        titulo: "Pasta de Tomate Fresco con Parmesano",
        items: [
          { nombre: "Salsa pomodoro", cantidad: "Propuesto: 4-5 oz por porción", estado: "AJUSTADO" },
          { nombre: "Parmesano", cantidad: "3 cucharadas", estado: "OK" },
        ],
      },
      {
        titulo: "Pasta de Focaccia con Parmesano",
        items: [
          { nombre: "Parmesano", cantidad: "1 cucharada", estado: "OK" },
          { nombre: "Focaccia", cantidad: "2 rebanadas", estado: "OK" },
        ],
      },
      {
        titulo: "Rendimiento de salsa Alfredo",
        alerta:
          "Revisar: 1 galón = 128 oz ÷ 18 platos = 7.1 oz/plato, no 5 oz. Confirmar cuál cifra es la correcta antes de calcular costo por plato.",
        items: [
          { nombre: "Rendimiento por galón", cantidad: "18 platos de pasta", estado: "CONFLICTO" },
          { nombre: "Salsa por porción", cantidad: "5 oz", estado: "CONFLICTO" },
        ],
      },
    ],
  },
  {
    titulo: "3. Proteínas y Platos Principales",
    recetas: [
      {
        titulo: "Canastica de Pollo a la Crema",
        items: [
          { nombre: "Plátano", cantidad: "1.5 unidades", estado: "OK" },
          {
            nombre: "Aceite Crisol",
            cantidad: "Propuesto: 1 oz (mismo estándar usado en el bistec encebollado)",
            estado: "AJUSTADO",
          },
          {
            nombre: "Vegetales (cebolla y ají morrón)",
            cantidad: "Propuesto: 2 oz combinados (1 oz + 1 oz) — “cantidad mínima” según el original",
            estado: "AJUSTADO",
          },
          { nombre: "Pollo (pechuga)", cantidad: "1/4 de la porción de 8 oz = 2 oz", estado: "OK" },
          {
            nombre: "Ajo, sal, pimienta, orégano",
            cantidad: "Propuesto: 1 diente de ajo picado, 1/4 cdta sal, pizca de pimienta, pizca de orégano",
            estado: "AJUSTADO",
          },
          {
            nombre: "Crema de leche",
            cantidad: "No aparece en el original pese al nombre “a la crema” — Propuesto: 3 oz; confirmar",
            estado: "FALTA",
          },
        ],
      },
      {
        titulo: "Canastica de Camarones a la Crema",
        items: [
          { nombre: "Plátano", cantidad: "1.5 unidades", estado: "OK" },
          { nombre: "Aceite Crisol", cantidad: "Propuesto: 1 oz", estado: "AJUSTADO" },
          {
            nombre: "Vegetales (cebolla, morrón)",
            cantidad: "Propuesto: 2 oz combinados",
            estado: "AJUSTADO",
          },
          { nombre: "Camarones", cantidad: "6 unidades", estado: "OK" },
          {
            nombre: "Crema de leche",
            cantidad: "No aparece en el original pese al nombre “a la crema” — Propuesto: 3 oz; confirmar",
            estado: "FALTA",
          },
        ],
      },
      {
        titulo: "Canastica al Ajillo",
        usoNota: "Igual que la canastica de pollo o camarones, pero se sustituye la crema por salsa al ajillo.",
        items: [{ nombre: "Salsa al ajillo", cantidad: "2 oz (sustituye a la crema)", estado: "OK" }],
      },
      {
        titulo: "Pechuga a la Crema",
        rendimiento: "1 galón de salsa de esta receta alcanza para 26 pechugas.",
        items: [
          { nombre: "Pechuga", cantidad: "1 porción (8 oz)", estado: "OK" },
          {
            nombre: "Ajo, sal, pimienta, orégano, mostaza",
            cantidad: "Propuesto: 1 diente de ajo, 1/4 cdta sal, pizca de pimienta, pizca de orégano, 1 cdta de mostaza",
            estado: "AJUSTADO",
          },
          {
            nombre: "Crema de leche (salsa)",
            cantidad:
              "No aparece con cantidad en el original — Propuesto: 5 oz por porción, calculado de “1 galón rinde 26 pechugas” (128 oz ÷ 26 ~ 4.9 oz)",
            estado: "AJUSTADO",
          },
        ],
      },
      {
        titulo: "Pechuga con Salsa del Rey",
        usoNota: "Ver Salsa del Rey — receta pendiente de cantidades (sección 1).",
        items: [],
      },
      {
        titulo: "Conejo con Salsa de Romero",
        alerta:
          "El original mezcla una nota sobre “porción de conejo o costilla de chivo” con un rendimiento (20 lb -> 25 servicios) que parece corresponder a costilla de chivo, no a conejo. Confirmar la porción real de conejo.",
        items: [
          {
            nombre: "Conejo (porción cruda)",
            cantidad: "Propuesto: 12 oz (0.75 lb) por porción; confirmar",
            estado: "AJUSTADO",
          },
          {
            nombre: "[Referencia del original] Costilla de chivo",
            cantidad: "20 lb rinden 25 servicios = 12.8 oz por servicio",
            estado: "CONFLICTO",
          },
        ],
      },
      {
        titulo: "Filete de Res en Salsa Blue Cheese",
        items: [
          { nombre: "Res (filete)", cantidad: "8 oz", estado: "OK" },
          {
            nombre: "Salsa blue cheese",
            cantidad: "Ver Salsa Blue Cheese — receta pendiente de cantidades (sección 1)",
            estado: "FALTA",
          },
          {
            nombre: "Ajo, sal, pimienta",
            cantidad: "Propuesto: 1 diente de ajo, 1/4 cdta sal, pizca de pimienta",
            estado: "AJUSTADO",
          },
        ],
      },
      {
        titulo: "Filete de Res a la Parrilla",
        alerta:
          "El original dice que es la misma preparación que el filete anterior, con salsa chimichurri como única diferencia — pero no existe ninguna receta de chimichurri en las notas. Falta por completo.",
        items: [
          {
            nombre: "Salsa chimichurri",
            cantidad: "— (falta la receta completa: ingredientes y cantidades)",
            estado: "FALTA",
          },
        ],
      },
      {
        titulo: "Bistec Encebollado con Toque de Vino Tinto",
        items: [
          { nombre: "Bistec", cantidad: "8 oz", estado: "OK" },
          { nombre: "Cebolla mediana", cantidad: "1 unidad", estado: "OK" },
          { nombre: "Salsa de tamarindo", cantidad: "4 oz", estado: "OK" },
          { nombre: "Aceite Crisol", cantidad: "1 oz", estado: "OK" },
        ],
      },
      {
        titulo: "Salmón a la Parrilla con Salsa del Bosque",
        items: [
          { nombre: "Salmón", cantidad: "8 oz", estado: "OK" },
          { nombre: "Salsa del Bosque", cantidad: "4 oz", estado: "OK" },
          {
            nombre: "Ajo, sal, pimienta y limón",
            cantidad: "Propuesto: 1 diente de ajo, 1/4 cdta sal, pizca de pimienta, 1/4 de limón",
            estado: "AJUSTADO",
          },
        ],
      },
    ],
  },
  {
    titulo: "4. Arroces y Asopaos",
    recetas: [
      {
        titulo: "Asopao de Camarones",
        items: [
          { nombre: "Salsa pomodoro", cantidad: "4 oz", estado: "OK" },
          { nombre: "Salsa del Bosque", cantidad: "4 oz", estado: "OK" },
          { nombre: "Arroz", cantidad: "1/4 libra (4 oz)", estado: "OK" },
          { nombre: "Camarones", cantidad: "8 unidades", estado: "OK" },
        ],
      },
      {
        titulo: "Asopao de Marisco",
        items: [
          { nombre: "Salsa pomodoro", cantidad: "4 oz", estado: "OK" },
          { nombre: "Salsa del Bosque", cantidad: "4 oz", estado: "OK" },
          { nombre: "Arroz", cantidad: "1/4 libra (4 oz)", estado: "OK" },
          { nombre: "Camarones", cantidad: "4 unidades", estado: "OK" },
          { nombre: "Marisco", cantidad: "3 oz", estado: "OK" },
        ],
      },
      {
        titulo: "Arroz con Marisco Mixto",
        items: [
          { nombre: "Arroz", cantidad: "1/4 libra (4 oz)", estado: "OK" },
          { nombre: "Salsa del Bosque", cantidad: "4 oz", estado: "OK" },
          { nombre: "Camarones", cantidad: "4 unidades", estado: "OK" },
          {
            nombre: "Recorte de marisco",
            cantidad: "Propuesto: 3 oz (igual que en el asopao de marisco)",
            estado: "AJUSTADO",
          },
          { nombre: "Aceite Crisol", cantidad: "1 oz", estado: "OK" },
          { nombre: "Morrón y cebolla", cantidad: "Propuesto: 2 oz combinados", estado: "AJUSTADO" },
        ],
      },
    ],
  },
  {
    titulo: "5. Guarniciones",
    recetas: [
      {
        titulo: "Tostones",
        items: [
          { nombre: "Plátano", cantidad: "1 unidad por porción", estado: "OK" },
          { nombre: "Aceite (nota operativa)", cantidad: "Se renueva cada 15 días", estado: "OK" },
        ],
      },
      { titulo: "Casabe", items: [{ nombre: "Casabe", cantidad: "1 longa por porción", estado: "OK" }] },
      {
        titulo: "Papas Fritas",
        items: [{ nombre: "Papa", cantidad: "0.65 libra por servicio", estado: "OK" }],
      },
      {
        titulo: "Papas Salteadas",
        items: [
          {
            nombre: "Papa",
            cantidad: "2 papas de tamaño normal — Propuesto: ~4 oz cada una (~8 oz total); confirmar peso de referencia",
            estado: "AJUSTADO",
          },
        ],
      },
      {
        titulo: "Aguacate",
        items: [{ nombre: "Aguacate", cantidad: "2 servicios por aguacate", estado: "OK" }],
      },
    ],
  },
  {
    titulo: "6. Empanizados y Otros",
    recetas: [
      {
        titulo: "Balitas de Queso",
        rendimiento: "Rinde 22 unidades",
        items: [
          {
            nombre: "Queso mozzarella",
            cantidad: "1 bloque — Propuesto: 2 lb (32 oz); confirmar tamaño del bloque usado",
            estado: "AJUSTADO",
          },
          { nombre: "Huevos", cantidad: "2 unidades", estado: "OK" },
          { nombre: "Pimienta", cantidad: "1 pizca", estado: "OK" },
          { nombre: "Ajo", cantidad: "1 cabeza", estado: "OK" },
          {
            nombre: "Harina blanquita",
            cantidad: "1/4 — Propuesto: 1/4 libra (4 oz); confirmar unidad",
            estado: "AJUSTADO",
          },
          {
            nombre: "Miga de pan",
            cantidad: "0.15 — Propuesto: 0.15 libra (2.4 oz); confirmar unidad",
            estado: "AJUSTADO",
          },
        ],
      },
      {
        titulo: "Croquetas de Pollo",
        rendimiento: "Rinde 21 unidades",
        items: [
          {
            nombre: "Pechuga",
            cantidad: "2.90 — Propuesto: 2.90 libras (~46 oz); confirmar unidad",
            estado: "AJUSTADO",
          },
          { nombre: "Cebolla", cantidad: "1 unidad", estado: "OK" },
          { nombre: "Ají cubanela", cantidad: "1 unidad", estado: "OK" },
          { nombre: "Mantequilla", cantidad: "1 libra", estado: "OK" },
          { nombre: "Leche entera", cantidad: "1 litro", estado: "OK" },
          { nombre: "Sazonador en sopita", cantidad: "2 unidades", estado: "OK" },
          { nombre: "Ajo", cantidad: "1/2 cabeza", estado: "OK" },
          { nombre: "Pimienta", cantidad: "1 pizca", estado: "OK" },
          { nombre: "Sal", cantidad: "1 pizca", estado: "OK" },
          {
            nombre: "Harina",
            cantidad: "1 1/2 — Propuesto: 1.5 libras (24 oz); confirmar unidad",
            estado: "AJUSTADO",
          },
        ],
      },
      {
        titulo: "Hamburguesa de Res",
        rendimiento: "Rinde 19 unidades",
        items: [
          { nombre: "Carne molida", cantidad: "6 libras", estado: "OK" },
          { nombre: "Huevos", cantidad: "6 unidades", estado: "OK" },
          { nombre: "Ajo", cantidad: "1 cabeza", estado: "OK" },
          { nombre: "Sal y pimienta", cantidad: "Propuesto: 1 cda sal, 1 cdta pimienta", estado: "AJUSTADO" },
          {
            nombre: "Miga de pan",
            cantidad: "1/2 — Propuesto: 0.5 libra (8 oz); confirmar unidad",
            estado: "AJUSTADO",
          },
        ],
      },
      {
        titulo: "Rendimientos de referencia (porciones)",
        alerta: "Este cuadro del original no dice a qué platos aplica cada rendimiento — usar con cautela y confirmar con el cocinero.",
        items: [
          {
            nombre: "Papa (referencia general)",
            cantidad:
              "0.45 — unidad no especificada. CONFLICTO con Papas Fritas (0.65 lb/servicio, sección 5). Confirmar si son preparaciones distintas.",
            estado: "CONFLICTO",
          },
          {
            nombre: "“Carne (sa.)”",
            cantidad: "0.625 — Propuesto: Carne Salada, 0.625 libra (10 oz) por servicio; confirmar la abreviatura “sa.”",
            estado: "AJUSTADO",
          },
          {
            nombre: "Lambí",
            cantidad: "“Rinde 22” — no dice de cuánto lambí crudo, ni si son porciones o unidades. Falta la base completa.",
            estado: "FALTA",
          },
        ],
      },
    ],
  },
];

function addFooterAndHeader(doc: jsPDF, dia: string) {
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i += 1) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(
      `Vista del Valle · Recetario para validar · ${dia} · ${i}/${pages}`,
      14,
      doc.internal.pageSize.getHeight() - 8,
    );
  }
}

function ensureSpace(doc: jsPDF, cursorY: number, needed: number): number {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (cursorY + needed > pageHeight - 16) {
    doc.addPage();
    return 20;
  }
  return cursorY;
}

function main() {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const dia = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santo_Domingo" }).format(new Date());
  const fechaLegible = new Intl.DateTimeFormat("es-DO", {
    timeZone: "America/Santo_Domingo",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date());

  // Portada
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...PRIMARY);
  doc.text("Vista del Valle", 14, 22);

  doc.setFontSize(14);
  doc.setTextColor(...MUTED);
  doc.text("Recetario de Cocina — Para Validación del Cocinero", 14, 31);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Generado: ${fechaLegible}`, 14, 38);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59);
  const intro = [
    "Este documento parte de las notas de cocina transcritas en “Recetario vista del valle.pdf” y las ordena en el",
    "mismo formato de porciones que usa el sistema de Vista del Valle (onzas, libras, litros y unidades).",
    "",
    "Donde la cantidad original no era clara (unidad ambigua, valor incompleto o dos versiones distintas de una",
    "misma salsa), se propone un valor estándar de cocina marcado como AJUSTADO. Donde no había ninguna",
    "cantidad, se marca como FALTA. Donde dos datos del propio recetario original no cuadran entre sí, se marca",
    "como CONFLICTO. Ningún valor propuesto debe darse por bueno sin la confirmación del cocinero.",
  ];
  let y = 46;
  for (const line of intro) {
    doc.text(line, 14, y);
    y += 5;
  }

  y += 4;
  autoTable(doc, {
    startY: y,
    margin: { left: 14, right: 14 },
    head: [["Estado", "Qué significa"]],
    body: [
      ["OK", "Cantidad clara en el original — se transcribe tal cual, solo con formato de unidades del sistema."],
      ["AJUSTADO", "Cantidad ambigua o incompleta en el original — aquí se propone un valor estándar de cocina a confirmar."],
      ["FALTA", "El original no traía ninguna cantidad — el cocinero debe aportarla."],
      ["CONFLICTO", "Dos datos del propio recetario original no cuadran entre sí — el cocinero debe indicar cuál es el correcto."],
    ],
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 2, textColor: [15, 23, 42] },
    headStyles: { fillColor: PRIMARY, textColor: HEAD_TEXT, fontStyle: "bold" },
    columnStyles: { 0: { cellWidth: 28, fontStyle: "bold" }, 1: { cellWidth: "auto" } },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 0) {
        const estado = String(data.cell.raw) as Estado;
        data.cell.styles.textColor = ESTADO_COLOR[estado];
      }
    },
  });

  y = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable!.finalY + 10;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...PRIMARY);
  doc.text("Cómo usar este documento", 14, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  const como = [
    "Por cada renglón: marque la casilla si la cantidad propuesta es correcta, o escriba el valor correcto en la",
    "columna “Corrección” si difiere. Las filas FALTA y CONFLICTO necesitan respuesta obligatoria.",
  ];
  for (const line of como) {
    doc.text(line, 14, y);
    y += 5;
  }

  // Secciones
  for (const seccion of secciones) {
    doc.addPage();
    let cy = 20;
    doc.setFillColor(...PRIMARY);
    doc.rect(14, cy - 6, 182, 9, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...HEAD_TEXT);
    doc.text(seccion.titulo, 17, cy);
    cy += 10;

    for (const receta of seccion.recetas) {
      cy = ensureSpace(doc, cy, 26);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(...PRIMARY);
      doc.text(receta.titulo, 14, cy);
      cy += 5;

      if (receta.rendimiento) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(8.5);
        doc.setTextColor(...MUTED);
        doc.text(receta.rendimiento, 14, cy);
        cy += 4.5;
      }
      if (receta.usoNota) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(8.5);
        doc.setTextColor(...MUTED);
        doc.text(`Uso: ${receta.usoNota}`, 14, cy);
        cy += 4.5;
      }
      if (receta.alerta) {
        const wrapped = doc.splitTextToSize(receta.alerta, 174);
        cy = ensureSpace(doc, cy, wrapped.length * 4 + 4);
        doc.setFillColor(...ALERT_BG);
        doc.rect(14, cy - 3.5, 182, wrapped.length * 4 + 3, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(...ALERT_TEXT);
        doc.text(wrapped, 16, cy);
        cy += wrapped.length * 4 + 4;
      }

      if (receta.items.length > 0) {
        autoTable(doc, {
          startY: cy,
          margin: { left: 14, right: 14 },
          head: [["Ingrediente / nota", "Cantidad", "Estado", "OK", "Corrección (si aplica)"]],
          body: receta.items.map((it) => [it.nombre, it.cantidad, it.estado, "", ""]),
          theme: "grid",
          styles: { fontSize: 8, cellPadding: 1.6, textColor: [15, 23, 42], valign: "middle", overflow: "linebreak" },
          headStyles: { fillColor: PRIMARY, textColor: HEAD_TEXT, fontStyle: "bold" },
          alternateRowStyles: { fillColor: ALT_ROW },
          columnStyles: {
            0: { cellWidth: 36 },
            2: { cellWidth: 20 },
            3: { cellWidth: 13, halign: "center" },
            4: { cellWidth: 27 },
          },
          didParseCell: (data) => {
            if (data.section === "body" && data.column.index === 2) {
              const estado = String(data.cell.raw) as Estado;
              data.cell.styles.textColor = ESTADO_COLOR[estado];
              data.cell.styles.fontStyle = "bold";
            }
          },
        });
        cy = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable!.finalY + 8;
      } else {
        cy += 4;
      }
    }
  }

  // Página final de firma
  doc.addPage();
  let fy = 30;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...PRIMARY);
  doc.text("Validación final", 14, fy);
  fy += 10;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59);
  doc.text(
    "Con mi firma confirmo que revisé cada receta de este documento, marqué las cantidades propuestas que son",
    14,
    fy,
  );
  fy += 5;
  doc.text(
    "correctas y aporté el valor correcto donde el documento indicaba FALTA o CONFLICTO.",
    14,
    fy,
  );
  fy += 20;
  doc.text("Nombre del cocinero: _________________________________________________", 14, fy);
  fy += 14;
  doc.text("Firma: ________________________________________     Fecha: _____________________", 14, fy);

  addFooterAndHeader(doc, dia);

  const outPath = join(process.cwd(), "Receta", "Recetario Vista del Valle - Para Validar.pdf");
  writeFileSync(outPath, Buffer.from(doc.output("arraybuffer")));
  console.log(`PDF generado en: ${outPath}`);
}

main();
