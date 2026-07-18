"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  WorkbookCellValue,
  WorkbookSyncItem,
  WorkbookSyncPreview,
  WorkbookSyncResolution,
} from "@/lib/excel/sync-contracts";

type PreviewResponse = WorkbookSyncPreview & { reused: boolean };
type RequestState = "idle" | "previewing" | "applying";

const statusLabel: Record<WorkbookSyncItem["status"], string> = {
  ready: "Pronta",
  unchanged: "Já conciliada",
  conflict: "Conflito",
  unmapped: "Sem de-para",
  applied: "Aplicada",
  kept_excel: "Mantida no Excel",
  imported: "Enviada à revisão",
};

function valueLabel(value: WorkbookCellValue): string {
  if (value === null || value === "") return "Em branco";
  if (typeof value === "object") return `Fórmula: ${value.formula}`;
  if (typeof value === "number") return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 4 }).format(value);
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  return value;
}

function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function responseFileName(response: Response, fallback: string): string {
  const disposition = response.headers.get("Content-Disposition") ?? "";
  return disposition.match(/filename="?([^";]+)"?/i)?.[1] ?? fallback;
}

export function WorkbookSyncForm({ approvedCount }: { approvedCount: number }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [resolutions, setResolutions] = useState<Record<string, WorkbookSyncResolution>>({});
  const [backupDownloaded, setBackupDownloaded] = useState(false);
  const [requestState, setRequestState] = useState<RequestState>("idle");
  const [message, setMessage] = useState<{ kind: "error" | "success"; text: string } | null>(null);

  const appItems = useMemo(() => preview?.items.filter((item) => item.direction === "app_to_excel") ?? [], [preview]);
  const excelItems = useMemo(() => preview?.items.filter((item) => item.direction === "excel_to_app") ?? [], [preview]);
  const conflictItems = appItems.filter((item) => item.status === "conflict");
  const unresolvedConflicts = conflictItems.filter((item) => !item.proposalId || !resolutions[item.proposalId]).length;
  const blocked = preview?.batch.status === "blocked" || (preview?.batch.unmappedCount ?? 0) > 0;
  const canApply = Boolean(preview && file && !blocked && backupDownloaded && unresolvedConflicts === 0);

  function resetForFile(next: File | null): void {
    setFile(next);
    setPreview(null);
    setResolutions({});
    setBackupDownloaded(false);
    setMessage(null);
  }

  async function createPreview(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!file) return;
    setRequestState("previewing");
    setMessage(null);
    try {
      const data = new FormData();
      data.set("workbook", file);
      const response = await fetch("/admin/sincronizacao/preview", { method: "POST", body: data });
      const payload = await response.json() as PreviewResponse | { error?: string };
      if (!response.ok || !("batch" in payload)) throw new Error("error" in payload ? payload.error : "Não foi possível gerar a prévia.");
      setPreview(payload);
      setResolutions({});
      setBackupDownloaded(false);
      setMessage(payload.reused ? { kind: "success", text: "Prévia idêntica recuperada. O lote não foi duplicado." } : null);
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "Não foi possível gerar a prévia." });
    } finally {
      setRequestState("idle");
    }
  }

  function downloadBackup(): void {
    if (!file || !preview) return;
    downloadBlob(file, preview.batch.backupFileName);
    setBackupDownloaded(true);
  }

  async function applyPreview(): Promise<void> {
    if (!file || !preview || !canApply) return;
    setRequestState("applying");
    setMessage(null);
    try {
      const data = new FormData();
      data.set("workbook", file);
      data.set("batchId", preview.batch.id);
      data.set("backupConfirmed", String(backupDownloaded));
      data.set("resolutions", JSON.stringify(resolutions));
      const response = await fetch("/admin/sincronizacao/aplicar", { method: "POST", body: data });
      if (!response.ok) {
        const payload = await response.json() as { error?: string };
        throw new Error(payload.error ?? "Não foi possível aplicar o lote.");
      }
      const workbook = await response.blob();
      downloadBlob(workbook, responseFileName(response, preview.batch.outputFileName ?? "SECC_atualizado.xlsx"));
      const imported = Number(response.headers.get("X-SECC-Imported-Excel") ?? 0);
      const replayed = response.headers.get("X-SECC-Replayed") === "true";
      setPreview((current) => current ? { ...current, batch: { ...current.batch, status: "applied" } } : current);
      setMessage({
        kind: "success",
        text: replayed
          ? "A mesma versão atualizada foi regenerada sem duplicar registros."
          : `Nova versão gerada. ${imported} alteração(ões) originada(s) no Excel foram enviadas à revisão.`,
      });
      router.refresh();
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "Não foi possível aplicar o lote." });
    } finally {
      setRequestState("idle");
    }
  }

  return <div className="sync-flow">
    <form className="workspace-panel form-grid" onSubmit={createPreview}>
      <div className="panel-heading full">
        <div><p className="eyebrow">1 · Arquivo mestre</p><h2>Gerar prévia controlada</h2></div>
        <span className="status under_review">Nenhuma sobrescrita automática</span>
      </div>
      <label className="full">Planilha oficial XLSX
        <input
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          required
          onChange={(event) => resetForFile(event.target.files?.[0] ?? null)}
        />
      </label>
      <p className="notice full">Use sempre a versão mais recente da planilha. O limite operacional é de 4 MB. A prévia identifica a versão, calcula o SHA-256 e compara apenas as células cobertas pelo de-para validado.</p>
      <div className="actions full">
        <button className="button" type="submit" disabled={!file || requestState !== "idle"}>{requestState === "previewing" ? "Analisando planilha…" : "Validar e comparar"}</button>
        {file && <span className="muted">{file.name} · {new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(file.size / 1024)} KB</span>}
      </div>
    </form>

    {message && <p className={message.kind === "error" ? "error sync-message" : "notice sync-message"} role={message.kind === "error" ? "alert" : "status"}>{message.text}</p>}

    {preview && <section className="workspace-panel sync-preview" aria-live="polite">
      <div className="panel-heading">
        <div><p className="eyebrow">2 · Prévia do lote</p><h2>{preview.batch.sourceWorkbookVersion} → {preview.batch.resultWorkbookVersion}</h2><p className="muted mono">SHA-256 {preview.batch.sourceSha256.slice(0, 16)}… · mapa {preview.batch.mappingVersion}</p></div>
        <span className={`status ${preview.batch.status === "blocked" ? "rejected" : preview.batch.status === "applied" ? "approved" : "under_review"}`}>{preview.batch.status === "blocked" ? "Bloqueada" : preview.batch.status === "applied" ? "Aplicada" : "Pronta para decisão"}</span>
      </div>

      <div className="workspace-summary sync-summary">
        <article><span>Aprovadas no app</span><strong>{preview.batch.approvedCount}</strong><small>{approvedCount} aprovadas no banco na abertura</small></article>
        <article><span>Escritas diretas</span><strong>{preview.batch.readyCount}</strong><small>Células sem divergência</small></article>
        <article><span>Conflitos</span><strong>{preview.batch.conflictCount}</strong><small>Exigem decisão explícita</small></article>
        <article><span>Mudanças no Excel</span><strong>{preview.batch.excelChangeCount}</strong><small>Voltam para revisão no app</small></article>
      </div>

      {preview.versionConflict && <p className="error sync-blocker" role="alert">{preview.versionConflict}</p>}
      {preview.batch.unmappedCount > 0 && <p className="error sync-blocker" role="alert">Há {preview.batch.unmappedCount} proposta(s) sem célula de destino no de-para. O lote está bloqueado até corrigir cadastro, ano ou variável.</p>}
      {!preview.hasBaseline && <p className="notice">Esta é a primeira leitura controlada desta planilha. Ela estabelece a linha de base; alterações originadas no Excel passam a ser detectadas a partir da versão gerada.</p>}

      <div className="sync-section-heading"><div><p className="eyebrow">App → Excel</p><h3>Propostas aprovadas e destino</h3></div><span>{appItems.length} item(ns)</span></div>
      {appItems.length === 0 ? <p className="notice">Não há propostas aprovadas para gravar. Ainda é possível estabelecer a primeira linha de base da planilha.</p> : <div className="table-wrap"><table className="sync-table"><thead><tr><th>Empresa / período</th><th>Variável</th><th>Destino</th><th>Excel atual</th><th>Valor aprovado</th><th>Situação / decisão</th></tr></thead><tbody>{appItems.map((item) => <tr key={`${item.proposalId}-${item.cellAddress}`}><td><strong>{item.companyName}</strong><br/><small>{item.year}</small></td><td>{item.variable}<br/><small>{item.unit}</small></td><td>{item.sheetName ? <span className="mono">{item.sheetName}!{item.cellAddress}</span> : "—"}</td><td>{valueLabel(item.previousValue)}</td><td>{valueLabel(item.proposedValue)}</td><td><span className={`status ${item.status === "conflict" || item.status === "unmapped" ? "rejected" : item.status === "unchanged" ? "approved" : "under_review"}`}>{statusLabel[item.status]}</span>{item.status === "conflict" && item.proposalId && <fieldset className="sync-resolution"><legend>Qual valor prevalece?</legend><label><input type="radio" name={`resolution-${item.proposalId}`} checked={resolutions[item.proposalId] === "use_app"} onChange={() => setResolutions((current) => ({ ...current, [item.proposalId!]: "use_app" }))}/> Usar aprovado no app</label><label><input type="radio" name={`resolution-${item.proposalId}`} checked={resolutions[item.proposalId] === "keep_excel"} onChange={() => setResolutions((current) => ({ ...current, [item.proposalId!]: "keep_excel" }))}/> Manter Excel e revisar no app</label></fieldset>}<small className="sync-item-message">{item.message}</small></td></tr>)}</tbody></table></div>}

      <div className="sync-section-heading"><div><p className="eyebrow">Excel → App</p><h3>Diferenças desde a última versão</h3></div><span>{excelItems.length} item(ns)</span></div>
      {excelItems.length === 0 ? <p className="muted">Nenhuma alteração externa detectada nas células controladas.</p> : <div className="table-wrap"><table className="sync-table"><thead><tr><th>Empresa / período</th><th>Variável</th><th>Célula</th><th>Base anterior</th><th>Excel recebido</th><th>Tratamento</th></tr></thead><tbody>{excelItems.map((item) => <tr key={`${item.companyId}-${item.sheetName}-${item.cellAddress}`}><td><strong>{item.companyName}</strong><br/><small>{item.year}</small></td><td>{item.variable}</td><td className="mono">{item.sheetName}!{item.cellAddress}</td><td>{valueLabel(item.previousValue)}</td><td>{valueLabel(item.proposedValue)}</td><td><span className="status under_review">Fila de revisão</span><small className="sync-item-message">{item.message}</small></td></tr>)}</tbody></table></div>}

      <div className="sync-confirm">
        <div><p className="eyebrow">3 · Backup e aplicação</p><h3>Confirme a proteção da origem</h3><p>O backup é baixado no seu computador. Depois, a aplicação gera outra planilha completa; o arquivo selecionado nunca é alterado no lugar.</p></div>
        <div className="sync-confirm-actions">
          <button className={`button ${backupDownloaded ? "secondary" : ""}`} type="button" onClick={downloadBackup}>{backupDownloaded ? "Backup baixado" : "Baixar backup obrigatório"}</button>
          <button className="button" type="button" onClick={applyPreview} disabled={!canApply || requestState !== "idle"}>{requestState === "applying" ? "Gerando versão…" : preview.batch.status === "applied" ? "Regenerar versão idempotente" : "Aplicar e baixar nova versão"}</button>
          {!backupDownloaded && <small>Baixe o backup para liberar a aplicação.</small>}
          {unresolvedConflicts > 0 && <small>Resolva {unresolvedConflicts} conflito(s) para continuar.</small>}
          {blocked && <small>O lote está bloqueado; nenhuma escrita será executada.</small>}
        </div>
      </div>
    </section>}
  </div>;
}
