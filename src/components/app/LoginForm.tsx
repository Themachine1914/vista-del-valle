"use client";

import { homeForRole } from "@/lib/roles";
import { getSession, signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

export function LoginForm() {
  const params = useSearchParams();
  const [error, setError] = useState(Boolean(params.get("error")));
  const [pending, setPending] = useState(false);

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(false);
    const res = await signIn("credentials", {
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      redirect: false,
    });
    if (!res || res.error) {
      setPending(false);
      setError(true);
      return;
    }
    const session = await getSession();
    const dest = session?.user.role ? homeForRole(session.user.role) : "/ventas";
    window.location.href = dest;
  }

  return (
    <form action={onSubmit} className="mt-6 space-y-4">
      <label className="block text-sm">
        <span className="text-fa-muted">Email</span>
        <input
          name="email"
          type="email"
          required
          defaultValue="camarero@vistadelvalle.local"
          className="mt-1 w-full rounded-[10px] border border-fa-border px-3 py-2"
        />
      </label>
      <label className="block text-sm">
        <span className="text-fa-muted">Contraseña</span>
        <input
          name="password"
          type="password"
          required
          className="mt-1 w-full rounded-[10px] border border-fa-border px-3 py-2"
        />
      </label>
      {error ? (
        <p className="text-sm text-red-700">Email o contraseña incorrectos.</p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-[10px] bg-fa-primary px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
