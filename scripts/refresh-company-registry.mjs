#!/usr/bin/env node
/**
 * Recalcula o cadastro e a cobertura das empresas no banco operacional a partir da
 * planilha mestre — porta fiel de parseMasterWorkbook + synchronizeWorkbook para a
 * linha de comando (a action do app lê a mestre do filesystem e só funciona local).
 * Necessário sempre que a ABA 01 muda (o sync de células cobre apenas Abas 02/03/04).
 *
 * Uso: node --env-file=.env.local scripts/refresh-company-registry.mjs --mestre <caminho> [--commit]
 */
import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
import postgres from "postgres";

function arg(flag) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}
const mestrePath = arg("--mestre");
const commit = process.argv.includes("--commit");
if (!mestrePath) {
  console.error("Informe --mestre <caminho da planilha>."); process.exit(1);
}

const SHEETS = {
  companies: "01. Cadastro empresas",
  financial: "02. Dados Financeiros",
  qualitative: "03. Dados Qualitativos",
  market: "04. Mercado (listadas)",
};

function text(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    if ("text" in value) return String(value.text ?? "").trim();
    if ("result" in value) return text(value.result);
    if ("richText" in value) return value.richText.map((part) => part.text).join("").trim();
  }
  return String(value).trim();
}
function normalizeCompanyName(value) {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
const slugify = (value) => normalizeCompanyName(value).replace(/\s+/g, "-") || "empresa";
function numberValue(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(text(value).replace("%", "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}
function yearValue(value) {
  const parsed = numberValue(value);
  return parsed && parsed >= 1900 && parsed <= 2200 ? Math.trunc(parsed) : null;
}
function parseWindow(value, eventYear) {
  const years = text(value).match(/(?:19|20)\d{2}/g)?.map(Number) ?? [];
  if (years.length >= 2) return [years[0], years[years.length - 1]];
  return eventYear ? [eventYear - 5, eventYear + 4] : [null, null];
}
function parseCompletion(value) {
  const parsed = numberValue(value);
  if (parsed === null) return null;
  return Math.max(0, Math.min(1, parsed > 1 ? parsed / 100 : parsed));
}
function hasData(value) {
  if (typeof value === "number" || value instanceof Date) return true;
  const normalized = normalizeCompanyName(text(value));
  return normalized !== "" && !["n d", "nd", "n a", "na", "nao disponivel", "nao aplicavel", "sem dados"].includes(normalized);
}
function tierFrom(value) {
  const normalized = normalizeCompanyName(text(value));
  if (normalized.includes("tier 1") || normalized === "t1") return "tier_1";
  if (normalized.includes("tier 2") || normalized === "t2") return "tier_2";
  return "unclassified";
}
const expectedYears = (start, end) => (start && end && end >= start ? end - start + 1 : 0);

function addSheetCoverage(sheet, lookup, counters, firstCol, lastCol, target) {
  for (let rowNumber = 1; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const companyId = lookup.get(normalizeCompanyName(text(row.getCell(1).value)));
    const year = yearValue(row.getCell(2).value);
    if (!companyId || !year) continue;
    const c = counters.get(companyId);
    if (!c) continue;
    let filled = 0;
    for (let column = firstCol; column <= lastCol; column += 1) {
      if (hasData(row.getCell(column).value)) filled += 1;
    }
    c[target] += filled;
    if (filled > 0) {
      c.researchedYears.add(year);
      c.lastDataYear = Math.max(c.lastDataYear ?? year, year);
    }
  }
}

const buffer = readFileSync(mestrePath);
const workbook = new ExcelJS.Workbook();
await workbook.xlsx.load(buffer);
const sheet = workbook.getWorksheet(SHEETS.companies);
if (!sheet) throw new Error("Aba 01 ausente.");
const hash = createHash("sha256").update(buffer).digest("hex");
const calculatedAt = new Date().toISOString();

const records = [];
const lookup = new Map();
const counters = new Map();
for (let rowNumber = 1; rowNumber <= sheet.rowCount; rowNumber += 1) {
  const row = sheet.getRow(rowNumber);
  const ordinal = numberValue(row.getCell(1).value);
  const name = text(row.getCell(4).value);
  if (!ordinal || !name) continue;
  const eventYear = yearValue(row.getCell(7).value);
  const [collectionStartYear, collectionEndYear] = parseWindow(row.getCell(8).value, eventYear);
  const companyId = `workbook:${Math.trunc(ordinal)}`;
  lookup.set(normalizeCompanyName(name), companyId);
  counters.set(companyId, { financialFilled: 0, qualitativeFilled: 0, marketFilled: 0, researchedYears: new Set(), lastDataYear: null });
  records.push({
    id: companyId, slug: `${slugify(name)}-${Math.trunc(ordinal)}`, name,
    tier: tierFrom(row.getCell(2).value), companyType: text(row.getCell(3).value) || null,
    referenceCode: text(row.getCell(5).value) || null, sector: text(row.getCell(6).value) || "Não classificado",
    eventYear, collectionStartYear, collectionEndYear,
    workbookStatus: text(row.getCell(10).value) || null, workbookCompletion: parseCompletion(row.getCell(11).value),
    workbookRow: rowNumber,
  });
}
addSheetCoverage(workbook.getWorksheet(SHEETS.financial), lookup, counters, 4, 27, "financialFilled");
addSheetCoverage(workbook.getWorksheet(SHEETS.qualitative), lookup, counters, 3, 10, "qualitativeFilled");
addSheetCoverage(workbook.getWorksheet(SHEETS.market), lookup, counters, 4, 7, "marketFilled");

console.log(`${records.length} empresas na Aba 01 de ${path.basename(mestrePath)} (hash ${hash.slice(0, 12)}…)`);
if (!commit) {
  const exemplo = records.filter((r) => ["Rossi Residencial", "Atma Participações", "Casas Bahia (2ª)"].includes(r.name));
  for (const r of exemplo) console.log(`  ${r.name}: evento ${r.eventYear}, janela ${r.collectionStartYear}-${r.collectionEndYear} (${r.id})`);
  console.log("(dry-run; --commit para gravar no banco)");
  process.exit(0);
}

const sql = postgres(process.env.DATABASE_URL, { max: 1, connect_timeout: 10 });
try {
  await sql.begin(async (tx) => {
    // workbook_row é único e as inserções de linha na mestre deslocam todo mundo:
    // zera antes e deixa o upsert repovoar na mesma transação.
    await tx`update companies set workbook_row = null`;
    for (const c of records) {
      await tx`
        insert into companies (
          id, slug, name, tier, sector, event_type, event_year, publication_status,
          workbook_row, company_type, reference_code, collection_start_year,
          collection_end_year, workbook_status, workbook_completion,
          source_workbook_hash, coverage_updated_at
        ) values (
          ${c.id}, ${c.slug}, ${c.name}, ${c.tier}, ${c.sector}, 'judicial_recovery',
          ${c.eventYear}, 'private', ${c.workbookRow}, ${c.companyType}, ${c.referenceCode},
          ${c.collectionStartYear}, ${c.collectionEndYear}, ${c.workbookStatus},
          ${c.workbookCompletion}, ${hash}, ${calculatedAt}
        )
        on conflict (id) do update set
          slug = excluded.slug, name = excluded.name, tier = excluded.tier,
          sector = excluded.sector, event_year = excluded.event_year,
          workbook_row = excluded.workbook_row, company_type = excluded.company_type,
          reference_code = excluded.reference_code,
          collection_start_year = excluded.collection_start_year,
          collection_end_year = excluded.collection_end_year,
          workbook_status = excluded.workbook_status,
          workbook_completion = excluded.workbook_completion,
          source_workbook_hash = excluded.source_workbook_hash,
          coverage_updated_at = excluded.coverage_updated_at,
          updated_at = now()`;
      const k = counters.get(c.id);
      const years = expectedYears(c.collectionStartYear, c.collectionEndYear);
      const listed = normalizeCompanyName(c.companyType ?? "").includes("listada");
      await tx`
        insert into company_coverage (
          company_id, financial_filled, financial_expected, qualitative_filled,
          qualitative_expected, market_filled, market_expected, researched_years,
          total_years, last_data_year, workbook_hash, calculated_at
        ) values (
          ${c.id}, ${k.financialFilled}, ${years * 24}, ${k.qualitativeFilled},
          ${c.tier === "tier_1" ? years * 8 : 0}, ${k.marketFilled}, ${listed ? years * 4 : 0},
          ${k.researchedYears.size}, ${years}, ${k.lastDataYear}, ${hash}, ${calculatedAt}
        )
        on conflict (company_id) do update set
          financial_filled = excluded.financial_filled,
          financial_expected = excluded.financial_expected,
          qualitative_filled = excluded.qualitative_filled,
          qualitative_expected = excluded.qualitative_expected,
          market_filled = excluded.market_filled,
          market_expected = excluded.market_expected,
          researched_years = excluded.researched_years,
          total_years = excluded.total_years,
          last_data_year = excluded.last_data_year,
          workbook_hash = excluded.workbook_hash,
          calculated_at = excluded.calculated_at`;
    }
    await tx`
      insert into audit_events (id, action, entity_id, actor_id, occurred_at, previous_version, resulting_version, reason, origin)
      values (${randomUUID()}, 'workbook.coverage_refreshed', ${hash}, 'demo-admin', ${calculatedAt}, ${null}, 1,
              ${`Cadastro e cobertura recalculados via refresh-company-registry.mjs; ${records.length} empresas.`}, 'excel')`;
  });
  console.log(`Cadastro atualizado: ${records.length} empresas + cobertura + evento de auditoria.`);
} finally {
  await sql.end();
}
