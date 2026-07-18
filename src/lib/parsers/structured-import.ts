import { createHash } from "node:crypto";
import { parse } from "csv-parse/sync";
import ExcelJS from "exceljs";
import { proposalInputSchema } from "@/lib/validation/proposal";
import type { StructuredImportPreview, StructuredImportRow } from "@/lib/imports/contracts";
import type { AvailabilityState, Proposal } from "@/types/domain";

const maxRows = 1_000;

const headerAliases = {
  year: ["ano", "year", "exercicio"],
  variable: ["variavel", "variable", "indicador", "conta"],
  value: ["valor", "value"],
  unit: ["unidade", "unit"],
  availability: ["disponibilidade", "availability", "status_dado"],
  sourceOrganization: ["organizacao_fonte", "fonte_organizacao", "source_organization"],
  sourceTitle: ["titulo_fonte", "fonte_titulo", "source_title"],
  sourceUrl: ["url_fonte", "fonte_url", "source_url"],
  referenceDate: ["data_referencia", "reference_date"],
  notes: ["observacao", "observacoes", "notes"],
} as const;

type CanonicalHeader = keyof typeof headerAliases;
type RawRecord = { rowNumber: number; values: Record<string, unknown> };

const requiredHeaders: CanonicalHeader[] = [
  "year", "variable", "value", "unit", "sourceOrganization", "sourceTitle", "sourceUrl", "referenceDate",
];

function normalize(value: unknown): string {
  return String(value ?? "").trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function normalizeHeader(value: unknown): string {
  return normalize(value).replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function scalar(value: unknown): string | number | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "number" || typeof value === "string") return value;
  if (typeof value === "object" && value && "result" in value) return scalar(value.result);
  if (typeof value === "object" && value && "text" in value) return String(value.text);
  if (typeof value === "object" && value && "richText" in value && Array.isArray(value.richText)) {
    return value.richText.map((part) => typeof part === "object" && part && "text" in part ? String(part.text) : "").join("");
  }
  return String(value);
}

function resolveHeaders(headers: unknown[]): Map<number, CanonicalHeader> {
  const lookup = new Map<string, CanonicalHeader>();
  for (const [canonical, aliases] of Object.entries(headerAliases) as Array<[CanonicalHeader, readonly string[]]>) {
    for (const alias of aliases) lookup.set(alias, canonical);
  }
  const resolved = new Map<number, CanonicalHeader>();
  const found = new Set<CanonicalHeader>();
  headers.forEach((header, index) => {
    const canonical = lookup.get(normalizeHeader(header));
    if (!canonical) return;
    if (found.has(canonical)) throw new Error(`Cabeçalho duplicado para ${canonical}.`);
    found.add(canonical);
    resolved.set(index, canonical);
  });
  const missing = requiredHeaders.filter((header) => !found.has(header));
  if (missing.length > 0) throw new Error(`Colunas obrigatórias ausentes: ${missing.join(", ")}.`);
  return resolved;
}

function delimiterFor(text: string): "," | ";" {
  const firstLine = text.replace(/^\uFEFF/, "").split(/\r?\n/, 1)[0] ?? "";
  return (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
}

function parseCsv(bytes: Buffer): RawRecord[] {
  const text = bytes.toString("utf8");
  const records = parse(text, {
    bom: true,
    delimiter: delimiterFor(text),
    skip_empty_lines: true,
    relax_column_count: false,
    trim: true,
  }) as string[][];
  if (records.length < 2) throw new Error("O arquivo precisa conter cabeçalho e pelo menos uma linha de dados.");
  const headers = records[0] ?? [];
  return records.slice(1).map((values, index) => ({
    rowNumber: index + 2,
    values: Object.fromEntries(headers.map((header, column) => [header, values[column] ?? ""])),
  }));
}

async function parseXlsx(bytes: Buffer): Promise<RawRecord[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  const sheet = workbook.worksheets.find((item) => item.state === "visible") ?? workbook.worksheets[0];
  if (!sheet || sheet.rowCount < 2) throw new Error("A primeira aba visível precisa conter cabeçalho e dados.");
  const headerRow = sheet.getRow(1);
  const headers = Array.from({ length: headerRow.cellCount }, (_, index) => scalar(headerRow.getCell(index + 1).value) ?? "");
  const rows: RawRecord[] = [];
  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const values = Object.fromEntries(headers.map((header, index) => [String(header), scalar(row.getCell(index + 1).value)]));
    if (Object.values(values).every((value) => value === null || String(value).trim() === "")) continue;
    rows.push({ rowNumber, values });
  }
  if (rows.length === 0) throw new Error("A primeira aba visível não contém linhas de dados.");
  return rows;
}

function mapRecord(record: RawRecord, headers: Map<number, CanonicalHeader>, originalHeaders: string[]): Partial<Record<CanonicalHeader, unknown>> {
  const mapped: Partial<Record<CanonicalHeader, unknown>> = {};
  originalHeaders.forEach((header, index) => {
    const canonical = headers.get(index);
    if (canonical) mapped[canonical] = record.values[header];
  });
  return mapped;
}

function parseUnit(value: unknown): Proposal["unit"] | null {
  const unit = normalize(value).replace(/\s+/g, "_");
  if (["brl", "r$", "reais", "real"].includes(unit)) return "BRL";
  if (["brl_millions", "r$_milhoes", "r$milhoes", "r_milhoes", "milhoes", "rs_milhoes"].includes(unit)) return "BRL_millions";
  if (["percent", "percentual", "%", "porcentagem"].includes(unit)) return "percent";
  if (["count_millions", "contagem_milhoes", "quantidade_milhoes", "milhoes_unidades"].includes(unit)) return "count_millions";
  if (["count", "contagem", "quantidade"].includes(unit)) return "count";
  if (["text", "texto"].includes(unit)) return "text";
  return null;
}

function parseAvailability(value: unknown): AvailabilityState | null {
  const state = normalize(value).replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  if (!state || ["available", "disponivel", "ok"].includes(state)) return "available";
  if (["unavailable", "indisponivel", "n_d", "nd"].includes(state)) return "unavailable";
  if (["not_researched", "nao_pesquisado", "nao_pesquisada"].includes(state)) return "not_researched";
  if (["not_applicable", "nao_aplicavel"].includes(state)) return "not_applicable";
  if (["future_period", "periodo_futuro"].includes(state)) return "future_period";
  if (["withheld", "retido", "nao_divulgado"].includes(state)) return "withheld";
  return null;
}

function parseNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  let text = String(value ?? "").trim();
  if (!text) return null;
  const negative = /^\(.*\)$/.test(text);
  text = text.replace(/[()\sR$%]/g, "");
  if (text.includes(",") && text.includes(".")) {
    text = text.lastIndexOf(",") > text.lastIndexOf(".") ? text.replace(/\./g, "").replace(",", ".") : text.replace(/,/g, "");
  } else if (text.includes(",")) {
    text = text.replace(/\./g, "").replace(",", ".");
  }
  const parsed = Number(text);
  if (!Number.isFinite(parsed)) return null;
  return negative ? -parsed : parsed;
}

function parseDate(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) return value.toISOString().slice(0, 10);
  if (typeof value === "number") {
    const date = new Date(Math.round((value - 25569) * 86400 * 1000));
    return Number.isNaN(date.valueOf()) ? null : date.toISOString().slice(0, 10);
  }
  const text = String(value ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const match = text.match(/^(\d{2})[\/-](\d{2})[\/-](\d{4})$/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : null;
}

function stableId(prefix: string, value: string): string {
  return `${prefix}:${createHash("sha256").update(value).digest("hex")}`;
}

function buildRow(record: RawRecord, mapped: Partial<Record<CanonicalHeader, unknown>>, input: ParseStructuredImportInput, sha256: string): StructuredImportRow {
  const unit = parseUnit(mapped.unit);
  const availability = parseAvailability(mapped.availability);
  const referenceDate = parseDate(mapped.referenceDate);
  const year = Number(mapped.year);
  const rawValue = scalar(mapped.value);
  const parsedValue = unit === "text" ? (rawValue === null ? null : String(rawValue).trim()) : parseNumber(rawValue);
  const value = availability && availability !== "available" ? null : parsedValue;
  const sourceLine = `Importação ${input.originalName}, linha ${record.rowNumber}.`;
  const rawNotes = String(mapped.notes ?? "").trim();
  const notes = `${rawNotes ? `${rawNotes} | ` : ""}${sourceLine}`.slice(0, 500);
  const candidate = {
    companyId: input.companyId,
    year,
    variable: String(mapped.variable ?? "").trim(),
    value,
    unit,
    availability,
    sourceOrganization: String(mapped.sourceOrganization ?? "").trim(),
    sourceTitle: String(mapped.sourceTitle ?? "").trim(),
    sourceUrl: String(mapped.sourceUrl ?? "").trim(),
    referenceDate,
    notes,
  };
  const parsed = proposalInputSchema.safeParse(candidate);
  const raw = Object.fromEntries(Object.entries(record.values).map(([key, item]) => [key, scalar(item)]));
  if (!parsed.success) {
    return { rowNumber: record.rowNumber, raw, proposal: null, errors: parsed.error.issues.map((issue) => issue.message) };
  }
  const normalizedKey = JSON.stringify({ ...parsed.data, notes: undefined });
  const externalKey = stableId("upload", `${sha256}|${input.companyId}|${record.rowNumber}|${normalizedKey}`);
  const sourceKey = `${parsed.data.sourceOrganization}|${parsed.data.sourceTitle}|${parsed.data.sourceUrl}|${parsed.data.referenceDate}`;
  const now = input.createdAt;
  const proposal: Proposal = {
    id: stableId("upload-proposal", externalKey),
    companyId: input.companyId,
    year: parsed.data.year,
    variable: parsed.data.variable,
    value: parsed.data.value,
    unit: parsed.data.unit,
    availability: parsed.data.availability,
    source: {
      id: stableId("upload-source", sourceKey),
      organization: parsed.data.sourceOrganization,
      title: parsed.data.sourceTitle,
      url: parsed.data.sourceUrl,
      referenceDate: parsed.data.referenceDate,
      collectedAt: now.slice(0, 10),
    },
    status: "under_review",
    createdBy: input.actorId,
    createdAt: now,
    version: 1,
    notes: parsed.data.notes,
    publishAuthorized: false,
    externalKey,
  };
  return { rowNumber: record.rowNumber, raw, proposal, errors: [] };
}

export interface ParseStructuredImportInput {
  bytes: Buffer;
  kind: "csv" | "xlsx";
  companyId: string;
  actorId: string;
  originalName: string;
  createdAt: string;
}

export async function parseStructuredImport(input: ParseStructuredImportInput): Promise<StructuredImportPreview> {
  const sha256 = createHash("sha256").update(input.bytes).digest("hex");
  const records = input.kind === "csv" ? parseCsv(input.bytes) : await parseXlsx(input.bytes);
  if (records.length > maxRows) throw new Error(`O arquivo excede o limite de ${maxRows} linhas por lote.`);
  const originalHeaders = Object.keys(records[0]?.values ?? {});
  const headers = resolveHeaders(originalHeaders);
  const rows = records.map((record) => buildRow(record, mapRecord(record, headers, originalHeaders), input, sha256));
  const validCount = rows.filter((row) => row.proposal !== null).length;
  return { sha256, rows, validCount, errorCount: rows.length - validCount };
}
