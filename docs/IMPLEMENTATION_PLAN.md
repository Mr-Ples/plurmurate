# Plurmurate Implementation Plan

## 1. Recommended Stack

Use this stack unless there is a strong reason to change it before implementation starts:

- Language: TypeScript.
- App framework: React Router v7, deployed as a full-stack Cloudflare Worker.
- Runtime/deployment: Cloudflare Workers.
- Styling: Tailwind CSS plus a small local component layer.
- Icons: use sparingly for utility controls only. `lucide-react` is acceptable for mundane actions such as settings, upload, close, filter, and send, but icons should not define the aesthetic.
- Validation: `zod`.
- Database access: repository interfaces over Drizzle ORM.
- Local database: SQLite-compatible development database.
- Production database: Cloudflare D1.
- Object storage: Wrangler local R2/local object adapter in development, Cloudflare R2 in staging/production.
- Auth: X OAuth 2.0 with PKCE, app-managed sessions stored in the database.
- X integration: live X API v2 client only.

Why this stack:

- React Router v7 is officially supported on Cloudflare Workers.
- D1 is SQLite-compatible, so local SQLite and production D1 can share most schema and query code.
- Drizzle supports Cloudflare D1 and keeps SQL/schema ownership clear.
- Keeping auth, storage, database, and X calls behind interfaces makes the repo forkable and easier to adapt.

## 2. High-Level Architecture

Use layered boundaries:

```text
React Router routes/components
  -> route loaders/actions
    -> application services
      -> repository interfaces
        -> Drizzle/D1/SQLite adapters
      -> storage interfaces
        -> local/R2 adapters
      -> X client interface
        -> live adapter
```

Rules:

- UI code should not talk directly to Drizzle, R2, or X.
- Route actions should be thin: validate input, get current user/session, call a service, return a response.
- Services own business logic such as voting criteria, publishing workflow, role checks, and status transitions.
- Repositories own persistence details.
- All host-specific values must come from settings, environment variables, or database state.
- Do not create or use mocks, mock clients, mocked data flows, stubbed behavior, test implementations, or test suites anywhere for any reason.

## 3. Project Structure

Suggested structure:

```text
app/
  components/
  routes/
  styles/
  lib/
    auth/
    permissions/
    validation/
    utils/
  domain/
    nominations.ts
    votes.ts
    roles.ts
    settings.ts
    publishing.ts
  services/
    approval-service.ts
    nomination-service.ts
    vote-service.ts
    role-service.ts
    publishing-service.ts
    settings-service.ts
  repositories/
    interfaces.ts
    drizzle/
      schema.ts
      sqlite-repositories.ts
      d1-repositories.ts
  storage/
    interfaces.ts
    local-storage.ts
    r2-storage.ts
  x/
    interfaces.ts
    live-x-client.ts
workers/
  app.ts
drizzle/
  migrations/
public/
```

Exact route file names can follow the scaffolded React Router convention.

## 4. Environment Configuration

Required environment/bindings:

```text
SESSION_SECRET
DATABASE_PROVIDER=sqlite|d1
STORAGE_PROVIDER=local-r2|r2
X_CLIENT_ID
X_CLIENT_SECRET
X_HOST_USER_ID
X_HOST_HANDLE
X_PUBLISHING_ACCESS_TOKEN
X_PUBLISHING_REFRESH_TOKEN
R2 bucket binding
```

Notes:

- Do not commit secrets.
- The host account is configuration, not code.
- The connected host/publishing account should be manageable through settings once the basic app works.
- Local development should use live X credentials and the live X client.

## 5. Database Schema

Use explicit migrations. Initial tables:

### `users`

- `id`
- `x_user_id`
- `username`
- `display_name`
- `profile_image_url`
- `followers_count`
- `x_access_token_encrypted`
- `x_refresh_token_encrypted`
- `last_profile_sync_at`
- `created_at`
- `updated_at`

### `sessions`

- `id`
- `user_id`
- `expires_at`
- `created_at`

### `roles`

- `id`
- `name`

Seed roles:

- `spectator`
- `voter`
- `publisher`
- `host`
- `admin`

### `user_roles`

- `user_id`
- `role_id`
- `assigned_by_user_id`
- `assignment_source`
- `created_at`

Unique constraint: `user_id + role_id`.

### `nominations`

- `id`
- `creator_user_id`
- `type`
- `status`
- `text`
- `target_tweet_url`
- `target_tweet_id`
- `rationale`
- `tweet_avatar_media_id`
- `nomination_media_id`
- `published_tweet_id`
- `published_tweet_url`
- `created_at`
- `updated_at`
- `qualified_at`
- `approved_at`
- `sent_at`
- `hidden_at`

Types:

- `original`
- `quote`
- `repost`
- `reply`

Statuses:

- `draft`
- `pending`
- `qualified`
- `approved`
- `sent`
- `denied`
- `vetoed`
- `withdrawn`
- `failed`

### `votes`

- `id`
- `nomination_id`
- `user_id`
- `value`
- `comment`
- `created_at`
- `updated_at`

Unique constraint: `nomination_id + user_id`.

Values:

- `A`
- `B`
- `U`

### `media_assets`

- `id`
- `owner_user_id`
- `nomination_id`
- `kind`
- `storage_key`
- `public_url`
- `mime_type`
- `size_bytes`
- `width`
- `height`
- `created_at`

Kinds:

- `tweet_avatar`
- `nomination_image`
- `composed_publish_image`

### `external_tweets`

- `tweet_id`
- `url`
- `author_username`
- `author_id`
- `text_preview`
- `fetched_at`
- `fetch_status`
- `raw_json`

### `settings`

- `key`
- `value_json`
- `updated_by_user_id`
- `updated_at`

Use JSON values for flexibility, but validate through typed settings objects in code.

### `role_assignment_rules`

Keep this table even if launch uses manual roles only.

- `id`
- `name`
- `enabled`
- `rule_type`
- `config_json`
- `created_at`
- `updated_at`

### `publish_attempts`

- `id`
- `nomination_id`
- `workflow`
- `actor_user_id`
- `x_operation`
- `request_json`
- `response_json`
- `status`
- `error_message`
- `created_at`

### `audit_logs`

- `id`
- `actor_user_id`
- `action`
- `entity_type`
- `entity_id`
- `metadata_json`
- `created_at`

## 6. Repository Interfaces

Create interfaces around domain operations, not generic table access.

Core interfaces:

```ts
interface UserRepository {}
interface SessionRepository {}
interface RoleRepository {}
interface NominationRepository {}
interface VoteRepository {}
interface SettingsRepository {}
interface MediaRepository {}
interface ExternalTweetRepository {}
interface PublishAttemptRepository {}
interface AuditLogRepository {}
```

Example:

```ts
interface VoteRepository {
  upsertVote(input: {
    nominationId: string;
    userId: string;
    value: "A" | "B" | "U";
    comment?: string;
  }): Promise<void>;

  getVoteSummary(nominationId: string): Promise<{
    a: number;
    b: number;
    u: number;
    positive: number;
    negative: number;
    total: number;
  }>;
}
```

## 7. Permission Model

Centralize permissions:

```text
nomination:create -> voter, publisher, host, admin
nomination:vote -> voter, publisher, host, admin
nomination:moderate -> publisher, host, admin
nomination:send -> publisher, host, admin
settings:update -> host, admin
roles:update -> host, admin
```

Implementation rules:

- Enforce permissions server-side in services.
- UI can hide controls, but hidden controls are not security.
- Audit sensitive actions: role changes, setting updates, vetoes, denies, approvals, sends.

## 8. Settings Model

Typed settings should include:

```ts
type PublishingWorkflow = "manual_review_when_qualified" | "auto_send_when_qualified";
type TweetAvatarMode = "disabled" | "optional" | "required";

interface AppSettings {
  minimumTotalVotes: number;
  minimumPositiveRatio: number;
  minimumPositiveMargin: number;
  minimumVotingAgeMinutes: number;
  maximumVotingAgeDays: number;
  publishingWorkflow: PublishingWorkflow;
  creatorSelfVoteAllowed: boolean;
  privilegedVotesCountTowardCriteria: boolean;
  deniedVisibleByDefault: boolean;
  tweetAvatarMode: TweetAvatarMode;
  includeTweetAvatarInPublishedMedia: boolean;
  enabledNominationTypes: Array<"original" | "quote" | "repost" | "reply">;
  automaticRoleAssignmentEnabled: boolean;
}
```

Default values:

- `minimumTotalVotes`: `5`
- `minimumPositiveRatio`: `0.6`
- `minimumPositiveMargin`: `2`
- `publishingWorkflow`: `manual_review_when_qualified`
- `tweetAvatarMode`: `optional`
- `creatorSelfVoteAllowed`: `false`
- `privilegedVotesCountTowardCriteria`: `true`
- `deniedVisibleByDefault`: `true`
- `automaticRoleAssignmentEnabled`: `false`

## 9. Approval Service

Approval logic:

```text
positiveVotes = A + B
negativeVotes = U
totalVotes = A + B + U
positiveRatio = positiveVotes / totalVotes
positiveMargin = positiveVotes - negativeVotes
```

A pending nomination qualifies when:

```text
totalVotes >= minimumTotalVotes
positiveRatio >= minimumPositiveRatio
positiveMargin >= minimumPositiveMargin
minimumVotingAge has passed
status is pending
not vetoed
```

When a nomination qualifies:

- In manual mode, set status to `qualified` and show it in the publisher review queue.
- In automatic mode, set status to `qualified`, then call `PublishingService.sendQualifiedNomination`.

## 10. X Client Interface

No application service should call `fetch` against X directly. Use:

```ts
interface XClient {
  getAuthenticatedUser(accessToken: string): Promise<XUser>;
  getUserById(userId: string): Promise<XUser>;
  getTweetById(tweetId: string): Promise<XTweet>;
  uploadMedia(input: UploadMediaInput): Promise<{ mediaId: string }>;
  createTweet(input: CreateTweetInput): Promise<{ tweetId: string; url: string }>;
  repost(input: RepostInput): Promise<{ tweetId: string }>;
}
```

Implementations:

- `LiveXClient`: X API v2 implementation.

Required live capabilities:

- OAuth 2.0 login/user identity.
- `users.read`, `tweet.read`, `tweet.write`, `media.write`, `offline.access`.
- Optional `follows.read` later if follower/following rules are enabled.

## 11. Publishing Service

Publishing flow:

1. Load nomination, settings, media, target tweet, and vote summary.
2. Check permission or automatic workflow authority.
3. Validate current status.
4. Validate nomination type and required fields.
5. Upload media to X if needed.
6. Call the correct X operation:
   - Original: `createTweet({ text, mediaIds })`
   - Quote: `createTweet({ text, quoteTweetId, mediaIds })`
   - Reply: `createTweet({ text, replyToTweetId, mediaIds })`
   - Repost: `repost({ tweetId })`
7. Store `publish_attempts`.
8. On success, mark nomination `sent`.
9. On failure, mark nomination `failed` and expose the error in the publisher queue.

Reply limitation:

- Reply/comment publishing may fail because of X self-serve reply restrictions.
- The UI should warn publishers that not every external reply target is publishable.

## 12. Media And Tweet Avatars

Launch behavior:

- Tweet avatar defaults to the nominator's X profile image.
- Hosts can set tweet avatars to disabled, optional, or required.
- Users can upload nomination images.
- Store tweet avatar and nomination image separately.
- Publish both as separate media attachments when allowed.

Later behavior:

- Add image composition to combine host avatar and nominator avatar creatively.
- Add composed publish images when multiple media attachments are not appropriate.

Storage interface:

```ts
interface ObjectStorage {
  put(input: PutObjectInput): Promise<StoredObject>;
  get(key: string): Promise<ReadableStream | null>;
  delete(key: string): Promise<void>;
}
```

## 13. Routes And Screens

Public/auth:

- `/login`
- `/auth/x/start`
- `/auth/x/callback`
- `/logout`

Main app:

- `/` feed
- `/nominations/new`
- `/nominations/:id`
- `/me`

Publisher/admin:

- `/review`
- `/settings`
- `/settings/roles`
- `/settings/publishing`
- `/settings/criteria`

Route behavior:

- Feed supports filters by status, type, author, and user's vote state.
- Nomination detail shows vote comments.
- Review queue shows qualified, failed, denied, and vetoed items relevant to publishers.
- Settings pages enforce host/admin permissions server-side.

## 14. UI Direction

Use a minimal, aesthetic, lightly impressionistic UI. The target is a quiet editorial tool with generative/poster-like nomination artifacts.

Core rules:

- First screen is the nomination feed.
- Avoid a marketing-style landing page.
- Keep settings/admin screens operational and dense enough for repeated use.
- Use accessible native controls underneath custom styling.
- Do not let visual atmosphere obscure voting, status, moderation, or publishing state.

Visual language:

- Mostly quiet neutral surfaces with strong readable typography.
- Subtle paper-like grain or texture is acceptable if it does not hurt readability.
- Each nomination can derive a faint wash/accent from its tweet avatar or nomination image.
- Nominations should feel like small composed artifacts: crisp text, compact metadata, typographic voting, and a soft visual trace of the avatar/media.
- Avoid decorative gradient blobs, loud dashboards, and heavy nested cards.
- Use hairline borders, restrained shadows, or soft surface shifts instead of boxed-in card stacks.
- Keep border radii small, around `6-8px`.

Interaction:

- A/B/U controls should be typographic, prominent, stable in size, and fast to use.
- Vote comments should be available without making feed cards too tall.
- Publisher actions should be visible only to authorized users.
- Use icons sparingly for utility actions. Prefer text or typographic controls where meaning matters.
- Motion should be subtle: feed item reveal, vote count changes, and publishing state transitions.

## 15. No Mocks Or Tests

Do not add mocks or tests anywhere for any reason. This includes unit tests, integration tests, end-to-end tests, test fixtures, test runners, mock clients, mocked service layers, stubbed auth/session flows, fake X clients, fake repositories, and package scripts dedicated to testing.

## 16. Build Phases

### Phase 1: Scaffold And Foundation

Acceptance criteria:

- React Router app runs locally.
- Cloudflare Worker deployment config exists.
- Drizzle schema and migrations exist.
- Repository interfaces exist.
- Live auth/session flow can identify a seeded host/admin.
- Basic layout, feed shell, and navigation exist.

### Phase 2: Auth, Roles, And Settings

Acceptance criteria:

- X OAuth login flow works through the live auth interface.
- Sessions persist in the database.
- Roles and permissions are enforced server-side.
- Settings can be viewed/edited by host/admin.
- Host account identity is configurable.

### Phase 3: Nominations And Feed

Acceptance criteria:

- Users with voter role can create nominations.
- Original, quote, repost, and reply nomination forms exist.
- Target X URLs are parsed and stored.
- Tweet avatar mode is respected.
- Feed and detail pages display nominations, media, vote summary, and status.

### Phase 4: Voting And Qualification

Acceptance criteria:

- Eligible users can vote `A`, `B`, or `U`.
- Vote comments can be added/edited.
- One vote per user per nomination is enforced.
- Approval service qualifies nominations based on settings.
- Manual and automatic workflow branches are both reachable.

### Phase 5: Publishing

Acceptance criteria:

- `LiveXClient` supports the required X endpoints.
- Manual publisher review can send/deny/veto/archive.
- Automatic workflow sends when criteria are met.
- Publish attempts are logged.
- Failures move nominations to `failed`.

### Phase 6: Media And Storage

Acceptance criteria:

- Nomination images upload locally and to R2 in deployed environments.
- Tweet avatars use the nominator's X profile image by default.
- Optional uploaded tweet avatar support works if enabled.
- Media is validated before storage and before publishing.

### Phase 7: Deployment And Hardening

Acceptance criteria:

- Cloudflare deployment works.
- D1 migrations apply in staging/production.
- R2 binding works.
- Secrets are documented.
- Basic rate limits and audit logging are in place.
- README has setup, local dev, migration, and deployment instructions.

## 17. Commands To Add

Suggested package scripts:

```json
{
  "dev": "react-router dev",
  "build": "react-router build",
  "deploy": "wrangler deploy",
  "typecheck": "tsc --noEmit",
  "lint": "eslint .",
  "db:generate": "drizzle-kit generate",
  "db:migrate:local": "wrangler d1 migrations apply plurmurate --local",
  "db:migrate:remote": "wrangler d1 migrations apply plurmurate --remote"
}
```

Adjust command names to the final scaffold.

## 18. External Documentation To Recheck During Build

- Cloudflare React Router Workers guide.
- Cloudflare D1 docs.
- Drizzle D1 docs.
- Cloudflare R2 Workers API docs.
- X OAuth 2.0 scopes docs.
- X Manage Posts, Repost, and Media Upload docs.
