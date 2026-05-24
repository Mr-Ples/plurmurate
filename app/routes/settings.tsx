import { Info, Send, X } from "lucide-react";
import { Form, redirect, useLoaderData } from "react-router";
import { AppShell } from "~/components/AppShell";
import { nominationTypes } from "~/domain/nominations";
import { roleNames, type RoleName } from "~/domain/roles";
import { getCurrentUser } from "~/lib/auth/session";
import { requirePermission } from "~/lib/permissions/permissions";
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
  return {
    user,
    settings: await getSettings(context),
    users: await repos.users.listUsers(),
    visibleNominationCount: (await repos.nominations.listFeed({ viewerUserId: user?.id })).length,
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

  await updateSettings(context, user, {
    ...current,
    minimumTotalVotes: optionalNumber(formData.get("minimumTotalVotes")),
    minimumPositiveRatio: optionalNumber(formData.get("minimumPositiveRatio")),
    minimumPositiveMargin: optionalNumber(formData.get("minimumPositiveMargin")),
    publishingWorkflow: formData.get("publishingWorkflow"),
    includeTweetAvatarInPublishedMedia: formData.get("includeTweetAvatarInPublishedMedia") === "on",
    enabledNominationTypes,
    automaticRoleAssignmentEnabled: formData.get("automaticRoleAssignmentEnabled") === "on",
    maxImageUploadBytes,
    hostUserId: String(formData.get("hostUserId") ?? ""),
    hostHandle: String(formData.get("hostHandle") ?? ""),
  });
  await evaluatePendingNominations(context);

  return redirect("/settings");
}

export default function Settings() {
  const { user, settings, users, visibleNominationCount, discordTest } = useLoaderData<typeof loader>();
  const maxImageUploadMb = Math.max(1, Math.round(settings.maxImageUploadBytes / 1024 / 1024));

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
          <SectionHeader title="Roles" />
          <div className="grid gap-2">
            {users.map((account) => (
              <RoleEditor key={account.id} account={account} />
            ))}
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
                <input className={fieldClass} name="minimumTotalVotes" type="number" min={0} defaultValue={settings.minimumTotalVotes ?? ""} />
              </label>
              <label className={labelClass}>
                <LabelText text="Approval percentage" info="The share of positive votes needed. 0.6 means 60%." />
                <input className={fieldClass} name="minimumPositiveRatio" type="number" min={0} max={1} step="0.01" defaultValue={settings.minimumPositiveRatio ?? ""} />
              </label>
              <label className={labelClass}>
                <LabelText text="Approval lead" info="How many more positive votes than negative votes are required." />
                <input className={fieldClass} name="minimumPositiveMargin" type="number" defaultValue={settings.minimumPositiveMargin ?? ""} />
              </label>
            </div>
          </section>

          <section className={`${cardClass} grid gap-4`}>
            <SectionHeader title="Publishing" />
            <div className="grid gap-3">
              <label className={labelClass}>
                <LabelText text="Publishing workflow" info="Choose whether qualified nominations go to review or publish automatically." />
                <select className={fieldClass} name="publishingWorkflow" defaultValue={settings.publishingWorkflow}>
                  <option value="manual_review_when_qualified">Review before publishing</option>
                  <option value="auto_send_when_qualified">Publish automatically</option>
                </select>
              </label>
              <label className={labelClass}>
                <LabelText text="Host X user ID" info="The numeric X account ID used as the host account." />
                <input className={fieldClass} name="hostUserId" defaultValue={settings.hostUserId} />
              </label>
              <label className={labelClass}>
                <LabelText text="Host handle" info="The public X handle shown for the host account." />
                <input className={fieldClass} name="hostHandle" defaultValue={settings.hostHandle} placeholder="@handle" />
              </label>
              <label className={labelClass}>
                <LabelText text="Image upload limit" info="Maximum file size per uploaded image, in megabytes." />
                <input className={fieldClass} name="maxImageUploadMegabytes" type="number" min={1} step={1} defaultValue={maxImageUploadMb} />
              </label>
            </div>
            <div className="grid gap-2">
              <Toggle name="includeTweetAvatarInPublishedMedia" defaultChecked={settings.includeTweetAvatarInPublishedMedia} title="Automatically nominator signature" info="Automatically upload nominator twitter avatar to nominated tweet as an image so people know it wasn't the host that sent the tweet." />
              <Toggle name="automaticRoleAssignmentEnabled" defaultChecked={settings.automaticRoleAssignmentEnabled} title="Automatic role assignment" info="Assign default roles automatically when users sign in." />
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

function RoleEditor({ account }: { account: { id: string; username: string | null; xUserId: string; roles: RoleName[] } }) {
  const availableRoles = roleNames.filter((role) => !account.roles.includes(role));

  return (
    <div className="grid max-w-[640px] gap-3 border-b border-[#1f242129] py-3 last:border-b-0">
      <div className="min-w-0">
        <p className="m-0 overflow-hidden text-ellipsis whitespace-nowrap font-medium">@{account.username ?? account.xUserId}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {account.roles.length ? account.roles.map((role) => (
          <Form method="post" key={role} className="m-0">
            <input type="hidden" name="_intent" value="role" />
            <input type="hidden" name="userId" value={account.id} />
            <input type="hidden" name="role" value={role} />
            <button className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border border-[#1f242129] bg-white/50 px-3 text-sm font-medium text-[#1f2421] hover:border-[#8b343466] hover:text-[#8b3434]" type="submit" aria-label={`Remove ${role} from @${account.username ?? account.xUserId}`}>
              {role}
              <X size={14} aria-hidden="true" />
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
