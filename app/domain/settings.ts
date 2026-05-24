import { z } from "zod";
import { nominationTypes } from "./nominations";

export const publishingWorkflowSchema = z.enum([
  "manual_review_when_qualified",
  "auto_send_when_qualified",
]);
export const tweetAvatarModeSchema = z.enum(["disabled", "optional", "required"]);

export type PublishingWorkflow = z.infer<typeof publishingWorkflowSchema>;
export type TweetAvatarMode = z.infer<typeof tweetAvatarModeSchema>;

const optionalManualThreshold = (schema: z.ZodType<number>, defaultValue: number) =>
  z.preprocess((value) => value === "" ? null : value, schema.nullable()).default(defaultValue) as z.ZodType<number | null>;

export const appSettingsSchema = z.object({
  minimumTotalVotes: optionalManualThreshold(z.coerce.number().int().min(0), 5),
  minimumPositiveRatio: optionalManualThreshold(z.coerce.number().min(0).max(1), 0.6),
  minimumPositiveMargin: optionalManualThreshold(z.coerce.number().int(), 2),
  publishingWorkflow: publishingWorkflowSchema.default("manual_review_when_qualified"),
  creatorSelfVoteAllowed: z.coerce.boolean().default(false),
  privilegedVotesCountTowardCriteria: z.coerce.boolean().default(true),
  deniedVisibleByDefault: z.coerce.boolean().default(true),
  tweetAvatarMode: tweetAvatarModeSchema.default("optional"),
  includeTweetAvatarInPublishedMedia: z.coerce.boolean().default(false),
  enabledNominationTypes: z.array(z.enum(nominationTypes)).default([...nominationTypes]),
  automaticRoleAssignmentEnabled: z.coerce.boolean().default(false),
  maxImageUploadBytes: z.coerce.number().int().min(1).default(5 * 1024 * 1024),
  hostUserId: z.string().default(""),
  hostHandle: z.string().default(""),
}).superRefine((settings, context) => {
  if (settings.publishingWorkflow === "manual_review_when_qualified") return;
  for (const field of ["minimumTotalVotes", "minimumPositiveRatio", "minimumPositiveMargin"] as const) {
    if (settings[field] === null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: [field],
        message: "This threshold is required when publishing automatically.",
      });
    }
  }
});

export type AppSettings = z.infer<typeof appSettingsSchema>;

export const defaultSettings: AppSettings = appSettingsSchema.parse({});
