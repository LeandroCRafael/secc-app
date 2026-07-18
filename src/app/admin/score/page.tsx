import { requireRole } from "@/lib/auth/server";
import { PostgresOperationalRepository } from "@/lib/database/postgres-operational-repository";
import { PostgresWorkbookSyncRepository } from "@/lib/database/postgres-workbook-sync-repository";
import { workbookId } from "@/lib/excel/workbook-mapping";
import { buildCompany360Model, selectPilotCompanies } from "@/features/company360/company-360-model";
import { buildScorePortfolio } from "@/features/scoring/score-model";
import { ScoreView } from "@/features/scoring/score-view";

export const metadata = { title: "Score experimental" };
export const dynamic = "force-dynamic";

export default async function ScorePage() {
  await requireRole("admin");
  const repository = new PostgresOperationalRepository();
  let score;
  try {
    const [companies, proposals, baseline] = await Promise.all([
      repository.listCompanyDiagnostics(),
      repository.listProposals(),
      new PostgresWorkbookSyncRepository().getLatestResultSnapshot(workbookId),
    ]);
    const pilot = new Set(selectPilotCompanies(companies));
    const models = companies.filter((company) => pilot.has(company.id)).map((company) => buildCompany360Model({ company, companies, proposals, baseline }));
    score = buildScorePortfolio(models);
  } catch {
    return <><header className="admin-title"><p className="eyebrow">Score experimental</p><h1>Banco operacional indisponível.</h1></header><p className="notice" role="alert">Não foi possível carregar a linha de base e a coorte piloto.</p></>;
  }
  return <ScoreView model={score} />;
}
