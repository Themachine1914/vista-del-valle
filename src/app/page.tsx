import { prisma } from "@/lib/prisma";
import { toMoney } from "@/lib/money";
import { MenuView, type MenuCategory } from "@/components/menu/MenuView";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const categories = await prisma.category.findMany({
    where: { esInterna: false },
    orderBy: { orden: "asc" },
    include: {
      dishes: {
        where: { disponible: true, precio: { not: null } },
        orderBy: { nombre: "asc" },
      },
    },
  });

  const data: MenuCategory[] = categories
    .map((c) => ({
      id: c.id,
      nombre: c.nombre,
      tipo: c.tipo,
      dishes: c.dishes
        .filter((d) => d.precio !== null)
        .map((d) => ({
          id: d.id,
          nombre: d.nombre,
          descripcion: d.descripcion,
          precio: toMoney(d.precio),
          foto: d.foto,
          destacado: d.destacado,
        })),
    }))
    .filter((c) => c.dishes.length > 0);

  return <MenuView categories={data} />;
}
