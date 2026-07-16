import { requireRole } from "@/lib/auth/server";
import { PostgresOperationalRepository } from "@/lib/database/postgres-operational-repository";
export const metadata = { title: "Auditoria" };
export const dynamic = "force-dynamic";

export default async function AuditPage() {
  await requireRole("admin");
  let events;
  try {
    events = await new PostgresOperationalRepository().listAuditEvents();
  } catch {
    return <><header className="admin-title"><p className="eyebrow">Trilha imutável</p><h1>Banco operacional indisponível.</h1></header><p className="notice" role="alert">Verifique a conexão do ambiente para consultar a auditoria.</p></>;
  }

  return <><header className="admin-title"><p className="eyebrow">Trilha imutável · PostgreSQL</p><h1>Cada mudança explica quem, quando e por quê.</h1></header>{events.length === 0 ? <p className="notice">Nenhum evento operacional registrado.</p> : <div className="table-wrap"><table><thead><tr><th>Data</th><th>Evento</th><th>Entidade</th><th>Autor</th><th>Versão</th><th>Justificativa</th></tr></thead><tbody>{events.map((event) => <tr key={event.id}><td>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(event.occurredAt))}</td><td className="mono">{event.action}</td><td className="mono">{event.entityId}</td><td>{event.actorId}</td><td>{event.previousVersion ?? "—"} → {event.resultingVersion}</td><td>{event.reason}</td></tr>)}</tbody></table></div>}</>;
}
