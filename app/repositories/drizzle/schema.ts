import { sql } from "drizzle-orm";
import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  xUserId: text("x_user_id").notNull().unique(),
  username: text("username"),
  displayName: text("display_name"),
  profileImageUrl: text("profile_image_url"),
  followersCount: integer("followers_count").default(0).notNull(),
  xAccessTokenEncrypted: text("x_access_token_encrypted"),
  xRefreshTokenEncrypted: text("x_refresh_token_encrypted"),
  lastProfileSyncAt: text("last_profile_sync_at"),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const roles = sqliteTable("roles", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
});

export const userRoles = sqliteTable(
  "user_roles",
  {
    userId: text("user_id").notNull().references(() => users.id),
    roleId: text("role_id").notNull().references(() => roles.id),
    assignedByUserId: text("assigned_by_user_id").references(() => users.id),
    assignmentSource: text("assignment_source").notNull(),
    createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.roleId] }),
  }),
);

export const nominations = sqliteTable(
  "nominations",
  {
    id: text("id").primaryKey(),
    creatorUserId: text("creator_user_id").notNull().references(() => users.id),
    type: text("type").notNull(),
    status: text("status").notNull(),
    text: text("text"),
    targetTweetUrl: text("target_tweet_url"),
    targetTweetId: text("target_tweet_id"),
    rationale: text("rationale"),
    tweetAvatarMediaId: text("tweet_avatar_media_id"),
    nominationMediaId: text("nomination_media_id"),
    publishedTweetId: text("published_tweet_id"),
    publishedTweetUrl: text("published_tweet_url"),
    createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
    updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
    qualifiedAt: text("qualified_at"),
    approvedAt: text("approved_at"),
    sentAt: text("sent_at"),
    hiddenAt: text("hidden_at"),
  },
  (table) => ({
    statusIdx: index("nominations_status_idx").on(table.status),
    creatorIdx: index("nominations_creator_idx").on(table.creatorUserId),
  }),
);

export const votes = sqliteTable(
  "votes",
  {
    id: text("id").primaryKey(),
    nominationId: text("nomination_id").notNull().references(() => nominations.id),
    userId: text("user_id").notNull().references(() => users.id),
    value: text("value").notNull(),
    comment: text("comment"),
    createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
    updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  },
  (table) => ({
    nominationUserUnique: uniqueIndex("votes_nomination_user_unique").on(table.nominationId, table.userId),
  }),
);

export const mediaAssets = sqliteTable("media_assets", {
  id: text("id").primaryKey(),
  ownerUserId: text("owner_user_id").notNull().references(() => users.id),
  nominationId: text("nomination_id").references(() => nominations.id),
  kind: text("kind").notNull(),
  storageKey: text("storage_key").notNull(),
  publicUrl: text("public_url"),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  width: integer("width"),
  height: integer("height"),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const externalTweets = sqliteTable("external_tweets", {
  tweetId: text("tweet_id").primaryKey(),
  url: text("url").notNull(),
  authorUsername: text("author_username"),
  authorName: text("author_name"),
  authorProfileImageUrl: text("author_profile_image_url"),
  authorId: text("author_id"),
  textPreview: text("text_preview"),
  mediaUrlsJson: text("media_urls_json"),
  fetchedAt: text("fetched_at"),
  fetchStatus: text("fetch_status").notNull(),
  rawJson: text("raw_json"),
});

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  valueJson: text("value_json").notNull(),
  updatedByUserId: text("updated_by_user_id").references(() => users.id),
  updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const roleAssignmentRules = sqliteTable("role_assignment_rules", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(false),
  ruleType: text("rule_type").notNull(),
  configJson: text("config_json").notNull(),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const publishAttempts = sqliteTable("publish_attempts", {
  id: text("id").primaryKey(),
  nominationId: text("nomination_id").notNull().references(() => nominations.id),
  workflow: text("workflow").notNull(),
  actorUserId: text("actor_user_id").references(() => users.id),
  xOperation: text("x_operation").notNull(),
  requestJson: text("request_json").notNull(),
  responseJson: text("response_json"),
  status: text("status").notNull(),
  errorMessage: text("error_message"),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const auditLogs = sqliteTable("audit_logs", {
  id: text("id").primaryKey(),
  actorUserId: text("actor_user_id").references(() => users.id),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  metadataJson: text("metadata_json").notNull(),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});
