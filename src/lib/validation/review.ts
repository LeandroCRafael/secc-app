import { z } from "zod";

export const reviewDecisionInputSchema = z.object({
  proposalId: z.uuid(),
  expectedVersion: z.number().int().positive(),
  decision: z.enum(["approved", "rejected", "changes_requested"]),
  justification: z.string().trim().min(10, "Informe uma justificativa com pelo menos 10 caracteres.").max(500),
});

export type ReviewDecisionInput = z.infer<typeof reviewDecisionInputSchema>;
