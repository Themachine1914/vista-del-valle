"use client";

import { PeriodFilter } from "@/components/app/PeriodFilter";
import { periodoQuery, type PeriodoFiltro } from "@/lib/period";
import { useEffect, useState } from "react";

export function PdfDownload({
  label,
  apiPath,
  periodo,
  extra,
}: {
  label: string;
  apiPath: string;
  periodo: PeriodoFiltro;
  extra?: Record<string, string | undefined>;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(periodo);

  useEffect(() => {
    setDraft(periodo);
  }, [periodo]);

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-[10px] bg-fa-primary px-3 py-2 text-sm font-medium text-white"
      >
        {label}
      </button>
      {open ? (
        <div className="space-y-3 rounded-[10px] border border-fa-border bg-fa-surface p-3">
          <p className="text-sm font-medium text-fa-primary">Periodo a imprimir</p>
          <PeriodFilter periodo={draft} onChange={setDraft} />
          <a
            href={`${apiPath}?${periodoQuery(draft, extra)}`}
            className="inline-flex rounded-[10px] bg-fa-accent px-3 py-2 text-sm font-medium text-white"
          >
            Descargar {draft.label}
          </a>
        </div>
      ) : null}
    </div>
  );
}
