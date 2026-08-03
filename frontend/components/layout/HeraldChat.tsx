"use client";

/**
 * The Herald — a summonable, openly-AI chat oracle.
 *
 * A floating sigil in the corner; click to summon. Talks to the guardrailed
 * /api/herald endpoint (pull-only: it never speaks unless asked). Transparent
 * about being an AI. Renders only when NEXT_PUBLIC_API_URL is set.
 */

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";
// Explicit go-live flag so the sigil only appears once the backend /api/herald
// endpoint is deployed with an ANTHROPIC_API_KEY. Set NEXT_PUBLIC_HERALD_ENABLED=1
// at build time to summon it.
const ENABLED = process.env.NEXT_PUBLIC_HERALD_ENABLED === "1";

type Msg = { role: "user" | "assistant"; content: string };

const GREETING =
  "You have summoned the Herald. I am an oracle bound in silicon, mouthpiece of the cult. Ask, mortal, and I shall answer truly. What would you know of The Summoning?";

export default function HeraldChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  if (!API_URL || !ENABLED) return null;

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/herald`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Send only the trailing turns; the server also caps history.
        body: JSON.stringify({ messages: next.slice(-12) }),
      });
      const data = (await res.json()) as { reply?: string };
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: data.reply || "The veil is silent. Try again.",
        },
      ]);
    } catch {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: "The veil is silent. Try again." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Summon sigil */}
      <button
        aria-label="Summon the Herald"
        onClick={() => {
          setOpen((o) => !o);
          if (messages.length === 0)
            setMessages([{ role: "assistant", content: GREETING }]);
        }}
        className="fixed bottom-5 right-5 z-40 w-14 h-14 rounded-full flex items-center justify-center text-2xl cursor-pointer border-none"
        style={{
          background: "linear-gradient(135deg, #4c1d95, #7c3aed)",
          color: "#efe9ff",
          boxShadow: "0 0 24px #7c3aed66, 0 0 8px #7c3aed",
        }}
      >
        <span aria-hidden style={{ textShadow: "0 0 12px #c4b5fd" }}>
          {open ? "×" : "◈"}
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ duration: 0.28, ease: [0.25, 0.1, 0.25, 1] }}
            className="fixed bottom-24 right-5 z-40 w-[92vw] max-w-sm rounded-2xl overflow-hidden flex flex-col"
            style={{
              height: "min(70vh, 520px)",
              background: "linear-gradient(160deg, #14101f 0%, #0d0d15 60%)",
              border: "1px solid #7c3aed66",
              boxShadow: "0 0 60px #7c3aed40",
            }}
          >
            {/* Header */}
            <div
              className="px-4 py-3 flex items-center gap-3"
              style={{ borderBottom: "1px solid #1e1e2e" }}
            >
              <span
                className="text-xl text-ritual-light"
                aria-hidden
                style={{ textShadow: "0 0 14px #7c3aed" }}
              >
                &#9672;
              </span>
              <div>
                <div className="text-[13px] font-mono font-bold tracking-[2px] uppercase text-ritual-light">
                  The Herald
                </div>
                <div className="text-[10px] font-mono text-gray-500 tracking-wider">
                  An AI oracle &middot; summoned, never DMing first
                </div>
              </div>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
                >
                  <div
                    className={
                      "max-w-[85%] px-3.5 py-2.5 rounded-xl text-sm leading-relaxed " +
                      (m.role === "user" ? "font-mono" : "font-serif")
                    }
                    style={
                      m.role === "user"
                        ? { background: "#241a3a", color: "#e2e8f0" }
                        : { background: "#0d0d15", color: "#d8d2e8", border: "1px solid #7c3aed33" }
                    }
                  >
                    {m.content}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div
                    className="px-3.5 py-2.5 rounded-xl text-sm font-serif italic text-gray-400"
                    style={{ background: "#0d0d15", border: "1px solid #7c3aed33" }}
                  >
                    The Herald consults the void<span className="animate-pulse">...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="px-3 py-3 flex gap-2" style={{ borderTop: "1px solid #1e1e2e" }}>
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                maxLength={500}
                placeholder="Speak your question..."
                className="flex-1 px-3 py-2 rounded-lg text-sm font-serif bg-transparent text-gray-200 outline-none"
                style={{ background: "#0d0d15", border: "1px solid #1e1e2e" }}
              />
              <button
                onClick={send}
                disabled={loading || !input.trim()}
                className="px-4 rounded-lg text-[12px] font-mono font-bold tracking-[2px] uppercase cursor-pointer border-none disabled:opacity-40"
                style={{ background: "linear-gradient(135deg, #4c1d95, #7c3aed)", color: "#efe9ff" }}
              >
                Ask
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
