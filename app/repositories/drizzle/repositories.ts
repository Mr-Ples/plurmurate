import { and, desc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import type { NominationStatus } from "~/domain/nominations";
import type { RoleName } from "~/domain/roles";
import { appSettingsSchema, defaultSettings, type AppSettings } from "~/domain/settings";
import type { VoteSummary, VoteValue } from "~/domain/votes";
import { newId } from "~/lib/utils/id";
import type { Repositories } from "../interfaces";
import {
  auditLogs,
  externalTweets,
  mediaAssets,
  nominations,
  publishAttempts,
  roles,
  sessions,
  settings,
  userRoles,
  users,
  votes,
} from "./schema";

function toCurrentUser(row: any, roleRows: Array<{ name: string }>) {
  return {
    id: row.id,
    xUserId: row.xUserId,
    username: row.username,
    displayName: row.displayName,
    profileImageUrl: row.profileImageUrl,
    followersCount: row.followersCount,
    roles: roleRows.map((role) => role.name as RoleName),
  };
}

function mapNomination(row: any) {
  return {
    id: row.id,
    creatorUserId: row.creatorUserId,
    type: row.type,
    status: row.status,
    text: row.text,
    targetTweetUrl: row.targetTweetUrl,
    targetTweetId: row.targetTweetId,
    rationale: row.rationale,
    decisionRationale: row.decisionRationale,
    tweetAvatarMediaId: row.tweetAvatarMediaId,
    nominationMediaId: row.nominationMediaId,
    publishedTweetId: row.publishedTweetId,
    publishedTweetUrl: row.publishedTweetUrl,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    qualifiedAt: row.qualifiedAt,
    approvedAt: row.approvedAt,
    sentAt: row.sentAt,
    hiddenAt: row.hiddenAt,
  };
}

function mapExternalTweet(row: any) {
  return {
    tweetId: row.tweetId,
    url: row.url,
    authorUsername: row.authorUsername,
    authorName: row.authorName,
    authorProfileImageUrl: row.authorProfileImageUrl,
    authorId: row.authorId,
    textPreview: row.textPreview,
    mediaUrls: row.mediaUrlsJson ? JSON.parse(row.mediaUrlsJson) : [],
    embedHtml: row.embedHtml,
    fetchedAt: row.fetchedAt,
    fetchStatus: row.fetchStatus,
  };
}

export function getRepositories(env: { DB: D1Database; X_HOST_USER_ID?: string; X_HOST_HANDLE?: string }): Repositories {
  const db = drizzle(env.DB);

  async function getUserRoles(userId: string) {
    return db
      .select({ name: roles.name })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.userId, userId));
  }

  async function getVoteSummary(nominationId: string): Promise<VoteSummary> {
    const rows = await db.select({ value: votes.value, count: sql<number>`count(*)` }).from(votes).where(eq(votes.nominationId, nominationId)).groupBy(votes.value).all();
    const counts = { A: 0, B: 0, U: 0 };
    for (const row of rows) counts[row.value as VoteValue] = Number(row.count);
    const positive = counts.A + counts.B;
    const negative = counts.U;
    const total = positive + negative;
    return {
      a: counts.A,
      b: counts.B,
      u: counts.U,
      positive,
      negative,
      total,
      positiveRatio: total === 0 ? 0 : positive / total,
      positiveMargin: positive - negative,
    };
  }

  return {
    users: {
      async upsertFromX(input) {
        const existing = await db.select().from(users).where(eq(users.xUserId, input.xUserId)).get();
        const id = existing?.id ?? newId("usr");
        const row = {
          id,
          xUserId: input.xUserId,
          username: input.username ?? null,
          displayName: input.displayName ?? null,
          profileImageUrl: input.profileImageUrl ?? null,
          followersCount: input.followersCount ?? 0,
          xAccessTokenEncrypted: input.accessTokenEncrypted !== undefined ? input.accessTokenEncrypted : existing?.xAccessTokenEncrypted ?? null,
          xRefreshTokenEncrypted: input.refreshTokenEncrypted !== undefined ? input.refreshTokenEncrypted : existing?.xRefreshTokenEncrypted ?? null,
          lastProfileSyncAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        if (existing) {
          await db.update(users).set(row).where(eq(users.id, id)).run();
        } else {
          await db.insert(users).values({ ...row, createdAt: new Date().toISOString() }).run();
        }
        const saved = await db.select().from(users).where(eq(users.id, id)).get();
        return toCurrentUser(saved, await getUserRoles(id));
      },
      async listUsers() {
        const rows = await db.select().from(users).orderBy(desc(users.createdAt)).all();
        return Promise.all(rows.map(async (row) => toCurrentUser(row, await getUserRoles(row.id))));
      },
      async findPublishingCredentialsByXUserId(xUserId) {
        const row = await db.select().from(users).where(eq(users.xUserId, xUserId)).get();
        if (!row) return null;
        return {
          userId: row.id,
          xUserId: row.xUserId,
          accessTokenEncrypted: row.xAccessTokenEncrypted,
          refreshTokenEncrypted: row.xRefreshTokenEncrypted,
        };
      },
      async updateTokens(input) {
        await db
          .update(users)
          .set({
            xAccessTokenEncrypted: input.accessTokenEncrypted,
            xRefreshTokenEncrypted: input.refreshTokenEncrypted,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(users.id, input.userId))
          .run();
      },
    },
    sessions: {
      async create(userId, expiresAt) {
        const id = newId("ses");
        await db.insert(sessions).values({ id, userId, expiresAt: expiresAt.toISOString() }).run();
        return id;
      },
      async delete(id) {
        await db.delete(sessions).where(eq(sessions.id, id)).run();
      },
      async findUserBySessionId(id) {
        const row = await db
          .select({ user: users, session: sessions })
          .from(sessions)
          .innerJoin(users, eq(sessions.userId, users.id))
          .where(and(eq(sessions.id, id), sql`${sessions.expiresAt} > CURRENT_TIMESTAMP`))
          .get();
        if (!row) return null;
        return toCurrentUser(row.user, await getUserRoles(row.user.id));
      },
    },
    roles: {
      async ensureSeedRoles() {
        const names: RoleName[] = ["spectator", "voter", "publisher", "host", "admin"];
        for (const name of names) {
          await db.insert(roles).values({ id: `role_${name}`, name }).onConflictDoNothing().run();
        }
      },
      async assignRole(input) {
        await db
          .insert(userRoles)
          .values({
            userId: input.userId,
            roleId: `role_${input.role}`,
            assignedByUserId: input.actorUserId,
            assignmentSource: input.assignmentSource,
          })
          .onConflictDoNothing()
          .run();
      },
      async removeRole(userId, role) {
        await db.delete(userRoles).where(and(eq(userRoles.userId, userId), eq(userRoles.roleId, `role_${role}`))).run();
      },
    },
    nominations: {
      async create(input) {
        const id = newId("nom");
        await db
          .insert(nominations)
          .values({
            id,
            creatorUserId: input.creatorUserId,
            type: input.type,
            status: input.status,
            text: input.text ?? null,
            targetTweetUrl: input.targetTweetUrl ?? null,
            targetTweetId: input.targetTweetId ?? null,
            rationale: input.rationale ?? null,
            decisionRationale: input.decisionRationale ?? null,
            tweetAvatarMediaId: input.tweetAvatarMediaId ?? null,
            nominationMediaId: input.nominationMediaId ?? null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          })
          .run();
        return mapNomination(await db.select().from(nominations).where(eq(nominations.id, id)).get());
      },
      async findById(id) {
        const row = await db.select().from(nominations).where(eq(nominations.id, id)).get();
        return row ? mapNomination(row) : null;
      },
      async listFeed(filter) {
        const rows = await db
          .select({
            nomination: nominations,
            creatorUsername: users.username,
            creatorDisplayName: users.displayName,
            creatorProfileImageUrl: users.profileImageUrl,
            nominationMediaUrl: mediaAssets.publicUrl,
            targetTweet: externalTweets,
          })
          .from(nominations)
          .innerJoin(users, eq(nominations.creatorUserId, users.id))
          .leftJoin(mediaAssets, eq(nominations.nominationMediaId, mediaAssets.id))
          .leftJoin(externalTweets, eq(nominations.targetTweetId, externalTweets.tweetId))
          .where(
            and(
              filter.status ? eq(nominations.status, filter.status) : undefined,
              filter.type ? eq(nominations.type, filter.type) : undefined,
            ),
          )
          .orderBy(desc(nominations.createdAt))
          .all();
        return Promise.all(
          rows.map(async (row) => {
            const summary = await getVoteSummary(row.nomination.id);
            const userVote = filter.viewerUserId
              ? await db
                  .select({ value: votes.value })
                  .from(votes)
                  .where(and(eq(votes.nominationId, row.nomination.id), eq(votes.userId, filter.viewerUserId)))
                  .get()
              : null;
            const recentComment = await db
              .select({ comment: votes.comment })
              .from(votes)
              .where(and(eq(votes.nominationId, row.nomination.id), sql`${votes.comment} IS NOT NULL AND ${votes.comment} != ''`))
              .orderBy(desc(votes.updatedAt))
              .get();
            const commentCount = await db
              .select({ count: sql<number>`count(*)` })
              .from(votes)
              .where(and(eq(votes.nominationId, row.nomination.id), sql`${votes.comment} IS NOT NULL AND ${votes.comment} != ''`))
              .get();
            const nominationMediaRows = await db
              .select({ publicUrl: mediaAssets.publicUrl })
              .from(mediaAssets)
              .where(and(eq(mediaAssets.nominationId, row.nomination.id), eq(mediaAssets.kind, "nomination_image"), sql`${mediaAssets.publicUrl} IS NOT NULL`))
              .orderBy(mediaAssets.createdAt)
              .all();
            const nominationMediaUrls = nominationMediaRows
              .map((media) => media.publicUrl)
              .filter((url): url is string => Boolean(url));
            return {
              ...mapNomination(row.nomination),
              creatorUsername: row.creatorUsername,
              creatorDisplayName: row.creatorDisplayName,
              creatorProfileImageUrl: row.creatorProfileImageUrl,
              voteA: summary.a,
              voteB: summary.b,
              voteU: summary.u,
              voteCommentCount: Number(commentCount?.count ?? 0),
              userVote: (userVote?.value as VoteValue | undefined) ?? null,
              recentVoteComment: recentComment?.comment ?? null,
              nominationMediaUrl: row.nominationMediaUrl,
              nominationMediaUrls,
              tweetAvatarUrl: row.creatorProfileImageUrl,
              targetTweet: row.targetTweet ? mapExternalTweet(row.targetTweet) : null,
            };
          }),
        );
      },
      async updateStatus(id, status, fields = {}) {
        await db
          .update(nominations)
          .set({
            status,
            qualifiedAt: fields.qualifiedAt,
            approvedAt: fields.approvedAt,
            sentAt: fields.sentAt,
            publishedTweetId: fields.publishedTweetId,
            publishedTweetUrl: fields.publishedTweetUrl,
            decisionRationale: fields.decisionRationale,
            hiddenAt: fields.hiddenAt,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(nominations.id, id))
          .run();
      },
      async attachMedia(id, field, mediaId) {
        await db.update(nominations).set({ [field]: mediaId, updatedAt: new Date().toISOString() }).where(eq(nominations.id, id)).run();
      },
    },
    externalTweets: {
      async findById(tweetId) {
        const row = await db.select().from(externalTweets).where(eq(externalTweets.tweetId, tweetId)).get();
        return row ? mapExternalTweet(row) : null;
      },
      async upsert(input) {
        const row = {
          tweetId: input.tweetId,
          url: input.url,
          authorUsername: input.authorUsername ?? null,
          authorName: input.authorName ?? null,
          authorProfileImageUrl: input.authorProfileImageUrl ?? null,
          authorId: input.authorId ?? null,
          textPreview: input.textPreview ?? null,
          mediaUrlsJson: JSON.stringify(input.mediaUrls ?? []),
          embedHtml: input.embedHtml ?? null,
          fetchedAt: new Date().toISOString(),
          fetchStatus: input.fetchStatus,
          rawJson: input.rawJson ? JSON.stringify(input.rawJson) : null,
        };
        await db
          .insert(externalTweets)
          .values(row)
          .onConflictDoUpdate({
            target: externalTweets.tweetId,
            set: row,
          })
          .run();
        return mapExternalTweet(await db.select().from(externalTweets).where(eq(externalTweets.tweetId, input.tweetId)).get());
      },
    },
    votes: {
      async upsertVote(input) {
        await db
          .insert(votes)
          .values({
            id: newId("vot"),
            nominationId: input.nominationId,
            userId: input.userId,
            value: input.value,
            comment: input.comment ?? null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          })
          .onConflictDoUpdate({
            target: [votes.nominationId, votes.userId],
            set: { value: input.value, comment: input.comment ?? null, updatedAt: new Date().toISOString() },
          })
          .run();
      },
      async findUserVote(nominationId, userId) {
        const row = await db
          .select({ value: votes.value })
          .from(votes)
          .where(and(eq(votes.nominationId, nominationId), eq(votes.userId, userId)))
          .get();
        return (row?.value as VoteValue | undefined) ?? null;
      },
      async deleteVote(nominationId, userId) {
        await db.delete(votes).where(and(eq(votes.nominationId, nominationId), eq(votes.userId, userId))).run();
      },
      async getVoteSummary(nominationId): Promise<VoteSummary> {
        return getVoteSummary(nominationId);
      },
      async listComments(nominationId) {
        return db
          .select({ value: votes.value, comment: votes.comment, username: users.username })
          .from(votes)
          .innerJoin(users, eq(votes.userId, users.id))
          .where(and(eq(votes.nominationId, nominationId), sql`${votes.comment} IS NOT NULL AND ${votes.comment} != ''`))
          .orderBy(desc(votes.updatedAt))
          .all() as any;
      },
    },
    settings: {
      async getSettings(envDefaults) {
        const row = await db.select().from(settings).where(eq(settings.key, "app")).get();
        const stored = row ? JSON.parse(row.valueJson) : {};
        return appSettingsSchema.parse({
          ...defaultSettings,
          ...envDefaults,
          ...stored,
        });
      },
      async updateSettings(value, actorUserId) {
        await db
          .insert(settings)
          .values({
            key: "app",
            valueJson: JSON.stringify(value),
            updatedByUserId: actorUserId,
            updatedAt: new Date().toISOString(),
          })
          .onConflictDoUpdate({
            target: settings.key,
            set: { valueJson: JSON.stringify(value), updatedByUserId: actorUserId, updatedAt: new Date().toISOString() },
          })
          .run();
      },
    },
    media: {
      async create(input) {
        const id = newId("med");
        await db.insert(mediaAssets).values({ id, ...input, createdAt: new Date().toISOString() }).run();
        return { id, publicUrl: input.publicUrl ?? null };
      },
      async findById(id) {
        const row = await db.select().from(mediaAssets).where(eq(mediaAssets.id, id)).get();
        return row ? { id: row.id, storageKey: row.storageKey, publicUrl: row.publicUrl, mimeType: row.mimeType } : null;
      },
    },
    publishAttempts: {
      async create(input) {
        await db
          .insert(publishAttempts)
          .values({
            id: newId("pub"),
            nominationId: input.nominationId,
            workflow: input.workflow,
            actorUserId: input.actorUserId,
            xOperation: input.xOperation,
            requestJson: JSON.stringify(input.requestJson),
            responseJson: input.responseJson ? JSON.stringify(input.responseJson) : null,
            status: input.status,
            errorMessage: input.errorMessage ?? null,
            createdAt: new Date().toISOString(),
          })
          .run();
      },
    },
    auditLogs: {
      async create(input) {
        await db
          .insert(auditLogs)
          .values({
            id: newId("aud"),
            actorUserId: input.actorUserId,
            action: input.action,
            entityType: input.entityType,
            entityId: input.entityId,
            metadataJson: JSON.stringify(input.metadata),
            createdAt: new Date().toISOString(),
          })
          .run();
      },
    },
  };
}
