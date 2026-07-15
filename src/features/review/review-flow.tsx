"use client";

import { useMemo, useState } from "react";
import { StatusBadge } from "@/components/ui/status-badge";
import { demoProposals } from "@/features/demo/data";
import { LocalExcelAdapter } from "@/lib/excel/local-adapter";
import type { SyncPreview } from "@/lib/excel/contracts";
import { LocalPublicationRepository } from "@/lib/publication/local-release";
import type { AuditEvent, Proposal } from "@/types/domain";

const excel = new LocalExcelAdapter();
const publication = new LocalPublicationRepository();

export function ReviewFlow() {
  const [proposals, setProposals] = useState<Proposal[]>(demoProposals);
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const [sync, setSync] = useState<SyncPreview | null>(null);
  const pending = proposals.find((item) => item.status === "under_review");
  const release = useMemo(() => publication.preview(proposals), [proposals]);
  function decide(decision: "approved" | "rejected") {
    if (!pending) return;
    const reason = decision === "approved" ? "Fonte, unidade e período conferidos em demonstração." : "Proposta fictícia rejeitada para demonstrar governança.";
    setProposals((items) => items.map((item) => item.id === pending.id ? { ...item, status: decision, version: item.version + 1 } : item));
    setAudit((items) => [...items, { id: `audit-local-${items.length + 1}`, action: `proposal.${decision}`, entityId: pending.id, actorId: "demo-reviewer", occurredAt: new Date().toISOString(), previousVersion: pending.version, resultingVersion: pending.version + 1, reason, origin: "manual" }]);
  }
  async function previewSync(currentVersion = "demo-v1", key = "batch-demo-001") {
    setSync(await excel.preview({ syncBatchId: "sync-demo-001", idempotencyKey: key, workbookId: "workbook-local-simulado", sourceWorkbookVersion: "demo-v1", currentWorkbookVersion: currentVersion, mappingVersion: "demo-map-v1", approvedProposals: proposals.filter((item) => item.status === "approved") }));
  }
  return <div className="grid" style={{gap: 24}}>
    <section className="card"><div className="split"><div><p className="eyebrow">1 · Fila de revisão</p><h3>{pending ? pending.variable : "Fila concluída"}</h3>{pending && <p>{pending.year} · {pending.value} · {pending.unit}<br/>Fonte: <a href={pending.source.url}>{pending.source.title}</a></p>}</div>{pending && <StatusBadge status={pending.status}/>}</div>{pending && <div className="actions"><button className="button" onClick={() => decide("approved")}>Aprovar como revisor</button><button className="button danger" onClick={() => decide("rejected")}>Rejeitar</button></div>}</section>
    <section className="grid two"><article className="card"><p className="eyebrow">2 · Auditoria</p><h3>{audit.length} novo evento</h3>{audit.map((event) => <p className="mono" key={event.id}>{event.action} · v{event.previousVersion} → v{event.resultingVersion}<br/>{event.reason}</p>)}{!audit.length && <p>A decisão registrará autor, horário, versões e justificativa.</p>}</article><article className="card"><p className="eyebrow">3 · Release pública</p><h3>{release.proposals.length} registro elegível</h3><p>Somente aprovado + autorizado. O registro aprovado sem autorização e o item em revisão ficam de fora.</p></article></section>
    <section className="card"><p className="eyebrow">4 · Prévia de sincronização Excel</p><h3>Adaptador local simulado</h3><p>Nenhum arquivo real é lido. Teste preparação, conflito otimista e idempotência.</p><div className="actions"><button className="button" onClick={() => previewSync()}>Preparar lote</button><button className="button secondary" onClick={() => previewSync("demo-v2", "batch-conflict")}>Simular conflito</button><button className="button secondary" onClick={() => previewSync()}>Repetir lote</button></div>{sync && <div className="notice" style={{marginTop: 16}}><strong>{sync.status.toUpperCase()}</strong> — {sync.message}{sync.backupPlanned && " Backup previsto antes da aplicação."}</div>}</section>
  </div>;
}
