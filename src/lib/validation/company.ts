import { z } from "zod";

export const companyInputSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(3)
    .max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use letras minúsculas, números e hífens no identificador."),
  name: z.string().trim().min(2).max(180),
  tier: z.enum(["tier_1", "tier_2", "unclassified"]),
  sector: z.string().trim().min(2).max(120),
  eventType: z.enum(["judicial_recovery", "extrajudicial_recovery", "bankruptcy", "restructuring"]),
  eventYear: z.number().int().min(1900).max(2200),
});

export type CompanyInput = z.infer<typeof companyInputSchema>;
