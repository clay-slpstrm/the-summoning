/**
 * Lightweight alert dispatcher. Logs to console always; also posts to a Discord
 * webhook when ALERT_WEBHOOK_URL is set.
 *
 * Designed to be easy to swap for a fuller alerting stack (PagerDuty, Opsgenie)
 * later by replacing the dispatch implementation. The call sites only need a
 * type tag + structured payload.
 */

const WEBHOOK_URL = process.env.ALERT_WEBHOOK_URL || "";

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

  if (!WEBHOOK_URL) return;

  try {
    const fields = Object.entries(payload.details ?? {}).map(([name, value]) => ({
      name,
      value: typeof value === "object" ? JSON.stringify(value) : String(value),
      inline: false,
    }));
    await fetch(WEBHOOK_URL, {
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
    console.error("[ALERT] dispatch failed:", (err as Error).message);
  }
}
