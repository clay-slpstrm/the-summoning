"use client";

import { useState, useEffect } from "react";

function formatDuration(seconds: number): string {
  if (seconds <= 0) return "00:00:00";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

export default function Countdown({ targetTimestamp }: { targetTimestamp: number }) {
  const [remaining, setRemaining] = useState(
    Math.max(0, targetTimestamp - Math.floor(Date.now() / 1000))
  );

  useEffect(() => {
    const tick = () =>
      setRemaining(Math.max(0, targetTimestamp - Math.floor(Date.now() / 1000)));
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetTimestamp]);

  return <span>{formatDuration(remaining)}</span>;
}
