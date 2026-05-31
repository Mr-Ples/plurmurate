import { z } from "zod";
import { nominationStatuses, nominationTypes, type NominationStatus } from "./nominations";
import { roleNames, type RoleName } from "./roles";

export const publishingWorkflowSchema = z.enum([
  "manual_review_when_qualified",
  "auto_send_when_qualified",
]);
export const tweetAvatarModeSchema = z.enum(["disabled", "optional", "required"]);
export const voteDisplayModeSchema = z.enum(["abu", "up_down"]);

export type PublishingWorkflow = z.infer<typeof publishingWorkflowSchema>;
export type TweetAvatarMode = z.infer<typeof tweetAvatarModeSchema>;
export type VoteDisplayMode = z.infer<typeof voteDisplayModeSchema>;

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

const defaultVisibleFeedStatuses = nominationStatuses.filter((status) => status !== "draft" && status !== "withdrawn");
const defaultAutomaticRoleRules: AutomaticRoleRule[] = [
  {
    id: "default-followers-more-than-5-voter",
    subject: "followers",
    operator: "more_than",
    value: 5,
    role: "voter",
  },
];

const visibleFeedStatusesSchema = z.array(z.enum(nominationStatuses));

export const roleFeedVisibilitySchema = z.object({
  spectator: visibleFeedStatusesSchema.default(defaultVisibleFeedStatuses),
  voter: visibleFeedStatusesSchema.default(defaultVisibleFeedStatuses),
  admin: visibleFeedStatusesSchema.default(nominationStatuses.filter((status) => status !== "draft")),
});

const optionalManualThreshold = (schema: z.ZodType<number>, defaultValue: number) =>
  z.preprocess((value) => value === "" ? null : value, schema.nullable()).default(defaultValue) as z.ZodType<number | null>;

export const appSettingsSchema = z.object({
  minimumTotalVotes: optionalManualThreshold(z.coerce.number().int().min(0), 5),
  minimumPositiveRatio: optionalManualThreshold(z.coerce.number().min(0).max(1), 0.6),
  minimumPositiveMargin: optionalManualThreshold(z.coerce.number().int(), 2),
  publishingWorkflow: publishingWorkflowSchema.default("manual_review_when_qualified"),
  tweetAvatarMode: tweetAvatarModeSchema.default("optional"),
  voteDisplayMode: voteDisplayModeSchema.default("up_down"),
  includeTweetAvatarInPublishedMedia: z.coerce.boolean().default(false),
  enabledNominationTypes: z.array(z.enum(nominationTypes)).default([...nominationTypes]),
  automaticRoleAssignmentEnabled: z.coerce.boolean().default(true),
  automaticRoleWhitelist: z.array(automaticRoleWhitelistEntrySchema).default([]),
  automaticRoleRules: z.array(automaticRoleRuleSchema).default(defaultAutomaticRoleRules),
  roleFeedVisibility: roleFeedVisibilitySchema.default({
    spectator: defaultVisibleFeedStatuses,
    voter: defaultVisibleFeedStatuses,
    admin: nominationStatuses.filter((status) => status !== "draft"),
  }),
  imageUploadsEnabled: z.coerce.boolean().default(true),
  imageUploadRateLimitMaxImages: z.coerce.number().int().min(1).default(12),
  imageUploadRateLimitWindowMinutes: z.coerce.number().int().min(1).default(15),
  imageUploadDailyLimitMaxImages: z.coerce.number().int().min(1).default(50),
  maxImageUploadBytes: z.coerce.number().int().min(1).default(5 * 1024 * 1024),
  hostUserId: z.string().default(""),
  hostHandle: z.string().default(""),
});

export type AppSettings = z.infer<typeof appSettingsSchema>;

export const defaultSettings: AppSettings = appSettingsSchema.parse({});

export function visibleFeedStatusesForRoles(settings: AppSettings, roles: RoleName[] | null | undefined): NominationStatus[] {
  const effectiveRoles: RoleName[] = roles?.length ? roles : ["spectator"];
  return Array.from(new Set(effectiveRoles.flatMap((role) => settings.roleFeedVisibility[role])));
}
