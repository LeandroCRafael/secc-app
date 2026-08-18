import "server-only";
import { gunzipSync } from "node:zlib";

/**
 * Snapshot do Score Interino v0.2.0 (laboratório protegido).
 * Calculado fora do app (workspace privado, scripts/score_interino.py do Coletor) e
 * entregue por variável de ambiente gzip+base64 — mesmo padrão do
 * INTERNAL_DIAGNOSTICS_SNAPSHOT. O repositório é público: o snapshot nunca entra no git.
 */

export type ScoreInterinoComponent = {
  saude: number;
  z?: number | null;
  o?: number | null;
  dd?: number | null;
  sigma_e?: number;
  nota?: string;
};

export type ScoreInterinoCompany = {
  ticker: string;
  ano_analise: number;
  status: "elegivel" | "cobertura_insuficiente";
  interino: number | null;
  banda: string | null;
  peso_disponivel: number;
  componentes: Record<string, ScoreInterinoComponent>;
  indisponiveis: Record<string, string>;
};

export type ScoreInterinoSnapshot = {
  modelo: string;
  janela: string;
  pesos: Record<string, number>;
  calculado_em: string;
  conferencia: string;
  empresas: Record<string, ScoreInterinoCompany>;
};

export function hasScoreInterinoSnapshot(): boolean {
  return Boolean(process.env.SCORE_INTERINO_SNAPSHOT);
}

export function readScoreInterinoSnapshot(): ScoreInterinoSnapshot {
  const encoded = process.env.SCORE_INTERINO_SNAPSHOT;
  if (!encoded) throw new Error("Snapshot do Score Interino não configurado.");
  const parsed = JSON.parse(gunzipSync(Buffer.from(encoded, "base64")).toString("utf8")) as Partial<ScoreInterinoSnapshot>;
  if (!parsed.modelo || !parsed.pesos || !parsed.empresas || typeof parsed.calculado_em !== "string") {
    throw new Error("Snapshot do Score Interino inválido.");
  }
  return parsed as ScoreInterinoSnapshot;
}
