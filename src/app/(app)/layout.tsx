import { auth, signOut } from "@/auth";
import { ROLE_LABEL } from "@/lib/roles";
import Link from "next/link";
import { redirect } from "next/navigation";

const LINKS = {
  ADMIN: [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/ventas", label: "Ventas" },
    { href: "/inventario", label: "Inventario" },
    { href: "/cocina", label: "Cocina" },
    { href: "/admin", label: "Admin" },
    { href: "/guia", label: "Guía" },
  ],
  CAMARERO: [
    { href: "/ventas", label: "Ventas" },
    { href: "/guia", label: "Guía" },
  ],
  COCINA: [
    { href: "/cocina", label: "Cocina" },
    { href: "/inventario", label: "Inventario" },
    { href: "/guia", label: "Guía" },
  ],
} as const;

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const links = LINKS[session.user.role];

  return (
    <div data-theme="app" className="min-h-screen bg-fa-bg text-fa-text">
      <header className="border-b border-fa-border bg-fa-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <img
              src="/logo.png"
              alt="Vista del Valle"
              width={40}
              height={40}
              className="rounded-[10px] bg-white"
            />
            <div>
              <p className="text-xs font-medium tracking-wide text-fa-accent uppercase">
                FacilApp · Vista del Valle
              </p>
              <p className="text-sm text-fa-muted">
                {session.user.name} · {ROLE_LABEL[session.user.role]}
              </p>
            </div>
          </div>
          <nav className="flex flex-wrap items-center gap-1">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="rounded-[10px] px-3 py-1.5 text-sm font-medium text-fa-primary hover:bg-fa-bg"
              >
                {l.label}
              </Link>
            ))}
            <Link
              href="/"
              className="rounded-[10px] px-3 py-1.5 text-sm text-fa-muted hover:bg-fa-bg"
            >
              Carta
            </Link>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <button
                type="submit"
                className="rounded-[10px] px-3 py-1.5 text-sm text-fa-muted hover:bg-fa-bg"
              >
                Salir
              </button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
