import JSZip from "jszip";
import { afterEach, describe, expect, it, vi } from "vitest";
import { collectCvmDfp, searchCvmCompanies } from "@/lib/cvm/client";

const header = "CNPJ_CIA;ORDEM_EXERC;CD_CONTA;DS_CONTA;VL_CONTA;ESCALA_MOEDA\n";
const row = (code: string, value: string) => `12345678000199;ÚLTIMO;${code};Conta;${value};MIL\n`;

afterEach(() => vi.unstubAllGlobals());

describe("cliente CVM", () => {
  it("pesquisa razão social no cadastro oficial", async () => {
    const csv = "CNPJ_CIA;DENOM_SOCIAL;DENOM_COMERC;CD_CVM;SETOR_ATIV;SIT\n12.345.678/0001-99;EMPRESA ARVORE S.A.;ARVORE;1234;Indústria;ATIVO\n";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(new TextEncoder().encode(csv))));
    const result = await searchCvmCompanies("Empresa Arvore");
    expect(result[0]).toMatchObject({ cnpj: "12345678000199", cvmCode: "1234" });
  });

  it("mapeia contas e derivados da DFP para R$ milhões", async () => {
    const zip = new JSZip();
    zip.file("dfp_cia_aberta_DRE_con_2025.csv", header + row("3.01", "100000") + row("3.03", "40000") + row("3.05", "25000") + row("3.06", "-5000") + row("3.11", "10000"));
    zip.file("dfp_cia_aberta_BPA_con_2025.csv", header + row("1", "300000") + row("1.01.01", "10000") + row("1.01.02", "5000"));
    zip.file("dfp_cia_aberta_BPP_con_2025.csv", header + row("2.03", "80000") + row("2.01", "90000"));
    zip.file("dfp_cia_aberta_DFC_MD_con_2025.csv", header + row("6.01", "20000") + row("6.05", "3000"));
    zip.file("dfp_cia_aberta_DVA_con_2025.csv", header + row("7.08.01", "15000"));
    const buffer = await zip.generateAsync({ type: "uint8array" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(new Uint8Array(buffer).buffer as ArrayBuffer)));
    const result = await collectCvmDfp("12.345.678/0001-99", 2025);
    const values = new Map(result.metrics.map((metric) => [metric.variable, metric.value]));
    expect(values.get("Receita Líquida")).toBe(100);
    expect(values.get("CMV")).toBe(60);
    expect(values.get("Despesas Operacionais")).toBe(-15);
    expect(values.get("Passivo Total")).toBe(220);
    expect(values.get("FCO")).toBe(20);
  });
});
