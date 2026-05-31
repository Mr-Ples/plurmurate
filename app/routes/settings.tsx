import { Info, Plus, Send, Trash2, X } from "lucide-react";
import { useState } from "react";
import { Form, redirect, useLoaderData } from "react-router";
import { AppShell } from "~/components/AppShell";
import { nominationStatuses, nominationTypes, type NominationStatus } from "~/domain/nominations";
import { roleNames, type RoleName } from "~/domain/roles";
import { visibleFeedStatusesForRoles, voteDisplayModeSchema, type AppSettings } from "~/domain/settings";
import { getCurrentUser } from "~/lib/auth/session";
import { requirePermission } from "~/lib/permissions/permissions";
import { newId } from "~/lib/utils/id";
import { getRepositories } from "~/repositories/drizzle/repositories";
import { sendDiscordTestMessage } from "~/services/discord-service";
import { updateUserRole } from "~/services/role-service";
import { getSettings, updateSettings } from "~/services/settings-service";
import { evaluatePendingNominations } from "~/services/approval-service";

const buttonClass = "cursor-pointer rounded-md border border-[#1f2421] bg-[#1f2421] px-3.5 py-2.5 text-[#fffaf0] disabled:cursor-not-allowed disabled:opacity-45";
const fieldClass = "min-h-[40px] rounded-md border border-[#1f242129] bg-white/55 px-3 py-2.5 outline-none focus:border-[#526f8d]";
const cardClass = "rounded-lg border border-[#1f242129] bg-[#fffcf47a] p-4";
const labelClass = "grid gap-1.5 text-sm font-medium";

export async function loader({ request, context }: any) {
  const user = await getCurrentUser(request, context);
  const repos = getRepositories(context.cloudflare.env);
  const url = new URL(request.url);
  const settings = await getSettings(context);
  return {
    user,
    settings,
    users: await repos.users.listUsers(),
    visibleNominationCount: await getVisibleNominationCount(repos, settings, user?.roles),
    pendingPublishingImpact: await getPendingPublishingImpact(repos),
    discordTest: url.searchParams.get("discordTest"),
  };
}

export async function action({ request, context }: any) {
  const user = await getCurrentUser(request, context);
  if (!user) throw new Response("Unauthorized", { status: 401 });

  const formData = await request.formData();
  const intent = formData.get("_intent");

  if (intent === "role") {
    await updateUserRole(context, user, String(formData.get("userId")), String(formData.get("role")) as RoleName, formData.get("enabled") === "on");
    return redirect("/settings#roles");
  }

  if (String(intent).startsWith("auto-role-")) {
    requirePermission(user.roles, "settings:update");
    const current = await getSettings(context);
    await updateSettings(context, user, updateAutomaticRoleSettings(current, formData, String(intent)));
    return redirect("/settings#automatic-role-assignment");
  }

  if (intent === "discord-test") {
    requirePermission(user.roles, "settings:update");
    try {
      const result = await sendDiscordTestMessage(context);
      return redirect(`/settings?discordTest=${result.ok ? "sent" : "missing"}#discord`);
    } catch (error) {
      console.warn("Discord test message failed", error);
      return redirect("/settings?discordTest=failed#discord");
    }
  }

  const current = await getSettings(context);
  const enabledNominationTypes = nominationTypes.filter((type) => formData.get(`enabledNominationTypes.${type}`) === "on");
  const maxImageUploadBytes = Math.max(1, Number(formData.get("maxImageUploadMegabytes"))) * 1024 * 1024;
  const imageUploadRateLimitMaxImages = Math.max(1, Number(formData.get("imageUploadRateLimitMaxImages")));
  const imageUploadRateLimitWindowMinutes = Math.max(1, Number(formData.get("imageUploadRateLimitWindowMinutes")));
  const imageUploadDailyLimitMaxImages = Math.max(1, Number(formData.get("imageUploadDailyLimitMaxImages")));

  await updateSettings(context, user, {
    ...current,
    minimumTotalVotes: optionalNumber(formData.get("minimumTotalVotes")),
    minimumPositiveRatio: optionalNumber(formData.get("minimumPositiveRatio")),
    minimumPositiveMargin: optionalNumber(formData.get("minimumPositiveMargin")),
    voteDisplayMode: voteDisplayModeSchema.parse(formData.get("voteDisplayMode")),
    publishingWorkflow: "manual_review_when_qualified",
    includeTweetAvatarInPublishedMedia: formData.get("includeTweetAvatarInPublishedMedia") === "on",
    enabledNominationTypes,
    roleFeedVisibility: readRoleFeedVisibility(formData),
    imageUploadsEnabled: formData.get("imageUploadsEnabled") === "on",
    imageUploadRateLimitMaxImages,
    imageUploadRateLimitWindowMinutes,
    imageUploadDailyLimitMaxImages,
    maxImageUploadBytes,
    hostUserId: current.hostUserId,
    hostHandle: current.hostHandle,
  });
  await evaluatePendingNominations(context, new URL(request.url).origin);

  return redirect("/settings");
}

export default function Settings() {
  const { user, settings, users, visibleNominationCount, pendingPublishingImpact, discordTest } = useLoaderData<typeof loader>();
  const [roleInfoOpen, setRoleInfoOpen] = useState(false);
  const maxImageUploadMb = Math.max(1, Math.round(settings.maxImageUploadBytes / 1024 / 1024));
  const [publishingWorkflow, setPublishingWorkflow] = useState<AppSettings["publishingWorkflow"]>(
    settings.publishingWorkflow === "auto_send_when_qualified" ? "manual_review_when_qualified" : settings.publishingWorkflow,
  );
  const [minimumTotalVotes, setMinimumTotalVotes] = useState(settings.minimumTotalVotes?.toString() ?? "");
  const [minimumPositiveRatio, setMinimumPositiveRatio] = useState(settings.minimumPositiveRatio?.toString() ?? "");
  const [minimumPositiveMargin, setMinimumPositiveMargin] = useState(settings.minimumPositiveMargin?.toString() ?? "");
  const automaticPublishingWithOptionalQualifications =
    publishingWorkflow === "auto_send_when_qualified" &&
    [minimumTotalVotes, minimumPositiveRatio, minimumPositiveMargin].some((value) => value.trim() === "");
  const qualifyingPendingNominations = publishingWorkflow === "auto_send_when_qualified"
    ? pendingPublishingImpact.filter((nomination) => nominationWouldQualify(nomination.summary, {
      minimumTotalVotes: parseOptionalThreshold(minimumTotalVotes),
      minimumPositiveRatio: parseOptionalThreshold(minimumPositiveRatio),
      minimumPositiveMargin: parseOptionalThreshold(minimumPositiveMargin),
    }))
    : [];
  const qualifyingUrlNominations = qualifyingPendingNominations.filter((nomination) => nomination.hasUrl).length;
  const estimatedMinimumPublishingCost = qualifyingPendingNominations.length * 0.015;
  const estimatedMaximumPublishingCost = estimatedMinimumPublishingCost + (qualifyingUrlNominations * 0.2);

  return (
    <AppShell user={user}>
      <main className="grid gap-5 py-[42px] pb-20">
        <header className="grid gap-2">
          <h1 className="m-0 font-serif text-[clamp(2rem,5vw,4.8rem)] leading-[0.95] font-medium">Settings</h1>
        </header>

        {/* <section className={cardClass}>
          <p className="m-0 text-[0.68rem] uppercase tracking-[0.08em] text-[#6e716b]">Account</p>
          <div className="mt-2 grid gap-1 md:grid-cols-[1fr_auto] md:items-end">
            <div>
              <h2 className="m-0 text-xl font-medium">{user ? `@${user.username ?? "me"}` : "Signed out"}</h2>
            </div>
            <p className="m-0 text-[#6e716b]">Visible nominations: {visibleNominationCount}</p>
          </div>
        </section> */}

        <section id="roles" className={`${cardClass} grid gap-4 scroll-mt-6`}>
          <div className="flex items-center justify-between gap-3">
            <SectionHeader title="Roles" />
            <button
              className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border border-[#1f242129] bg-white/45 text-[#6e716b] hover:border-[#1f24214d] hover:bg-[#fffcf4]"
              type="button"
              onClick={() => setRoleInfoOpen(true)}
              aria-label="Show role explanations"
            >
              <Info size={17} aria-hidden="true" />
            </button>
          </div>
          <div className="grid max-h-[520px] gap-2 overflow-y-auto pr-2">
            {users.map((account) => (
              <RoleEditor key={account.id} account={account} isHost={isHostAccount(account, settings)} />
            ))}
          </div>
          {roleInfoOpen ? <RoleInfoDialog onClose={() => setRoleInfoOpen(false)} /> : null}
        </section>

        <section id="automatic-role-assignment" className={`${cardClass} grid gap-4 scroll-mt-6`}>
          <div className="grid gap-1">
            <SectionHeader title="Automatic Role Assignment" />
            <p className="m-0 text-sm text-[#6e716b]">Roles configured here are added when a matching user logs in. Current automatic targets: {automaticRoleSummary(settings)}</p>
          </div>
          <Form method="post" className="grid gap-3 rounded-md border border-[#1f242114] bg-white/35 p-3">
            <input type="hidden" name="_intent" value="auto-role-toggle" />
            <Toggle name="automaticRoleAssignmentEnabled" defaultChecked={settings.automaticRoleAssignmentEnabled} title="Enable automatic assignments" info="When enabled, matching whitelist entries and rules add their configured roles during X login." />
            <button className={`${buttonClass} w-fit`}>Save automatic assignment toggle</button>
          </Form>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="grid content-start gap-3">
              <h3 className="m-0 text-base font-medium">Username whitelist</h3>
              <Form method="post" className="grid gap-2 rounded-md border border-[#1f242114] bg-white/35 p-3">
                <input type="hidden" name="_intent" value="auto-role-whitelist-add" />
                <label className={labelClass}>
                  <LabelText text="Username" info="Use an X username with or without @. Matching is case-insensitive." />
                  <input className={fieldClass} name="username" placeholder="DefenderOfBasic" />
                </label>
                <label className={labelClass}>
                  <LabelText text="Role to add" info="The selected role is added when this username logs in." />
                  <RoleSelect name="role" defaultValue="voter" />
                </label>
                <button className={`${buttonClass} inline-flex w-fit items-center gap-2`}>
                  <Plus size={16} aria-hidden="true" />
                  Add username
                </button>
              </Form>
              <div className="grid gap-2">
                {settings.automaticRoleWhitelist.length ? settings.automaticRoleWhitelist.map((entry) => (
                  <Form method="post" key={`${entry.username}-${entry.role}`} className="flex items-center justify-between gap-2 rounded-md border border-[#1f242114] bg-white/35 px-3 py-2">
                    <input type="hidden" name="_intent" value="auto-role-whitelist-remove" />
                    <input type="hidden" name="username" value={entry.username} />
                    <input type="hidden" name="role" value={entry.role} />
                    <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-sm">@{entry.username} gets <strong>{entry.role}</strong></span>
                    <button className="inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md border border-[#1f242129] bg-white/45 text-[#6e716b] hover:border-[#8b343466] hover:text-[#8b3434]" type="submit" aria-label={`Remove @${entry.username} automatic ${entry.role} assignment`}>
                      <Trash2 size={15} aria-hidden="true" />
                    </button>
                  </Form>
                )) : <p className="m-0 text-sm text-[#6e716b]">No usernames configured.</p>}
              </div>
            </div>
            <div className="grid content-start gap-3">
              <h3 className="m-0 text-base font-medium">Rules</h3>
              <Form method="post" className="grid gap-2 rounded-md border border-[#1f242114] bg-white/35 p-3">
                <input type="hidden" name="_intent" value="auto-role-rule-add" />
                <div className="grid gap-2 sm:grid-cols-[1fr_1fr]">
                  <label className={labelClass}>
                    <LabelText text="Metric" info="The account field checked during login." />
                    <select className={fieldClass} name="subject" defaultValue="followers">
                      <option value="followers">Followers</option>
                    </select>
                  </label>
                  <label className={labelClass}>
                    <LabelText text="Condition" info="The comparison used for the metric." />
                    <select className={fieldClass} name="operator" defaultValue="more_than">
                      <option value="more_than">More than</option>
                    </select>
                  </label>
                </div>
                <div className="grid gap-2 sm:grid-cols-[1fr_1fr]">
                  <label className={labelClass}>
                    <LabelText text="Value" info="For example, 5 means users with more than 5 followers match." />
                    <input className={fieldClass} name="value" type="number" min={0} defaultValue={5} />
                  </label>
                  <label className={labelClass}>
                    <LabelText text="Role to add" info="The selected role is added when the rule matches." />
                    <RoleSelect name="role" defaultValue="voter" />
                  </label>
                </div>
                <button className={`${buttonClass} inline-flex w-fit items-center gap-2`}>
                  <Plus size={16} aria-hidden="true" />
                  Add rule
                </button>
              </Form>
              <div className="grid gap-2">
                {settings.automaticRoleRules.length ? settings.automaticRoleRules.map((rule) => (
                  <Form method="post" key={rule.id} className="flex items-center justify-between gap-2 rounded-md border border-[#1f242114] bg-white/35 px-3 py-2">
                    <input type="hidden" name="_intent" value="auto-role-rule-remove" />
                    <input type="hidden" name="ruleId" value={rule.id} />
                    <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-sm">{roleRuleSummary(rule)}</span>
                    <button className="inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md border border-[#1f242129] bg-white/45 text-[#6e716b] hover:border-[#8b343466] hover:text-[#8b3434]" type="submit" aria-label={`Remove automatic role rule ${roleRuleSummary(rule)}`}>
                      <Trash2 size={15} aria-hidden="true" />
                    </button>
                  </Form>
                )) : <p className="m-0 text-sm text-[#6e716b]">No rules configured.</p>}
              </div>
            </div>
          </div>
        </section>

        <section id="discord" className={`${cardClass} grid gap-4 scroll-mt-6`}>
          <SectionHeader title="Discord" />
          <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
            <div className="grid gap-1">
              <p className="m-0 text-sm text-[#6e716b]">Send a test message to the configured Discord channel.</p>
              {discordTest ? <p className={`m-0 text-sm font-medium ${discordTest === "sent" ? "text-[#315f45]" : "text-[#8b3434]"}`}>{discordTestMessage(discordTest)}</p> : null}
            </div>
            <Form method="post" className="m-0">
              <input type="hidden" name="_intent" value="discord-test" />
              <button className={`${buttonClass} inline-flex items-center gap-2`} type="submit">
                <Send size={16} aria-hidden="true" />
                Send test
              </button>
            </Form>
          </div>
        </section>

        <Form method="post" className="grid gap-5 lg:grid-cols-3 lg:items-start">
          <section className={`${cardClass} grid gap-4`}>
            <SectionHeader title="Voting" />
            <div className="grid gap-3">
              <label className={labelClass}>
                <LabelText text="Minimum votes" info="How many total votes a nomination needs before it can qualify." />
                <input className={fieldClass} name="minimumTotalVotes" type="number" min={0} value={minimumTotalVotes} onChange={(event) => setMinimumTotalVotes(event.currentTarget.value)} />
              </label>
              <label className={labelClass}>
                <LabelText text="Approval percentage" info="The share of positive votes needed. 0.6 means 60%." />
                <input className={fieldClass} name="minimumPositiveRatio" type="number" min={0} max={1} step="0.01" value={minimumPositiveRatio} onChange={(event) => setMinimumPositiveRatio(event.currentTarget.value)} />
              </label>
              <label className={labelClass}>
                <LabelText text="Approval lead" info="How many more positive votes than negative votes are required." />
                <input className={fieldClass} name="minimumPositiveMargin" type="number" value={minimumPositiveMargin} onChange={(event) => setMinimumPositiveMargin(event.currentTarget.value)} />
              </label>
              <label className={labelClass}>
                <LabelText text="Vote buttons" info="Choose whether voters see A/B/U buttons or a simpler upvote/downvote interface." />
                <select className={fieldClass} name="voteDisplayMode" defaultValue={settings.voteDisplayMode}>
                  <option value="abu">A/B/U rating</option>
                  <option value="up_down">Upvote/downvote</option>
                </select>
              </label>
            </div>
          </section>

          <section className={`${cardClass} grid gap-4`}>
            <SectionHeader title="Publishing" />
            <div className="grid gap-3">
              <label className={labelClass}>
                <LabelText text="Publishing workflow" info="Choose whether qualified nominations go to review or publish automatically." />
                <select className={fieldClass} name="publishingWorkflow" value={publishingWorkflow} onChange={(event) => setPublishingWorkflow(event.currentTarget.value as typeof settings.publishingWorkflow)}>
                  <option value="manual_review_when_qualified">Review before publishing</option>
                  <option value="auto_send_when_qualified" disabled>Publish automatically (coming soon)</option>
                </select>
              </label>
              <p className="m-0 text-sm text-[#6e716b]">Automated sending is coming soon.</p>
              {publishingWorkflow === "auto_send_when_qualified" ? (
                <div className="rounded-md border border-[#b9892f66] bg-[#fff2cf] px-3 py-2.5 text-sm leading-snug text-[#6b4a12]">
                  {automaticPublishingWithOptionalQualifications ? "Blank vote qualifications are ignored. A pending nomination can publish as soon as the remaining qualifications pass, and if all vote qualifications are blank, one vote can qualify it. " : null}
                  Saving reevaluates pending nominations only; already qualified nominations are not automatically posted. Based on the criteria currently shown, {qualifyingPendingNominations.length} pending {qualifyingPendingNominations.length === 1 ? "nomination appears" : "nominations appear"} able to qualify. Automated X API charges could be about {formatUsd(estimatedMinimumPublishingCost)}{qualifyingUrlNominations ? ` to ${formatUsd(estimatedMaximumPublishingCost)}` : ""} if {qualifyingPendingNominations.length === 1 ? "it publishes" : "they publish"}.
                </div>
              ) : null}
              <label className={labelClass}>
                <LabelText text="Host X user ID" info="Configured by X_HOST_USER_ID in the deployment environment. Change it there and redeploy." />
                <input className={`${fieldClass} text-[#6e716b]`} value={settings.hostUserId} readOnly />
              </label>
              <label className={labelClass}>
                <LabelText text="Host handle" info="Configured by X_HOST_HANDLE in the deployment environment. Change it there and redeploy." />
                <input className={`${fieldClass} text-[#6e716b]`} value={settings.hostHandle} readOnly placeholder="@handle" />
              </label>
              <label className={labelClass}>
                <LabelText text="Image upload limit" info="Maximum file size per uploaded image, in megabytes." />
                <input className={fieldClass} name="maxImageUploadMegabytes" type="number" min={1} step={1} defaultValue={maxImageUploadMb} />
              </label>
              <div className="grid gap-3 md:grid-cols-2">
                <label className={labelClass}>
                  <LabelText text="Upload rate limit" info="Maximum number of images each user can upload during the rate-limit window." />
                  <input className={fieldClass} name="imageUploadRateLimitMaxImages" type="number" min={1} step={1} defaultValue={settings.imageUploadRateLimitMaxImages} />
                </label>
                <label className={labelClass}>
                  <LabelText text="Rate-limit window" info="Rolling window length for image upload rate limiting, in minutes." />
                  <input className={fieldClass} name="imageUploadRateLimitWindowMinutes" type="number" min={1} step={1} defaultValue={settings.imageUploadRateLimitWindowMinutes} />
                </label>
              </div>
              <label className={labelClass}>
                <LabelText text="Daily upload limit" info="Hard maximum number of images each user can upload during a rolling 24-hour period." />
                <input className={fieldClass} name="imageUploadDailyLimitMaxImages" type="number" min={1} step={1} defaultValue={settings.imageUploadDailyLimitMaxImages} />
              </label>
            </div>
            <div className="grid gap-2">
              <Toggle name="imageUploadsEnabled" defaultChecked={settings.imageUploadsEnabled} title="Allow image uploads" info="When disabled, users cannot attach images to nominations and upload requests are rejected before writing to storage." />
              <Toggle name="includeTweetAvatarInPublishedMedia" defaultChecked={settings.includeTweetAvatarInPublishedMedia} title="Automatically add nominator signature" info="Automatically upload nominator twitter avatar to nominated tweet as an image so people know it wasn't the host that sent the tweet." />
            </div>
          </section>

          <section className={`${cardClass} grid gap-4`}>
            <SectionHeader title="Nomination Types" />
            <div className="grid gap-2">
              {nominationTypes.map((type) => (
                <Toggle key={type} name={`enabledNominationTypes.${type}`} defaultChecked={settings.enabledNominationTypes.includes(type)} title={nominationTypeTitle(type)} info={nominationTypeInfo(type)} />
              ))}
            </div>
          </section>

          <section className={`${cardClass} grid gap-4 lg:col-span-3`}>
            <div className="grid gap-1">
              <SectionHeader title="Feed Visibility" />
              <p className="m-0 text-sm text-[#6e716b]">Choose which nomination statuses each role can see in the feed and nomination detail pages.</p>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {roleNames.map((role) => (
                <div key={role} className="grid content-start gap-2">
                  <h3 className="m-0 text-base font-medium capitalize">{role}</h3>
                  <div className="grid gap-2">
                    {visibleStatusOptions.map((status) => (
                      <Toggle
                        key={status}
                        name={`roleFeedVisibility.${role}.${status}`}
                        defaultChecked={settings.roleFeedVisibility[role].includes(status)}
                        title={statusLabel(status)}
                        info={`Allow ${role} users to see ${statusLabel(status).toLowerCase()} nominations in the feed.`}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <div className="sticky bottom-3 z-10 flex justify-end lg:col-span-3">
            <button className={buttonClass}>Save settings</button>
          </div>
        </Form>
      </main>
    </AppShell>
  );
}

function optionalNumber(value: FormDataEntryValue | null) {
  if (value === null) return null;
  const trimmed = String(value).trim();
  return trimmed === "" ? null : Number(trimmed);
}

const visibleStatusOptions = nominationStatuses.filter((status) => status !== "draft");

function readRoleFeedVisibility(formData: FormData): AppSettings["roleFeedVisibility"] {
  return {
    spectator: readVisibleStatuses(formData, "spectator"),
    voter: readVisibleStatuses(formData, "voter"),
    admin: readVisibleStatuses(formData, "admin"),
  };
}

function readVisibleStatuses(formData: FormData, role: RoleName): NominationStatus[] {
  return visibleStatusOptions.filter((status) => formData.get(`roleFeedVisibility.${role}.${status}`) === "on");
}

function statusLabel(status: NominationStatus) {
  if (status === "sent") return "Sent";
  if (status === "withdrawn") return "Archived";
  return status[0].toUpperCase() + status.slice(1);
}

function updateAutomaticRoleSettings(current: AppSettings, formData: FormData, intent: string): AppSettings {
  if (intent === "auto-role-toggle") {
    return { ...current, automaticRoleAssignmentEnabled: formData.get("automaticRoleAssignmentEnabled") === "on" };
  }

  if (intent === "auto-role-whitelist-add") {
    const username = cleanUsername(String(formData.get("username") ?? ""));
    const role = String(formData.get("role")) as RoleName;
    if (!username || !roleNames.includes(role)) return current;
    const exists = current.automaticRoleWhitelist.some((entry) => cleanUsername(entry.username) === username && entry.role === role);
    return exists ? current : {
      ...current,
      automaticRoleWhitelist: [...current.automaticRoleWhitelist, { username, role }],
    };
  }

  if (intent === "auto-role-whitelist-remove") {
    const username = cleanUsername(String(formData.get("username") ?? ""));
    const role = String(formData.get("role")) as RoleName;
    return {
      ...current,
      automaticRoleWhitelist: current.automaticRoleWhitelist.filter((entry) => !(cleanUsername(entry.username) === username && entry.role === role)),
    };
  }

  if (intent === "auto-role-rule-add") {
    const role = String(formData.get("role")) as RoleName;
    const subject = String(formData.get("subject"));
    const operator = String(formData.get("operator"));
    const value = Math.max(0, Math.floor(Number(formData.get("value") ?? 0)));
    if (!roleNames.includes(role) || subject !== "followers" || operator !== "more_than" || !Number.isFinite(value)) return current;
    return {
      ...current,
      automaticRoleRules: [...current.automaticRoleRules, { id: newId("rar"), subject, operator, value, role }],
    };
  }

  if (intent === "auto-role-rule-remove") {
    const ruleId = String(formData.get("ruleId") ?? "");
    return {
      ...current,
      automaticRoleRules: current.automaticRoleRules.filter((rule) => rule.id !== ruleId),
    };
  }

  return current;
}

function cleanUsername(username: string) {
  return username.replace(/^@/, "").trim().toLowerCase();
}

function automaticRoleSummary(settings: AppSettings) {
  const assignments = [
    ...settings.automaticRoleWhitelist.map((entry) => `@${entry.username} -> ${entry.role}`),
    ...settings.automaticRoleRules.map(roleRuleSummary),
  ];
  return assignments.length ? assignments.join(", ") : "none";
}

function roleRuleSummary(rule: AppSettings["automaticRoleRules"][number]) {
  return `followers more than ${rule.value} -> ${rule.role}`;
}

async function getPendingPublishingImpact(repos: ReturnType<typeof getRepositories>) {
  const pending = await repos.nominations.listFeed({ status: "pending" });
  return Promise.all(pending.map(async (nomination) => ({
    id: nomination.id,
    hasUrl: nominationHasUrl(nomination),
    summary: await repos.votes.getVoteSummary(nomination.id),
  })));
}

async function getVisibleNominationCount(repos: ReturnType<typeof getRepositories>, settings: AppSettings, roles: RoleName[] | undefined) {
  const visibleStatuses = new Set(visibleFeedStatusesForRoles(settings, roles));
  const includeHidden = roles?.includes("admin") ?? false;
  const nominations = await repos.nominations.listFeed({ includeHidden });
  return nominations.filter((nomination) => visibleStatuses.has(nomination.status)).length;
}

function nominationHasUrl(nomination: { type: string; text: string | null; targetTweetUrl: string | null }) {
  return nomination.type !== "original" || Boolean(nomination.targetTweetUrl) || /https?:\/\/|www\./i.test(nomination.text ?? "");
}

function parseOptionalThreshold(value: string) {
  const trimmed = value.trim();
  return trimmed === "" ? null : Number(trimmed);
}

function nominationWouldQualify(
  summary: { total: number; positiveRatio: number; positiveMargin: number },
  thresholds: { minimumTotalVotes: number | null; minimumPositiveRatio: number | null; minimumPositiveMargin: number | null },
) {
  if (summary.total === 0) return false;
  return thresholdPasses(summary.total, thresholds.minimumTotalVotes) &&
    thresholdPasses(summary.positiveRatio, thresholds.minimumPositiveRatio) &&
    thresholdPasses(summary.positiveMargin, thresholds.minimumPositiveMargin);
}

function thresholdPasses(value: number, threshold: number | null) {
  return threshold === null || value >= threshold;
}

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(value);
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div>
      <h2 className="m-0 text-xl font-medium">{title}</h2>
    </div>
  );
}

function LabelText({ text, info }: { text: string; info: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {text}
      <InfoTip text={info} />
    </span>
  );
}

function InfoTip({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex h-[22px] w-[22px] items-center justify-center rounded-full border border-[#1f242129] text-[#6e716b]" tabIndex={0} aria-label={text}>
      <Info size={15} aria-hidden="true" />
      <span className="pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 z-30 w-[min(300px,76vw)] -translate-x-1/2 translate-y-1 rounded-md border border-[#1f242129] bg-[#1f2421] px-3 py-2.5 text-sm leading-snug text-[#fffaf0] opacity-0 shadow-[0_12px_30px_rgba(31,36,33,0.16)] transition group-hover:translate-y-0 group-hover:opacity-100 group-focus:translate-y-0 group-focus:opacity-100">
        {text}
      </span>
    </span>
  );
}

function Toggle({ name, defaultChecked, title, info }: { name: string; defaultChecked: boolean; title: string; info: string }) {
  return (
    <label className="flex min-h-[42px] items-center justify-between gap-3 rounded-md border border-[#1f242114] bg-white/35 px-3 py-2 text-sm font-medium">
      <LabelText text={title} info={info} />
      <input className="h-4 w-4 shrink-0" type="checkbox" name={name} defaultChecked={defaultChecked} />
    </label>
  );
}

function RoleSelect({ name, defaultValue }: { name: string; defaultValue: RoleName }) {
  return (
    <select className={fieldClass} name={name} defaultValue={defaultValue}>
      {roleNames.map((role) => <option key={role} value={role}>{role}</option>)}
    </select>
  );
}

function RoleEditor({ account, isHost }: { account: { id: string; username: string | null; xUserId: string; roles: RoleName[] }; isHost: boolean }) {
  const availableRoles = roleNames.filter((role) => !account.roles.includes(role));

  return (
    <div className="grid max-w-[640px] gap-3 border-b border-[#1f242129] py-3 last:border-b-0">
      <div className="min-w-0">
        <p className="m-0 overflow-hidden text-ellipsis whitespace-nowrap font-medium">@{account.username ?? account.xUserId}{isHost ? <span className="ml-2 text-sm font-normal text-[#6e716b]">host</span> : null}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {account.roles.length ? account.roles.map((role) => (
          <Form method="post" key={role} className="m-0">
            <input type="hidden" name="_intent" value="role" />
            <input type="hidden" name="userId" value={account.id} />
            <input type="hidden" name="role" value={role} />
            <button className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border border-[#1f242129] bg-white/50 px-3 text-sm font-medium text-[#1f2421] hover:border-[#8b343466] hover:text-[#8b3434] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-[#1f242129] disabled:hover:text-[#1f2421]" type="submit" aria-label={`Remove ${role} from @${account.username ?? account.xUserId}`} disabled={isHost}>
              {role}
              {isHost ? null : <X size={14} aria-hidden="true" />}
            </button>
          </Form>
        )) : <span className="text-sm text-[#6e716b]">No roles</span>}
      </div>
      {availableRoles.length ? (
        <Form method="post" className="flex flex-wrap gap-2">
          <input type="hidden" name="_intent" value="role" />
          <input type="hidden" name="userId" value={account.id} />
          <input type="hidden" name="enabled" value="on" />
          <select className={fieldClass} name="role" defaultValue={availableRoles[0]}>
            {availableRoles.map((role) => <option key={role}>{role}</option>)}
          </select>
          <button className={buttonClass}>Add role</button>
        </Form>
      ) : null}
    </div>
  );
}

function isHostAccount(account: { username: string | null; xUserId: string }, settings: AppSettings) {
  const cleanHostHandle = settings.hostHandle.replace(/^@/, "").toLowerCase();
  return Boolean(
    (settings.hostUserId && account.xUserId === settings.hostUserId) ||
    (cleanHostHandle && account.username?.toLowerCase() === cleanHostHandle),
  );
}

function RoleInfoDialog({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#1f242166] p-4" role="presentation" onClick={onClose}>
      <div className="grid w-full max-w-[460px] gap-4 rounded-md border border-[#1f242129] bg-[#fffcf4] p-5 shadow-[0_18px_48px_rgba(31,36,33,0.22)]" role="dialog" aria-modal="true" aria-labelledby="role-info-title" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <h2 id="role-info-title" className="m-0 text-xl font-medium">Role explanations</h2>
          <button className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-[#1f242129] bg-white/45 text-[#6e716b] hover:border-[#1f24214d]" type="button" onClick={onClose} aria-label="Close role explanations">
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        <div className="grid gap-3 text-sm leading-snug">
          {roleNames.map((role) => (
            <div key={role} className="rounded-md border border-[#1f242114] bg-white/35 p-3">
              <p className="m-0 font-medium">{role}</p>
              <p className="mt-1 mb-0 text-[#6e716b]">{roleExplanation(role)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function roleExplanation(role: RoleName) {
  if (role === "admin") return "Can moderate nominations, send approved posts, update settings, and manage roles. Note: withdrawn/archived nominations are only visible to admin";
  if (role === "voter") return "Can create nominations and vote on open nominations.";
  return "Can view the app and create nominations, but cannot vote or moderate.";
}

function nominationTypeTitle(type: (typeof nominationTypes)[number]) {
  if (type === "original") return "Text posts";
  if (type === "quote") return "Quote tweets";
  if (type === "repost") return "Reposts";
  return "Replies";
}

function nominationTypeInfo(type: (typeof nominationTypes)[number]) {
  if (type === "original") return "Allow users to nominate a new text post.";
  if (type === "quote") return "Allow users to nominate a quote of an existing X post.";
  if (type === "repost") return "Allow users to nominate an existing X post for reposting.";
  return "Allow users to nominate a reply to an existing X post.";
}

function discordTestMessage(status: string) {
  if (status === "sent") return "Test message sent.";
  if (status === "missing") return "Set DISCORD_BOT_TOKEN and DISCORD_CHANNEL_ID before testing.";
  return "Discord rejected the test message. Check the token, channel ID, and bot permissions.";
}
