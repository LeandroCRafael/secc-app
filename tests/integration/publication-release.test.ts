import { describe, expect, it } from "vitest";
import { demoProposals } from "@/features/demo/data";
import { LocalPublicationRepository } from "@/lib/publication/local-release";

describe("prévia de release", () => {
  it("inclui apenas aprovado e autorizado", () => {
    const release = new LocalPublicationRepository().preview(demoProposals);
    expect(release.proposals).toHaveLength(1);
    expect(release.proposals.every((item) => item.status === "approved" && item.publishAuthorized)).toBe(true);
    expect(release.proposals.some((item) => item.id === "proposal-demo-003")).toBe(false);
  });
});
