import { gzipSync } from "node:zlib";
import postgres from "postgres";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL não configurada.");
const sql = postgres(process.env.DATABASE_URL, { max: 1 });

try {
  const rows = await sql`
    select
      c.id, c.slug, c.name, c.tier, c.sector, c.event_type, c.event_year,
      c.publication_status, c.workbook_row, c.company_type, c.reference_code,
      c.collection_start_year, c.collection_end_year, c.workbook_status,
      c.workbook_completion, c.cvm_cnpj, c.cvm_code, c.coverage_updated_at,
      cv.financial_filled, cv.financial_expected, cv.qualitative_filled,
      cv.qualitative_expected, cv.market_filled, cv.market_expected,
      cv.researched_years, cv.total_years, cv.last_data_year, cv.calculated_at
    from companies c
    left join company_coverage cv on cv.company_id = c.id
    order by c.name
  `;

  const companies = rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    tier: row.tier,
    sector: row.sector,
    eventType: row.event_type,
    eventYear: row.event_year,
    publicationStatus: row.publication_status,
    workbookRow: row.workbook_row,
    companyType: row.company_type,
    referenceCode: row.reference_code,
    collectionStartYear: row.collection_start_year,
    collectionEndYear: row.collection_end_year,
    workbookStatus: row.workbook_status,
    workbookCompletion: row.workbook_completion === null ? null : Number(row.workbook_completion),
    cvmCnpj: row.cvm_cnpj ? "disponível" : null,
    cvmCode: row.cvm_code ? "disponível" : null,
    coverageUpdatedAt: row.coverage_updated_at?.toISOString() ?? null,
    coverage: row.calculated_at === null ? null : {
      companyId: row.id,
      financialFilled: row.financial_filled ?? 0,
      financialExpected: row.financial_expected ?? 0,
      qualitativeFilled: row.qualitative_filled ?? 0,
      qualitativeExpected: row.qualitative_expected ?? 0,
      marketFilled: row.market_filled ?? 0,
      marketExpected: row.market_expected ?? 0,
      researchedYears: row.researched_years ?? 0,
      totalYears: row.total_years ?? 0,
      lastDataYear: row.last_data_year,
      workbookHash: "interno",
      calculatedAt: row.calculated_at.toISOString(),
    },
  }));

  const snapshot = { version: 1, generatedAt: new Date().toISOString(), companies };
  process.stdout.write(gzipSync(JSON.stringify(snapshot), { level: 9 }).toString("base64"));
} finally {
  await sql.end();
}
