"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  BarChart,
  Bar,
} from "recharts";
import { formatRD } from "@/lib/money";

export function DashboardCharts({
  daily,
  byCategory,
}: {
  daily: { fecha: string; total: number }[];
  byCategory: { nombre: string; total: number }[];
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-[10px] border border-fa-border bg-fa-surface p-4">
        <h2 className="mb-3 font-medium text-fa-primary">Ventas por día (RD$)</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={daily}>
              <CartesianGrid stroke="#E2E8F0" />
              <XAxis dataKey="fecha" tick={{ fontSize: 10 }} hide={daily.length > 40} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v) => formatRD(Number(v ?? 0))} />
              <Line type="monotone" dataKey="total" stroke="#0B3A6E" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>
      <section className="rounded-[10px] border border-fa-border bg-fa-surface p-4">
        <h2 className="mb-3 font-medium text-fa-primary">Por categoría</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byCategory} layout="vertical">
              <CartesianGrid stroke="#E2E8F0" />
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="nombre" width={110} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => formatRD(Number(v ?? 0))} />
              <Bar dataKey="total" fill="#00A8A8" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}
