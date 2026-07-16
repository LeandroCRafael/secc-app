import Link from "next/link";
import { requireRole } from "@/lib/auth/server";
import { PostgresOperationalRepository } from "@/lib/database/postgres-operational-repository";
import { companyWorkspacePath } from "@/lib/navigation/admin-return";
import { UploadPreview } from "@/features/imports/upload-preview";

export const metadata = { title: "Importações" };
export const dynamic = "force-dynamic";

export default async function ImportsPage({ searchParams }: { searchParams: Promise<{ companyId?: string }> }) {
  await requireRole("admin");
  const { companyId } = await searchParams;
  let companyName: string | undefined;
  if (companyId) {
    try { companyName = (await new PostgresOperationalRepository().listCompanies()).find((company) => company.id === companyId)?.name; }
    catch { companyName = undefined; }
  }

  return <>
    {companyId && <Link className="back-link" href={companyWorkspacePath(companyId)}>← Voltar à estação da empresa</Link>}
    <header className="admin-title"><p className="eyebrow">Arquivos não confiáveis</p><h1>Validar antes de armazenar ou mapear.</h1><p className="lede">Esta etapa verifica extensão, MIME, tamanho e assinatura. O arquivo não cria propostas nem atualiza a planilha automaticamente.</p></header>
    <UploadPreview context={companyName}/>
    <p className="notice">O mapeamento de linhas e colunas para propostas será implementado depois da validação do padrão de arquivo. Até lá, use a entrada manual ou a coleta CVM.</p>
  </>;
}
