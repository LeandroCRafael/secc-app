import Link from "next/link";
import { requireRole } from "@/lib/auth/server";
import { loadDiagnosticData } from "@/lib/diagnostics/internal-snapshot";
import { WorkbookRefreshForm } from "@/features/diagnostics/workbook-refresh-form";
import { CoverageDistributionChart, TierCoverageChart } from "@/features/diagnostics/dashboard-charts";
import { DiagnosticTabs } from "@/features/diagnostics/diagnostic-tabs";
import { buildDashboardModel, priorityLabels } from "@/features/diagnostics/dashboard-model";

export const metadata = { title: "Dashboard mestre" };
export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  await requireRole("admin");
  let model;
  let dataSource;
  try {
    dataSource = await loadDiagnosticData();
    model = buildDashboardModel(dataSource.companies, dataSource.proposals);
  } catch {
    return <><header className="admin-title"><p className="eyebrow">Dashboard mestre</p><h1>Banco local indisponível.</h1></header><p className="notice" role="alert">Inicie o Docker e execute as migrações antes de atualizar a planilha.</p></>;
  }

  return <>
    <DiagnosticTabs active="dashboard" />
    <header className="admin-title dashboard-title">
      <div><p className="eyebrow">Planilha mestre · espelho operacional</p><h1>O que temos, o que falta e onde agir.</h1><p className="lede">A mesma leitura executiva do Excel, calculada sobre a base operacional privada. Nenhum valor é publicado ou aprovado automaticamente.</p></div>
      <div className="dashboard-actions">{dataSource.mode === "operational" ? <WorkbookRefreshForm /> : <span className="status">Espelho interno · somente leitura</span>}{model.latestCalculation && <p className="muted">Último cálculo: {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(model.latestCalculation))}</p>}{dataSource.generatedAt && <p className="muted">Snapshot publicado: {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(dataSource.generatedAt))}</p>}</div>
    </header>

    <section className="metric-strip" aria-label="Indicadores principais da planilha mestre">
      <article className="metric-card tone-navy"><span>Empresas no universo</span><strong>{model.total}</strong></article>
      <article className="metric-card tone-green"><span>Com dados financeiros</span><strong>{model.withFinancial}</strong></article>
      <article className="metric-card tone-red"><span>Sem dados financeiros</span><strong>{model.withoutFinancial}</strong></article>
      <article className="metric-card tone-teal"><span>Cobertura financeira ≥ 90%</span><strong>{model.highCoverage}</strong></article>
      <article className="metric-card tone-teal"><span>Com dados qualitativos</span><strong>{model.withQualitative}</strong></article>
      <article className="metric-card tone-amber"><span>Com dados de mercado</span><strong>{model.withMarket}</strong></article>
      <article className="metric-card tone-red"><span>Empresas bloqueadas</span><strong>{model.blocked}</strong></article>
      <article className="metric-card tone-green"><span>Status da reconciliação</span><strong className="metric-status">{model.total > 0 ? "Base reconciliada" : "Revisar"}</strong></article>
    </section>

    <section className="dashboard-grid" aria-label="Gráficos de cobertura"><TierCoverageChart data={model.tiers} /><CoverageDistributionChart data={model.bands} /></section>

    <section className="dashboard-grid dashboard-grid-small">
      <article className="dashboard-panel"><div className="panel-heading"><div><p className="eyebrow">Cadastro</p><h3>Estágio informado no Excel</h3></div></div><div className="status-summary">{model.workbookStatuses.map((status) => <div key={status.label}><span>{status.label}</span><strong>{status.value}</strong></div>)}</div></article>
      <article className="dashboard-panel"><div className="panel-heading"><div><p className="eyebrow">Fila de ação</p><h3>Prioridade calculada</h3></div><Link href="/admin/empresas">Abrir visão mestre →</Link></div><div className="priority-summary">{Object.entries(model.priorityCounts).map(([priority, value]) => <div key={priority}><span className={`priority priority-${priority}`}>{priorityLabels[priority as keyof typeof priorityLabels]}</span><strong>{value}</strong></div>)}</div><p className="muted">{model.pendingProposals} proposta(s) aguardam revisão, conflito ou decisão.</p></article>
    </section>

    <section className="dashboard-callout"><div><p className="eyebrow">Leitura executiva</p><h2>O próximo ganho é completar, revisar e publicar com controle.</h2></div><ol><li>Concluir Tier 1 sem dados ou abaixo de 90% de cobertura financeira.</li><li>Expandir o qualitativo além do nome do auditor.</li><li>Automatizar mercado para listadas e manter a fila de revisão.</li></ol></section>
  </>;
}
