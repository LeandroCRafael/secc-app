import { requireRole } from "@/lib/auth/server";
import { hasScoreInterinoSnapshot, readScoreInterinoSnapshot } from "@/lib/diagnostics/score-interino-snapshot";

export const metadata = { title: "Score Interino (lab)" };
export const dynamic = "force-dynamic";

const COMPONENT_LABELS: Record<string, string> = {
  sanvicente_minardi: "Z″ S-M",
  altman: "Altman",
  ohlson: "Ohlson",
  dd_naive: "DD naive",
};

function bandClass(banda: string | null): string {
  if (!banda) return "status";
  if (banda.startsWith("Verde")) return "status available";
  if (banda.startsWith("Amarelo")) return "status under_review";
  return "status unavailable";
}

export default async function ScoreInterinoPage() {
  await requireRole("admin");
  if (!hasScoreInterinoSnapshot()) {
    return <><header className="admin-title"><p className="eyebrow">Score Interino · laboratório</p><h1>Snapshot não configurado.</h1></header><p className="notice" role="alert">Defina SCORE_INTERINO_SNAPSHOT (gerado por scripts/encode-score-interino.mjs a partir do cálculo do workspace privado).</p></>;
  }
  const snapshot = readScoreInterinoSnapshot();
  const componentKeys = Object.keys(snapshot.pesos);
  const rows = Object.entries(snapshot.empresas).sort(([a], [b]) => a.localeCompare(b, "pt-BR"));

  return (
    <>
      <header className="admin-title">
        <p className="eyebrow">Score Interino v0.2.0 · laboratório protegido</p>
        <h1>Quatro modelos clássicos, uma leitura combinada.</h1>
        <p className="lede">Média ponderada de Z″ Sanvicente-Minardi (40), Altman 1968 (25), O-Score Ohlson (20) e DD naive Bharath-Shumway (15), cada um convertido para saúde 0–100 (maior = mais saudável). Componente indisponível redistribui o peso. Janela {snapshot.janela}. Calculado em {snapshot.calculado_em.slice(0, 10)} · conferência {snapshot.conferencia}.</p>
      </header>

      <section className="section table-wrap">
        <table>
          <thead><tr><th>Empresa</th><th>t-1</th>{componentKeys.map((key) => <th key={key}>{COMPONENT_LABELS[key] ?? key} <small>({snapshot.pesos[key]})</small></th>)}<th>Peso disp.</th><th>Interino</th><th>Banda</th></tr></thead>
          <tbody>
            {rows.map(([nome, empresa]) => (
              <tr key={nome}>
                <td><strong>{nome}</strong><br /><small>{empresa.ticker}</small></td>
                <td>{empresa.ano_analise}</td>
                {componentKeys.map((key) => {
                  const item = empresa.componentes[key];
                  if (!item) return <td key={key}><span className="status" title={empresa.indisponiveis[key]}>—</span></td>;
                  return <td key={key} title={item.nota ?? ""}>{item.saude.toFixed(0)}</td>;
                })}
                <td>{empresa.peso_disponivel}</td>
                <td><strong>{empresa.interino === null ? "—" : empresa.interino.toFixed(1)}</strong></td>
                <td><span className={bandClass(empresa.banda)}>{empresa.banda ?? "cobertura insuficiente"}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="section grid two">
        <article className="card"><p className="eyebrow">O que este laboratório é</p><h3>Combinação heurística de modelos publicados.</h3><p>Substitui provisoriamente o modelo próprio enquanto o SECC E-Score é estimado. Fórmulas, âncoras das transformações e proxies documentados na especificação v0.2 do workspace privado. Escala e bandas seguem a convenção pública (Vermelho 0–49, Amarelo 50–74, Verde 75–100).</p></article>
        <article className="card"><p className="eyebrow">Limitações conhecidas</p><h3>Não é PD, rating nem recomendação.</h3><p>Sem calibração conjunta na amostra brasileira. O DD naive superestima a saúde quando a dívida bancária registrada está subestimada (reclassificações pré-RJ). Lucros retidos usam o proxy PL − capital social; σE vem de séries nominais sem ajuste de proventos.</p></article>
      </section>

      <section className="section notice">Uso interno de pesquisa. O índice público permanece o experimental da vitrine; este resultado não é publicado.</section>
    </>
  );
}
