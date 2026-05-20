# Plurmurate Product Plan

## 1. Product Summary

Plurmurate is a lightweight community nomination and voting tool for deciding what a shared X/Twitter account should post, quote, repost, or reply to. Users authenticate with X, submit proposed posts as nominations, vote on nominations using the A/B/U rating system, and authorized publishing users or automation decide what ultimately gets published based on the configured workflow.

The product must support both automatic publishing and manual publisher-reviewed publishing. Each fork/deployment should be configurable for a different host account, voting policy, role policy, and publishing workflow without hard-coding a specific host.

## 2. Goals

- Let authenticated users submit proposed posts as nominations.
- Show nominations in a clean feed with status, vote totals, author, media, and target tweet context.
- Let eligible users vote using `A`, `B`, or `U`.
- Treat `A` and `B` as positive votes and `U` as a negative vote for initial approval logic.
- Let publishers, hosts, or admins approve, veto, send, deny, or archive nominations.
- Support text posts, image uploads, quote-tweet nominations, repost nominations, and reply/comment nominations.
- Keep database access behind a generic interface so local, staging, and production persistence can change with minimal application code changes.
- Deploy on Cloudflare.

## 3. Non-Goals

- Fully decentralized governance.
- Complex reputation weighting.
- Public unauthenticated voting.
- Real-time collaboration.
- Advanced spam detection.
- Full analytics dashboard.

## 4. Core User Roles

### Visitor

- Can view public feed if enabled.
- Cannot nominate or vote.
- Can start X login.

### Spectator

- Authenticated account.
- Can view nominations and results.
- Cannot create nominations.
- Cannot vote.

### Voter

- Can create nominations.
- Can vote on eligible nominations.
- Can optionally attach a short comment/reason to each vote.
- Can edit or withdraw own nominations while they are still in draft or pending state.

### Host

- Owns or operates the deployment's connected publishing account.
- Gets administrator and publisher permissions by default.
- Can grant publisher permissions to other users.
- Can manage user roles.

### Publisher

- Can approve, veto, deny, archive, and send nominations.
- Can override voting criteria.
- Can manage nomination status.
- Can review publishing errors.

### Administrator

- Has all host permissions.
- Can manage roles.
- Can change voting criteria and site settings.
- Can manage connected X account settings.
- Can configure automatic role assignment and bulk-apply role rules to existing users.

## 5. Nomination Types

### Original Tweet

User writes a proposed post to be posted by the host account.

Fields:

- Text content.
- Tweet avatar image, required when enabled by host settings.
- Optional uploaded image.
- Optional content warning or note.

### Quote Tweet

User writes a proposed quote post and attaches a link to an existing X post that should be quoted.

Fields:

- Text content.
- Tweet avatar image, required when enabled by host settings.
- Target X post URL.
- Optional uploaded image, if allowed by the final posting rules.

### Repost

User submits an existing X post URL that should be reposted by the host account.

Fields:

- Target X post URL.
- Tweet avatar image, required when enabled by host settings.
- Optional rationale.
- No tweet text required.

### Reply / Comment

User writes a reply to an existing X post.

Fields:

- Text content.
- Tweet avatar image, required when enabled by host settings.
- Target X post URL.
- Optional uploaded image.
- Optional rationale.

Note: Reply/comment nominations may have higher API and moderation cost at scale, because they require fetching, validating, displaying, and sometimes monitoring external tweet context.

## 6. Nomination Lifecycle

Recommended status model:

1. `draft`
   Nomination is being edited by its creator.

2. `pending`
   Nomination is visible and can receive votes.

3. `qualified`
   Nomination currently meets configured voting criteria.

4. `approved`
   A publisher, host, or admin has approved it for sending.

5. `sent`
   Nomination was successfully published, reposted, quoted, or replied to.

6. `denied`
   A publisher, host, or admin rejected the nomination.

7. `vetoed`
   A publisher, host, or admin explicitly blocked the nomination from passing.

8. `withdrawn`
   Creator removed the nomination before final decision.

9. `failed`
   Attempted send failed and needs review.

The UI can merge `qualified` and `approved` visually in automatic mode if needed, but keeping separate states in the data model makes both workflows easier to reason about.

## 7. Voting Model

The rating system has three options:

- `A`: positive vote.
- `B`: positive vote.
- `U`: negative vote.

The exact meaning of `A` and `B` can be defined later. Initially, approval criteria should use:

- `positiveVotes = A + B`
- `negativeVotes = U`
- `totalVotes = A + B + U`
- `positiveRatio = positiveVotes / totalVotes`

Voting rules:

- One vote per user per nomination.
- Users can change their vote while the nomination is still pending.
- Each vote can include an optional voter comment explaining the reason for the vote.
- Vote comments should be editable when the voter changes their vote.
- Vote comments should be visible on the nomination detail page. Feed cards can show a compact count or recent excerpt.
- Spectators cannot vote.
- Hosts, publishers, and admins can optionally vote, but their moderation powers should be separate from their vote.
- The creator may or may not be allowed to vote on their own nomination. This should be a setting.

## 8. Approval Criteria

Criteria should be configurable by hosts and administrators. A nomination qualifies only if all enabled criteria pass.

Recommended initial settings:

- Minimum total votes: `5`
- Minimum positive ratio: `60%`
- Minimum positive vote margin: `+2`
- Minimum voting age: `30 minutes`
- Maximum voting age before expiry: `7 days`
- Publishing workflow: `manual_review`

Potential criteria:

- Minimum total votes.
- Minimum positive ratio, such as more than `50%`, `60%`, or `66%`.
- Minimum positive margin, such as `positiveVotes - negativeVotes >= 2`.
- Minimum number of `A` votes.
- Maximum number of `U` votes.
- Minimum time open for voting.
- Quorum based on active voters in the last `N` days.
- Different thresholds per nomination type.
- Different thresholds for users with trusted roles.

Practical recommendation:

- Use both a minimum vote count and a positive ratio.
- Add a positive margin to prevent `2 positive / 1 negative` from passing too easily.
- Make the criteria adjustable in settings.
- Support different criteria per deployment and optionally per nomination type.

Example rule:

```text
totalVotes >= 5
positiveRatio >= 0.60
positiveVotes - negativeVotes >= 2
status is pending
not vetoed
```

## 9. Feed Requirements

The feed should support:

- Pending nominations.
- Qualified nominations.
- Sent nominations.
- Denied/vetoed nominations, visible to hosts/admins and optionally visible to everyone.
- Filters by status, nomination type, author, and vote state.
- Sorting by newest, most votes, highest positive ratio, and closest to qualifying.

Each feed item should show:

- Nomination type.
- Proposed post text or target repost.
- Uploaded image preview.
- Target X post URL preview, when available.
- Author.
- Created time.
- Current status.
- A/B/U vote counts.
- User's current vote, if any.
- Publisher, host, or admin actions when authorized.

## 10. Authentication And Authorization

Authentication:

- Use X OAuth for login.
- Store provider account ID, username, display name, avatar URL, and token metadata as needed.
- Treat the connected publishing account separately from regular user login accounts.

Authorization:

- Implement role checks in server-side actions/API handlers, not only in the UI.
- Use a small permission map rather than scattering role conditionals across the app.
- Log sensitive actions such as role changes, vetoes, approvals, and sends.

Example permissions:

```text
nomination:create -> voter, publisher, host, admin
nomination:vote -> voter, publisher, host, admin
nomination:moderate -> publisher, host, admin
nomination:send -> publisher, host, admin
settings:update -> host, admin
roles:update -> host, admin
```

## 11. Role Assignment

Roles must be manageable manually and assignable automatically through settings.

Manual role management:

- Hosts/admins can assign and remove roles for individual users.
- Hosts/admins can grant publisher permissions to trusted users.
- Role changes should be audit logged.

Automatic role assignment:

- Hosts/admins can enable or disable automatic role assignment.
- Rules should be configurable.
- Example rule: users with at least `X` X/Twitter followers automatically receive the `voter` role.
- Rules should be evaluated when a user signs in and when a host/admin runs a bulk sync.
- Hosts/admins should be able to preview the impact of a bulk role change before applying it.

Potential automatic role criteria:

- Minimum follower count.
- Account follows the host account.
- Account is on an allowlist.
- Account has been registered for at least `N` days.
- Account has not been denied or flagged.

Bulk role tools:

- Apply current automatic role rules to all existing users.
- Apply current automatic role rules to a filtered set of users.
- Remove automatically assigned roles when users no longer meet criteria, if that setting is enabled.
- Preserve manually assigned admin, host, and publisher roles unless explicitly changed by a host/admin.

## 12. Media Uploads

Users should be able to attach an image to eligible nomination types.

Recommended implementation:

- Local development: Wrangler local R2/local object adapter plus SQLite-compatible file metadata.
- Staging/production: Cloudflare R2.
- Store image metadata in the database.
- Validate file type, file size, dimensions, and upload ownership.
- Generate or store a safe public/private object URL depending on visibility.

Initial constraints:

- One image per nomination.
- JPEG, PNG, and WebP.
- Configurable max size, for example `5 MB`.

## 13. Nomination Tweet Avatars

A nomination can include a tweet avatar image that visually identifies the proposed author/persona of the nominated tweet. This is separate from the X profile name and avatar of the user who submitted, voted on, moderated, or administered the nomination.

The tweet avatar requirement should be controlled by host settings:

- If enabled as required, every nomination must include a tweet avatar before it can become pending.
- If enabled as optional, users may attach one but are not required to.
- If disabled, nominations do not collect tweet avatars.

The tweet avatar has two roles:

- In-app visual identifier on the nomination.
- Image element that can be sent together with the nominated tweet/media when publishing, depending on settings and X media constraints.

Initial implementation:

- Allow nominators to upload a tweet avatar image with the nomination.
- Validate type, size, and dimensions.
- Store tweet avatar media separately from regular nomination image media.
- Let hosts/admins decide whether tweet avatars are required and whether they are included in published media.

Possible future tweet avatar picker:

- Start from a base image chosen by the host/deployment.
- Generate or pre-create variations of that base image.
- Let nominators choose from approved variations.
- Keep the chosen avatar attached to the nomination.

Open design question:

- If both a nomination image and tweet avatar are published, the app needs a composition step. Options include posting multiple media attachments where X allows it, or generating a single combined image with the tweet avatar placed in a consistent corner/header/footer.

## 14. External X Post Links

The app should parse and validate X post URLs for:

- Quote tweet nominations.
- Repost nominations.
- Reply/comment nominations.

Store:

- Original URL.
- Parsed tweet ID.
- Parsed username, if available.
- Fetched preview metadata, if available.
- Fetch timestamp and fetch status.

Do not make posting depend on fragile URL string parsing alone. Store the parsed tweet ID separately.

## 15. Publishing Workflows

The product must support two complete publishing workflows. Hosts and administrators should be able to switch between them in settings.

### Automatic Publishing

1. Nomination is pending and can receive votes.
2. Approval service evaluates the configured criteria.
3. If criteria pass, the nomination becomes `qualified`.
4. Server validates status, content, media, target tweet ID, rate limits, and deployment publishing credentials.
5. Server sends the tweet, quote, repost, or reply through the connected X account.
6. App stores the published tweet URL, timestamp, workflow mode, and any API response metadata.
7. If publishing fails, the nomination moves to `failed` and appears in the publisher review queue.

Automatic publishing must still respect vetoes, disabled nomination types, content validation, and API safety checks.

### Manual Publisher Review

1. Nomination is pending and can receive votes.
2. Approval service evaluates the configured criteria.
3. If criteria pass, the nomination becomes `qualified`.
4. Publisher reviews the qualified nomination.
5. Publisher clicks send, deny, veto, or archive.
6. Server validates permissions, status, content, media, target tweet ID, and publishing credentials.
7. Server sends the tweet, quote, repost, or reply through the connected X account.
8. App stores the published tweet URL, timestamp, workflow mode, actor, and any API response metadata.

Workflow setting options:

- `auto_send_when_qualified`
- `manual_review_when_qualified`

The setting should be deployment-level and editable by hosts/admins. A fork should be able to choose its own workflow without code changes.

## 16. X API Requirements

Current recommendation: use X API v2 on the documented pay-per-use credit model. The app does not require Enterprise-only streaming, firehose, or analytics features for the planned product.

Required X app capabilities:

- X OAuth login for regular users.
- User-context OAuth for the connected host/publishing account.
- Persistent publishing authorization for the host account, using refresh tokens where allowed.
- Read access for user identity and follower-count based role rules.
- Write access for posts, replies, quote posts, reposts, and media upload.

Required OAuth scopes:

- `users.read`: read authenticated user identity.
- `tweet.read`: read posts and validate linked posts.
- `tweet.write`: create posts, replies, quote posts, and reposts.
- `media.write`: upload tweet avatars and nomination images for publishing.
- `offline.access`: keep the connected host/publishing account authorized without requiring a fresh login for every automatic send.
- `follows.read`: only needed if automatic role rules include "follows the host account" or follower/following relationship checks.

Required endpoints/features:

- `GET /2/users/me`: identify the logged-in user.
- `GET /2/users/:id` or `GET /2/users/by/username/:username` with `user.fields=public_metrics,profile_image_url,verified,created_at`: fetch profile metadata and follower counts for role rules.
- `GET /2/tweets/:id`: validate quote/repost/reply targets and fetch preview metadata.
- `POST /2/tweets`: publish original posts, quote posts using `quote_tweet_id`, and replies using `reply.in_reply_to_tweet_id`.
- `POST /2/users/:id/retweets`: repost a target post from the connected host account.
- `POST /2/media/upload`: upload tweet avatars and nomination images before publishing posts with media.

Important X API constraints:

- X currently documents API pricing as pay-per-use credits, not a fixed subscription tier. Costs depend on the endpoints called and the current Developer Console rates.
- Media must be uploaded first, then attached to a post by `media_id`.
- Reply nominations have a platform constraint: self-serve API replies may only be allowed when the original post's author has explicitly summoned the replying account by mentioning it or quoting one of its posts. The app should validate this when possible and clearly show failures.
- Repost nominations require the authenticated host user ID and use the repost/retweet endpoint.
- Fetching external post previews and follower counts should be cached to reduce cost and avoid rate/credit waste.

Implementation rule:

- Build the publishing layer behind an `XClient` interface with only the live X API implementation. The rest of the app should not call X endpoints directly.
- Do not use mocks, mock clients, mocked data flows, stubbed behavior, test implementations, or test suites anywhere in the product for any reason.

## 17. Technical Architecture

Recommended stack for Cloudflare deployment:

- Frontend/app: framework compatible with Cloudflare Workers or Pages.
- Runtime: Cloudflare Workers.
- Local database: SQLite.
- Staging database: Supabase Postgres or Cloudflare D1.
- Production database: Cloudflare D1, Supabase, or another adapter behind the repository interface.
- Object storage: Cloudflare R2 for uploaded images.
- Auth/session storage: database-backed sessions or framework-supported session storage.
- Host account and deployment identity configured through environment variables and settings, not hard-coded constants.

The app should separate domain logic from infrastructure:

```text
UI components
  -> server actions / route handlers
    -> services
      -> repositories
        -> database adapter
```

## 18. Database Interface

Create repository interfaces around domain operations rather than exposing database-specific queries throughout the app.

Suggested repositories:

- `UserRepository`
- `SessionRepository`
- `NominationRepository`
- `VoteRepository`
- `SettingsRepository`
- `AuditLogRepository`
- `MediaRepository`
- `PublishingRepository`
- `RoleAssignmentRepository`

Example interface shape:

```ts
interface NominationRepository {
  create(input: CreateNominationInput): Promise<Nomination>;
  findById(id: string): Promise<Nomination | null>;
  listFeed(filter: FeedFilter): Promise<PaginatedResult<Nomination>>;
  updateStatus(id: string, status: NominationStatus, actorId: string): Promise<void>;
}
```

Database-specific adapters can then implement the same interfaces:

- `SqliteNominationRepository`
- `SupabaseNominationRepository`
- `D1NominationRepository`

Keep migrations explicit and versioned. Even with a generic interface, schema changes still need careful migration planning per database.

## 19. Suggested Data Model

Core tables/entities:

- `users`
- `roles`
- `user_roles`
- `sessions`
- `nominations`
- `votes`
- `media_assets`
- `external_tweets`
- `settings`
- `role_assignment_rules`
- `audit_logs`
- `publish_attempts`

Key constraints:

- Unique vote per `user_id + nomination_id`.
- Nominations have one creator.
- Media assets belong to one nomination and uploader.
- Tweet avatar media belongs to one nomination, unless the nomination uses a reusable host-approved avatar variant.
- Publish attempts belong to one nomination.
- Role updates and moderation actions are audit logged.

## 20. Settings

Settings should be editable by hosts and administrators and read by the approval service.

Suggested settings:

- Minimum total votes.
- Minimum positive ratio.
- Minimum positive margin.
- Minimum voting age.
- Maximum voting age.
- Allow creator self-vote.
- Allow host/publisher/admin votes.
- Publishing workflow: automatic or manual publisher review.
- Enabled nomination types.
- Max image upload size.
- Public visibility of denied/vetoed nominations.
- Automatic role assignment enabled.
- Automatic voter role criteria.
- Whether automatic role rules can remove roles when criteria are no longer met.
- Tweet avatar collection mode: disabled, optional, or required.
- Tweet avatar included in published media.
- Tweet avatar composition mode.
- Connected host account metadata.

Settings should have validation and defaults. The app should continue working if a setting is missing.

## 21. UI Direction

The UI should feel aesthetic, minimal, and lightly impressionistic while staying operational. The product should feel like a quiet editorial tool for collective posting, not a generic dashboard and not a marketing page.

Design target:

- Quiet editorial tool with generative/poster-like nomination artifacts.
- Feed-first experience.
- Crisp text and controls over soft, low-contrast visual atmosphere.
- Functional screens such as settings and role management can be more utilitarian, but should still share the same restrained visual system.

Principles:

- First screen should be the nomination feed.
- Use typography, spacing, and composition as the main visual structure.
- Keep the base palette restrained, with subtle image-derived color washes from tweet avatars or nomination media.
- Avoid decorative gradient blobs, obvious dashboard chrome, and loud card-heavy layouts.
- Make each nomination feel like a small artifact: readable text, compact metadata, minimal controls, and a faint visual impression from the avatar/media.
- Use A/B/U as typographic voting controls rather than button-heavy UI.
- Keep cards compact and scannable, with hairline borders or soft surface changes instead of heavy boxes.
- Make vote actions visually clear and fast.
- Show status and eligibility clearly.
- Keep publisher/host/admin controls visible only when useful.
- Avoid hiding critical moderation state behind hover-only interactions.
- Use motion sparingly: gentle reveal, vote count transitions, and publishing state changes.

Primary screens:

- Login screen.
- Feed.
- Create nomination.
- Nomination detail.
- Vote comments on nomination detail.
- Publisher review queue.
- Settings.
- Role management.
- Automatic role rule preview/apply screen.
- Tweet avatar upload/picker screen.
- User profile / own nominations.

## 22. Deployment Plan

Recommended environments:

- Local: SQLite, local uploads, local OAuth callback.
- Staging: Cloudflare deployment with staging database and staging X app credentials.
- Production: Cloudflare deployment with production database, R2 bucket, and production X app credentials.

Environment-specific configuration:

- X OAuth client ID/secret.
- X publishing credentials.
- Host account handle/ID for the current fork/deployment.
- Database adapter type.
- Database connection settings.
- R2 bucket name and credentials/bindings.
- Session secret.
- Base URL.

Cloudflare resources likely needed:

- Workers or Pages project.
- D1 database if using Cloudflare-native SQL.
- R2 bucket for images.
- KV or database-backed session store if needed by the chosen framework.
- Secrets for OAuth and publishing credentials.

Forkability requirements:

- The repo should be forkable for different hosts.
- Host-specific values should live in environment variables, deployment settings, or database settings.
- The code should not hard-code a specific host account, display name, X account, voting threshold, or publishing workflow.
- Each fork should be able to run with its own OAuth app, connected publishing account, role rules, database, R2 bucket, and criteria.

## 23. Risks And Open Questions

### X API Access

Posting, reposting, replying, fetching tweet previews, and media uploads depend on current X API access, pricing, permissions, and rate limits. This should be validated before launch so both publishing workflows can work with the available API tier.

### A/B/U Meaning

`A` and `B` are both positive for now, but the product should eventually define why a user would choose one over the other. Possible meanings:

- `A`: strongly approve, `B`: approve.
- `A`: original/clever, `B`: aligned/useful.
- `A`: publish now, `B`: good but needs host judgment.

### Governance

Decide per deployment whether the voting system is binding or advisory. In automatic mode, configured criteria are binding unless a publisher vetoes before the nomination qualifies. In manual mode, votes qualify a nomination for publisher review.

### Abuse And Spam

Potential controls:

- Require account age or allowlist before voting.
- Rate-limit nominations.
- Rate-limit votes.
- Hide nominations from new accounts until reviewed.
- Give publishers and hosts a fast veto flow.

### Cost

Reply/comment nominations and external tweet previews may increase API calls. Cache fetched tweet metadata and avoid refetching aggressively.

### Automatic Role Assignment Accuracy

Follower counts and other external account metadata may be stale, unavailable, rate limited, or expensive to fetch. Role rules should record when they were evaluated and whether the value came from live data or cached data.

## 24. Build Scope And Sequence

The whole product should be implemented, including both publishing workflows. The sequence below is for reducing integration risk, not for cutting scope.

Foundation:

- X login.
- User roles.
- Create original tweet nomination.
- Feed of pending and sent nominations.
- A/B/U voting.
- Optional voter comments.
- Configurable minimum votes, positive ratio, and positive margin.
- Configurable automatic publishing and manual publisher-review workflows.
- Publisher approval/deny/veto/send actions.
- Real send workflow for supported X API actions.
- Nomination tweet avatar upload.
- Image uploads.
- SQLite repository implementation.
- Clean minimal UI.

Expanded nomination support:

- Quote tweet nominations.
- Repost nominations.
- Reply/comment nominations.
- R2 storage.
- Staging deployment.
- More configurable criteria.
- Automatic role assignment rules.
- Bulk role rule preview and apply flow.
- Tweet avatar picker based on host-provided image variants.

Hardening and production readiness:

- Quorum rules.
- Audit dashboard.
- External tweet preview caching.
- Supabase/D1 adapter swap.
- Advanced moderation and anti-abuse controls.
- Image composition for combining nomination media and tweet avatars.

## 25. Decision Checklist

- What should `A` and `B` and `U` mean?
  Decision: use the A/B/U rating system designed by defender on X/Twitter.
  `A` means "true & useful, and new to me."
  `B` means "true & useful, but not novel."
  `U` means "unclear, undefined, unknowable, or just flat out wrong."
  For approval criteria, `A` and `B` are positive votes and `U` is a negative vote.

- Should creators be allowed to vote on their own nominations?
  Decision: no.

- Should host/publisher/admin votes count toward criteria?
  Decision: yes.

- Which publishing workflow should a new deployment default to: automatic or manual publisher review?
  Decision: manual publisher review by default. Automatic publishing must still be fully implemented and switchable.

- Should denied/vetoed nominations remain visible?
  Decision: yes by default, but hosts/admins can hide denied or vetoed nominations they do not want visible.

- Should all authenticated users be voters by default, or should voting be invite/role based?
  Decision: authenticated users start as spectators. Voter role is granted manually or through role rules.

- Which automatic role assignment rules should be enabled at launch?
  Decision: launch with manual role assignment only. Keep the role-rule architecture, but do not enable automatic role assignment at launch.

- Should automatically assigned roles be removed when a user no longer meets criteria?
  Decision: no.

- Should tweet avatars be disabled, optional, or required by default?
  Decision: optional by default.

- Should tweet avatar variants be generated dynamically, pre-generated, or uploaded by the host?
  Decision: for launch, default the tweet avatar to the nominator's X/Twitter profile picture. Later, add a tool to creatively combine the host avatar and nominator avatar.

- How should tweet avatar and nomination image composition work when both are present?
  Decision: store them separately at first, then publish as multiple media attachments when X supports the target action. Add a composition service later for generating a single combined image.

- Which database should be used for first production deployment: D1, Supabase, or another option?
  Decision: Cloudflare D1 for production, SQLite-compatible local development, behind repository interfaces. Supabase can be added later as another adapter if needed.

- Which framework should be used for the Cloudflare app?
  Decision: React Router v7 running on Cloudflare Workers, with TypeScript.

- What is the expected community size for the first launch?
  Decision: roughly `20-100` authenticated users and low posting volume. Design the schema and repository interfaces so it can grow.

- What X API tier and permissions are available?
  Required: X API v2 pay-per-use access with an approved developer app. No Enterprise-only features are required for the planned product. The app needs OAuth 2.0 user-context access for login and for the connected host/publishing account.

  Required scopes: `users.read`, `tweet.read`, `tweet.write`, `media.write`, and `offline.access`. Add `follows.read` only if follower/following relationship rules are enabled.

  Required endpoints/features: user lookup for login/profile/follower counts, post lookup for linked tweet validation/previews, `POST /2/tweets` for original posts/quotes/replies, `POST /2/users/:id/retweets` for reposts, and `POST /2/media/upload` for tweet avatars and nomination images.

  Important limitation: reply/comment nominations may not always be publishable through the self-serve API. X documents a self-serve reply constraint where replies are only permitted if the original post's author has explicitly summoned the replying account by mentioning it or quoting one of its posts. The app should detect this when possible and show a clear publishing failure when not.
