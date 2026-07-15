import { describe, expect, it } from "vitest";
import { companyInputSchema } from "@/lib/validation/company";

const valid = {
  slug: "companhia-exemplo",
  name: "Companhia Exemplo",
  tier: "unclassified",
  sector: "Setor de demonstração",
  eventType: "judicial_recovery",
  eventYear: 2024,
} as const;

describe("companyInputSchema", () => {
  it("aceita cadastro operacional válido", () => {
    expect(companyInputSchema.safeParse(valid).success).toBe(true);
  });

  it("rejeita slug incompatível com URL", () => {
    expect(companyInputSchema.safeParse({ ...valid, slug: "Companhia Exemplo" }).success).toBe(false);
  });

  it("rejeita ano fora do intervalo operacional", () => {
    expect(companyInputSchema.safeParse({ ...valid, eventYear: 1800 }).success).toBe(false);
  });
});
