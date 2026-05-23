import { Info, X } from "lucide-react";
import { Form, redirect, useLoaderData } from "react-router";
import { AppShell } from "~/components/AppShell";
import { nominationTypes } from "~/domain/nominations";
import { roleNames, type RoleName } from "~/domain/roles";
import { getCurrentUser } from "~/lib/auth/session";
import { getRepositories } from "~/repositories/drizzle/repositories";
import { updateUserRole } from "~/services/role-service";
import { getSettings, updateSettings } from "~/services/settings-service";

const buttonClass = "cursor-pointer rounded-md border border-[#1f2421] bg-[#1f2421] px-3.5 py-2.5 text-[#fffaf0] disabled:cursor-not-allowed disabled:opacity-45";
const fieldClass = "min-h-[40px] rounded-md border border-[#1f242129] bg-white/55 px-3 py-2.5 outline-none focus:border-[#526f8d]";
const cardClass = "rounded-lg border border-[#1f242129] bg-[#fffcf47a] p-4";
const labelClass = "grid gap-1.5 text-sm font-medium";

export async function loader({ request, context }: any) {
  const user = await getCurrentUser(request, context);
  const repos = getRepositories(context.cloudflare.env);
  return {
    user,
    settings: await getSettings(context),
    users: await repos.users.listUsers(),
    visibleNominationCount: (await repos.nominations.listFeed({ viewerUserId: user?.id })).length,
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

  const current = await getSettings(context);
  const enabledNominationTypes = nominationTypes.filter((type) => formData.get(`enabledNominationTypes.${type}`) === "on");
  const maxImageUploadBytes = Math.max(1, Number(formData.get("maxImageUploadMegabytes"))) * 1024 * 1024;

  await updateSettings(context, user, {
    ...current,
    minimumTotalVotes: Number(formData.get("minimumTotalVotes")),
    minimumPositiveRatio: Number(formData.get("minimumPositiveRatio")),
    minimumPositiveMargin: Number(formData.get("minimumPositiveMargin")),
    minimumVotingAgeMinutes: Number(formData.get("minimumVotingAgeMinutes")),
    maximumVotingAgeDays: Number(formData.get("maximumVotingAgeDays")),
    publishingWorkflow: formData.get("publishingWorkflow"),
    creatorSelfVoteAllowed: formData.get("creatorSelfVoteAllowed") === "on",
    privilegedVotesCountTowardCriteria: formData.get("privilegedVotesCountTowardCriteria") === "on",
    deniedVisibleByDefault: formData.get("deniedVisibleByDefault") === "on",
    tweetAvatarMode: formData.get("tweetAvatarMode"),
    includeTweetAvatarInPublishedMedia: formData.get("includeTweetAvatarInPublishedMedia") === "on",
    enabledNominationTypes,
    automaticRoleAssignmentEnabled: formData.get("automaticRoleAssignmentEnabled") === "on",
    maxImageUploadBytes,
    hostUserId: String(formData.get("hostUserId") ?? ""),
    hostHandle: String(formData.get("hostHandle") ?? ""),
  });

  return redirect("/settings");
}

export default function Settings() {
  const { user, settings, users, visibleNominationCount } = useLoaderData<typeof loader>();
  const maxImageUploadMb = Math.max(1, Math.round(settings.maxImageUploadBytes / 1024 / 1024));

  return (
    <AppShell user={user}>
      <main className="grid gap-5 py-[42px] pb-20">
        <header className="grid gap-2">
          <h1 className="m-0 font-serif text-[clamp(2rem,5vw,4.8rem)] leading-[0.95] font-medium">Settings</h1>
        </header>

        <section className={cardClass}>
          <p className="m-0 text-[0.68rem] uppercase tracking-[0.08em] text-[#6e716b]">Account</p>
          <div className="mt-2 grid gap-1 md:grid-cols-[1fr_auto] md:items-end">
            <div>
              <h2 className="m-0 text-xl font-medium">{user ? `@${user.username ?? "me"}` : "Signed out"}</h2>
              <p className="m-0 text-[#6e716b]">Roles: {user?.roles.join(", ") || "none"}</p>
            </div>
            <p className="m-0 text-[#6e716b]">Visible nominations: {visibleNominationCount}</p>
          </div>
        </section>

        <Form method="post" className="grid gap-5">
          <section className={`${cardClass} grid gap-4`}>
            <SectionHeader title="Voting" />
            <div className="grid max-w-[640px] gap-3">
              <label className={labelClass}>
                <LabelText text="Votes needed" info="How many total votes a nomination needs before it can qualify." />
                <input className={fieldClass} name="minimumTotalVotes" type="number" min={1} defaultValue={settings.minimumTotalVotes} />
              </label>
              <label className={labelClass}>
                <LabelText text="Approval percentage" info="The share of positive votes needed. 0.6 means 60%." />
                <input className={fieldClass} name="minimumPositiveRatio" type="number" min={0} max={1} step="0.01" defaultValue={settings.minimumPositiveRatio} />
              </label>
              <label className={labelClass}>
                <LabelText text="Approval lead" info="How many more positive votes than negative votes are required." />
                <input className={fieldClass} name="minimumPositiveMargin" type="number" defaultValue={settings.minimumPositiveMargin} />
              </label>
              <label className={labelClass}>
                <LabelText text="Minimum voting duration" info="How long voting must stay open before a nomination can qualify." />
                <input className={fieldClass} name="minimumVotingAgeMinutes" type="number" min={0} defaultValue={settings.minimumVotingAgeMinutes} />
              </label>
              <label className={labelClass}>
                <LabelText text="Maximum voting duration" info="How long voting can stay open before it expires." />
                <input className={fieldClass} name="maximumVotingAgeDays" type="number" min={1} defaultValue={settings.maximumVotingAgeDays} />
              </label>
            </div>
            <div className="grid max-w-[640px] gap-2">
              <Toggle name="creatorSelfVoteAllowed" defaultChecked={settings.creatorSelfVoteAllowed} title="Creator self-votes" info="Let people vote on nominations they created." />
              <Toggle name="privilegedVotesCountTowardCriteria" defaultChecked={settings.privilegedVotesCountTowardCriteria} title="Staff votes count" info="Count host, admin, and publisher votes toward approval rules." />
              <Toggle name="deniedVisibleByDefault" defaultChecked={settings.deniedVisibleByDefault} title="Show denied nominations" info="Keep denied nominations visible in normal views." />
            </div>
          </section>

          <section className={`${cardClass} grid gap-4`}>
            <SectionHeader title="Publishing" />
            <div className="grid max-w-[640px] gap-3">
              <label className={labelClass}>
                <LabelText text="Publishing workflow" info="Choose whether qualified nominations go to review or publish automatically." />
                <select className={fieldClass} name="publishingWorkflow" defaultValue={settings.publishingWorkflow}>
                  <option value="manual_review_when_qualified">Review before publishing</option>
                  <option value="auto_send_when_qualified">Publish automatically</option>
                </select>
              </label>
              <label className={labelClass}>
                <LabelText text="Tweet avatar uploads" info="Controls whether nomination forms can collect an avatar image for the source tweet." />
                <select className={fieldClass} name="tweetAvatarMode" defaultValue={settings.tweetAvatarMode}>
                  <option value="disabled">Off</option>
                  <option value="optional">Optional</option>
                  <option value="required">Required</option>
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
            <div className="grid max-w-[640px] gap-2">
              <Toggle name="includeTweetAvatarInPublishedMedia" defaultChecked={settings.includeTweetAvatarInPublishedMedia} title="Use avatars in publish images" info="Include uploaded tweet avatars in generated media for published posts." />
              <Toggle name="automaticRoleAssignmentEnabled" defaultChecked={settings.automaticRoleAssignmentEnabled} title="Automatic role assignment" info="Assign default roles automatically when users sign in." />
            </div>
          </section>

          <section className={`${cardClass} grid gap-4`}>
            <SectionHeader title="Nomination Types" />
            <div className="grid max-w-[640px] gap-2">
              {nominationTypes.map((type) => (
                <Toggle key={type} name={`enabledNominationTypes.${type}`} defaultChecked={settings.enabledNominationTypes.includes(type)} title={nominationTypeTitle(type)} info={nominationTypeInfo(type)} />
              ))}
            </div>
          </section>

          <div className="sticky bottom-3 z-10 flex justify-end">
            <button className={buttonClass}>Save settings</button>
          </div>
        </Form>

        <section id="roles" className={`${cardClass} grid gap-4 scroll-mt-6`}>
          <SectionHeader title="Roles" />
          <div className="grid gap-2">
            {users.map((account) => (
              <RoleEditor key={account.id} account={account} />
            ))}
          </div>
        </section>
      </main>
    </AppShell>
  );
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
