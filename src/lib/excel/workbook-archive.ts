import JSZip from "jszip";
import type { WorkbookCellValue } from "./sync-contracts";

type CellUpdate = {
  sheetName: string;
  cellAddress: string;
  value: WorkbookCellValue;
};

type MetadataRow = {
  batchId: string;
  appliedAt: string;
  sourceSha256: string;
  sourceWorkbookVersion: string;
  resultWorkbookVersion: string;
  dataVersion: number;
  mappingVersion: string;
  appliedCount: number;
  keptCount: number;
  excelChangeCount: number;
};

const metadataSheetName = "SECC_App_Sync";
const metadataHeaders = [
  "batch_id",
  "aplicado_em",
  "sha256_origem",
  "source_workbook_version",
  "result_workbook_version",
  "data_version",
  "mapping_version",
  "propostas_sincronizadas",
  "conflitos_mantidos_excel",
  "alteracoes_excel_importadas",
] as const;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function xmlEscape(value: string): string {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function xmlUnescape(value: string): string {
  return value
    .replaceAll("&apos;", "'")
    .replaceAll("&quot;", '"')
    .replaceAll("&gt;", ">")
    .replaceAll("&lt;", "<")
    .replaceAll("&amp;", "&");
}

function attribute(xml: string, name: string): string | null {
  return xml.match(new RegExp(`\\b${escapeRegExp(name)}="([^"]*)"`, "i"))?.[1] ?? null;
}

function relationshipTarget(target: string): string {
  const normalized = target.replaceAll("\\", "/").replace(/^\//, "");
  return normalized.startsWith("xl/") ? normalized : `xl/${normalized.replace(/^\.\.\//, "")}`;
}

function cellXml(address: string, value: WorkbookCellValue, current = ""): string {
  if (value && typeof value === "object") {
    throw new Error(`A célula ${address} contém fórmula e não pode ser gravada pelo patch controlado.`);
  }
  const style = attribute(current, "s");
  const styleAttribute = style === null ? "" : ` s="${xmlEscape(style)}"`;
  if (value === null || value === "") return `<c r="${address}"${styleAttribute}/>`;
  if (typeof value === "number") return `<c r="${address}"${styleAttribute}><v>${value}</v></c>`;
  if (typeof value === "boolean") return `<c r="${address}"${styleAttribute} t="b"><v>${value ? 1 : 0}</v></c>`;
  return `<c r="${address}"${styleAttribute} t="inlineStr"><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`;
}

function setCellValue(worksheetXml: string, address: string, value: WorkbookCellValue): string {
  const cellPattern = new RegExp(
    `<c\\b(?=[^>]*\\br="${escapeRegExp(address)}"(?:\\s|/|>))[^>]*(?:/>|>[\\s\\S]*?</c>)`,
    "i",
  );
  const current = worksheetXml.match(cellPattern)?.[0];
  if (current) return worksheetXml.replace(cellPattern, cellXml(address, value, current));

  const rowNumber = Number(address.match(/\d+$/)?.[0]);
  if (!rowNumber) throw new Error(`Endereço de célula inválido: ${address}.`);
  const rowPattern = new RegExp(`(<row\\b(?=[^>]*\\br="${rowNumber}"(?:\\s|>))[^>]*>)([\\s\\S]*?)(</row>)`, "i");
  if (rowPattern.test(worksheetXml)) {
    return worksheetXml.replace(rowPattern, `$1$2${cellXml(address, value)}$3`);
  }
  return worksheetXml.replace(
    "</sheetData>",
    `<row r="${rowNumber}">${cellXml(address, value)}</row></sheetData>`,
  );
}

function inlineCell(address: string, value: string | number): string {
  return typeof value === "number"
    ? `<c r="${address}"><v>${value}</v></c>`
    : `<c r="${address}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`;
}

function metadataRowXml(rowNumber: number, values: Array<string | number>): string {
  return `<row r="${rowNumber}">${values
    .map((value, index) => inlineCell(`${String.fromCharCode(65 + index)}${rowNumber}`, value))
    .join("")}</row>`;
}

function metadataValues(row: MetadataRow): Array<string | number> {
  return [
    row.batchId,
    row.appliedAt,
    row.sourceSha256,
    row.sourceWorkbookVersion,
    row.resultWorkbookVersion,
    row.dataVersion,
    row.mappingVersion,
    row.appliedCount,
    row.keptCount,
    row.excelChangeCount,
  ];
}

async function removeLegacyComments(zip: JSZip): Promise<void> {
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
}

function sheetPaths(workbookXml: string, relationshipsXml: string): Map<string, string> {
  const targets = new Map<string, string>();
  for (const match of relationshipsXml.matchAll(/<Relationship\b[^>]*\/>/gi)) {
    const id = attribute(match[0], "Id");
    const type = attribute(match[0], "Type");
    const target = attribute(match[0], "Target");
    if (id && target && type?.endsWith("/worksheet")) targets.set(id, relationshipTarget(target));
  }
  const paths = new Map<string, string>();
  for (const match of workbookXml.matchAll(/<sheet\b[^>]*\/>/gi)) {
    const name = attribute(match[0], "name");
    const relationshipId = attribute(match[0], "r:id");
    const target = relationshipId ? targets.get(relationshipId) : null;
    if (name && target) paths.set(xmlUnescape(name), target);
  }
  return paths;
}

function nextRelationshipId(relationshipsXml: string): string {
  const ids = [...relationshipsXml.matchAll(/\bId="rId(\d+)"/gi)].map((match) => Number(match[1]));
  return `rId${Math.max(0, ...ids) + 1}`;
}

function nextSheetId(workbookXml: string): number {
  const ids = [...workbookXml.matchAll(/\bsheetId="(\d+)"/gi)].map((match) => Number(match[1]));
  return Math.max(0, ...ids) + 1;
}

function nextWorksheetPath(zip: JSZip): string {
  const ids = Object.keys(zip.files)
    .map((name) => name.match(/^xl\/worksheets\/sheet(\d+)\.xml$/i)?.[1])
    .filter((value): value is string => Boolean(value))
    .map(Number);
  return `xl/worksheets/sheet${Math.max(0, ...ids) + 1}.xml`;
}

function appendMetadataRow(worksheetXml: string, row: MetadataRow): string {
  const rows = [...worksheetXml.matchAll(/<row\b[^>]*\br="(\d+)"[^>]*>/gi)].map((match) => Number(match[1]));
  const rowNumber = Math.max(1, ...rows) + 1;
  const withRow = worksheetXml.replace("</sheetData>", `${metadataRowXml(rowNumber, metadataValues(row))}</sheetData>`);
  return withRow.replace(/<dimension\b[^>]*ref="[^"]*"[^>]*\/>/i, `<dimension ref="A1:J${rowNumber}"/>`);
}

function newMetadataWorksheet(row: MetadataRow): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:J2"/><sheetViews><sheetView workbookViewId="0"/></sheetViews><sheetFormatPr defaultRowHeight="15"/><sheetData>${metadataRowXml(1, [...metadataHeaders])}${metadataRowXml(2, metadataValues(row))}</sheetData></worksheet>`;
}

function ensureFullCalculation(workbookXml: string): string {
  if (/<calcPr\b[^>]*\/>/i.test(workbookXml)) {
    return workbookXml.replace(/<calcPr\b[^>]*\/>/i, '<calcPr calcMode="auto" fullCalcOnLoad="1" forceFullCalc="1"/>');
  }
  return workbookXml.replace("</workbook>", '<calcPr calcMode="auto" fullCalcOnLoad="1" forceFullCalc="1"/></workbook>');
}

export async function patchWorkbookArchive(input: {
  source: Buffer;
  updates: CellUpdate[];
  metadata: MetadataRow;
}): Promise<Buffer> {
  const zip = await JSZip.loadAsync(input.source);
  await removeLegacyComments(zip);

  const workbookFile = zip.file("xl/workbook.xml");
  const relationshipsFile = zip.file("xl/_rels/workbook.xml.rels");
  const contentTypesFile = zip.file("[Content_Types].xml");
  if (!workbookFile || !relationshipsFile || !contentTypesFile) {
    throw new Error("O XLSX não contém os contratos internos necessários para a sincronização.");
  }

  let workbookXml = await workbookFile.async("string");
  let relationshipsXml = await relationshipsFile.async("string");
  let contentTypesXml = await contentTypesFile.async("string");
  const paths = sheetPaths(workbookXml, relationshipsXml);
  const updatesByPath = new Map<string, CellUpdate[]>();
  for (const update of input.updates) {
    const target = paths.get(update.sheetName);
    if (!target) throw new Error(`A aba ${update.sheetName} não foi localizada no pacote XLSX.`);
    updatesByPath.set(target, [...(updatesByPath.get(target) ?? []), update]);
  }
  for (const [target, updates] of updatesByPath) {
    const file = zip.file(target);
    if (!file) throw new Error(`O arquivo interno ${target} não foi localizado.`);
    let worksheetXml = await file.async("string");
    for (const update of updates) worksheetXml = setCellValue(worksheetXml, update.cellAddress, update.value);
    zip.file(target, worksheetXml);
  }

  const metadataPath = paths.get(metadataSheetName);
  if (metadataPath) {
    const file = zip.file(metadataPath);
    if (!file) throw new Error(`A aba técnica ${metadataSheetName} está incompleta.`);
    zip.file(metadataPath, appendMetadataRow(await file.async("string"), input.metadata));
  } else {
    const worksheetPath = nextWorksheetPath(zip);
    const relationshipId = nextRelationshipId(relationshipsXml);
    const sheetId = nextSheetId(workbookXml);
    workbookXml = workbookXml.replace(
      "</sheets>",
      `<sheet xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" name="${metadataSheetName}" sheetId="${sheetId}" state="veryHidden" r:id="${relationshipId}"/></sheets>`,
    );
    relationshipsXml = relationshipsXml.replace(
      "</Relationships>",
      `<Relationship Id="${relationshipId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/${worksheetPath.split("/").at(-1)}"/></Relationships>`,
    );
    contentTypesXml = contentTypesXml.replace(
      "</Types>",
      `<Override PartName="/${worksheetPath}" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`,
    );
    zip.file(worksheetPath, newMetadataWorksheet(input.metadata));
  }

  zip.remove("xl/calcChain.xml");
  relationshipsXml = relationshipsXml.replace(/<Relationship\b(?=[^>]*Type="[^"]*\/calcChain")[^>]*\/>/gi, "");
  contentTypesXml = contentTypesXml.replace(/<Override\b(?=[^>]*PartName="\/xl\/calcChain\.xml")[^>]*\/>/gi, "");
  workbookXml = ensureFullCalculation(workbookXml);
  zip.file("xl/workbook.xml", workbookXml);
  zip.file("xl/_rels/workbook.xml.rels", relationshipsXml);
  zip.file("[Content_Types].xml", contentTypesXml);

  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
