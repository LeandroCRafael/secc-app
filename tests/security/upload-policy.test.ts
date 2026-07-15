import { describe, expect, it } from "vitest";
import { uploadPolicy, validateUpload } from "@/lib/parsers/upload-policy";

describe("política de upload", () => {
  it("aceita CSV coerente", () => { const bytes = new TextEncoder().encode("empresa;ano;valor\nDemo;2020;10"); expect(validateUpload({ name: "demo.csv", type: "text/csv", size: bytes.length, bytes })).toEqual({ ok: true, kind: "csv" }); });
  it("rejeita macro por extensão", () => { expect(validateUpload({ name: "malicioso.xlsm", type: "application/vnd.ms-excel.sheet.macroEnabled.12", size: 10, bytes: new Uint8Array([0x50, 0x4b]) }).ok).toBe(false); });
  it("rejeita MIME divergente", () => { expect(validateUpload({ name: "arquivo.xlsx", type: "text/plain", size: 10, bytes: new Uint8Array([0x50, 0x4b]) }).ok).toBe(false); });
  it("rejeita arquivo acima do limite", () => { expect(validateUpload({ name: "grande.csv", type: "text/csv", size: uploadPolicy.maxBytes + 1, bytes: new Uint8Array() }).ok).toBe(false); });
});
