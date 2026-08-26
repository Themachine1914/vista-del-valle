import type { Metadata } from "next";
import { Fraunces, Outfit, Geist } from "next/font/google";
import { Providers } from "@/components/app/Providers";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Vista del Valle · Casabito",
  description:
    "Carta digital y control de ventas e inventario del restaurante Vista del Valle, carretera Casabito–Constanza.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={`${fraunces.variable} ${outfit.variable} ${geist.variable} antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
