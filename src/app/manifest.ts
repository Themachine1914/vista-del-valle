import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Vista del Valle",
    short_name: "Vista del Valle",
    description:
      "Carta digital y control de ventas e inventario de Vista del Valle, Casabito.",
    start_url: "/",
    display: "standalone",
    background_color: "#163528",
    theme_color: "#163528",
    icons: [
      {
        src: "/icons/icon-192.png?v=oficial",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png?v=oficial",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512-maskable.png?v=oficial",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
