import { describe, expect, it } from "vitest";
import { availabilityStates } from "@/types/domain";

describe("estados de disponibilidade", () => {
  it("mantém estados distintos para ausência, revisão e conflito", () => {
    expect(availabilityStates).toContain("not_researched");
    expect(availabilityStates).toContain("unavailable");
    expect(availabilityStates).toContain("future_period");
    expect(availabilityStates).toContain("under_review");
    expect(availabilityStates).toContain("conflicted");
  });
});
