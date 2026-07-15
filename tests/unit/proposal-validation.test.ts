import { describe, expect, it } from "vitest";
import { proposalInputSchema } from "@/lib/validation/proposal";

const valid = { companyId: "demo", year: 2020, variable: "Receita líquida", value: 10.25, unit: "BRL_millions", availability: "available", sourceOrganization: "Fonte Demo", sourceTitle: "Documento fictício", sourceUrl: "https://example.com/demo", referenceDate: "2020-12-31" } as const;

describe("proposalInputSchema", () => {
  it("aceita valor disponível com fonte e unidade", () => { expect(proposalInputSchema.safeParse(valid).success).toBe(true); });
  it("impede ausência de virar zero", () => { expect(proposalInputSchema.safeParse({ ...valid, availability: "unavailable", value: 0 }).success).toBe(false); });
  it("exige no máximo duas casas em R$ milhões", () => { expect(proposalInputSchema.safeParse({ ...valid, value: 10.257 }).success).toBe(false); });
  it("rejeita protocolo de fonte inseguro", () => { expect(proposalInputSchema.safeParse({ ...valid, sourceUrl: "file:///segredo.xlsx" }).success).toBe(false); });
});
