import type { Metadata, Viewport } from "next";
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
  applicationName: "Vista del Valle",
  description:
    "Carta digital y control de ventas e inventario del restaurante Vista del Valle, carretera Casabito–Constanza.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Vista del Valle",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png?v=oficial", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png?v=oficial", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png?v=oficial", sizes: "180x180", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#163528",
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
