#!/usr/bin/env node
/**
 * Codifica o JSON do Score Interino (calculado no workspace privado) para a variável
 * de ambiente SCORE_INTERINO_SNAPSHOT (gzip + base64), no mesmo padrão do
 * INTERNAL_DIAGNOSTICS_SNAPSHOT. O caminho do JSON vem por argumento — nenhum
 * caminho local nem dado do snapshot é versionado neste repositório público.
 *
 * Uso:
 *   node scripts/encode-score-interino.mjs --json <caminho> [--out <arquivo>]
 * Sem --out, imprime apenas o valor (stdout), pronto para:
 *   node scripts/encode-score-interino.mjs --json <caminho> | npx vercel env add SCORE_INTERINO_SNAPSHOT production
 */
import { readFileSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import process from "node:process";

function arg(flag) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const jsonPath = arg("--json");
if (!jsonPath) {
  console.error("Informe --json <caminho do score_interino_t1.json>.");
  process.exit(1);
}

const raw = readFileSync(jsonPath, "utf8");
const parsed = JSON.parse(raw);
if (!parsed.modelo || !parsed.pesos || !parsed.empresas) {
  console.error("JSON não parece um snapshot do Score Interino (faltam modelo/pesos/empresas).");
  process.exit(1);
}

const encoded = gzipSync(Buffer.from(JSON.stringify(parsed), "utf8")).toString("base64");
const out = arg("--out");
if (out) {
  writeFileSync(out, encoded, "utf8");
  console.error(`Gravado ${out} (${encoded.length} caracteres).`);
} else {
  process.stdout.write(encoded);
  console.error(`\n(${encoded.length} caracteres)`);
}
