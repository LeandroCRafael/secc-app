"use client";

import { useState } from "react";
import { uploadPolicy, validateUpload } from "@/lib/parsers/upload-policy";

export function UploadPreview() {
  const [result, setResult] = useState<string | null>(null);
  async function inspect(formData: FormData) {
    const file = formData.get("file");
    if (!(file instanceof File)) { setResult("Selecione um arquivo."); return; }
    const validation = validateUpload({ name: file.name, type: file.type, size: file.size, bytes: new Uint8Array(await file.arrayBuffer()) });
    setResult(validation.ok ? `Prévia segura: ${validation.kind.toUpperCase()} validado; permaneceria privado e em quarentena.` : `Rejeitado: ${validation.reason}`);
  }
  return <form className="card" action={inspect}><label>Arquivo de demonstração<input type="file" name="file" accept=".csv,.xlsx" required /></label><p>Allowlist: CSV e XLSX sem macros. Limite: {uploadPolicy.maxBytes / 1024 / 1024} MB. O nome original nunca seria usado como caminho.</p><button className="button" type="submit">Validar prévia local</button>{result && <p className="notice" role="status">{result}</p>}</form>;
}
