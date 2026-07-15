import { describe, expect, it } from "vitest";
import { demoProposals } from "@/features/demo/data";
import { LocalExcelAdapter } from "@/lib/excel/local-adapter";

const base = { syncBatchId: "sync-1", idempotencyKey: "idempotency-1", workbookId: "demo", sourceWorkbookVersion: "v1", currentWorkbookVersion: "v1", mappingVersion: "map-v1", approvedProposals: demoProposals.filter((item) => item.status === "approved") };

describe("adaptador Excel local", () => {
  it("planeja backup ao preparar lote", async () => { const result = await new LocalExcelAdapter().preview(base); expect(result.status).toBe("prepared"); expect(result.backupPlanned).toBe(true); });
  it("bloqueia conflito de versão", async () => { const result = await new LocalExcelAdapter().preview({ ...base, currentWorkbookVersion: "v2" }); expect(result.status).toBe("blocked"); expect(result.affectedCells).toHaveLength(0); });
  it("não reaplica a mesma chave", async () => { const adapter = new LocalExcelAdapter(); await adapter.preview(base); const result = await adapter.preview(base); expect(result.status).toBe("duplicate"); expect(result.backupPlanned).toBe(false); });
});
