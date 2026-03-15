/**
 * WebSocket session manager.
 *
 * Manages per-wallet WebSocket connections for real-time glyph delivery.
 * See ARCHITECTURE.md Section 4.4 for specification.
 */

import { WebSocketServer, WebSocket } from "ws";

class WSManager {
  private connections = new Map<string, Set<WebSocket>>();

  attach(wss: WebSocketServer): void {
    wss.on("connection", (ws) => {
      ws.on("message", (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === "auth" && typeof msg.wallet === "string") {
            const wallet = msg.wallet.toLowerCase();
            if (!this.connections.has(wallet)) {
              this.connections.set(wallet, new Set());
            }
            this.connections.get(wallet)!.add(ws);

            ws.on("close", () => {
              this.connections.get(wallet)?.delete(ws);
              if (this.connections.get(wallet)?.size === 0) {
                this.connections.delete(wallet);
              }
            });

            // Acknowledge auth
            ws.send(JSON.stringify({ type: "auth_ok", wallet }));
          }
        } catch {
          // Ignore malformed messages
        }
      });
    });

    console.log("[WS] Manager attached");
  }

  sendToWallet(wallet: string, payload: object): void {
    const sockets = this.connections.get(wallet.toLowerCase());
    if (!sockets) return;

    const msg = JSON.stringify(payload);
    for (const ws of sockets) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(msg);
      }
    }
  }

  broadcast(payload: object): void {
    const msg = JSON.stringify(payload);
    for (const sockets of this.connections.values()) {
      for (const ws of sockets) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(msg);
        }
      }
    }
  }

  getConnectionCount(): number {
    let count = 0;
    for (const sockets of this.connections.values()) {
      count += sockets.size;
    }
    return count;
  }
}

export const wsManager = new WSManager();
