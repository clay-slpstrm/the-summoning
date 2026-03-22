/**
 * useGlyphs
 *
 * Hydrates the glyph collection from the backend REST API whenever the
 * connected wallet changes. Returns loading/error state so the UI can
 * show skeletons while the fetch is in flight.
 *
 * Real-time updates arrive via WebSocketProvider which calls setRevealGlyph.
 * On WS reconnect, WebSocketProvider re-fetches from REST to catch any
 * glyphs that arrived while disconnected.
 *
 * See ARCHITECTURE.md Section 5.4 for spec.
 */

"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { useGlyphStore, type GlyphData } from "@/stores/glyphStore";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export function useGlyphs() {
  const { address } = useAccount();
  const setGlyphs = useGlyphStore((s) => s.setGlyphs);
  const glyphs = useGlyphStore((s) => s.glyphs);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!address) {
      setGlyphs([]);
      return;
    }

    let cancelled = false;

    async function fetchGlyphs() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_URL}/api/glyphs/${address!.toLowerCase()}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json() as { glyphs: GlyphData[] };
        if (!cancelled) setGlyphs(data.glyphs);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load glyphs");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    fetchGlyphs();

    return () => {
      cancelled = true;
    };
  }, [address, setGlyphs]);

  return { glyphs, isLoading, error };
}
