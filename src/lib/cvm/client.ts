import JSZip from "jszip";
import { parse } from "csv-parse/sync";
import { normalizeCompanyName } from "@/lib/workbook/master-workbook";

const CADASTRO_URL = "https://dados.cvm.gov.br/dados/CIA_ABERTA/CAD/DADOS/cad_cia_aberta.csv";
const DFP_URL = (year: number) => `https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/DFP/DADOS/dfp_cia_aberta_${year}.zip`;

export interface CvmCompany {
  cnpj: string;
  corporateName: string;
  tradeName: string;
  cvmCode: string;
  sector: string;
  status: string;
}

export interface CvmMetric {
  variable: string;
  value: number;
  accountCode: string;
  statement: string;
  basis: string;
}

type CvmRow = Record<string, string>;

function decode(buffer: ArrayBuffer | Uint8Array): string {
  return new TextDecoder("windows-1252").decode(buffer);
}

function csvRecords(content: string): CvmRow[] {
  return parse(content, { columns: true, delimiter: ";", skip_empty_lines: true, relax_column_count: true, relax_quotes: true, bom: true, trim: true });
}

function digits(value: string): string { return value.replace(/\D/g, ""); }

export async function searchCvmCompanies(query: string): Promise<CvmCompany[]> {
  const normalized = normalizeCompanyName(query);
  const numeric = digits(query);
  if (normalized.length < 2 && numeric.length < 3) return [];
  const response = await fetch(CADASTRO_URL, { next: { revalidate: 86_400 }, signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`Cadastro CVM indisponível (HTTP ${response.status}).`);
  const rows = csvRecords(decode(await response.arrayBuffer()));
  return rows.map((row) => ({
    cnpj: digits(row.CNPJ_CIA ?? ""), corporateName: row.DENOM_SOCIAL ?? "",
    tradeName: row.DENOM_COMERC ?? "", cvmCode: row.CD_CVM ?? "",
    sector: row.SETOR_ATIV ?? "", status: row.SIT ?? row.SIT_EMISSOR ?? "",
  })).map((company) => {
    const haystack = normalizeCompanyName(`${company.corporateName} ${company.tradeName}`);
    let score = haystack === normalized ? 100 : haystack.startsWith(normalized) ? 80 : haystack.includes(normalized) ? 60 : 0;
    if (numeric && (company.cnpj.includes(numeric) || company.cvmCode === numeric)) score = 120;
    const tokens = normalized.split(" ").filter((token) => token.length > 2);
    score += tokens.filter((token) => haystack.includes(token)).length * 5;
    return { company, score };
  }).filter(({ score }) => score > 0).sort((a, b) => b.score - a.score || a.company.corporateName.localeCompare(b.company.corporateName)).slice(0, 20).map(({ company }) => company);
}

function parseCvmNumber(row: CvmRow): number | null {
  const raw = (row.VL_CONTA ?? "").replace(/\./g, "").replace(",", ".");
  const value = Number(raw);
  if (!Number.isFinite(value)) return null;
  const scale = normalizeCompanyName(row.ESCALA_MOEDA ?? "mil");
  return scale.includes("unidade") ? value / 1_000_000 : value / 1_000;
}

function latestRows(rows: CvmRow[], cnpj: string): CvmRow[] {
  const selected = rows.filter((row) => digits(row.CNPJ_CIA ?? "") === cnpj && normalizeCompanyName(row.ORDEM_EXERC ?? "ultimo").includes("ultimo"));
  return selected.length > 0 ? selected : rows.filter((row) => digits(row.CNPJ_CIA ?? "") === cnpj);
}

function account(rows: CvmRow[], code: string): number | null {
  const row = rows.find((item) => item.CD_CONTA === code);
  return row ? parseCvmNumber(row) : null;
}

function add(metrics: CvmMetric[], variable: string, value: number | null, accountCode: string, statement: string, basis: string): void {
  if (value !== null && Number.isFinite(value)) metrics.push({ variable, value, accountCode, statement, basis });
}

function findFile(zip: JSZip, fragment: string, consolidated: boolean): JSZip.JSZipObject | undefined {
  const marker = consolidated ? "_con_" : "_ind_";
  return Object.values(zip.files).find((file) => !file.dir && file.name.toLowerCase().includes(fragment.toLowerCase()) && file.name.toLowerCase().includes(marker));
}

async function statementRows(zip: JSZip, fragment: string, cnpj: string): Promise<{ rows: CvmRow[]; basis: string }> {
  const consolidated = findFile(zip, fragment, true);
  const individual = findFile(zip, fragment, false);
  const file = consolidated ?? individual;
  if (!file) return { rows: [], basis: "não localizada" };
  return { rows: latestRows(csvRecords(decode(await file.async("uint8array"))), cnpj), basis: consolidated ? "consolidado" : "individual" };
}

export async function collectCvmDfp(cnpjInput: string, year: number): Promise<{ metrics: CvmMetric[]; sourceUrl: string; basis: string }> {
  const cnpj = digits(cnpjInput);
  const sourceUrl = DFP_URL(year);
  const response = await fetch(sourceUrl, { signal: AbortSignal.timeout(45_000) });
  if (!response.ok) throw new Error(`DFP ${year} indisponível na CVM (HTTP ${response.status}).`);
  const zip = await JSZip.loadAsync(await response.arrayBuffer());
  const [dre, bpa, bpp, dfc, dva] = await Promise.all([
    statementRows(zip, "_DRE_", cnpj), statementRows(zip, "_BPA_", cnpj),
    statementRows(zip, "_BPP_", cnpj), statementRows(zip, "_DFC_", cnpj),
    statementRows(zip, "_DVA_", cnpj),
  ]);
  if (dre.rows.length === 0 && bpa.rows.length === 0) throw new Error("A empresa não foi localizada na DFP selecionada.");
  const metrics: CvmMetric[] = [];
  const revenue = account(dre.rows, "3.01");
  const grossProfit = account(dre.rows, "3.03");
  const ebit = account(dre.rows, "3.05");
  const assets = account(bpa.rows, "1");
  const equity = account(bpp.rows, "2.03");
  const cash = (account(bpa.rows, "1.01.01") ?? 0) + (account(bpa.rows, "1.01.02") ?? 0);
  add(metrics, "Receita Líquida", revenue, "3.01", "DRE", dre.basis);
  add(metrics, "CMV", revenue !== null && grossProfit !== null ? revenue - grossProfit : null, "3.01 - 3.03", "DRE", `${dre.basis}; derivado`);
  add(metrics, "Lucro Bruto", grossProfit, "3.03", "DRE", dre.basis);
  add(metrics, "Despesas Operacionais", ebit !== null && grossProfit !== null ? ebit - grossProfit : null, "3.05 - 3.03", "DRE", `${dre.basis}; derivado`);
  add(metrics, "EBIT", ebit, "3.05", "DRE", dre.basis);
  add(metrics, "Resultado Financeiro", account(dre.rows, "3.06"), "3.06", "DRE", dre.basis);
  add(metrics, "Lucro Líquido", account(dre.rows, "3.11") ?? account(dre.rows, "3.11.01"), "3.11", "DRE", dre.basis);
  add(metrics, "Caixa + Equiv.", cash || null, "1.01.01 + 1.01.02", "BPA", bpa.basis);
  add(metrics, "Contas a Receber", account(bpa.rows, "1.01.03"), "1.01.03", "BPA", bpa.basis);
  add(metrics, "Estoques", account(bpa.rows, "1.01.04"), "1.01.04", "BPA", bpa.basis);
  add(metrics, "Ativo Circulante", account(bpa.rows, "1.01"), "1.01", "BPA", bpa.basis);
  add(metrics, "Imobilizado", account(bpa.rows, "1.02.03"), "1.02.03", "BPA", bpa.basis);
  add(metrics, "Ativo Total", assets, "1", "BPA", bpa.basis);
  add(metrics, "Fornecedores", account(bpp.rows, "2.01.02"), "2.01.02", "BPP", bpp.basis);
  add(metrics, "Empréstimos CP", account(bpp.rows, "2.01.04"), "2.01.04", "BPP", bpp.basis);
  add(metrics, "Passivo Circulante", account(bpp.rows, "2.01"), "2.01", "BPP", bpp.basis);
  add(metrics, "Empréstimos LP", account(bpp.rows, "2.02.01"), "2.02.01", "BPP", bpp.basis);
  add(metrics, "Passivo Total", assets !== null && equity !== null ? assets - equity : null, "1 - 2.03", "BPA/BPP", "derivado");
  add(metrics, "Patrimônio Líquido", equity, "2.03", "BPP", bpp.basis);
  add(metrics, "FCO", account(dfc.rows, "6.01"), "6.01", "DFC", dfc.basis);
  add(metrics, "Variação de Caixa", account(dfc.rows, "6.05"), "6.05", "DFC", dfc.basis);
  add(metrics, "Despesas com Pessoal", account(dva.rows, "7.08.01"), "7.08.01", "DVA", dva.basis);
  return { metrics, sourceUrl, basis: dre.basis };
}
