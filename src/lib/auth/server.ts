import "server-only";
import { isPublicPreview } from "@/lib/runtime/public-preview";
import type { Role } from "@/types/domain";

const roleWeight: Record<Role, number> = { public: 0, curator: 1, reviewer: 2, admin: 3 };

export interface SessionUser {
  id: string;
  name: string;
  role: Role;
  demo: true;
}

export async function getSessionUser(): Promise<SessionUser> {
  if (isPublicPreview()) throw new Error("A área administrativa não está habilitada na prévia pública.");
  // Adaptador local explícito. Será substituído pelo provedor aprovado sem alterar o domínio.
  return { id: "demo-admin", name: "Administrador de demonstração", role: "admin", demo: true };
}

export async function requireRole(minimum: Role): Promise<SessionUser> {
  const user = await getSessionUser();
  if (roleWeight[user.role] < roleWeight[minimum]) throw new Error("Acesso não autorizado.");
  return user;
}
