import type { Metadata } from "next";
import "./globals.css";
import { WalletProvider } from "@/components/providers/WalletProvider";
import { WebSocketProvider } from "@/components/providers/WebSocketProvider";

export const metadata: Metadata = {
  metadataBase: new URL("https://thesummoning.xyz"),
  title: "The Summoning: A Lovecraftian Onchain Coordination Game",
  description:
    "Collectively burn $RITUAL tokens to breach the veil and summon Great Old Ones. Earn Eldritch Glyphs on every sacrifice.",
  openGraph: {
    title: "The Summoning",
    description:
      "Make Ethereum fun again. Burn $RITUAL, earn provably fair Eldritch Glyphs, summon the Old Ones.",
    url: "https://thesummoning.xyz",
    siteName: "The Summoning",
    type: "website",
    images: [
      {
        url: "/og.jpg",
        width: 1200,
        height: 630,
        alt: "The Summoning: a Great Old One stirs beyond the portal",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "The Summoning",
    description:
      "Make Ethereum fun again. Burn $RITUAL, earn provably fair Eldritch Glyphs, summon the Old Ones.",
    images: ["/og.jpg"],
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
