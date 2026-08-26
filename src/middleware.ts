import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

export default NextAuth(authConfig).auth;

export const config = {
  matcher: [
    "/ventas/:path*",
    "/inventario/:path*",
    "/dashboard/:path*",
    "/cocina/:path*",
    "/admin/:path*",
  ],
};
