import type { UserRole } from "@/modules/users/domain/user";

const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Administrador",
  agent: "Agente",
};

/**
 * Spanish label of a role, as shown to users (app shell, "Mi cuenta").
 * Kept in one place so every screen names the roles the same way.
 */
export function getRoleLabel(role: UserRole): string {
  return ROLE_LABELS[role];
}
