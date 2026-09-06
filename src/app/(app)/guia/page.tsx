import { auth } from "@/auth";
import { ROLE_LABEL, type AppRole } from "@/lib/roles";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type Section = {
  id: string;
  titulo: string;
  ruta: string;
  roles: AppRole[];
  resumen: string;
  bloques: { titulo?: string; puntos: string[] }[];
};

const SECTIONS: Section[] = [
  {
    id: "ventas",
    titulo: "Ventas",
    ruta: "/ventas",
    roles: ["ADMIN", "CAMARERO"],
    resumen:
      "Registra lo que se vende en cada turno. Cada venta descuenta el inventario automáticamente según la receta del plato.",
    bloques: [
      {
        titulo: "Registrar una venta",
        puntos: [
          "Elige el turno (Desayuno, Almuerzo o Cena) con los botones de arriba. Si estás viendo otro período, primero aparece un campo de fecha.",
          "Busca el plato o bebida por nombre, o filtra por categoría, y pulsa Agregar para sumarlo al ticket de la derecha.",
          "En el ticket puedes cambiar la cantidad, escribir el precio si el plato no tiene uno fijo (aparece como “s/precio”), y elegir la guarnición si el plato la incluye.",
          "Antes de guardar, revisa “Impacto en inventario”: muestra qué ingredientes bajarán y los marca en ámbar (quedan bajo el mínimo) o en rojo (no alcanza). Si está en rojo, conviene ajustar el inventario antes; la venta igual se puede registrar y el stock puede quedar en negativo.",
          "Pulsa Registrar venta para guardar. Si te equivocaste, pide a la administradora que pulse Borrar en la lista de abajo (solo ella puede hacerlo).",
        ],
      },
      {
        titulo: "Corregir una venta",
        puntos: [
          "“Ya registrado en este turno” lista lo vendido en ese turno y fecha.",
          "Solo Administradora ve el botón Borrar: quita esa línea y devuelve al inventario lo que esa venta había descontado (plato y guarnición).",
        ],
      },
      {
        titulo: "Consultar totales y exportar",
        puntos: [
          "El filtro de arriba (Día, Mes, Año, Rango) cambia el total y el desglose de ventas que se muestra, no solo el registro de un turno.",
          "Imprimir ventas PDF abre un selector de período y genera un PDF descargable con ese rango.",
        ],
      },
    ],
  },
  {
    id: "inventario",
    titulo: "Inventario",
    ruta: "/inventario",
    roles: ["ADMIN", "COCINA"],
    resumen:
      "Controla el stock de ingredientes: compras, ajustes manuales, alertas de mínimo y el historial completo de movimientos.",
    bloques: [
      {
        titulo: "Buscar y filtrar",
        puntos: [
          "Solo alertas muestra únicamente los productos por debajo del mínimo (aparecen resaltados en rojo en la tabla).",
          "Buscar producto filtra a la vez todas las tablas de la página (consumo, productos, movimientos, compras).",
        ],
      },
      {
        titulo: "Registrar una compra o un producto nuevo",
        puntos: [
          "Elige “Producto existente” o “Producto nuevo” (para un producto nuevo, escribe el nombre directamente).",
          "Indica la fecha de la compra y “Entrada por”: la unidad en que llega el producto (libra, onza, kilo, litro, unidad, ítem, u “otro” con una etiqueta libre como “saco” o “caja”).",
          "Define el “Límite mínimo”: el nivel bajo el cual el producto se marca en alertas.",
          "Escribe cuántos ítems compraste y cuánto contiene cada uno (por ejemplo, 2 sacos de 25 libras cada uno) y el precio total que pagaste.",
          "El sistema convierte todo a la unidad de stock del producto y muestra “Total a sumar” antes de guardar, además de comparar el precio por unidad contra la última compra. Pulsa Registrar.",
        ],
      },
      {
        titulo: "Ajuste de stock (sin que sea una compra)",
        puntos: [
          "Usa esto para conteos físicos, mermas o correcciones — no queda registrado como una compra con precio.",
          "“Entrada (+)” solo suma; “Ajuste (+/−)” suma o resta según el signo (usa un número negativo para restar).",
          "Elige la unidad en que estás ajustando (puede ser distinta a la unidad de compra, por ejemplo ajustar por unidades cuando el producto se compra por peso).",
        ],
      },
      {
        titulo: "Editar o borrar un producto",
        puntos: [
          "En la tabla “Productos”, quien tiene permiso puede cambiar el nombre, la unidad, el contenido por ítem y el mínimo directo en la fila, y pulsar Guardar.",
          "Borrar elimina el producto por completo: se quita de las recetas que lo usan, aunque su historial de altas/bajas se conserva para consulta.",
        ],
      },
      {
        titulo: "Consultar historial",
        puntos: [
          "Consumo: lo que las ventas fueron descontando en el período elegido.",
          "Movimientos: todo junto — Compra, Consumo, Ajuste, Preparación (cuando cocina registra un lote de salsa), y “Anulación” cuando se borra una venta o un lote.",
          "Registro de altas, bajas y cambios y Compras registradas (con la comparación de precio contra la compra anterior) están más abajo, uno al lado del otro.",
          "Imprimir registro PDF descarga el reporte completo del período elegido.",
        ],
      },
      {
        titulo: "Lista de reposición",
        puntos: [
          "Genera un PDF con todo lo que está agotado o por debajo del mínimo — incluye ingredientes de recetas y también materiales que no están en ninguna receta (gastables), porque un producto no necesita estar en una receta para aparecer en Inventario.",
          "Por cada producto muestra cuánto falta para llegar al mínimo y el costo aproximado, calculado con el precio de la última compra registrada.",
          "Si un producto nunca se ha comprado (sin precio registrado), aparece en la lista pero no se suma al total — el PDF avisa cuántos quedaron fuera del total por esa razón.",
          "En la tabla “Productos”, cada fila marcada en rojo (bajo mínimo) tiene un botón Registrar compra: selecciona ese producto en el formulario de arriba y sube hasta él automáticamente, para no tener que buscarlo. El formulario ya trae cargadas sus propiedades (unidad, contenido por ítem) y muestra si el precio nuevo sube o baja frente a la última compra.",
        ],
      },
    ],
  },
  {
    id: "cocina",
    titulo: "Cocina · Recetas",
    ruta: "/cocina",
    roles: ["ADMIN", "COCINA"],
    resumen:
      "Consulta recetas de plato, escala porciones y registra lotes de salsas y otras preparaciones internas.",
    bloques: [
      {
        titulo: "Recetas de plato",
        puntos: [
          "La lista de abajo muestra todos los platos que ya tienen receta cargada; toca uno para abrir su ficha.",
          "Dentro de la ficha, cambia el número en “Porciones” y la cantidad de cada ingrediente se recalcula automáticamente en proporción a la receta base.",
          "Debajo aparecen los pasos de preparación numerados en el orden en que se cargaron.",
        ],
      },
      {
        titulo: "Preparaciones internas (salsas de lote)",
        puntos: [
          "Arriba están las salsas y bases que se preparan por galón u otro lote. No se venden: al registrar un lote salen los crudos y entra la salsa al inventario.",
          "En la ficha, indica cuántos lotes vas a hacer. El preview muestra qué baja (leche, crema, harina…) y cuánta salsa entra.",
          "Pulsa Registrar lote cuando el lote esté listo. Si te equivocaste, Anular en “Lotes recientes” devuelve los crudos y quita la salsa entrada.",
          "Cuando Ventas registra un plato que usa esa salsa, solo se descuenta la salsa — los crudos ya salieron al preparar el lote.",
        ],
      },
    ],
  },
  {
    id: "dashboard",
    titulo: "Dashboard",
    ruta: "/dashboard",
    roles: ["ADMIN"],
    resumen:
      "Vista general del negocio: lo que se está vendiendo hoy en vivo, alertas de stock y los platos más y menos vendidos.",
    bloques: [
      {
        puntos: [
          "“Hoy” se actualiza en vivo con lo que van marcando los camareros en Ventas, con el total del día.",
          "Los tres indicadores de arriba son: ventas del período mostrado, días con registro, e ingredientes bajo mínimo (se pone en rojo si hay alguno).",
          "Si hay ingredientes en alerta, aparecen listados justo debajo, en rojo, con su stock actual y su mínimo.",
          "Las gráficas muestran ventas por día y por categoría.",
          "Top 10 más vendidos y Top 10 menos vendidos rankean los platos por unidades vendidas, no por dinero.",
        ],
      },
    ],
  },
  {
    id: "admin",
    titulo: "Administración",
    ruta: "/admin",
    roles: ["ADMIN"],
    resumen:
      "Panel para dar de alta o modificar todo lo que las demás pantallas usan: platos, ingredientes, categorías, recetas, preparaciones internas, y corregir ventas de cualquier día.",
    bloques: [
      {
        titulo: "Pestaña Platos",
        puntos: [
          "El formulario de arriba crea un plato nuevo: el id va en minúsculas y con guiones, sin espacios ni tildes (por ejemplo “pollo-guisado”); si dejas el precio vacío, el plato queda oculto en la carta pública.",
          "Cada plato de la lista se edita en su propia tarjeta: nombre, precio, descripción, y las casillas Disponible, Favorito e Incluye guarnición. Pulsa Guardar en esa tarjeta para aplicar los cambios.",
          "Subir foto reemplaza la imagen del plato — elige un archivo de imagen y pulsa el botón junto al selector.",
        ],
      },
      {
        titulo: "Pestaña Ingredientes",
        puntos: [
          "El formulario de arriba crea un ingrediente nuevo con su id, nombre, unidad (g, ml o ud) y stock mínimo inicial.",
          "En la tabla, edita nombre, unidad, stock actual y mínimo directo en la fila y pulsa Guardar.",
          "Borrar pide confirmación porque también elimina las líneas de receta que usan ese ingrediente y su historial de movimientos —úsalo solo si el producto ya no existe de verdad.",
        ],
      },
      {
        titulo: "Pestaña Categorías",
        puntos: [
          "Crea categorías con id, nombre, tipo (Comida o Bebida) y el orden en que aparecen en la carta.",
          "Marca “Interna” para categorías que no deben salir en la carta pública (por ejemplo, consumo de empleados).",
        ],
      },
      {
        titulo: "Pestaña Recetas",
        puntos: [
          "Elige el plato, escribe los minutos de preparación, los pasos (uno por línea) y la lista de ingredientes con la cantidad que usa la receta.",
          "Esta es la receta que Ventas usa para descontar inventario automáticamente y que Cocina usa para escalar porciones — mantenerla exacta es lo que hace confiable el resto del sistema.",
          "Pulsa Guardar receta para aplicar los cambios.",
        ],
      },
      {
        titulo: "Pestaña Preparaciones",
        puntos: [
          "Una preparación interna produce un producto de inventario (por ejemplo Salsa Alfredo Blanca). Primero crea ese producto en Ingredientes si no existe.",
          "Indica el rendimiento de 1 lote (en la unidad del producto: ml, g o ud) y los ingredientes crudos que consume ese lote.",
          "Una salsa puede usar otra salsa ya preparada (Salsa del Rey encima de Alfredo). El sistema no deja guardar un ciclo.",
          "Cocina registra cada lote desde su pantalla; aquí solo se define la receta.",
        ],
      },
      {
        titulo: "Pestaña Ventas",
        puntos: [
          "Filtra por fecha y busca por plato, guarnición o camarero para encontrar una venta puntual de cualquier día.",
          "Borrar anula esa venta y repone el inventario que había descontado — es la forma de corregir errores de un día específico sin tener que ir turno por turno desde Ventas.",
        ],
      },
    ],
  },
];

export default async function GuiaPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const role = session.user.role;
  const visibles = SECTIONS.filter((s) => s.roles.includes(role));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-fa-primary">Guía de uso</h1>
        <p className="mt-1 text-sm text-fa-muted">
          Cómo usar cada pantalla a la que tienes acceso como{" "}
          {ROLE_LABEL[role]}. Toca un tema para abrirlo.
        </p>
      </div>

      <nav className="flex flex-wrap gap-2">
        {visibles.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="rounded-[10px] border border-fa-border px-3 py-1.5 text-sm text-fa-primary hover:bg-fa-bg"
          >
            {s.titulo}
          </a>
        ))}
      </nav>

      <div className="space-y-4">
        {visibles.map((s) => (
          <details
            key={s.id}
            id={s.id}
            className="scroll-mt-20 rounded-[10px] border border-fa-border bg-fa-surface p-4 open:pb-5"
          >
            <summary className="cursor-pointer list-none">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-lg font-semibold text-fa-primary">
                  {s.titulo}
                </h2>
                <span className="text-xs text-fa-muted">{s.ruta}</span>
              </div>
              <p className="mt-1 text-sm text-fa-muted">{s.resumen}</p>
            </summary>
            <div className="mt-4 space-y-4 border-t border-fa-border pt-4">
              {s.bloques.map((b, i) => (
                <div key={i}>
                  {b.titulo ? (
                    <h3 className="text-sm font-semibold text-fa-primary">
                      {b.titulo}
                    </h3>
                  ) : null}
                  <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-fa-text">
                    {b.puntos.map((p, j) => (
                      <li key={j}>{p}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
