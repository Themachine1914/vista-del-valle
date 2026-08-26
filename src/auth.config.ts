import type { NextAuthConfig } from "next-auth";

const APP_PREFIXES = [
  "/ventas",
  "/inventario",
  "/dashboard",
  "/cocina",
  "/admin",
];

export const authConfig = {
  pages: { signIn: "/login" },
  providers: [],
  trustHost: true,
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = Boolean(auth?.user);
      const isProtected = APP_PREFIXES.some((p) =>
        nextUrl.pathname.startsWith(p),
      );
      if (isProtected) return isLoggedIn;
      return true;
    },
  },
} satisfies NextAuthConfig;
