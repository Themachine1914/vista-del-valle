"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useMemo, useState } from "react";
import { formatRD } from "@/lib/money";
import { homeForRole, ROLE_LABEL, type AppRole } from "@/lib/roles";

export type MenuDish = {
  id: string;
  nombre: string;
  descripcion: string | null;
  precio: number;
  foto: string | null;
  destacado: boolean;
};

export type MenuCategory = {
  id: string;
  nombre: string;
  tipo: "COMIDA" | "BEBIDA";
  dishes: MenuDish[];
};

export function MenuView({ categories }: { categories: MenuCategory[] }) {
  const [active, setActive] = useState<string>("todos");
  const favoritos = useMemo(
    () =>
      categories.flatMap((c) => c.dishes.filter((d) => d.destacado)).slice(0, 8),
    [categories],
  );
  const visible =
    active === "todos" ? categories : categories.filter((c) => c.id === active);
  const { data: session, status } = useSession();
  const role = session?.user.role as AppRole | undefined;
  const staffHome = role ? homeForRole(role) : "/login";
  const loggedIn = status === "authenticated" && Boolean(role);

  return (
    <div className="min-h-screen bg-paper text-ink">
      {loggedIn ? (
        <div className="bg-fa-primary px-4 py-2 text-center text-sm text-white">
          Sesión activa · {session?.user.name} · {role ? ROLE_LABEL[role] : ""} ·{" "}
          <Link href={staffHome} className="underline underline-offset-2">
            Volver al panel
          </Link>
        </div>
      ) : null}
      <header className="relative overflow-hidden bg-pine text-mist">
        <div className="mx-auto max-w-5xl px-4 pt-10 pb-8">
          <p className="text-xs tracking-[0.28em] text-lamp uppercase">
            Carretera Casabito · Constanza
          </p>
          <h1 className="font-display mt-2 text-4xl font-medium md:text-6xl">
            Vista del Valle
          </h1>
          <p className="mt-3 max-w-xl text-base text-mist/85 md:text-lg">
            Cocina de montaña con la vista del valle. Carta viva, platos de la
            casa y el aire frío de Casabito.
          </p>
          {loggedIn ? (
            <Link
              href={staffHome}
              className="mt-6 inline-block rounded-md border border-mist/30 px-4 py-2 text-sm hover:bg-white/10"
            >
              Volver al panel
            </Link>
          ) : (
            <Link
              href="/login"
              className="mt-6 inline-block rounded-md border border-mist/30 px-4 py-2 text-sm hover:bg-white/10"
            >
              Acceso personal
            </Link>
          )}
        </div>
        <div className="ridge bg-paper" />
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10">
        {favoritos.length > 0 ? (
          <section className="mb-12">
            <h2 className="font-display text-2xl text-pine">Favoritos del Valle</h2>
            <p className="mt-1 text-sm text-ink-soft">
              Lo que más se pide en la montaña — Chivo del Valle a la cabeza.
            </p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {favoritos.map((d) => (
                <article
                  key={d.id}
                  className="overflow-hidden rounded-md border border-line bg-white"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={d.foto ?? "/images/placeholders/especialidades.svg"}
                    alt={d.nombre}
                    className="h-36 w-full object-cover"
                  />
                  <div className="p-3">
                    <h3 className="font-medium text-pine">{d.nombre}</h3>
                    <p className="mt-1 text-sm text-clay">{formatRD(d.precio)}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        <div className="sticky top-0 z-10 -mx-4 mb-8 bg-paper/95 px-4 py-3 backdrop-blur-sm">
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setActive("todos")}
              className={`shrink-0 rounded-md px-3 py-1.5 text-sm ${
                active === "todos"
                  ? "bg-pine text-mist"
                  : "border border-line text-ink-soft"
              }`}
            >
              Toda la carta
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setActive(c.id)}
                className={`shrink-0 rounded-md px-3 py-1.5 text-sm ${
                  active === c.id
                    ? "bg-pine text-mist"
                    : "border border-line text-ink-soft"
                }`}
              >
                {c.nombre}
              </button>
            ))}
          </div>
        </div>

        {visible.map((cat) => (
          <section key={cat.id} className="mb-12">
            <div className="mb-4 flex items-end justify-between gap-4">
              <h2 className="font-display text-2xl text-pine">{cat.nombre}</h2>
              <div className="ridge w-40" />
            </div>
            <ul className="divide-y divide-line border-t border-line">
              {cat.dishes.map((d) => (
                <li key={d.id} className="flex gap-4 py-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={d.foto ?? "/images/placeholders/entradas.svg"}
                    alt=""
                    className="h-20 w-24 shrink-0 rounded-md object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <h3 className="font-medium">{d.nombre}</h3>
                      <span className="shrink-0 font-medium text-clay">
                        {formatRD(d.precio)}
                      </span>
                    </div>
                    {d.descripcion ? (
                      <p className="mt-1 text-sm text-ink-soft">{d.descripcion}</p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </main>

      <footer className="border-t border-line py-8 text-center text-sm text-ink-soft">
        Vista del Valle · RD$ · Precios de comidas del menú impreso
      </footer>
    </div>
  );
}
