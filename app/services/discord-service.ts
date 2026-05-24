import type { AppLoadContext } from "react-router";
import { nominationTypeLabel, type Nomination } from "~/domain/nominations";
import type { VoteSummary } from "~/domain/votes";
import { getRepositories } from "~/repositories/drizzle/repositories";
import type { CurrentUser } from "~/repositories/interfaces";

type DiscordEnv = {
  DISCORD_BOT_TOKEN?: string;
  DISCORD_CHANNEL_ID?: string;
};

type DiscordNotification =
  | {
      kind: "new_nomination";
      nomination: Nomination;
      actor: CurrentUser;
    }
  | {
      kind: "nomination_qualified";
      nomination: Nomination;
      summary: VoteSummary;
    };

export async function sendDiscordTestMessage(context: AppLoadContext) {
  const env = context.cloudflare.env;
  if (!env.DISCORD_BOT_TOKEN || !env.DISCORD_CHANNEL_ID) {
    return { ok: false as const, reason: "missing_config" as const };
  }

  await sendDiscordMessage(env, {
    content: "Hello world from Plurmurate.",
  });
  return { ok: true as const };
}

export function queueDiscordNotification(context: AppLoadContext, notification: DiscordNotification) {
  const promise = reserveAndSendDiscordNotification(context, notification);
  context.cloudflare.ctx.waitUntil(promise);
}

async function reserveAndSendDiscordNotification(context: AppLoadContext, notification: DiscordNotification) {
  const repos = getRepositories(context.cloudflare.env);
  const notificationId = await repos.discordNotifications.reserve({
    kind: notification.kind,
    entityType: "nomination",
    entityId: notification.nomination.id,
  });
  if (!notificationId) return;

  try {
    await sendDiscordNotification(context.cloudflare.env, notification);
    await repos.discordNotifications.markSent(notificationId);
  } catch (error) {
    await repos.discordNotifications.markFailed(notificationId, error).catch((markError) => {
      console.warn("Discord notification failure tracking failed", markError);
    });
    console.warn("Discord notification failed", error);
  }
}

async function sendDiscordNotification(env: DiscordEnv, notification: DiscordNotification) {
  return sendDiscordMessage(env, buildDiscordMessage(notification));
}

async function sendDiscordMessage(env: DiscordEnv, message: unknown) {
  if (!env.DISCORD_BOT_TOKEN || !env.DISCORD_CHANNEL_ID) return;
  const response = await fetch(`https://discord.com/api/v10/channels/${env.DISCORD_CHANNEL_ID}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(message),
  });
  if (!response.ok) {
    throw new Error(`Discord API returned ${response.status}: ${await response.text()}`);
  }
}

function buildDiscordMessage(notification: DiscordNotification) {
  const nomination = notification.nomination;
  const title = notification.kind === "new_nomination" ? "New nomination" : "Nomination qualified";
  const description = nomination.text || nomination.targetTweetUrl || nomination.rationale || "No text provided.";
  const fields = [
    { name: "Type", value: nominationTypeLabel(nomination.type), inline: true },
    { name: "Status", value: notification.kind === "new_nomination" ? nomination.status : "qualified", inline: true },
  ];

  if (notification.kind === "new_nomination") {
    const name = notification.actor.displayName || notification.actor.username || notification.actor.xUserId;
    fields.push({ name: "Submitted by", value: notification.actor.username ? `@${notification.actor.username}` : name, inline: true });
  } else {
    fields.push(
      { name: "Votes", value: `A ${notification.summary.a} / B ${notification.summary.b} / U ${notification.summary.u}`, inline: true },
      { name: "Positive ratio", value: `${Math.round(notification.summary.positiveRatio * 100)}%`, inline: true },
      { name: "Margin", value: String(notification.summary.positiveMargin), inline: true },
    );
  }

  return {
    content: notification.kind === "new_nomination" ? "A new nomination was submitted." : "A nomination is qualified and ready for review.",
    embeds: [
      {
        title,
        description: truncate(description, 500),
        fields,
        timestamp: new Date().toISOString(),
      },
    ],
  };
}

function truncate(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1)}...`;
}
