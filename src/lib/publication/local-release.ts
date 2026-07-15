import type { Proposal } from "@/types/domain";
import type { PublicationRelease, PublicationRepository } from "@/types/contracts";

export class LocalPublicationRepository implements PublicationRepository {
  preview(proposals: Proposal[]): PublicationRelease {
    const eligible = proposals.filter((item) => item.status === "approved" && item.publishAuthorized);
    return {
      id: "release-demo-preview",
      version: "demo-0.1.0",
      generatedAt: "2026-07-15T12:00:00.000Z",
      proposals: eligible,
      limitations: ["Conteúdo integralmente fictício.", "Prévia local não publicada.", "Sem score ou rating."]
    };
  }
}
