import { createHash } from "node:crypto";
import ExcelJS from "exceljs";
import { normalizeCompanyName } from "@/lib/workbook/master-workbook";
import type { Company, DataPoint, Proposal } from "@/types/domain";
import type {
  WorkbookCellValue,
  WorkbookSnapshot,
  WorkbookSnapshotCell,
  WorkbookSyncBatch,
  WorkbookSyncItem,
  WorkbookSyncPreview,
} from "./sync-contracts";

export const workbookId = "secc-master-workbook";
export const workbookMappingVersion = "secc-map-v1";
export const workbookMaxBytes = 4 * 1024 * 1024;
const workbookMaxUncompressedBytes = 64 * 1024 * 1024;
const workbookMaxEntries = 2_000;
const workbookMaxRowsPerMappedSheet = 25_000;

type ColumnDefinition = {
  sheetName: string;
  headerRow: number;
  dataStartRow: number;
  companyColumn: number;
  yearColumn: number;
  column: number;
  header: string;
  variable: string;
  unit: DataPoint["unit"];
  aliases: string[];
};

const financialSheet = "02. Dados Financeiros";
const qualitativeSheet = "03. Dados Qualitativos";
const marketSheet = "04. Mercado (listadas)";
const metadataSheet = "SECC_App_Sync";

function definition(
  sheetName: string,
  column: number,
  header: string,
  variable: string,
  unit: DataPoint["unit"],
  aliases: string[] = [],
): ColumnDefinition {
  const market = sheetName === marketSheet;
  return {
    sheetName,
    headerRow: 5,
    dataStartRow: 6,
    companyColumn: 1,
    yearColumn: market ? 3 : 2,
    column,
    header,
    variable,
    unit,
    aliases: [variable, header, ...aliases],
  };
}

const definitions: ColumnDefinition[] = [
  definition(financialSheet, 4, "Receita Líquida (3.01)", "Receita Líquida", "BRL_millions"),
  definition(financialSheet, 5, "CMV (3.02)", "CMV", "BRL_millions"),
  definition(financialSheet, 6, "Lucro Bruto (3.03)", "Lucro Bruto", "BRL_millions"),
  definition(financialSheet, 7, "Despesas Operacionais (3.04)", "Despesas Operacionais", "BRL_millions"),
  definition(financialSheet, 8, "EBIT (3.05)", "EBIT", "BRL_millions"),
  definition(financialSheet, 9, "Resultado Financeiro (3.06)", "Resultado Financeiro", "BRL_millions"),
  definition(financialSheet, 10, "Lucro Líquido (3.11)", "Lucro Líquido", "BRL_millions"),
  definition(financialSheet, 11, "Caixa + Equiv. (1.01.01+02)", "Caixa + Equivalentes", "BRL_millions", ["Caixa e Equivalentes", "Caixa + Equiv."]),
  definition(financialSheet, 12, "Contas a Receber (1.01.03)", "Contas a Receber", "BRL_millions"),
  definition(financialSheet, 13, "Estoques (1.01.04)", "Estoques", "BRL_millions"),
  definition(financialSheet, 14, "Ativo Circulante (1.01)", "Ativo Circulante", "BRL_millions"),
  definition(financialSheet, 15, "Imobilizado (1.02.03)", "Imobilizado", "BRL_millions"),
  definition(financialSheet, 16, "Ativo Total (1)", "Ativo Total", "BRL_millions"),
  definition(financialSheet, 17, "Fornecedores (2.01.02)", "Fornecedores", "BRL_millions"),
  definition(financialSheet, 18, "Empréstimos CP (2.01.04)", "Empréstimos CP", "BRL_millions"),
  definition(financialSheet, 19, "Passivo Circulante (2.01)", "Passivo Circulante", "BRL_millions"),
  definition(financialSheet, 20, "Empréstimos LP (2.02.01)", "Empréstimos LP", "BRL_millions"),
  definition(financialSheet, 21, "Passivo Total", "Passivo Total", "BRL_millions"),
  definition(financialSheet, 22, "Patrimônio Líquido (2.03)", "Patrimônio Líquido", "BRL_millions"),
  definition(financialSheet, 23, "FCO (6.01)", "FCO", "BRL_millions"),
  definition(financialSheet, 24, "Capex (Investim.)", "Capex", "BRL_millions"),
  definition(financialSheet, 25, "Variação líquida caixa (6.04)", "Variação de Caixa", "BRL_millions", ["Variação líquida de caixa"]),
  definition(financialSheet, 26, "Despesas com Pessoal", "Despesas com Pessoal", "BRL_millions"),
  definition(financialSheet, 27, "Headcount", "Headcount", "count"),
  definition(qualitativeSheet, 3, "Auditor", "Auditor", "text"),
  definition(qualitativeSheet, 4, "Opinião auditor", "Opinião auditor", "text", ["Opinião do auditor"]),
  definition(qualitativeSheet, 5, "Going Concern flag", "Going Concern flag", "text", ["Going concern"]),
  definition(qualitativeSheet, 6, "% receita top-5 clientes", "% receita top-5 clientes", "percent"),
  definition(qualitativeSheet, 7, "% receita mercado interno", "% receita mercado interno", "percent"),
  definition(qualitativeSheet, 8, "Provisões + Contingências (R$ MM)", "Provisões + Contingências", "BRL_millions"),
  definition(qualitativeSheet, 9, "Atrasou DFP (>30 dias)?", "Atrasou DFP", "text"),
  definition(qualitativeSheet, 10, "Fato relevante: waiver/breach?", "Fato relevante: waiver/breach", "text"),
  definition(marketSheet, 4, "Cotação 31/12 (R$)", "Cotação 31/12", "BRL"),
  definition(marketSheet, 5, "Ações em circulação (MM)", "Ações em circulação", "count_millions"),
  definition(marketSheet, 6, "Market Cap (R$ MM)", "Market Cap", "BRL_millions"),
  definition(marketSheet, 7, "Volume médio diário (R$ MM)", "Volume médio diário", "BRL_millions"),
];

function normalize(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9%]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function text(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    if ("text" in value) return String(value.text ?? "").trim();
    if ("result" in value) return text(value.result as ExcelJS.CellValue);
    if ("richText" in value) return value.richText.map((part) => part.text).join("").trim();
  }
  return String(value).trim();
}

function number(value: ExcelJS.CellValue): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(text(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function scalar(value: ExcelJS.CellValue): WorkbookCellValue {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (["string", "number", "boolean"].includes(typeof value)) return value as string | number | boolean;
  if (typeof value === "object" && "formula" in value) {
    const result = value.result;
    const normalizedResult = result instanceof Date
      ? result.toISOString()
      : (["string", "number", "boolean"].includes(typeof result) ? result as string | number | boolean : null);
    return { formula: String(value.formula), result: normalizedResult };
  }
  return text(value);
}

function stable(value: WorkbookCellValue): string {
  return JSON.stringify(value, Object.keys(value && typeof value === "object" ? value : {}).sort());
}

function hash(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function assertSafeXlsxArchive(source: Buffer): void {
  const minimumEocdSize = 22;
  const searchStart = Math.max(0, source.length - 65_557);
  let eocd = -1;
  for (let offset = source.length - minimumEocdSize; offset >= searchStart; offset -= 1) {
    if (source.readUInt32LE(offset) === 0x06054b50) {
      eocd = offset;
      break;
    }
  }
  if (eocd < 0) throw new Error("Estrutura ZIP do XLSX inválida.");
  const entries = source.readUInt16LE(eocd + 10);
  const centralSize = source.readUInt32LE(eocd + 12);
  const centralOffset = source.readUInt32LE(eocd + 16);
  if (entries === 0xffff || centralSize === 0xffffffff || centralOffset === 0xffffffff) {
    throw new Error("XLSX em formato ZIP64 não é aceito neste fluxo.");
  }
  if (entries === 0 || entries > workbookMaxEntries || centralOffset + centralSize > source.length) {
    throw new Error("Quantidade ou diretório de arquivos internos do XLSX fora do limite seguro.");
  }
  let offset = centralOffset;
  let uncompressedBytes = 0;
  let hasWorkbook = false;
  for (let index = 0; index < entries; index += 1) {
    if (offset + 46 > source.length || source.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error("Diretório interno do XLSX inválido.");
    }
    const flags = source.readUInt16LE(offset + 8);
    const compression = source.readUInt16LE(offset + 10);
    const uncompressed = source.readUInt32LE(offset + 24);
    const nameLength = source.readUInt16LE(offset + 28);
    const extraLength = source.readUInt16LE(offset + 30);
    const commentLength = source.readUInt16LE(offset + 32);
    const end = offset + 46 + nameLength + extraLength + commentLength;
    if (end > source.length || (flags & 1) !== 0 || ![0, 8].includes(compression)) {
      throw new Error("O XLSX contém entrada criptografada ou compactação não suportada.");
    }
    const name = source.subarray(offset + 46, offset + 46 + nameLength).toString("utf8").replaceAll("\\", "/").toLowerCase();
    if (name === "xl/workbook.xml") hasWorkbook = true;
    if (name.includes("vbaproject.bin") || name.includes("/macrosheets/")) {
      throw new Error("Planilhas com macros não são aceitas na sincronização.");
    }
    uncompressedBytes += uncompressed;
    if (uncompressedBytes > workbookMaxUncompressedBytes) {
      throw new Error("Conteúdo descompactado do XLSX acima do limite seguro de 64 MB.");
    }
    offset = end;
  }
  if (!hasWorkbook) throw new Error("O pacote enviado não contém uma pasta de trabalho XLSX válida.");
}

function same(left: WorkbookCellValue, right: WorkbookCellValue): boolean {
  if (typeof left === "number" && typeof right === "number") return Math.abs(left - right) < 1e-9;
  return stable(left) === stable(right);
}

function blank(value: WorkbookCellValue): boolean {
  return value === null || value === "";
}

function formula(value: WorkbookCellValue): boolean {
  return typeof value === "object" && value !== null && "formula" in value;
}

function proposalValue(proposal: Proposal): WorkbookCellValue {
  if (proposal.availability === "available") return proposal.value as WorkbookCellValue;
  if (proposal.availability === "unavailable") return "N/D";
  if (proposal.availability === "not_applicable") return "N/A";
  if (proposal.availability === "future_period") return "PERÍODO FUTURO";
  if (proposal.availability === "withheld") return "RETIDO";
  if (proposal.availability === "not_researched") return null;
  return null;
}

function safeStamp(value: string): string {
  return value.replace(/[:.]/g, "-");
}

function readMetadata(workbook: ExcelJS.Workbook): { workbookVersion: string; dataVersion: number } | null {
  const sheet = workbook.getWorksheet(metadataSheet);
  if (!sheet || normalize(sheet.getCell(1, 5).value) !== "result workbook version") return null;
  for (let row = sheet.rowCount; row >= 2; row -= 1) {
    const version = text(sheet.getCell(row, 5).value);
    const dataVersion = number(sheet.getCell(row, 6).value);
    if (version && dataVersion !== null) return { workbookVersion: version, dataVersion: Math.trunc(dataVersion) };
  }
  return null;
}

async function loadWorkbook(source: Buffer): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(source as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  return workbook;
}

function assertLayout(workbook: ExcelJS.Workbook): void {
  for (const item of definitions) {
    const sheet = workbook.getWorksheet(item.sheetName);
    if (!sheet) throw new Error(`A planilha não contém a aba obrigatória “${item.sheetName}”.`);
    const actual = normalize(sheet.getCell(item.headerRow, item.column).value);
    if (actual !== normalize(item.header)) {
      throw new Error(`Cabeçalho incompatível em ${item.sheetName}!${sheet.getCell(item.headerRow, item.column).address}. Esperado: “${item.header}”.`);
    }
  }
}

function extractCells(workbook: ExcelJS.Workbook, companies: Company[]): WorkbookSnapshotCell[] {
  const companyByName = new Map(companies.map((company) => [normalizeCompanyName(company.name), company]));
  const cells: WorkbookSnapshotCell[] = [];
  for (const sheetName of [...new Set(definitions.map((item) => item.sheetName))]) {
    const sheet = workbook.getWorksheet(sheetName)!;
    if (sheet.rowCount > workbookMaxRowsPerMappedSheet) {
      throw new Error(`A aba “${sheetName}” excede o limite de ${workbookMaxRowsPerMappedSheet} linhas controladas.`);
    }
    const sheetDefinitions = definitions.filter((item) => item.sheetName === sheetName);
    const first = sheetDefinitions[0]!;
    for (let rowNumber = first.dataStartRow; rowNumber <= sheet.rowCount; rowNumber += 1) {
      const company = companyByName.get(normalizeCompanyName(text(sheet.getCell(rowNumber, first.companyColumn).value)));
      const year = number(sheet.getCell(rowNumber, first.yearColumn).value);
      if (!company || year === null || year < 1900 || year > 2200) continue;
      for (const item of sheetDefinitions) {
        const cell = sheet.getCell(rowNumber, item.column);
        const value = scalar(cell.value);
        const cellKey = `${item.sheetName}!${cell.address}`;
        cells.push({
          cellKey,
          sheetName: item.sheetName,
          cellAddress: cell.address,
          companyId: company.id,
          year: Math.trunc(year),
          variable: item.variable,
          unit: item.unit,
          value,
          cellHash: hash(stable(value)),
        });
      }
    }
  }
  return cells;
}

const definitionsByAlias = new Map<string, ColumnDefinition[]>();
for (const item of definitions) {
  for (const alias of item.aliases) {
    const key = normalize(alias);
    const matches = definitionsByAlias.get(key) ?? [];
    if (!matches.includes(item)) definitionsByAlias.set(key, [...matches, item]);
  }
}

export async function prepareWorkbookSync(input: {
  source: Buffer;
  originalName: string;
  actorId: string;
  requestedAt: string;
  companies: Company[];
  approvedProposals: Proposal[];
  baseline: WorkbookSnapshot | null;
}): Promise<WorkbookSyncPreview> {
  if (input.source.byteLength === 0 || input.source.byteLength > workbookMaxBytes) {
    throw new Error("A planilha deve ter até 4 MB para processamento protegido na Vercel.");
  }
  if (!input.originalName.toLowerCase().endsWith(".xlsx") || input.source[0] !== 0x50 || input.source[1] !== 0x4b) {
    throw new Error("Selecione um arquivo XLSX válido, sem macros.");
  }
  assertSafeXlsxArchive(input.source);

  const sourceSha256 = hash(input.source);
  const workbook = await loadWorkbook(input.source);
  assertLayout(workbook);
  const metadata = readMetadata(workbook);
  const sourceWorkbookVersion = metadata?.workbookVersion
    ?? (input.baseline?.sha256 === sourceSha256 ? input.baseline.workbookVersion : `legacy-${sourceSha256.slice(0, 12)}`);
  const sourceDataVersion = metadata?.dataVersion
    ?? (input.baseline?.sha256 === sourceSha256 ? input.baseline.dataVersion : 0);
  const resultWorkbookVersion = `secc-d${sourceDataVersion + 1}`;
  const versionConflict = input.baseline && sourceWorkbookVersion !== input.baseline.workbookVersion
    ? `A versão enviada (${sourceWorkbookVersion}) diverge da última versão gerada (${input.baseline.workbookVersion}).`
    : null;

  const cells = extractCells(workbook, input.companies);
  const currentByTarget = new Map(cells.map((cell) => [`${cell.companyId}|${cell.year}|${normalize(cell.variable)}`, cell]));
  const companyNames = new Map(input.companies.map((company) => [company.id, company.name]));
  const proposalSignature = input.approvedProposals
    .map((proposal) => `${proposal.id}@${proposal.version}`)
    .sort()
    .join("|");
  const idempotencyKey = hash(`${workbookMappingVersion}|${sourceSha256}|${proposalSignature}`);
  const batchId = `sync-${idempotencyKey.slice(0, 32)}`;
  const appItems: WorkbookSyncItem[] = [];
  const targetedCells = new Set<string>();

  for (const proposal of input.approvedProposals) {
    const candidates = definitionsByAlias.get(normalize(proposal.variable)) ?? [];
    const itemBase = {
      batchId,
      proposalId: proposal.id,
      proposalVersion: proposal.version,
      direction: "app_to_excel" as const,
      companyId: proposal.companyId,
      companyName: companyNames.get(proposal.companyId),
      year: proposal.year,
      variable: proposal.variable,
      unit: proposal.unit,
      resolution: null,
    };
    if (candidates.length !== 1) {
      appItems.push({ ...itemBase, sheetName: null, cellAddress: null, previousValue: null, proposedValue: proposalValue(proposal), status: "unmapped", message: "Variável sem de-para único no mapping v1." });
      continue;
    }
    const target = candidates[0]!;
    if (target.unit !== proposal.unit) {
      appItems.push({ ...itemBase, sheetName: target.sheetName, cellAddress: null, previousValue: null, proposedValue: proposalValue(proposal), status: "unmapped", message: `Unidade incompatível: esperado ${target.unit}, recebido ${proposal.unit}.` });
      continue;
    }
    const current = currentByTarget.get(`${proposal.companyId}|${proposal.year}|${normalize(target.variable)}`);
    if (!current) {
      appItems.push({ ...itemBase, sheetName: target.sheetName, cellAddress: null, previousValue: null, proposedValue: proposalValue(proposal), status: "unmapped", message: "Linha empresa-ano não localizada na planilha." });
      continue;
    }
    const proposed = proposalValue(proposal);
    targetedCells.add(current.cellKey);
    if (formula(current.value)) {
      appItems.push({ ...itemBase, sheetName: current.sheetName, cellAddress: current.cellAddress, previousValue: current.value, proposedValue: proposed, status: "unmapped", message: "A célula contém fórmula protegida e não pode ser sobrescrita." });
    } else if (same(current.value, proposed)) {
      appItems.push({ ...itemBase, sheetName: current.sheetName, cellAddress: current.cellAddress, previousValue: current.value, proposedValue: proposed, status: "unchanged", message: "O Excel já contém o valor aprovado." });
    } else if (blank(current.value)) {
      appItems.push({ ...itemBase, sheetName: current.sheetName, cellAddress: current.cellAddress, previousValue: current.value, proposedValue: proposed, status: "ready", message: "Célula vazia pronta para receber o valor aprovado." });
    } else {
      appItems.push({ ...itemBase, sheetName: current.sheetName, cellAddress: current.cellAddress, previousValue: current.value, proposedValue: proposed, status: "conflict", message: "Excel e proposta aprovada possuem valores diferentes; escolha explícita obrigatória." });
    }
  }

  const excelItems: WorkbookSyncItem[] = [];
  if (input.baseline) {
    const baselineByCell = new Map(input.baseline.cells.map((cell) => [cell.cellKey, cell]));
    for (const current of cells) {
      const previous = baselineByCell.get(current.cellKey);
      if (!previous || same(previous.value, current.value) || targetedCells.has(current.cellKey)) continue;
      const isFormula = formula(current.value) || formula(previous.value);
      excelItems.push({
        batchId,
        proposalId: null,
        proposalVersion: null,
        direction: "excel_to_app",
        companyId: current.companyId,
        companyName: companyNames.get(current.companyId),
        year: current.year,
        variable: current.variable,
        unit: current.unit,
        sheetName: current.sheetName,
        cellAddress: current.cellAddress,
        previousValue: previous.value,
        proposedValue: current.value,
        status: isFormula ? "unmapped" : "ready",
        resolution: null,
        message: isFormula ? "Mudança de fórmula exige revisão especializada." : "Alteração feita no Excel será importada como proposta em revisão.",
      });
    }
  }

  const readyCount = appItems.filter((item) => item.status === "ready").length;
  const conflictCount = appItems.filter((item) => item.status === "conflict").length;
  const unmappedCount = appItems.filter((item) => item.status === "unmapped").length;
  const unchangedCount = appItems.filter((item) => item.status === "unchanged").length;
  const blockedByExcelChange = excelItems.some((item) => item.status === "unmapped");
  const requestedStamp = safeStamp(input.requestedAt);
  const sourceSnapshotId = `snapshot-source-${sourceSha256.slice(0, 32)}`;
  const batch: WorkbookSyncBatch = {
    id: batchId,
    idempotencyKey,
    workbookId,
    sourceSnapshotId,
    status: versionConflict || unmappedCount > 0 || blockedByExcelChange ? "blocked" : "prepared",
    mappingVersion: workbookMappingVersion,
    sourceWorkbookVersion,
    resultWorkbookVersion,
    sourceSha256,
    resultSha256: null,
    approvedCount: appItems.length,
    readyCount,
    conflictCount,
    unmappedCount,
    unchangedCount,
    excelChangeCount: excelItems.length,
    requestedBy: input.actorId,
    requestedAt: input.requestedAt,
    appliedBy: null,
    appliedAt: null,
    outputFileName: `secc-atualizado-${requestedStamp}-${batchId.slice(5, 13)}.xlsx`,
    backupFileName: `backup-${requestedStamp}-${sourceSha256.slice(0, 10)}.xlsx`,
    failureReason: versionConflict ?? (unmappedCount > 0 || blockedByExcelChange ? "Existem itens sem mapeamento seguro." : null),
  };
  const sourceSnapshot: WorkbookSnapshot = {
    id: sourceSnapshotId,
    workbookId,
    originalName: input.originalName,
    sizeBytes: input.source.byteLength,
    sha256: sourceSha256,
    workbookVersion: sourceWorkbookVersion,
    dataVersion: sourceDataVersion,
    mappingVersion: workbookMappingVersion,
    kind: "source",
    syncBatchId: batchId,
    createdBy: input.actorId,
    createdAt: input.requestedAt,
    cells,
  };
  return { batch, sourceSnapshot, items: [...appItems, ...excelItems], hasBaseline: Boolean(input.baseline), versionConflict };
}

export { definitions as workbookMappingDefinitions, extractCells, loadWorkbook, metadataSheet, same };
