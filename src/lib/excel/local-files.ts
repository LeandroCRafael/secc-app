import "server-only";
import path from "node:path";

// A integração por arquivo é exclusivamente local; estes diretórios nunca entram no bundle público.
const excelRoot = path.join(/* turbopackIgnore: true */ process.cwd(), "local", "private", "excel");

export const localExcelPaths = {
  backups: path.join(excelRoot, "backups"),
  outputs: path.join(excelRoot, "saida"),
};

export function safeOutputPath(fileName: string): string {
  if (!/^secc-atualizado-[a-zA-Z0-9-]+\.xlsx$/.test(fileName)) {
    throw new Error("Nome de arquivo de saída inválido.");
  }
  return path.join(/* turbopackIgnore: true */ localExcelPaths.outputs, fileName);
}
