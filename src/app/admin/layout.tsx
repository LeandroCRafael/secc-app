import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/server";
import { hasOperationalDatabase } from "@/lib/diagnostics/internal-snapshot";
import { isPublicPreview } from "@/lib/runtime/public-preview";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false, nocache: true } };

const adminLinks = [
  ["Dashboard", "/admin"], ["Visão mestre", "/admin/empresas"], ["Comparador", "/admin/comparar"], ["Score experimental", "/admin/score"], ["Pesquisa CVM", "/admin/cvm"],
  ["Entrada manual", "/admin/pesquisa"], ["Importações", "/admin/importacoes"], ["Revisões", "/admin/revisoes"],
  ["Conflitos", "/admin/conflitos"], ["Sincronização", "/admin/sincronizacao"], ["Auditoria", "/admin/auditoria"],
  ["Banco operacional", "/admin/banco"],
] as const;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (isPublicPreview()) redirect("/construindo");
  const user = await requireRole("curator");
  const operational = hasOperationalDatabase();
  const links = operational ? adminLinks : adminLinks.slice(0, 2);
  return <main className="shell"><div className="admin-shell"><aside><p className="eyebrow">Curadoria protegida</p><p><strong>{user.name}</strong><br/><span className="status">{user.role} · {operational ? "banco persistente" : "espelho interno"}</span></p><nav className="admin-nav" aria-label="Navegação de curadoria">{links.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}</nav></aside><div className="admin-main">{children}</div></div></main>;
}
