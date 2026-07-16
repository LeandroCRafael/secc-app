import { requireRole } from "@/lib/auth/server";
import { checkDatabaseHealth } from "@/lib/database/postgres";
import { PostgresOperationalRepository } from "@/lib/database/postgres-operational-repository";

export const metadata = { title: "Banco operacional" };
export const dynamic = "force-dynamic";

type DatabaseState =
  | { connected: true; database: string; user: string; version: string; companies: number; proposals: number }
  | { connected: false };

async function getDatabaseState(): Promise<DatabaseState> {
  try {
    const repository = new PostgresOperationalRepository();
    const [health, companies, proposals] = await Promise.all([
      checkDatabaseHealth(),
      repository.listCompanies(),
      repository.listProposals(),
    ]);
    return { connected: true, ...health, companies: companies.length, proposals: proposals.length };
  } catch {
    return { connected: false };
  }
}

export default async function DatabasePage() {
  await requireRole("admin");
  const state = await getDatabaseState();
  const environment = process.env.VERCEL ? "Produção gerenciada · Neon" : "Ambiente de desenvolvimento";

  return (
    <>
      <header className="admin-title">
        <p className="eyebrow">Infraestrutura operacional</p>
        <h1>PostgreSQL operacional.</h1>
        <p className="lede">
          Diagnóstico restrito ao administrador. Credenciais e endereço de conexão não são exibidos.
        </p>
      </header>
      {state.connected ? (
        <section className="grid three" aria-label="Diagnóstico do banco operacional">
          <article className="card">
            <p>Estado</p>
            <div className="metric">Conectado</div>
            <p>{environment}</p>
          </article>
          <article className="card">
            <p>Banco e usuário</p>
            <div className="metric">{state.database}</div>
            <p className="mono">{state.user}</p>
          </article>
          <article className="card">
            <p>PostgreSQL</p>
            <div className="metric">{state.version}</div>
          </article>
        </section>
      ) : (
        <section className="notice" role="alert">
          O banco operacional não respondeu. Verifique a conexão configurada para este ambiente.
        </section>
      )}
      <section className="section notice">
        Repositório operacional validado em leitura: {state.connected ? `${state.companies} empresa(s) e ${state.proposals} proposta(s)` : "indisponível"}.
        O diagnóstico da planilha, os vínculos CVM e as propostas de coleta usam esta base operacional privada.
      </section>
    </>
  );
}
