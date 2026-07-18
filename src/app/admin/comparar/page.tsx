import { requireRole } from "@/lib/auth/server";
import { PostgresOperationalRepository } from "@/lib/database/postgres-operational-repository";
import { PostgresWorkbookSyncRepository } from "@/lib/database/postgres-workbook-sync-repository";
import { workbookId } from "@/lib/excel/workbook-mapping";
import { buildCompany360Model, selectPilotCompanies } from "@/features/company360/company-360-model";
import { buildComparisonModel } from "@/features/comparison/comparison-model";
import { ComparisonView } from "@/features/comparison/comparison-view";

export const metadata = { title: "Comparador executivo" };
export const dynamic = "force-dynamic";

type Search = { empresa?: string | string[]; metrica?: string };

function selectedValues(value: Search["empresa"]): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

export default async function AdminComparePage({ searchParams }: { searchParams: Promise<Search> }) {
  await requireRole("admin");
  const search = await searchParams;
  const operational = new PostgresOperationalRepository();
  let companies;
  let proposals;
  let baseline;
  try {
    [companies, proposals, baseline] = await Promise.all([
      operational.listCompanyDiagnostics(),
      operational.listProposals(),
      new PostgresWorkbookSyncRepository().getLatestResultSnapshot(workbookId),
    ]);
  } catch {
    return <><header className="admin-title"><p className="eyebrow">Comparador executivo</p><h1>Banco operacional indisponível.</h1></header><p className="notice" role="alert">Não foi possível carregar a coorte e a linha de base controlada.</p></>;
  }
  const pilotIds = selectPilotCompanies(companies);
  const pilotCompanies = pilotIds.map((id) => companies.find((company) => company.id === id)).filter((company) => company !== undefined);
  const requested = selectedValues(search.empresa).filter((id) => pilotIds.includes(id)).slice(0, 4);
  const selectedIds = requested.length >= 2 ? requested : pilotIds.slice(0, 4);
  const selectedCompanies = selectedIds.map((id) => companies.find((company) => company.id === id)).filter((company) => company !== undefined);
  const companyModels = selectedCompanies.map((company) => buildCompany360Model({ company, companies, proposals, baseline }));
  const model = buildComparisonModel(companyModels, search.metrica);
  return <ComparisonView model={model} pilotCompanies={pilotCompanies} selectedIds={selectedIds}/>;
}
