export const uploadPolicy = {
  maxBytes: 5 * 1024 * 1024,
  maxFilesPerRequest: 1,
  allowed: {
    ".csv": ["text/csv", "application/vnd.ms-excel"],
    ".xlsx": ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"]
  }
} as const;

export interface UploadCandidate {
  name: string;
  type: string;
  size: number;
  bytes: Uint8Array;
}

export function validateUpload(candidate: UploadCandidate): { ok: true; kind: "csv" | "xlsx" } | { ok: false; reason: string } {
  if (candidate.size <= 0 || candidate.size > uploadPolicy.maxBytes) {
    return { ok: false, reason: "Arquivo vazio ou acima do limite de 5 MB." };
  }
  const extension = candidate.name.toLowerCase().match(/\.[^.]+$/)?.[0];
  if (!extension || !(extension in uploadPolicy.allowed)) {
    return { ok: false, reason: "Extensão não permitida. Use CSV ou XLSX sem macros." };
  }
  const allowedMimes = uploadPolicy.allowed[extension as keyof typeof uploadPolicy.allowed];
  if (!(allowedMimes as readonly string[]).includes(candidate.type)) {
    return { ok: false, reason: "O MIME informado não corresponde ao tipo permitido." };
  }
  if (extension === ".xlsx") {
    const isZip = candidate.bytes[0] === 0x50 && candidate.bytes[1] === 0x4b;
    return isZip ? { ok: true, kind: "xlsx" } : { ok: false, reason: "Assinatura XLSX inválida." };
  }
  const sample = new TextDecoder().decode(candidate.bytes.slice(0, 512));
  if (sample.includes("\0") || (!sample.includes(",") && !sample.includes(";"))) {
    return { ok: false, reason: "Conteúdo CSV inválido ou sem delimitador reconhecido." };
  }
  return { ok: true, kind: "csv" };
}
