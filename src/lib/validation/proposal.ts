import { z } from "zod";
import { availabilityStates } from "@/types/domain";

const typedValue = z.union([z.number(), z.string().trim().min(1), z.null()]);

export const proposalInputSchema = z
  .object({
    companyId: z.string().min(1),
    year: z.number().int().min(1900).max(2200),
    variable: z.string().trim().min(2).max(100),
    value: typedValue,
    unit: z.enum(["BRL_millions", "percent", "count", "text"]),
    availability: z.enum(availabilityStates),
    sourceOrganization: z.string().trim().min(2).max(160),
    sourceTitle: z.string().trim().min(2).max(200),
    sourceUrl: z.url().refine((url) => ["https:", "http:"].includes(new URL(url).protocol), {
      message: "A fonte deve usar HTTP ou HTTPS."
    }),
    referenceDate: z.iso.date(),
    notes: z.string().trim().max(500).optional()
  })
  .superRefine((input, ctx) => {
    if (input.availability === "available" && input.value === null) {
      ctx.addIssue({ code: "custom", path: ["value"], message: "Valor é obrigatório quando disponível." });
    }
    if (input.availability !== "available" && input.value !== null) {
      ctx.addIssue({ code: "custom", path: ["value"], message: "Estados de ausência não recebem valor." });
    }
    if (input.unit === "BRL_millions" && typeof input.value === "number") {
      const decimals = input.value.toString().split(".")[1]?.length ?? 0;
      if (decimals > 2) {
        ctx.addIssue({ code: "custom", path: ["value"], message: "Use no máximo duas casas decimais." });
      }
    }
  });

export type ProposalInput = z.infer<typeof proposalInputSchema>;
