import { z } from "zod";
import { nominationTypes } from "~/domain/nominations";
import { voteValues } from "~/domain/votes";

export const nominationFormSchema = z.object({
  type: z.enum(nominationTypes),
  text: z.string().trim().max(280).optional(),
  targetTweetUrl: z.string().trim().url().optional().or(z.literal("")),
  rationale: z.string().trim().max(500).optional(),
});

export const voteFormSchema = z.object({
  nominationId: z.string(),
  value: z.enum(voteValues),
  comment: z.string().trim().max(400).optional(),
});
