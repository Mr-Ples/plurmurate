import { z } from "zod";
import { nominationTypes } from "./nominations";

export const publishingWorkflowSchema = z.enum([
  "manual_review_when_qualified",
  "auto_send_when_qualified",
]);
export const tweetAvatarModeSchema = z.enum(["disabled", "optional", "required"]);

export type PublishingWorkflow = z.infer<typeof publishingWorkflowSchema>;
export type TweetAvatarMode = z.infer<typeof tweetAvatarModeSchema>;

export const appSettingsSchema = z.object({
  minimumTotalVotes: z.coerce.number().int().min(1).default(5),
  minimumPositiveRatio: z.coerce.number().min(0).max(1).default(0.6),
  minimumPositiveMargin: z.coerce.number().int().default(2),
  minimumVotingAgeMinutes: z.coerce.number().int().min(0).default(30),
  maximumVotingAgeDays: z.coerce.number().int().min(1).default(7),
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
});

export type AppSettings = z.infer<typeof appSettingsSchema>;

export const defaultSettings: AppSettings = appSettingsSchema.parse({});
