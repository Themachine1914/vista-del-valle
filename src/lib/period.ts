import { todayISO } from "./money";

export type PeriodoModo = "dia" | "mes" | "anio" | "rango";

export type Periodo = {
  modo: PeriodoModo;
  fecha: string;
  mes: string;
  anio: string;
  desde: string;
  hasta: string;
  gte: Date;
  lt: Date;
  label: string;
};

const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const MES = /^\d{4}-\d{2}$/;
const ANIO = /^\d{4}$/;

function utcDay(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function addUtcDays(iso: string, days: number): string {
  const d = utcDay(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function lastDayOfMonth(yyyyMm: string): string {
  const [y, m] = yyyyMm.split("-").map(Number);
  const d = new Date(Date.UTC(y, m, 0));
  return d.toISOString().slice(0, 10);
}

function formatDia(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MESES[m - 1]} ${y}`;
}

export function parsePeriodo(
  sp: {
    periodo?: string;
    fecha?: string;
    mes?: string;
    anio?: string;
    desde?: string;
    hasta?: string;
  },
  today = todayISO(),
): Periodo {
  const fecha = sp.fecha && ISO.test(sp.fecha) ? sp.fecha : today;
  const mes = sp.mes && MES.test(sp.mes) ? sp.mes : fecha.slice(0, 7);
  const anio = sp.anio && ANIO.test(sp.anio) ? sp.anio : fecha.slice(0, 4);
  const modo: PeriodoModo =
    sp.periodo === "mes" || sp.periodo === "anio" || sp.periodo === "rango"
      ? sp.periodo
      : "dia";

  let desde = fecha;
  let hasta = fecha;
  let label = formatDia(fecha);

  if (modo === "mes") {
    desde = `${mes}-01`;
    hasta = lastDayOfMonth(mes);
    const [y, m] = mes.split("-").map(Number);
    label = `${MESES[m - 1]} ${y}`;
  } else if (modo === "anio") {
    desde = `${anio}-01-01`;
    hasta = `${anio}-12-31`;
    label = anio;
  } else if (modo === "rango") {
    desde = sp.desde && ISO.test(sp.desde) ? sp.desde : fecha;
    hasta = sp.hasta && ISO.test(sp.hasta) ? sp.hasta : fecha;
    if (utcDay(hasta) < utcDay(desde)) hasta = desde;
    label =
      desde === hasta ? formatDia(desde) : `${formatDia(desde)} – ${formatDia(hasta)}`;
  }

  return {
    modo,
    fecha,
    mes,
    anio,
    desde,
    hasta,
    gte: utcDay(desde),
    lt: utcDay(addUtcDays(hasta, 1)),
    label,
  };
}

export type PeriodoFiltro = Omit<Periodo, "gte" | "lt">;

export function periodoQuery(
  p: PeriodoFiltro,
  extra: Record<string, string | undefined> = {},
): string {
  const params = new URLSearchParams();
  params.set("periodo", p.modo);
  params.set("fecha", p.fecha);
  if (p.modo === "mes") params.set("mes", p.mes);
  if (p.modo === "anio") params.set("anio", p.anio);
  if (p.modo === "rango") {
    params.set("desde", p.desde);
    params.set("hasta", p.hasta);
  }
  for (const [k, v] of Object.entries(extra)) {
    if (v) params.set(k, v);
  }
  return params.toString();
}

export function yearsAround(today = todayISO(), back = 4): string[] {
  const y = Number(today.slice(0, 4));
  const out: string[] = [];
  for (let i = y - back; i <= y; i += 1) out.push(String(i));
  return out;
}
