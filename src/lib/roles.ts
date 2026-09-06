export type AppRole = "ADMIN" | "CAMARERO" | "COCINA";

export const ROLE_LABEL: Record<AppRole, string> = {
  ADMIN: "Administradora",
  CAMARERO: "Camarero",
  COCINA: "Cocina",
};

export function homeForRole(role: AppRole): string {
  if (role === "ADMIN") return "/dashboard";
  if (role === "CAMARERO") return "/ventas";
  return "/cocina";
}

export function canRegisterSales(role: AppRole): boolean {
  return role === "ADMIN" || role === "CAMARERO";
}

export function isAdmin(role: AppRole): boolean {
  return role === "ADMIN";
}

export function canManagePrep(role: AppRole): boolean {
  return role === "ADMIN" || role === "COCINA";
}
