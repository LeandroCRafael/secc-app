#!/usr/bin/env node
/**
 * Gera o release público sanitizado (data/public/showcase.json + manifest.json)
 * a partir da planilha mestre, aplicando a whitelist de publicação v1.
 *
 * Uso:
 *   node scripts/generate-public-showcase.mjs --mestre <caminho-do-xlsx> [--reference-date AAAA-MM-DD]
 *
 * O caminho da mestre é sempre informado por argumento: nenhum caminho local
 * é registrado neste repositório. O script lê somente campos publicáveis
 * (identificação, financeiro consolidado, metadados de qualidade); a coluna
 * de observações internas nunca é lida.
 */
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import ExcelJS from "exceljs";

const SHOWCASE_VERSION = "showcase-2026.08.2";
const MAPPING_VERSION = "secc-map-v1";
const SCORE_VERSION = "0.1.1-experimental";
const SEAL = "Coletado — em conferência";

/** Whitelist v1 — Faixa A aprovada em 13/08/2026 (docs privados do workspace). */
const FAIXA_A = [
  "Atma Participações",
  "Bardella",
  "Bombril",
  "Eternit",
  "Heringer (Fert.)",
  "Hotéis Othon",
  "Inepar",
  "João Fortes Engenharia",
  "Oi (1ª RJ)",
  "OSX (2ª)",
  "PDG Realty",
  "Pomifrutas",
  "Saraiva Livreiros",
  "Viver Incorporadora",
  "Wetzel (1ª)",
  "MMX Mineração",
  "Rossi Residencial",
  "Lupatech (1ª)",
  "OSX (1ª)",
  "Pet Manguinhos",
  "Teka",
  "Nutriplant",
];

/** Aba 02 (headerRow 5, dados a partir da 6): colunas do mapping v1 usadas pelo score. */
const FINANCIAL_COLUMNS = {
  "Receita Líquida": 4,
  EBIT: 8,
  "Lucro Líquido": 10,
  "Caixa + Equivalentes": 11,
  "Ativo Circulante": 14,
  "Ativo Total": 16,
  "Empréstimos CP": 18,
  "Passivo Circulante": 19,
  "Empréstimos LP": 20,
  "Patrimônio Líquido": 22,
  FCO: 23,
};

const SCORE_DIMENSIONS = [
  { name: "Margem EBIT", weight: 20 },
  { name: "Margem líquida", weight: 15 },
  { name: "Liquidez corrente", weight: 15 },
  { name: "Dívida líquida / ativos", weight: 20 },
  { name: "Patrimônio líquido / ativos", weight: 15 },
  { name: "FCO / receita", weight: 15 },
];

/**
 * Convenção de mercado (decisão de 14/08/2026, RECONCILIACAO_REGRAS_ESCORE_2026-08):
 * o índice publicado é saúde = 100 − pontos de sinal da heurística 0.1.0, com três
 * bandas alinhadas ao E-Score MASTER: quanto maior, mais saudável.
 */
const BAND_LABELS = { green: "Verde — saudável", yellow: "Amarelo — atenção", red: "Vermelho — alto risco" };

function parseArgs(argv) {
  const args = { referenceDate: null, mestre: null };
  for (let index = 2; index < argv.length; index += 1) {
    if (argv[index] === "--mestre") args.mestre = argv[++index];
    else if (argv[index] === "--reference-date") args.referenceDate = argv[++index];
    else throw new Error(`Argumento desconhecido: ${argv[index]}`);
  }
  if (!args.mestre) throw new Error("Informe --mestre <caminho-do-xlsx>.");
  if (!args.referenceDate) args.referenceDate = new Date().toISOString().slice(0, 10);
  return args;
}

function cellText(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    if ("text" in value) return String(value.text ?? "").trim();
    if ("result" in value) return cellText(value.result);
    if ("richText" in value) return value.richText.map((part) => part.text).join("").trim();
  }
  return String(value).trim();
}

function cellNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value && typeof value === "object" && "result" in value) return cellNumber(value.result);
  return null;
}

function slugify(name) {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function displaySector(raw) {
  const joined = String(raw ?? "").split("/").map((part) => part.trim()).join(" e ");
  return joined
    .split(/\s+/)
    .map((word, index) => {
      if (index === 0) return word;
      if (word.length >= 2 && word === word.toUpperCase()) return word;
      return word.toLowerCase();
    })
    .join(" ");
}

function normalizeWindow(raw) {
  return String(raw ?? "").replace(/\s*[–—-]\s*/, "–");
}

function parseCompletion(raw) {
  if (typeof raw === "number") return Math.round(raw <= 1 ? raw * 100 : raw);
  const parsed = Number(String(raw ?? "").replace("%", "").replace(",", "."));
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

function ratio(numerator, denominator) {
  if (numerator === null || denominator === null || denominator === 0) return null;
  return numerator / denominator;
}

function stepped(value, levels) {
  for (const level of levels) if (level.when(value)) return level.points;
  return 0;
}

/** Réplica fiel das regras de src/features/scoring/score-model.ts (0.1.0-experimental). */
function computeScore(values) {
  const contributions = [];
  const push = (key, maxPoints, observed, points) => contributions.push({ key, maxPoints, observed, points });

  const ebitMargin = ratio(values.EBIT, values["Receita Líquida"]);
  if (ebitMargin !== null) push("ebitMargin", 20, ebitMargin * 100, stepped(ebitMargin, [
    { when: (input) => input < 0, points: 20 },
    { when: (input) => input < 0.05, points: 10 },
  ]));

  const netMargin = ratio(values["Lucro Líquido"], values["Receita Líquida"]);
  if (netMargin !== null) push("netMargin", 15, netMargin * 100, stepped(netMargin, [
    { when: (input) => input < 0, points: 15 },
    { when: (input) => input < 0.03, points: 7.5 },
  ]));

  const currentRatio = ratio(values["Ativo Circulante"], values["Passivo Circulante"]);
  if (currentRatio !== null) push("currentRatio", 15, currentRatio, stepped(currentRatio, [
    { when: (input) => input < 1, points: 15 },
    { when: (input) => input < 1.2, points: 7.5 },
  ]));

  if (values["Empréstimos CP"] !== null && values["Empréstimos LP"] !== null && values["Caixa + Equivalentes"] !== null) {
    const netDebtAssets = ratio(values["Empréstimos CP"] + values["Empréstimos LP"] - values["Caixa + Equivalentes"], values["Ativo Total"]);
    if (netDebtAssets !== null) push("netDebtAssets", 20, netDebtAssets * 100, stepped(netDebtAssets, [
      { when: (input) => input > 0.6, points: 20 },
      { when: (input) => input > 0.4, points: 14 },
      { when: (input) => input > 0.2, points: 7 },
    ]));
  }

  const equityAssets = ratio(values["Patrimônio Líquido"], values["Ativo Total"]);
  if (equityAssets !== null) push("equityAssets", 15, equityAssets * 100, stepped(equityAssets, [
    { when: (input) => input < 0, points: 15 },
    { when: (input) => input < 0.15, points: 8 },
  ]));

  const operatingCashMargin = ratio(values.FCO, values["Receita Líquida"]);
  if (operatingCashMargin !== null) push("operatingCashMargin", 15, operatingCashMargin * 100, stepped(operatingCashMargin, [
    { when: (input) => input < 0, points: 15 },
    { when: (input) => input < 0.05, points: 8 },
  ]));

  const availableWeight = contributions.reduce((sum, item) => sum + item.maxPoints, 0);
  const eligible = availableWeight >= 60 && contributions.length >= 4;
  const rawPoints = contributions.reduce((sum, item) => sum + item.points, 0);
  const signalScore = eligible && availableWeight > 0 ? Math.round((rawPoints / availableWeight) * 100) : null;
  const score = signalScore === null ? null : 100 - signalScore;
  const band = score === null ? null : score >= 75 ? "green" : score >= 50 ? "yellow" : "red";
  return { contributions, availableWeight, score, band };
}

function readRegistry(workbook) {
  const sheet = workbook.getWorksheet("01. Cadastro empresas");
  if (!sheet) throw new Error("A mestre não contém a aba “01. Cadastro empresas”.");
  const rows = [];
  for (let rowNumber = 5; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const name = cellText(sheet.getCell(rowNumber, 4).value);
    if (!name) continue;
    // Linhas de seção são células mescladas que repetem o título em todas as colunas.
    if (cellNumber(sheet.getCell(rowNumber, 1).value) === null && !/^\d+$/.test(cellText(sheet.getCell(rowNumber, 1).value))) continue;
    rows.push({
      tier: cellText(sheet.getCell(rowNumber, 2).value),
      entityType: cellText(sheet.getCell(rowNumber, 3).value),
      name,
      ticker: cellText(sheet.getCell(rowNumber, 5).value),
      sector: cellText(sheet.getCell(rowNumber, 6).value),
      eventYear: cellNumber(sheet.getCell(rowNumber, 7).value),
      window: cellText(sheet.getCell(rowNumber, 8).value),
      site: cellText(sheet.getCell(rowNumber, 9).value),
      status: cellText(sheet.getCell(rowNumber, 10).value),
      completion: parseCompletion(sheet.getCell(rowNumber, 11).value),
    });
  }
  return rows;
}

function countCompanyYears(workbook, sheetName, dataStartRow, yearColumn) {
  const sheet = workbook.getWorksheet(sheetName);
  if (!sheet) return 0;
  let count = 0;
  for (let rowNumber = dataStartRow; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const company = cellText(sheet.getCell(rowNumber, 1).value);
    const year = cellNumber(sheet.getCell(rowNumber, yearColumn).value);
    if (company && year !== null && year >= 1900 && year <= 2200) count += 1;
  }
  return count;
}

function readFinancialRows(workbook, wanted) {
  const sheet = workbook.getWorksheet("02. Dados Financeiros");
  if (!sheet) throw new Error("A mestre não contém a aba “02. Dados Financeiros”.");
  const rows = new Map();
  for (let rowNumber = 6; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const company = cellText(sheet.getCell(rowNumber, 1).value);
    const year = cellNumber(sheet.getCell(rowNumber, 2).value);
    if (!company || !wanted.has(company) || year === null) continue;
    const values = {};
    for (const [variable, column] of Object.entries(FINANCIAL_COLUMNS)) {
      values[variable] = cellNumber(sheet.getCell(rowNumber, column).value);
    }
    rows.set(`${company}|${Math.trunc(year)}`, values);
  }
  return rows;
}

function readBaselineVersion(workbook) {
  const sheet = workbook.getWorksheet("SECC_App_Sync");
  if (!sheet) return "sem-sync";
  for (let rowNumber = sheet.rowCount; rowNumber >= 2; rowNumber -= 1) {
    const version = cellText(sheet.getCell(rowNumber, 5).value);
    if (version) return version;
  }
  return "sem-sync";
}

async function main() {
  const args = parseArgs(process.argv);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(args.mestre);

  const registry = readRegistry(workbook);
  const registryByName = new Map(registry.map((entry) => [entry.name, entry]));

  const missing = FAIXA_A.filter((name) => !registryByName.has(name));
  if (missing.length > 0) throw new Error(`Empresas da whitelist ausentes no cadastro: ${missing.join(", ")}`);

  const statusOf = (entry) => entry.status.toLowerCase();
  const portfolio = {
    companies: registry.length,
    tier1: registry.filter((entry) => entry.tier === "T1").length,
    tier2: registry.filter((entry) => entry.tier === "T2").length,
    toResearch: registry.filter((entry) => entry.tier !== "T1" && entry.tier !== "T2").length,
    collectedForReview: registry.filter((entry) => statusOf(entry).startsWith("coletado")).length,
    inProgress: registry.filter((entry) => statusOf(entry).startsWith("em andamento")).length,
    blocked: registry.filter((entry) => statusOf(entry).startsWith("bloqueada")).length,
    financialCompanyYears: countCompanyYears(workbook, "02. Dados Financeiros", 6, 2),
    qualitativeCompanyYears: countCompanyYears(workbook, "03. Dados Qualitativos", 5, 2),
    marketCompanyYears: countCompanyYears(workbook, "04. Mercado (listadas)", 5, 3),
  };

  const financialRows = readFinancialRows(workbook, new Set(FAIXA_A));
  const companies = [];
  const report = [];
  for (const name of FAIXA_A) {
    const entry = registryByName.get(name);
    if (entry.entityType !== "Listada") throw new Error(`${name}: whitelist v1 aceita somente listadas (tipo atual: ${entry.entityType}).`);
    if (entry.eventYear === null) throw new Error(`${name}: ano do evento ausente no cadastro.`);
    const analysisYear = Math.trunc(entry.eventYear) - 1;
    const values = financialRows.get(`${name}|${analysisYear}`);
    if (!values) throw new Error(`${name}: linha t-1 (${analysisYear}) não encontrada na Aba 02.`);
    const missingVariables = Object.entries(values).filter(([, value]) => value === null).map(([variable]) => variable);
    if (missingVariables.length > 0) {
      throw new Error(`${name}: valores não numéricos em t-1 (${analysisYear}): ${missingVariables.join(", ")}. A Faixa A exige financeiro completo.`);
    }
    const { contributions, availableWeight, score, band } = computeScore(values);
    if (score === null) throw new Error(`${name}: cobertura insuficiente para o score experimental.`);
    const observed = Object.fromEntries(contributions.map((item) => [item.key, item.observed]));
    companies.push({
      slug: slugify(name),
      name,
      ticker: entry.ticker,
      tier: entry.tier,
      entityType: entry.entityType,
      sector: displaySector(entry.sector),
      eventYear: Math.trunc(entry.eventYear),
      collectionWindow: normalizeWindow(entry.window),
      collectionStatus: SEAL,
      completion: entry.completion ?? 0,
      analysisYear,
      score,
      scoreBand: BAND_LABELS[band],
      scoreCoverage: availableWeight,
      metrics: {
        revenue: round2(values["Receita Líquida"]),
        ebitMargin: round2(observed.ebitMargin),
        netMargin: round2(observed.netMargin),
        currentRatio: round2(observed.currentRatio),
        netDebtAssets: round2(observed.netDebtAssets),
        equityAssets: round2(observed.equityAssets),
        operatingCashMargin: round2(observed.operatingCashMargin),
      },
      sourceSummary: "Demonstrações financeiras consolidadas (DFP/CVM), base Economatica e conferência documental em andamento.",
      sourceUrl: entry.site.startsWith("http") ? entry.site : "https://www.gov.br/cvm/pt-br",
      publicNote: "Recorte t-1. Valores financeiros em R$ milhões; indicadores derivados pelo SECC.",
    });
    report.push(`${name}: t-1=${analysisYear} score=${score} banda=${BAND_LABELS[band]}`);
  }
  companies.sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));

  const slugs = new Set(companies.map((company) => company.slug));
  if (slugs.size !== companies.length) throw new Error("Slugs duplicados no recorte público.");

  const generatedAt = new Date().toISOString();
  const showcase = {
    release: {
      id: `secc-public-showcase-${args.referenceDate}`,
      version: SHOWCASE_VERSION,
      referenceDate: args.referenceDate,
      generatedAt,
      baselineVersion: readBaselineVersion(workbook),
      mappingVersion: MAPPING_VERSION,
      scope: "Recorte público sanitizado para demonstração do produto. A base analítica completa permanece na área protegida.",
    },
    portfolio,
    score: {
      version: SCORE_VERSION,
      analysisWindow: "t-1",
      scale: "0–100 · maior = mais saudável",
      minimumCoverage: 60,
      minimumDimensions: 4,
      dimensions: SCORE_DIMENSIONS,
    },
    companies,
    sources: [
      { name: "CVM", role: "Cadastro de companhias e demonstrações financeiras padronizadas", status: "Conector operacional" },
      { name: "Planilha mestre SECC", role: "Baseline, janelas relativas, dados coletados e diagnóstico de cobertura", status: "Sincronização controlada" },
      { name: "Economatica e B3", role: "Séries financeiras e informações de mercado para companhias listadas", status: "Fontes catalogadas" },
      { name: "RI, administradores judiciais e tribunais", role: "Documentos societários, processuais e eventos de reestruturação", status: "Pesquisa documental" },
      { name: "Banco Central — SGS", role: "Contexto macroeconômico e setorial", status: "Fonte catalogada" },
    ],
    limitations: [
      "A release pública é um recorte sanitizado e não reproduz a planilha mestre.",
      `Os ${companies.length} casos exibidos ainda estão em conferência na base de pesquisa.`,
      "O índice é heurístico, experimental e não foi calibrado como probabilidade de default; a escala segue a convenção de mercado (0–100, maior = mais saudável).",
      "O conteúdo tem finalidade acadêmica e informacional; não constitui rating, recomendação de crédito ou investimento.",
    ],
  };

  const outputDir = path.join(process.cwd(), "data", "public");
  await mkdir(outputDir, { recursive: true });
  const showcaseJson = `${JSON.stringify(showcase, null, 2)}\n`;
  await writeFile(path.join(outputDir, "showcase.json"), showcaseJson, "utf8");

  const manifest = {
    version: SHOWCASE_VERSION,
    referenceDate: args.referenceDate,
    generatedAt,
    releaseId: showcase.release.id,
    counts: {
      portfolioCompanies: portfolio.companies,
      publishedCompanyCases: companies.length,
      scoreDimensions: SCORE_DIMENSIONS.length,
      sources: showcase.sources.length,
    },
    hashes: {
      "showcase.json": createHash("sha256").update(showcaseJson).digest("hex"),
    },
    limitations: showcase.limitations,
  };
  await writeFile(path.join(outputDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  console.log(`Release ${SHOWCASE_VERSION} gerado com ${companies.length} empresas.`);
  console.log(`Portfólio: ${JSON.stringify(portfolio)}`);
  for (const line of report) console.log(`  ${line}`);
}

main().catch((error) => {
  console.error(`Falha na geração do release: ${error.message}`);
  process.exit(1);
});
