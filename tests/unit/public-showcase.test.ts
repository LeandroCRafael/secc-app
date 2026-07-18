import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import manifest from "../../data/public/manifest.json";
import { publicShowcase } from "@/features/public/public-showcase";

describe("snapshot público sanitizado", () => {
  it("reconcilia contagens e pesos declarados", () => {
    expect(publicShowcase.portfolio.companies).toBe(192);
    expect(publicShowcase.portfolio.tier1 + publicShowcase.portfolio.tier2 + publicShowcase.portfolio.toResearch).toBe(192);
    expect(publicShowcase.companies).toHaveLength(manifest.counts.publishedCompanyCases);
    expect(publicShowcase.score.dimensions.reduce((sum, item) => sum + item.weight, 0)).toBe(100);
  });

  it("mantém o hash do artefato reconciliado com o manifesto", () => {
    const contents = readFileSync(resolve(process.cwd(), "data/public/showcase.json"));
    const hash = createHash("sha256").update(contents).digest("hex");
    expect(hash).toBe(manifest.files["showcase.json"].sha256);
  });

  it("não expõe caminhos locais, segredos ou estados finais indevidos", () => {
    const serialized = JSON.stringify(publicShowcase);
    expect(serialized).not.toMatch(/[A-Z]:\\\\/i);
    expect(serialized).not.toMatch(/password|secret|token|credential/i);
    expect(publicShowcase.companies.every((company) => company.collectionStatus.includes("conferência"))).toBe(true);
  });
});
