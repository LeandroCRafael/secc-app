import "server-only";
import { gunzipSync } from "node:zlib";
import { PostgresOperationalRepository } from "@/lib/database/postgres-operational-repository";
import type { CompanyDiagnostic, Proposal } from "@/types/domain";

type InternalDiagnosticsSnapshot = {
  version: 1;
  generatedAt: string;
  companies: CompanyDiagnostic[];
};

export type DiagnosticDataSource = {
  companies: CompanyDiagnostic[];
  proposals: Proposal[];
  mode: "operational" | "snapshot";
  generatedAt: string | null;
};

export function hasOperationalDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export function isInternalSnapshotMode(): boolean {
  return !hasOperationalDatabase() && Boolean(process.env.INTERNAL_DIAGNOSTICS_SNAPSHOT);
}

function readSnapshot(): InternalDiagnosticsSnapshot {
  const encoded = process.env.INTERNAL_DIAGNOSTICS_SNAPSHOT;
  if (!encoded) throw new Error("Snapshot interno não configurado.");

  const parsed = JSON.parse(gunzipSync(Buffer.from(encoded, "base64")).toString("utf8")) as Partial<InternalDiagnosticsSnapshot>;
  if (parsed.version !== 1 || typeof parsed.generatedAt !== "string" || !Array.isArray(parsed.companies)) {
    throw new Error("Snapshot interno inválido.");
  }
  return parsed as InternalDiagnosticsSnapshot;
}

export async function loadDiagnosticData(): Promise<DiagnosticDataSource> {
  if (hasOperationalDatabase()) {
    try {
      const repository = new PostgresOperationalRepository();
      const [companies, proposals] = await Promise.all([repository.listCompanyDiagnostics(), repository.listProposals()]);
      return { companies, proposals, mode: "operational", generatedAt: null };
    } catch (error) {
      if (!process.env.INTERNAL_DIAGNOSTICS_SNAPSHOT) throw error;
    }
  }

  if (process.env.INTERNAL_DIAGNOSTICS_SNAPSHOT) {
    const snapshot = readSnapshot();
    return { companies: snapshot.companies, proposals: [], mode: "snapshot", generatedAt: snapshot.generatedAt };
  }

  throw new Error("Banco operacional e snapshot interno indisponíveis.");
}
