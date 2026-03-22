"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { useAccount } from "wagmi";
import { useGlyphStore, type GlyphData } from "@/stores/glyphStore";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

/**
 * WebSocket provider for real-time glyph delivery.
 *
 * Connects to the backend WS server, authenticates with the user's
 * wallet address, and routes incoming messages to the appropriate store.
 *
 * See ARCHITECTURE.md Section 5.4 for specification.
 */

type WSContextType = {
  isConnected: boolean;
};

const WSContext = createContext<WSContextType>({ isConnected: false });

export function useWebSocket() {
  return useContext(WSContext);
}

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3001/ws";
const RECONNECT_DELAY = 3000;

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const { address } = useAccount();
  const wsRef = useRef<WebSocket | null>(null);
  const setRevealGlyph = useGlyphStore((s) => s.setRevealGlyph);
  const setGlyphs = useGlyphStore((s) => s.setGlyphs);

  useEffect(() => {
    if (!address) {
      // Close existing connection if wallet disconnects
      wsRef.current?.close();
      wsRef.current = null;
      return;
    }

    function connect() {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("[WS] Connected");
        ws.send(JSON.stringify({ type: "auth", wallet: address }));
        // Fetch REST on (re)connect to catch any glyphs missed while disconnected
        fetch(`${API_URL}/api/glyphs/${address!.toLowerCase()}`)
          .then((r) => r.json())
          .then((data: { glyphs: GlyphData[] }) => setGlyphs(data.glyphs))
          .catch(() => { /* non-fatal */ });
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          switch (msg.type) {
            case "glyph_reveal":
              setRevealGlyph(msg.data);
              break;
            case "epoch_update":
              // TODO: Update epoch progress in store
              break;
            case "auth_ok":
              console.log("[WS] Authenticated as", msg.wallet);
              break;
          }
        } catch {
          // Ignore malformed messages
        }
      };

      ws.onclose = () => {
        console.log("[WS] Disconnected, reconnecting...");
        setTimeout(connect, RECONNECT_DELAY);
      };

      ws.onerror = (error) => {
        console.error("[WS] Error:", error);
        ws.close();
      };
    }

    connect();

    return () => {
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [address, setRevealGlyph, setGlyphs]);

  return (
    <WSContext.Provider value={{ isConnected: !!wsRef.current }}>
      {children}
    </WSContext.Provider>
  );
}
