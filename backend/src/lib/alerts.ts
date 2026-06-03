/**
 * Lightweight alert dispatcher. Logs to console always; also posts to a Discord
 * webhook when ALERT_WEBHOOK_URL is set.
 *
 * Designed to be easy to swap for a fuller alerting stack (PagerDuty, Opsgenie)
 * later by replacing the dispatch implementation. The call sites only need a
 * type tag + structured payload.
 */

const DISCORD_WEBHOOK_URL = process.env.ALERT_WEBHOOK_URL || "";
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || "";

export type AlertType =
  | "stuck_vrf"
  | "low_link"
  | "backend_unhealthy"
  | "event_listener_lagging";

export type AlertPayload = {
  type: AlertType;
  summary: string;
  details?: Record<string, unknown>;
};

export async function sendAlert(payload: AlertPayload): Promise<void> {
  const line = `[ALERT:${payload.type}] ${payload.summary}`;
  console.error(line, payload.details ?? {});

  // Fire to every configured channel in parallel. Each is independent — set
  // one, both, or neither. Channel failures don't block the others.
  await Promise.allSettled([
    dispatchDiscord(payload),
    dispatchTelegram(payload),
  ]);
}

async function dispatchDiscord(payload: AlertPayload): Promise<void> {
  if (!DISCORD_WEBHOOK_URL) return;
  try {
    const fields = Object.entries(payload.details ?? {}).map(([name, value]) => ({
      name,
      value: typeof value === "object" ? JSON.stringify(value) : String(value),
      inline: false,
    }));
    await fetch(DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "Summoning Watcher",
        embeds: [
          {
            title: `🚨 ${payload.summary}`,
            color: payload.type === "low_link" ? 0xfcd34d : 0xef4444,
            fields,
            footer: { text: `alert.type=${payload.type}` },
            timestamp: new Date().toISOString(),
          },
        ],
      }),
    });
  } catch (err) {
    console.error("[ALERT] Discord dispatch failed:", (err as Error).message);
  }
}

async function dispatchTelegram(payload: AlertPayload): Promise<void> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;
  try {
    // Telegram supports HTML and MarkdownV2; use HTML — easier to escape.
    const detailLines = Object.entries(payload.details ?? {})
      .map(
        ([k, v]) =>
          `<b>${escapeHtml(k)}:</b> <code>${escapeHtml(
            typeof v === "object" ? JSON.stringify(v) : String(v),
          )}</code>`,
      )
      .join("\n");
    const text =
      `🚨 <b>${escapeHtml(payload.summary)}</b>\n` +
      `alert.type=<code>${payload.type}</code>\n\n` +
      detailLines;

    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
  } catch (err) {
    console.error("[ALERT] Telegram dispatch failed:", (err as Error).message);
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
