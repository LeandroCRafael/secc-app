import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_MASTER_FILE = "SECC_Coleta_de_Dados_COMPLETA.xlsx";

export async function readMasterWorkbook(): Promise<{ buffer: Buffer; path: string; name: string }> {
  const configured = process.env.MASTER_WORKBOOK_PATH?.trim();
  const resolved = configured
    ? path.resolve(configured)
    : path.resolve(process.cwd(), "..", DEFAULT_MASTER_FILE);
  if (path.extname(resolved).toLowerCase() !== ".xlsx") {
    throw new Error("MASTER_WORKBOOK_PATH deve apontar para um arquivo .xlsx.");
  }
  return { buffer: await readFile(resolved), path: resolved, name: path.basename(resolved) };
}
