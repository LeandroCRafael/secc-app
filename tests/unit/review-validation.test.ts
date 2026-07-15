import { describe, expect, it } from "vitest";
import { reviewDecisionInputSchema } from "@/lib/validation/review";

const valid = {
  proposalId: "4d8f6c10-c2fe-45df-a0b1-1ecb82911983",
  expectedVersion: 1,
  decision: "approved",
  justification: "Fonte e período foram conferidos.",
} as const;

describe("reviewDecisionInputSchema", () => {
  it("aceita decisão com versão e justificativa", () => {
    expect(reviewDecisionInputSchema.safeParse(valid).success).toBe(true);
  });

  it("rejeita justificativa insuficiente", () => {
    expect(reviewDecisionInputSchema.safeParse({ ...valid, justification: "ok" }).success).toBe(false);
  });

  it("rejeita versão inválida", () => {
    expect(reviewDecisionInputSchema.safeParse({ ...valid, expectedVersion: 0 }).success).toBe(false);
  });
});
