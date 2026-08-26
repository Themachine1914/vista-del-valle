import { Suspense } from "react";
import { LoginForm } from "@/components/app/LoginForm";

export default function LoginPage() {
  return (
    <div data-theme="app" className="flex min-h-screen items-center justify-center bg-fa-bg px-4">
      <div className="w-full max-w-md rounded-[10px] border border-fa-border bg-fa-surface p-8 shadow-[0_1px_2px_rgb(15_23_42_/_6%)]">
        <p className="text-xs font-medium tracking-wide text-fa-accent uppercase">FacilApp</p>
        <h1 className="mt-1 text-2xl font-semibold text-fa-primary">Vista del Valle</h1>
        <p className="mt-1 text-sm text-fa-muted">Control de ventas e inventario</p>
        <Suspense>
          <LoginForm />
        </Suspense>
        <p className="mt-4 text-xs text-fa-muted">
          Camarero: camarero@vistadelvalle.local / ValleCamarero2026 ·
          Administradora: admin@vistadelvalle.local / ValleAdmin2026
        </p>
      </div>
    </div>
  );
}
