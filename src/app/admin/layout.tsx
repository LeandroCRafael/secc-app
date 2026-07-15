import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/server";
import { isPublicPreview } from "@/lib/runtime/public-preview";

export const dynamic = "force-dynamic";

const adminLinks = [["Visão geral", "/admin"], ["Pesquisa", "/admin/pesquisa"], ["Importações", "/admin/importacoes"], ["Revisões", "/admin/revisoes"], ["Conflitos", "/admin/conflitos"], ["Sincronização", "/admin/sincronizacao"], ["Auditoria", "/admin/auditoria"], ["Banco local", "/admin/banco"]] as const;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (isPublicPreview()) redirect("/construindo");
  const user = await requireRole("curator");
  return <main className="shell"><div className="admin-shell"><aside><p className="eyebrow">Curadoria protegida</p><p><strong>{user.name}</strong><br/><span className="status">{user.role} · demo</span></p><nav className="admin-nav" aria-label="Navegação de curadoria">{adminLinks.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}</nav></aside><div className="admin-main">{children}</div></div></main>;
}
