import { z } from "zod";

export const LlmExtractedSkillSchema = z.object({
  name: z.string().trim().min(1),
  category: z.string().trim().default("General"),
  priority: z.enum(["must-have", "nice-to-have"]).default("must-have"),
  frequency: z.number().int().nonnegative().default(1),
});

export const LlmSeniorityDistributionSchema = z.object({
  junior: z.number().int().nonnegative().default(0),
  mid: z.number().int().nonnegative().default(0),
  senior: z.number().int().nonnegative().default(0),
  lead: z.number().int().nonnegative().default(0),
  executive: z.number().int().nonnegative().default(0),
  unspecified: z.number().int().nonnegative().default(0),
  confidence: z.enum(["high", "medium", "low", "insufficient_data"]).default("medium"),
});

export const LlmExtractionResultSchema = z.object({
  skills: z.array(LlmExtractedSkillSchema).default([]),
  seniorityDistribution: LlmSeniorityDistributionSchema.default({
    junior: 0,
    mid: 0,
    senior: 0,
    lead: 0,
    executive: 0,
    unspecified: 0,
    confidence: "insufficient_data",
  }),
  employmentTypes: z.array(z.string()).default([]),
  commonResponsibilities: z.array(z.string()).default([]),
  commonQualifications: z.array(z.string()).default([]),
  coverage: z.enum(["high", "medium", "low", "none"]).default("medium"),
});

export type LlmExtractionResult = z.infer<typeof LlmExtractionResultSchema>;
