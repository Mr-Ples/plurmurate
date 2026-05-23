import type { FeedNomination, Nomination, NominationStatus, NominationType } from "~/domain/nominations";
import type { ExternalTweetPreview } from "~/domain/external-tweets";
import type { RoleName } from "~/domain/roles";
import type { AppSettings } from "~/domain/settings";
import type { VoteSummary, VoteValue } from "~/domain/votes";

export interface CurrentUser {
  id: string;
  xUserId: string;
  username: string | null;
  displayName: string | null;
  profileImageUrl: string | null;
  followersCount: number;
  roles: RoleName[];
}

export interface PublishingCredentials {
  userId: string;
  xUserId: string;
  accessTokenEncrypted: string | null;
  refreshTokenEncrypted: string | null;
}

export interface UserRepository {
  upsertFromX(input: {
    xUserId: string;
    username?: string | null;
    displayName?: string | null;
    profileImageUrl?: string | null;
    followersCount?: number;
    accessTokenEncrypted?: string | null;
    refreshTokenEncrypted?: string | null;
  }): Promise<CurrentUser>;
  listUsers(): Promise<CurrentUser[]>;
  findPublishingCredentialsByXUserId(xUserId: string): Promise<PublishingCredentials | null>;
  updateTokens(input: {
    userId: string;
    accessTokenEncrypted: string | null;
    refreshTokenEncrypted: string | null;
  }): Promise<void>;
}

export interface SessionRepository {
  create(userId: string, expiresAt: Date): Promise<string>;
  delete(id: string): Promise<void>;
  findUserBySessionId(id: string): Promise<CurrentUser | null>;
}

export interface RoleRepository {
  ensureSeedRoles(): Promise<void>;
  assignRole(input: {
    userId: string;
    role: RoleName;
    actorUserId: string | null;
    assignmentSource: string;
  }): Promise<void>;
  removeRole(userId: string, role: RoleName): Promise<void>;
}

export interface NominationRepository {
  create(input: {
    creatorUserId: string;
    type: NominationType;
    status: NominationStatus;
    text?: string | null;
    targetTweetUrl?: string | null;
    targetTweetId?: string | null;
    rationale?: string | null;
    tweetAvatarMediaId?: string | null;
    nominationMediaId?: string | null;
  }): Promise<Nomination>;
  findById(id: string): Promise<Nomination | null>;
  listFeed(filter: {
    viewerUserId?: string | null;
    status?: string | null;
    type?: string | null;
    reviewOnly?: boolean;
  }): Promise<FeedNomination[]>;
  updateStatus(id: string, status: NominationStatus, fields?: Partial<Nomination>): Promise<void>;
  attachMedia(id: string, field: "tweetAvatarMediaId" | "nominationMediaId", mediaId: string): Promise<void>;
}

export interface ExternalTweetRepository {
  findById(tweetId: string): Promise<ExternalTweetPreview | null>;
  upsert(input: {
    tweetId: string;
    url: string;
    authorUsername?: string | null;
    authorName?: string | null;
    authorProfileImageUrl?: string | null;
    authorId?: string | null;
    textPreview?: string | null;
    mediaUrls?: string[];
    fetchStatus: "ok" | "failed";
    rawJson?: unknown;
  }): Promise<ExternalTweetPreview>;
}

export interface VoteRepository {
  upsertVote(input: {
    nominationId: string;
    userId: string;
    value: VoteValue;
    comment?: string | null;
  }): Promise<void>;
  getVoteSummary(nominationId: string): Promise<VoteSummary>;
  listComments(nominationId: string): Promise<Array<{ value: VoteValue; comment: string; username: string | null }>>;
}

export interface SettingsRepository {
  getSettings(envDefaults: Partial<AppSettings>): Promise<AppSettings>;
  updateSettings(settings: AppSettings, actorUserId: string): Promise<void>;
}

export interface MediaRepository {
  create(input: {
    ownerUserId: string;
    nominationId?: string | null;
    kind: "tweet_avatar" | "nomination_image" | "composed_publish_image";
    storageKey: string;
    publicUrl?: string | null;
    mimeType: string;
    sizeBytes: number;
  }): Promise<{ id: string; publicUrl: string | null }>;
  findById(id: string): Promise<{ id: string; storageKey: string; publicUrl: string | null; mimeType: string } | null>;
}

export interface PublishAttemptRepository {
  create(input: {
    nominationId: string;
    workflow: string;
    actorUserId: string | null;
    xOperation: string;
    requestJson: unknown;
    responseJson?: unknown;
    status: "success" | "failed";
    errorMessage?: string | null;
  }): Promise<void>;
}

export interface AuditLogRepository {
  create(input: {
    actorUserId: string | null;
    action: string;
    entityType: string;
    entityId: string;
    metadata: unknown;
  }): Promise<void>;
}

export interface Repositories {
  users: UserRepository;
  sessions: SessionRepository;
  roles: RoleRepository;
  nominations: NominationRepository;
  externalTweets: ExternalTweetRepository;
  votes: VoteRepository;
  settings: SettingsRepository;
  media: MediaRepository;
  publishAttempts: PublishAttemptRepository;
  auditLogs: AuditLogRepository;
}
