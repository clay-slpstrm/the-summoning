/**
 * In-memory liveness signal. Event handlers tick this whenever they successfully
 * process an on-chain event; the /api/health endpoint reads it and returns 503
 * when the indexer has drifted too far behind chain head.
 *
 * Resets on process restart, which is fine — external monitoring polls the
 * endpoint every few minutes and will see the post-restart values.
 */

let lastEventAt: number = Date.now();
let lastEventLabel: string = "boot";

export function recordEvent(label: string): void {
  lastEventAt = Date.now();
  lastEventLabel = label;
}

export function getHeartbeat(): { lastEventAt: number; lastEventLabel: string; ageMs: number } {
  return {
    lastEventAt,
    lastEventLabel,
    ageMs: Date.now() - lastEventAt,
  };
}
