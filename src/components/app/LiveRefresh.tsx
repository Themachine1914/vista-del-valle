"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function LiveRefresh({ intervalMs = 4000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        router.refresh();
      }
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs, router]);

  return (
    <p className="inline-flex items-center gap-1.5 text-xs text-fa-muted">
      <span className="h-1.5 w-1.5 rounded-full bg-fa-accent" aria-hidden />
      En vivo
    </p>
  );
}
