import { z } from "zod";
import { nominationTypes } from "./nominations";
import { roleNames } from "./roles";

export const publishingWorkflowSchema = z.enum([
  "manual_review_when_qualified",
  "auto_send_when_qualified",
]);
export const tweetAvatarModeSchema = z.enum(["disabled", "optional", "required"]);

export type PublishingWorkflow = z.infer<typeof publishingWorkflowSchema>;
export type TweetAvatarMode = z.infer<typeof tweetAvatarModeSchema>;

export const automaticRoleWhitelistEntrySchema = z.object({
  username: z.string().trim().min(1),
  role: z.enum(roleNames),
});

export const automaticRoleRuleSchema = z.object({
  id: z.string().min(1),
  subject: z.literal("followers"),
  operator: z.literal("more_than"),
  value: z.coerce.number().int().min(0),
  role: z.enum(roleNames),
});

export type AutomaticRoleWhitelistEntry = z.infer<typeof automaticRoleWhitelistEntrySchema>;
export type AutomaticRoleRule = z.infer<typeof automaticRoleRuleSchema>;

const optionalManualThreshold = (schema: z.ZodType<number>, defaultValue: number) =>
  z.preprocess((value) => value === "" ? null : value, schema.nullable()).default(defaultValue) as z.ZodType<number | null>;

export const appSettingsSchema = z.object({
  minimumTotalVotes: optionalManualThreshold(z.coerce.number().int().min(0), 5),
  minimumPositiveRatio: optionalManualThreshold(z.coerce.number().min(0).max(1), 0.6),
  minimumPositiveMargin: optionalManualThreshold(z.coerce.number().int(), 2),
  publishingWorkflow: publishingWorkflowSchema.default("manual_review_when_qualified"),
  tweetAvatarMode: tweetAvatarModeSchema.default("optional"),
  includeTweetAvatarInPublishedMedia: z.coerce.boolean().default(false),
  enabledNominationTypes: z.array(z.enum(nominationTypes)).default([...nominationTypes]),
  automaticRoleAssignmentEnabled: z.coerce.boolean().default(false),
  automaticRoleWhitelist: z.array(automaticRoleWhitelistEntrySchema).default([]),
  automaticRoleRules: z.array(automaticRoleRuleSchema).default([]),
  maxImageUploadBytes: z.coerce.number().int().min(1).default(5 * 1024 * 1024),
  hostUserId: z.string().default(""),
  hostHandle: z.string().default(""),
});

export type AppSettings = z.infer<typeof appSettingsSchema>;

export const defaultSettings: AppSettings = appSettingsSchema.parse({});
