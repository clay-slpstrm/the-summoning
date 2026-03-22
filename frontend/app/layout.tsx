import type { Metadata } from "next";
import "./globals.css";
import { WalletProvider } from "@/components/providers/WalletProvider";
import { WebSocketProvider } from "@/components/providers/WebSocketProvider";

export const metadata: Metadata = {
  title: "The Summoning — A Lovecraftian Onchain Coordination Game",
  description:
    "Collectively burn $RITUAL tokens to breach the veil and summon Great Old Ones. Earn Eldritch Glyphs on every sacrifice.",
  openGraph: {
    title: "The Summoning",
    description: "The app that made Ethereum fun again.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <WalletProvider>
          <WebSocketProvider>{children}</WebSocketProvider>
        </WalletProvider>
      </body>
    </html>
  );
}
