import { createHash } from "node:crypto";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import type { Company, CompanyCoverage, WorkbookSnapshot } from "@/types/domain";

const SHEETS = {
  companies: "01. Cadastro empresas",
  financial: "02. Dados Financeiros",
  qualitative: "03. Dados Qualitativos",
  market: "04. Mercado (listadas)",
} as const;

type Counters = {
  financialFilled: number;
  qualitativeFilled: number;
  marketFilled: number;
  financialYears: Set<number>;
  researchedYears: Set<number>;
  lastDataYear: number | null;
};

function text(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    if ("text" in value) return String(value.text ?? "").trim();
    if ("result" in value) return text(value.result as ExcelJS.CellValue);
    if ("richText" in value) return value.richText.map((part) => part.text).join("").trim();
  }
  return String(value).trim();
}

export function normalizeCompanyName(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function slugify(value: string): string {
  return normalizeCompanyName(value).replace(/\s+/g, "-") || "empresa";
}

function numberValue(value: ExcelJS.CellValue): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(text(value).replace("%", "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function yearValue(value: ExcelJS.CellValue): number | null {
  const parsed = numberValue(value);
  return parsed && parsed >= 1900 && parsed <= 2200 ? Math.trunc(parsed) : null;
}

function parseWindow(value: ExcelJS.CellValue, eventYear: number | null): [number | null, number | null] {
  const years = text(value).match(/(?:19|20)\d{2}/g)?.map(Number) ?? [];
  if (years.length >= 2) return [years[0]!, years[years.length - 1]!];
  return eventYear ? [eventYear - 5, eventYear + 4] : [null, null];
}

function parseCompletion(value: ExcelJS.CellValue): number | null {
  const parsed = numberValue(value);
  if (parsed === null) return null;
  return Math.max(0, Math.min(1, parsed > 1 ? parsed / 100 : parsed));
}

function hasData(value: ExcelJS.CellValue): boolean {
  if (typeof value === "number" || value instanceof Date) return true;
  const normalized = normalizeCompanyName(text(value));
  return normalized !== "" && !["n d", "nd", "n a", "na", "nao disponivel", "nao aplicavel", "sem dados"].includes(normalized);
}

function tierFrom(value: ExcelJS.CellValue): Company["tier"] {
  const normalized = normalizeCompanyName(text(value));
  if (normalized.includes("tier 1") || normalized === "t1") return "tier_1";
  if (normalized.includes("tier 2") || normalized === "t2") return "tier_2";
  return "unclassified";
}

function expectedYears(start: number | null, end: number | null): number {
  return start && end && end >= start ? end - start + 1 : 0;
}

function requireSheet(workbook: ExcelJS.Workbook, name: string): ExcelJS.Worksheet {
  const sheet = workbook.getWorksheet(name);
  if (!sheet) throw new Error(`A planilha mestre não contém a aba obrigatória “${name}”.`);
  return sheet;
}

async function withoutLegacyComments(source: Buffer): Promise<Buffer> {
  const zip = await JSZip.loadAsync(source);
  for (const [name, file] of Object.entries(zip.files)) {
    const normalized = name.toLowerCase();
    if (/^xl\/comments\d+\.xml$/.test(normalized) || /^xl\/drawings\/vmldrawing\d+\.vml$/.test(normalized)) {
      zip.remove(name);
      continue;
    }
    if (normalized.startsWith("xl/worksheets/_rels/") && normalized.endsWith(".rels")) {
      const xml = await file.async("string");
      zip.file(name, xml.replace(/<Relationship\b(?=[^>]*Type="[^"]*(?:comments|vmlDrawing)")[^>]*\/>/gi, ""));
    }
    if (normalized.startsWith("xl/worksheets/") && normalized.endsWith(".xml")) {
      const xml = await file.async("string");
      zip.file(name, xml.replace(/<legacyDrawing\b[^>]*\/>/gi, ""));
    }
  }
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

function addSheetCoverage(
  sheet: ExcelJS.Worksheet,
  lookup: Map<string, string>,
  counters: Map<string, Counters>,
  firstDataColumn: number,
  lastDataColumn: number,
  target: "financialFilled" | "qualitativeFilled" | "marketFilled",
): void {
  for (let rowNumber = 1; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const companyId = lookup.get(normalizeCompanyName(text(row.getCell(1).value)));
    const year = yearValue(row.getCell(2).value);
    if (!companyId || !year) continue;
    const companyCounters = counters.get(companyId);
    if (!companyCounters) continue;
    let filled = 0;
    for (let column = firstDataColumn; column <= lastDataColumn; column += 1) {
      if (hasData(row.getCell(column).value)) filled += 1;
    }
    companyCounters[target] += filled;
    if (filled > 0) {
      companyCounters.researchedYears.add(year);
      companyCounters.lastDataYear = Math.max(companyCounters.lastDataYear ?? year, year);
    }
    if (target === "financialFilled") companyCounters.financialYears.add(year);
  }
}

export async function parseMasterWorkbook(source: Buffer, sourceName: string, calculatedAt = new Date().toISOString()): Promise<WorkbookSnapshot> {
  const workbook = new ExcelJS.Workbook();
  const readableSource = await withoutLegacyComments(source);
  await workbook.xlsx.load(readableSource as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  const companiesSheet = requireSheet(workbook, SHEETS.companies);
  const hash = createHash("sha256").update(source).digest("hex");
  const records: Array<{ company: Company; coverage: CompanyCoverage }> = [];
  const lookup = new Map<string, string>();
  const counters = new Map<string, Counters>();

  for (let rowNumber = 1; rowNumber <= companiesSheet.rowCount; rowNumber += 1) {
    const row = companiesSheet.getRow(rowNumber);
    const ordinal = numberValue(row.getCell(1).value);
    const name = text(row.getCell(4).value);
    if (!ordinal || !name) continue;
    const eventYear = yearValue(row.getCell(7).value);
    const [collectionStartYear, collectionEndYear] = parseWindow(row.getCell(8).value, eventYear);
    const companyId = `workbook:${Math.trunc(ordinal)}`;
    const company: Company = {
      id: companyId,
      slug: `${slugify(name)}-${Math.trunc(ordinal)}`,
      name,
      tier: tierFrom(row.getCell(2).value),
      companyType: text(row.getCell(3).value) || null,
      referenceCode: text(row.getCell(5).value) || null,
      sector: text(row.getCell(6).value) || "Não classificado",
      eventType: "judicial_recovery",
      eventYear,
      collectionStartYear,
      collectionEndYear,
      workbookStatus: text(row.getCell(10).value) || null,
      workbookCompletion: parseCompletion(row.getCell(11).value),
      workbookRow: rowNumber,
      publicationStatus: "private",
      sourceWorkbookHash: hash,
      coverageUpdatedAt: calculatedAt,
    };
    lookup.set(normalizeCompanyName(name), companyId);
    counters.set(companyId, {
      financialFilled: 0, qualitativeFilled: 0, marketFilled: 0,
      financialYears: new Set(), researchedYears: new Set(), lastDataYear: null,
    });
    records.push({ company, coverage: {} as CompanyCoverage });
  }

  addSheetCoverage(requireSheet(workbook, SHEETS.financial), lookup, counters, 4, 27, "financialFilled");
  addSheetCoverage(requireSheet(workbook, SHEETS.qualitative), lookup, counters, 3, 10, "qualitativeFilled");
  addSheetCoverage(requireSheet(workbook, SHEETS.market), lookup, counters, 4, 7, "marketFilled");

  for (const record of records) {
    const count = counters.get(record.company.id)!;
    const years = expectedYears(record.company.collectionStartYear ?? null, record.company.collectionEndYear ?? null);
    const listed = normalizeCompanyName(record.company.companyType ?? "").includes("listada");
    record.coverage = {
      companyId: record.company.id,
      financialFilled: count.financialFilled,
      financialExpected: years * 24,
      qualitativeFilled: count.qualitativeFilled,
      qualitativeExpected: record.company.tier === "tier_1" ? years * 8 : 0,
      marketFilled: count.marketFilled,
      marketExpected: listed ? years * 4 : 0,
      researchedYears: count.researchedYears.size,
      totalYears: years,
      lastDataYear: count.lastDataYear,
      workbookHash: hash,
      calculatedAt,
    };
  }

  return { hash, sourceName, calculatedAt, companies: records };
}
