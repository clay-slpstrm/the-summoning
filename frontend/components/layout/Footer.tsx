"use client";

/**
 * Site footer: social links + navigation, shown at the bottom of the main
 * page and the about page. Social links are env-driven and hidden when unset.
 */

import Link from "next/link";

const X_URL = process.env.NEXT_PUBLIC_X_URL || "";
const DISCORD_URL = process.env.NEXT_PUBLIC_DISCORD_URL || "";

const linkClass =
  "text-[12px] sm:text-[13px] font-mono font-bold tracking-[2px] uppercase text-gray-400 hover:text-ritual-light transition-colors no-underline";

export default function Footer({ showAbout = false }: { showAbout?: boolean }) {
  return (
    <footer className="mt-14 sm:mt-20 pt-8 pb-10 border-t border-void-border">
      <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
        {X_URL && (
          <a href={X_URL} target="_blank" rel="noopener noreferrer" className={linkClass}>
            Follow on X
          </a>
        )}
        {DISCORD_URL && (
          <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer" className={linkClass}>
            Join the Cult
          </a>
        )}
        {showAbout ? (
          <Link href="/about" className={linkClass}>
            How it works
          </Link>
        ) : (
          <Link href="/" className={linkClass}>
            The Ritual
          </Link>
        )}
        <Link href="/codex" className={linkClass}>
          How it runs
        </Link>
      </div>
      <p className="text-center text-[11px] font-mono font-bold tracking-[2px] uppercase text-gray-500 mt-5">
        No promises. Only rituals.
      </p>
    </footer>
  );
}
