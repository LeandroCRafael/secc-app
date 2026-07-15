import type { ExcelAdapter, SyncPreview, SyncRequest } from "./contracts";

export class LocalExcelAdapter implements ExcelAdapter {
  private readonly processedKeys = new Set<string>();

  async preview(request: SyncRequest): Promise<SyncPreview> {
    if (this.processedKeys.has(request.idempotencyKey)) {
      return { status: "duplicate", backupPlanned: false, affectedCells: [], conflicts: [], message: "Lote já processado; nenhuma segunda escrita seria executada." };
    }
    if (request.sourceWorkbookVersion !== request.currentWorkbookVersion) {
      return { status: "blocked", backupPlanned: false, affectedCells: [], conflicts: ["A versão atual diverge da versão esperada."], message: "Sincronização bloqueada por conflito de versão." };
    }
    this.processedKeys.add(request.idempotencyKey);
    return {
      status: "prepared",
      backupPlanned: true,
      affectedCells: request.approvedProposals.map((proposal, index) => `DEMO!R${index + 2}:C${proposal.year}`),
      conflicts: [],
      message: "Prévia local preparada. Nenhuma planilha foi lida ou alterada."
    };
  }
}
