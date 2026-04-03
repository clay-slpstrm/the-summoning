# The Summoning — Product Requirements Document

> **Purpose**: This document defines what to build and why. It specifies every feature, user story, acceptance criterion, and design requirement for The Summoning V1. When building with Claude Code, reference this for product decisions. Reference `ARCHITECTURE.md` for technical implementation details.
>
> **Version**: 1.0 | March 2026
> **Target Launch**: 4–6 weeks from kickoff
> **Platform**: Ethereum Mainnet (Sepolia for testnet)

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [User Personas](#2-user-personas)
3. [Core Game Loop](#3-core-game-loop)
4. [Feature Specifications](#4-feature-specifications)
5. [Eldritch Glyph System](#5-eldritch-glyph-system)
6. [Portal Visualization](#6-portal-visualization)
7. [Cult Rank System](#7-cult-rank-system)
8. [Design System & Visual Identity](#8-design-system--visual-identity)
9. [Copy & Lore](#9-copy--lore)
10. [Priority & Scope](#10-priority--scope)
11. [Success Metrics](#11-success-metrics)
12. [Known Constraints & Tradeoffs](#12-known-constraints--tradeoffs)

---

## 1. Product Overview

### 1.1 One-Line Description

A Lovecraftian onchain coordination game where players collectively burn tokens to summon eldritch beings, earning gacha-style micro-rewards on every sacrifice and tiered NFT artifacts on successful summonings.

### 1.2 Core Thesis

Crypto needs to be fun again. The Summoning combines collective coordination (the reason people come back next week) with individual gacha pulls (the reason people sacrifice five more times this session) to create engagement mechanics comparable to the most successful mobile games — deployed on Ethereum mainnet at historic low gas costs.

### 1.3 What This Is NOT

- NOT a financial product. $RITUAL is a consumable game token, not an investment.
- NOT a speculative token launch. There is no yield, staking, or profit mechanism.
- NOT an NFT art project. ERC-1155 artifacts are status symbols earned through gameplay.
- NOT a DAO. The team controls epoch parameters in V1. Governance is a V2 consideration.

### 1.4 Revenue Model

Users deposit ETH into a dynamic minting curve to mint $RITUAL tokens. A 12% protocol fee is extracted from every mint. All ETH in the contract is withdrawable by the multisig owner — there is no sell-back mechanism. $RITUAL tokens are burned (destroyed permanently) during gameplay. Revenue = 12% of all ETH deposited + 5% royalties on secondary glyph NFT sales.

---

## 2. User Personas

### 2.1 The Degen (Primary)

- **Who**: Active crypto trader, 25–35, lives on Twitter/X and Discord
- **Motivation**: Wants dopamine, status, and something to tweet about
- **Behavior**: Will sacrifice 5–20 times per session chasing rare glyphs. Screenshots and shares rare pulls. Competes on leaderboards.
- **Session**: 10–30 minutes, multiple times per epoch
- **Spend**: 0.05–0.5 ETH per epoch

### 2.2 The Collector (Secondary)

- **Who**: NFT enthusiast, cares about building a complete set
- **Motivation**: Wants every glyph tier, every epoch artifact, highest cult rank
- **Behavior**: Participates in every epoch. Tracks tier counts obsessively. Will sacrifice extra times to try for missing tiers.
- **Session**: 15–45 minutes, concentrated around ritual phases
- **Spend**: 0.1–1.0 ETH per epoch

### 2.3 The Whale (Tertiary)

- **Who**: High net worth crypto native, wants Harbinger status
- **Motivation**: Top of the leaderboard, rarest artifacts, community recognition
- **Behavior**: Large single sacrifices. Aims for top 1% contribution per epoch.
- **Session**: Brief but high-value interactions
- **Spend**: 1.0–10.0 ETH per epoch

### 2.4 The Curious Newcomer (Growth Target)

- **Who**: Sees a tweet about a rare glyph pull or the portal animation
- **Motivation**: "What is this? That looks cool. I want to try."
- **Behavior**: Connects wallet, mints a small amount, does 2–3 sacrifices
- **Session**: 5–10 minutes, may or may not return
- **Spend**: 0.01–0.05 ETH

---

## 3. Core Game Loop

### 3.1 Macro Loop (Epoch-Level)

```
New Old One announced → Players mint $RITUAL → Community coordinates →
Players sacrifice $RITUAL during Ritual Phase → Threshold met? →
YES: Old One summoned, participants claim tiered ERC-1155 artifacts →
  Next epoch threshold increases 1.3x
NO: Sacrifice was made but summoning failed, consolation artifacts →
  Next epoch threshold decreases 20%
→ Next Old One announced → Repeat
```

**Epoch cadence**: 3 days total (48h Gathering + 24h Ritual), with ~1 day gap between epochs. Target: 2 epochs per week during active periods.

### 3.2 Micro Loop (Session-Level — The Gacha)

```
Player selects sacrifice amount → Clicks "Perform Sacrifice" →
Transaction submitted → "Channeling..." animation (fills ~12s confirmation) →
WebSocket delivers glyph assignment → Full-screen glyph reveal animation →
Tier revealed (Whisper/Echo/Tremor/Rupture/Breach) →
Player taps to dismiss → Glyph added to collection → Cult rank bar updates →
Player wants another pull → Repeat
```

**This micro loop is the most important product feature.** The entire engagement thesis depends on users wanting to sacrifice again immediately after seeing their glyph reveal. Every design decision in the sacrifice flow should optimize for this compulsion.

### 3.3 Engagement Triggers

| Trigger | Mechanism | Target Emotion |
|---------|-----------|----------------|
| Variable reward | 5-tier glyph rarity on every sacrifice | Anticipation → surprise |
| Collection progress | Glyph grid fills up, tier counts increment | Completionism |
| Status progression | Cult rank bar advances toward next rank | Achievement |
| Social pressure | Portal visually advances with collective burns | FOMO, coordination |
| Scarcity | Epoch time limit creates urgency | Urgency |
| Near-miss | "Almost got a Tremor" (15% chance feels close) | "One more try" |

---

## 4. Feature Specifications

### 4.1 F1: Wallet Connection

**Description**: Users connect an Ethereum wallet to interact with the application.

**User Story**: As a user, I want to connect my wallet so I can mint $RITUAL and participate in summonings.

**Acceptance Criteria**:
- Support MetaMask, WalletConnect, and Coinbase Wallet via wagmi
- Display connected wallet address (truncated: 0x1234...abcd)
- Show ENS name if available
- Persist connection across page refreshes (wagmi autoConnect)
- Show $RITUAL balance prominently after connection
- Show ETH balance (needed for gas + minting)
- Disconnect button accessible from header
- If wrong chain: prompt to switch to Ethereum mainnet

**Priority**: P0 — Launch

---

### 4.2 F2: Minting Curve Interface

**Description**: Users deposit ETH to mint $RITUAL tokens via the minting curve.

**User Story**: As a user, I want to buy $RITUAL tokens with ETH so I can participate in summoning rituals.

**Acceptance Criteria**:
- ETH input field with max button (sets to full ETH balance minus gas buffer)
- Real-time preview: "You will receive approximately X $RITUAL"
- Current price per token displayed
- Price impact warning if mint is >5% of current supply
- Slippage tolerance selector (default 1%, options: 0.5%, 1%, 3%)
- "Mint $RITUAL" button → sends transaction → shows confirmation
- After confirmation: $RITUAL balance updates, success message
- Error handling: insufficient ETH, slippage exceeded, user rejection

**UI Notes**:
- This is a secondary interface. Most users should be directed to sacrifice first (if they already have $RITUAL) and only see the mint interface when their balance is low.
- Consider a combined flow: "You need X more $RITUAL. Mint now?" inline in the sacrifice panel.

**Priority**: P0 — Launch

---

### 4.3 F3: Sacrifice Interface

**Description**: Users commit $RITUAL tokens to the current epoch's summoning ritual. Each sacrifice triggers a glyph reveal.

**User Story**: As a user, I want to sacrifice my $RITUAL tokens to help summon the Old One and receive an Eldritch Glyph.

**Acceptance Criteria**:
- Amount input field + quick-select buttons (100, 500, 1000 $RITUAL)
- Display current $RITUAL balance
- "SACRIFICE" button — prominent, thematic, unmissable
- Before first sacrifice: check if SummoningEngine has approval. If not, show "APPROVE & SACRIFICE" (handles both in sequence).
- Button states:
  - **Idle**: Purple gradient, "⬡ SACRIFICE $RITUAL"
  - **Approving**: "APPROVE & SACRIFICE" / "CONFIRM IN WALLET..."
  - **Sacrificing**: "SACRIFICING..." with loading animation
  - **Success**: "SACRIFICE ACCEPTED" briefly, then resets
  - **Cooldown**: Dimmed, shows countdown timer (30 seconds)
  - **Disabled**: Gray, insufficient balance or wrong epoch phase
- After sacrifice tx confirms: "VRF requested — channeling your glyph..." text appears
- Full-screen ChannelingOverlay activates during Chainlink VRF wait (~30-60s)
- VRF callback triggers GlyphReveal overlay via WebSocket `glyph_reveal`
- Cooldown: 30 seconds between sacrifices (enforced on-chain, reflected in UI)
- Only visible during Ritual phase (hidden otherwise)
- Error states: insufficient balance, cooldown active, epoch not in Ritual phase, user rejected tx

**Critical UX Requirement**: The time between clicking "Sacrifice" and seeing the glyph reveal includes a ~30-60 second Chainlink VRF wait. The ChannelingOverlay fills this gap with rotating lore text and atmospheric animations, making the wait feel like the void is deciding the user's fate rather than idle loading.

**Priority**: P0 — Launch

---

### 4.4 F4: Glyph Reveal Animation

**Description**: Full-screen animated reveal when a user receives a new Eldritch Glyph after sacrifice. This is the gacha "pull" moment.

**User Story**: As a user, I want a dramatic reveal experience when I sacrifice so I feel excited about what I got and want to do it again.

**Acceptance Criteria**:
- Full-screen overlay with backdrop blur and dark background
- 4-phase animation sequence with **rarity-scaled timing** (longer suspense for rarer tiers):
  - **Phase 1 — Channeling (0→100ms)**: Card scales from 0.5 to 1.0, spinning channeling symbol (✦), dark background. Spinner is faster and tier-colored for rare+ tiers.
  - **Phase 2 — Manifestation**: Spinning symbol replaced by glyph rune. Background transitions to tier-colored gradient. Glow effect scales based on tier rarity. Tier color immediately signals rarity. Timing: ~1000ms for common, ~1720ms for Tremor, ~2200ms for Rupture/Breach.
  - **Phase 3 — Reveal**: Tier name fades in ("ECHO GLYPH"), lore text fades in. For Tremor+: "★ RARE ★" label. For Rupture+: "✦ LEGENDARY ✦" label. For Breach: screen shake effect + extended glow. Timing: ~2000ms for common, ~3440ms for Tremor, ~4400ms for Rupture/Breach.
  - **Phase 4 — Dismiss**: "TAP TO CONTINUE" text appears. Click/tap anywhere dismisses overlay. Glyph animates to collection grid.
- Total animation time: ~2s for common tiers (Whisper, Echo), ~3.4s for Tremor, ~4.4s for rare tiers (Rupture, Breach)
- Tier-specific visual treatments:
  - **Whisper**: Gray glow, subtle, brief
  - **Echo**: Blue glow, moderate
  - **Tremor**: Purple glow, "RARE" label, expanded glow radius
  - **Rupture**: Gold glow, "LEGENDARY" badge, full-screen flash
  - **Breach**: Red glow, screen shake, ambient color shift, extended animation
- Must not block the user from sacrificing again. Tapping dismiss should immediately return to sacrifice interface.
- Animations should use Framer Motion for smooth 60fps performance

**Design Principle**: The reveal must feel like a reward, not an interruption. Common tiers should be fast and satisfying. Rare tiers should be dramatic enough to screenshot. The user should NEVER feel like the animation is slowing them down.

**Priority**: P0 — Launch (this IS the product)

---

### 4.5 F5: Glyph Collection

**Description**: Visual grid displaying all glyphs a user has collected, with tier color coding and tooltips.

**User Story**: As a user, I want to see all my collected glyphs in a grid so I can track my progress and admire my collection.

**Acceptance Criteria**:
- Grid layout: `repeat(auto-fill, minmax(52px, 1fr))` — responsive, fills available width
- Each cell shows the rune symbol with tier-colored glow and background
- Newest glyph animates in with `glyph-enter` animation (scale 0.5→1, cubic-bezier bounce, 0.5s), a "NEW" badge in the tier color, and a double-intensity glow
- Hover/tap on glyph shows tooltip: tier name, rune, lore text. Hover scales the rune symbol (1.25x)
- Sort order: newest first (most recent glyph top-left)
- Tier count summary bar above grid: shows count per tier (e.g., "Whisper: 12, Echo: 7, Tremor: 3, Rupture: 1, Breach: 0")
- Each tier count uses the tier's signature color
- Empty state: "No glyphs yet. Perform a sacrifice to receive your first glyph."
- Accessible via "Glyphs" tab in the main navigation

**Priority**: P0 — Launch

---

### 4.6 F6: Epoch Status & Progress

**Description**: Real-time display of current epoch information, phase, countdown, and collective progress.

**User Story**: As a user, I want to see the current epoch status so I know when to participate and how close we are to summoning.

**Acceptance Criteria**:
- Epoch status bar at top of page showing:
  - Current phase (Gathering / Ritual / Resolved) with colored indicator
  - Countdown timer to next phase transition (HH:MM:SS, updates every second)
  - Old One name/identity for current epoch
  - User's cult rank (with rank color)
- Collective progress indicator:
  - Shows "X.XXM burned / Y.YYM needed"
  - Progress bar fills left to right
  - Bar color shifts from purple to red as progress approaches 100%
  - Glow effect intensifies as threshold approaches
- Updates in real-time via WebSocket (backend broadcasts on each sacrifice)
- When epoch resolves:
  - Success: celebratory animation, "THE OLD ONE HAS BEEN SUMMONED" message
  - Failure: somber animation, "The summoning failed... the veil holds... for now."

**Priority**: P0 — Launch

---

### 4.7 F7: Cult Rank Bar

**Description**: Visual indicator of user's cult rank progression based on total glyph count.

**User Story**: As a user, I want to see my cult rank and how close I am to the next rank so I have a long-term goal to work toward.

**Acceptance Criteria**:
- Displays current rank name with rank-specific color
- Shows distance to next rank: "X glyphs to [Next Rank Name]"
- Segmented progress bar showing all rank tiers, filled proportionally
- Each segment colored with the target rank's color
- On rank-up: celebration animation (glow pulse, text highlight)
- At max rank (Herald of the Breach): show "MAX RANK" indicator
- Persists across sessions (backend-calculated, loaded on connect)

**Rank Thresholds**:
| Rank | Glyphs Required | Color |
|------|----------------|-------|
| Uninitiated | 0 | #6B7280 |
| Whisperer | 3 | #8B8B8B |
| Echo Walker | 8 | #4A9EFF |
| Void Touched | 15 | #A855F7 |
| Rift Keeper | 25 | #F59E0B |
| Herald of the Breach | 40 | #EF4444 |

**Priority**: P0 — Launch

---

### 4.8 F8: Leaderboard

**Description**: Rankings showing top contributors and glyph collectors.

**User Story**: As a user, I want to see where I rank compared to other players so I can compete and flex my status.

**Acceptance Criteria**:
- Two views: "Top Contributors" (by $RITUAL burned this epoch) and "Top Collectors" (by total glyph count)
- Each entry shows: rank number, wallet address (truncated) or ENS name, cult rank badge, relevant metric
- Highlight current user's row if they appear in the top list
- Top 3 get special visual treatment (gold/silver/bronze or thematic equivalent)
- Paginated (top 50 initially, load more on scroll)
- Refreshes on page load, updates via WebSocket for live epochs

**Priority**: P1 — Week 2

---

### 4.9 F9: Artifact Gallery

**Description**: Display of user's ERC-1155 artifact holdings from successful summonings.

**User Story**: As a user, I want to view my earned artifacts from past summonings with their tier and epoch information.

**Acceptance Criteria**:
- Card-based layout showing each artifact
- Each card shows: artifact image (from metadata API), tier badge (Harbinger/Acolyte/Cultist/Shattered), epoch number, Old One name
- Tier-colored border and glow effects
- Click/tap opens detail view with full metadata
- Empty state: "No artifacts yet. Participate in a successful summoning to earn your first artifact."
- Links to view on OpenSea/Blur

**Priority**: P1 — Week 2

---

### 4.10 F10: Social Share Card

**Description**: One-tap share functionality for rare glyph pulls.

**User Story**: As a user who just pulled a rare glyph, I want to share it on Twitter/Farcaster so my followers see how lucky I am.

**Acceptance Criteria**:
- Share button appears on GlyphReveal screen for Tremor+ tiers
- Generates a branded image card with: glyph rune, tier name, "The Summoning" branding, Lovecraftian border
- Pre-filled tweet text: "I pulled a [Tier] Glyph in The Summoning 🔮 [link]"
- Opens Twitter/X share intent in new window
- Optional: Farcaster share via Warpcast intent URL

**Priority**: P1 — Week 2

---

### 4.11 F11: Lore Introduction

**Description**: Brief atmospheric lore introduction for first-time visitors.

**User Story**: As a new visitor, I want to understand the world of The Summoning before I start playing.

**Acceptance Criteria**:
- Shown once on first visit (before wallet connect)
- Brief scrolling text or fade-in sequence: 3–4 sentences of Lovecraftian lore
- "Enter the Ritual" CTA button dismisses and shows main interface
- Should not take more than 10 seconds to read through
- Can be skipped immediately with a click/tap
- Saved to localStorage so it only shows once per browser

**Priority**: P2 — Post-launch (can ship without this, but adds atmosphere)

---

## 5. Eldritch Glyph System

### 5.1 Glyph Rarity Distribution

| Tier | Drop Rate | Color | Glow Hex | Visual Weight |
|------|-----------|-------|----------|---------------|
| Whisper | 50% | #8B8B8B (Gray) | #8B8B8B44 | Subtle, brief |
| Echo | 28% | #4A9EFF (Blue) | #4A9EFF44 | Moderate |
| Tremor | 15% | #A855F7 (Purple) | #A855F766 | "RARE" label, shimmer |
| Rupture | 6% | #F59E0B (Gold) | #F59E0B66 | "LEGENDARY" badge, flash |
| Breach | 1% | #EF4444 (Red) | #EF444488 | Screen shake, extended |

### 5.2 Rune Symbol Pool

Glyphs draw from a pool of 30 unicode rune symbols. The specific rune is determined on-chain by Chainlink VRF (`randomWord % 30`). The result is stored in the EldritchGlyphs contract and indexed by the backend.

```
◈ ◇ ⬡ △ ▽ ⬢ ◆ ⬠ ☍ ⚝
✧ ⊛ ⊕ ⊗ ⊘ ⊙ ⊚ ⊜ ⊡ ⊞
᛭ ᚦ ᚠ ᚢ ᚨ ᚱ ᚲ ᚷ ᚹ ᛃ
```

### 5.3 Lore Message Pool

Each glyph receives one of 10 lore fragments, determined on-chain by Chainlink VRF (`randomWord % 10`).

```
"The void stirs..."
"Something ancient takes notice."
"The veil grows thin."
"Whispers from beyond the stars."
"The geometry of space bends."
"Dead dreams ripple outward."
"The sleeping one shifts."
"Reality fractures, just slightly."
"The darkness between stars pulses."
"An eye opens in the deep."
```

### 5.4 Glyph Assignment Rules

- One glyph per `commitRitual()` transaction (regardless of sacrifice amount in V1)
- Minimum sacrifice of 100 $RITUAL required
- 30-second cooldown between sacrifices (per wallet, enforced on-chain)
- **Glyphs are on-chain ERC-1155 NFTs** minted by the EldritchGlyphs contract
- Tier, rune, and lore are assigned by **Chainlink VRF** (provably fair randomness)
- Each glyph is a unique token (auto-incrementing `tokenId`, amount=1)
- Glyphs are **tradeable** — visible in wallets (OpenSea, etc.) and transferable
- **EIP-2981 royalties**: 5% on all secondary sales, paid to protocol treasury
- Cult rank reflects **on-chain `glyphCount`** (includes purchased/transferred glyphs)
- Backend indexes `GlyphMinted` events for leaderboard/metadata; on-chain is source of truth

### 5.5 V2 Glyph Enhancements (Out of Scope for V1)

These are designed but explicitly not built for launch:
- Weighted odds by sacrifice size (larger burns slightly increase rare chances)
- Pity system (guaranteed Tremor+ after 50 pulls without one)
- Glyph fusion (burn 5 Whispers to forge 1 Echo)
- Epoch-exclusive glyph variants
- Fast reveal toggle for power users (after 10+ pulls)
- Social share integration (one-tap screenshot-to-tweet)
- On-chain generative art (SVG glyphs rendered in contract)

---

## 6. Portal Visualization

### 6.1 Concept

The central visual element of the UI. A portal/rift in space that evolves as collective token burns approach the summoning threshold. All users see the same portal state at the same time, reinforcing the collective nature of the experience.

### 6.2 Visual Stages

| Progress | State | Visual Description |
|----------|-------|-------------------|
| 0–10% | Dormant | Faint outer ritual circle with slowly rotating runes. Barely visible inner glow. The void is still. |
| 10–30% | Stirring | Inner crack appears — a thin vertical tear in space. Faint purple glow bleeds through. Runes brighten and rotate faster. |
| 30–60% | Fracturing | Tear widens into an almond/eye shape. Tentacle-like wisps of energy extend from edges. Ambient purple pulsing. |
| 60–80% | Breaching | Full rift visible with glowing edges. Multiple tentacle appendages protrude and retract in animation loop. Glow intensifies. Screen edges darken slightly. |
| 80–95% | The Eye Opens | A massive eye shape becomes visible in the void beyond the rift. It blinks slowly (ellipse height animated). Tentacles fully animated. Red glow begins mixing with purple. |
| 95–100% | Manifestation | Maximum intensity. Eye fully open. Heavy glow bleeds beyond portal container. Progress text reads "IMMINENT". Screen edges heavily darkened. |

### 6.3 Technical Requirements

- Rendered as inline SVG (220x220 viewBox) for crisp scaling
- All animation via SVG `<animate>` and `<animateTransform>` (no JS animation loop needed)
- Progress-driven: accepts a `progress` prop (0–100), renders the appropriate stage
- Portal shakes briefly when a sacrifice transaction is confirmed (CSS keyframe animation)
- Must not cause layout shift — fixed dimensions within its container
- Performance: should not noticeably impact frame rate on mid-range mobile devices

### 6.4 Portal Elements

1. **Background glow**: Radial gradient, opacity scales with progress
2. **Outer ritual circle**: Dashed stroke, slow clockwise rotation (30s period)
3. **Inner rune circle**: Thin stroke, counter-clockwise rotation (20s period)
4. **Rune marks**: 12 elder futhark characters positioned around the rune circle
5. **The Tear**: Almond-shaped path, width scales with progress (2px → 42px)
6. **Inner void**: Smaller almond inside the tear, purple glow
7. **Tentacles**: Line elements radiating from the tear, count scales with progress (0→8)
8. **The Eye**: Ellipse in the center, appears at 80%+, ry animated for blinking effect
9. **Progress text**: "SUMMONING PROGRESS" label with "XX.X%" below it in ritual purple (opacity scales with intensity), monospace font

---

## 7. Cult Rank System

### 7.1 Purpose

Provides long-term progression that persists across epochs. While epoch artifacts are per-event rewards, cult rank is a cumulative status that only grows. It creates sunk-cost attachment and a reason to keep participating beyond any single epoch.

### 7.2 Rank Definitions

| Rank | Glyphs Required | Color | Badge | Perks |
|------|----------------|-------|-------|-------|
| Uninitiated | 0 | #6B7280 | None | Default state |
| Whisperer | 3 | #8B8B8B | Gray sigil | Proves participation |
| Echo Walker | 8 | #4A9EFF | Blue sigil | Custom leaderboard frame |
| Void Touched | 15 | #A855F7 | Purple sigil + particles | Early epoch announcements |
| Rift Keeper | 25 | #F59E0B | Gold sigil + animated border | 1.1x contribution weight |
| Herald of the Breach | 40 | #EF4444 | Red sigil + unique animation | 1.2x weight + vote on next Old One |

### 7.3 Display Requirements

- Current rank visible in epoch status bar (always visible)
- Rank badge appears next to wallet address everywhere it's shown
- Leaderboard entries show rank badges
- On rank-up: inline celebration (glow pulse on rank bar, brief text callout)
- Rank is calculated from on-chain `glyphCount(address)` in EldritchGlyphs contract (includes purchased/transferred glyphs)

---

## 8. Design System & Visual Identity

### 8.1 Aesthetic Direction

**Dark Lovecraftian Occult** — Deep voids, eldritch purple, ritual circle motifs, ancient typography. The UI should feel like a forbidden ritual interface, not a DeFi dashboard. Everything should feel slightly unsettling and mysterious, but still clean and usable.

### 8.2 Color Palette

```
Background:     #0a0a0f (near-black with blue undertone)
Surface:        #0d0d15 (card backgrounds)
Surface Raised: #111118 (input backgrounds, stat boxes)
Border:         #1e1e2e (subtle purple-gray borders)
Text Primary:   #e2e8f0 (light gray-white)
Text Secondary: #6b7280 (muted gray)
Text Muted:     #4b5563 (very muted, hints and footnotes)
Accent Primary: #7c3aed (ritual purple — buttons, glows, portal)
Accent Deep:    #4c1d95 (deep purple — gradients, backgrounds)
Accent Light:   #c4b5fd (light lavender — headings, highlights)
Danger/Breach:  #EF4444 (red — breach tier, warnings)
Gold/Rupture:   #F59E0B (gold — legendary tier)
```

### 8.3 Typography

- **Headings / Title**: `'Crimson Text', 'Georgia', serif` — Occult-feeling serif with good readability
- **Body text**: Same serif family for immersive consistency
- **Monospace (UI labels, stats, code-like elements)**: `'Courier New', monospace`
- **Title treatment**: All-caps, letter-spacing: 6px, text-shadow with purple glow
- **Section labels**: All-caps, letter-spacing: 2–3px, 10–11px size, monospace, secondary color

### 8.4 Component Style Patterns

**Cards/Panels**: Background #0d0d15, border 1px solid #1e1e2e, border-radius 12px, padding 20px

**Buttons (Primary)**: Background linear-gradient(135deg, #4c1d95, #7c3aed), text white, border-radius 8px, box-shadow 0 0 20px #7c3aed44, letter-spacing 3px, uppercase, serif font

**Buttons (Disabled)**: Background #1e1e2e, text #4b5563, no shadow

**Inputs/Sliders**: Background #1e1e2e, thumb #7c3aed with purple glow shadow

**Stat boxes**: Background #111118, border 1px solid #1e1e2e, border-radius 8px, compact padding

**Tab navigation**: Active tab gets #1e1e2e background and #c4b5fd text, inactive is transparent with muted text. Monospace font, uppercase, letter-spacing 3px.

### 8.5 Animation Principles

- **Portal**: SVG-native animations (rotate, opacity), continuous and ambient
- **Glyph reveal**: Framer Motion with spring physics for the card entrance, timed phases
- **Hover effects**: CSS transitions (0.3s ease), subtle scale or glow changes
- **Shake effects**: CSS keyframe (0.5s), used for portal on sacrifice and screen on Breach tier
- **Fade-in for new elements**: 0.3s opacity + slight scale (0.8→1.0)
- **No animation should block interaction**. Everything is interruptible.

### 8.6 Responsive Behavior

- **Desktop (>768px)**: Two-column layout — portal left, sacrifice controls right
- **Mobile (<768px)**: Single column — portal stacked above sacrifice controls
- **The sacrifice button must always be visible** without scrolling on mobile when the sacrifice interface is active
- Tab navigation (Ritual Chamber / Glyphs) enables switching between main views on all screen sizes
- Minimum supported width: 320px (iPhone SE)

### 8.7 Pages & Navigation

- **`/` (Home)**: Main summoning page. Header includes "About" nav link (inline on desktop, separate row on mobile). When wallet is not connected, shows a hero/onboarding section: "Burn $RITUAL tokens. Receive eldritch glyphs. Summon the Old Ones." with a "How it works" link to the About page. During Gathering phase with wallet connected, shows guidance text in place of the hidden sacrifice panel.
- **`/about`**: Mythos-flavored explainer page with smooth-scroll Framer Motion sections: the pitch ("Ethereum used to be fun"), 4-step ritual walkthrough, interactive glyph tier grid, cult rank table, "Why" philosophy section, fully on-chain feature grid, and "Enter the Ritual" CTA. Uses the same design system (dark theme, Crimson Text headings, purple accents).
- **Channeling Overlay**: Changed from a full-screen dark overlay (which made the app appear frozen) to a compact floating card in the bottom-right corner. Users can continue interacting with the app while VRF processes.

---

## 9. Copy & Lore

### 9.1 Voice & Tone

The application copy should balance two tones:
- **Atmospheric/mysterious**: Lore text, epoch descriptions, flavor text
- **Clear/functional**: Button labels, error messages, instructions

Never sacrifice clarity for atmosphere. If a user doesn't understand what a button does, the lore has failed.

### 9.2 Key Copy Elements

**Page title**: "THE SUMMONING"

**Subtitle**: Dynamic from epoch data — "Epoch {id} — {Old One subtitle}" (e.g., "Epoch 1 — The Dreaming One Stirs"). Falls back to "The veil grows thin..." when no epoch is active.

**Section labels** (monospace, uppercase):
- "THE RIFT" (portal section)
- "SACRIFICE $RITUAL" (controls section)
- "YOUR BALANCE" (token balance)
- "SACRIFICE AMOUNT" (slider label)
- "GLYPH CHANCES" (odds display)
- "CULT RANK" (rank bar)
- "YOUR GLYPH COLLECTION — X ACQUIRED" (collection header)
- "RITUAL PHASE" (epoch status)

**Button labels**:
- "⬡ PERFORM SACRIFICE" (primary action)
- "◈ CHANNELING..." (during transaction)
- "APPROVE $RITUAL" (first-time approval)
- "MINT $RITUAL" (minting curve)
- "CLAIM ARTIFACT" (after epoch resolution)

**Progress indicators**:
- "X.XXM burned / Y.YYM needed" (collective progress)
- "SUMMONING PROGRESS / XX.X%" (portal text)
- "X glyphs to [Rank Name]" (rank progress)

**Empty states**:
- Collection: "No glyphs yet. Perform a sacrifice to receive your first glyph."
- Artifacts: "No artifacts yet. Participate in a successful summoning to earn your first artifact."

**Error messages** (keep functional, not thematic):
- "Insufficient $RITUAL balance"
- "Cooldown active — wait X seconds"
- "Epoch is not in Ritual phase"
- "Transaction rejected"

### 9.3 Old Ones (Epoch Themes)

Each epoch features a different Old One. V1 launches with Cthulhu. Future Old Ones for subsequent epochs:

| Epoch | Old One | Subtitle | Flavor |
|-------|---------|----------|--------|
| 1 | Cthulhu | "The Dreaming One Stirs" | The first and greatest. Dead Cthulhu waits dreaming. |
| 2 | Nyarlathotep | "The Crawling Chaos Whispers" | The messenger, the shapeshifter, the thousand-faced one. |
| 3 | Azathoth | "The Blind Idiot God Writhes" | The nuclear chaos at the center of infinity. |
| 4 | Shub-Niggurath | "The Black Goat Breeds" | The All-Mother, the one with a thousand young. |
| 5 | Yog-Sothoth | "The Gate Opens" | The key and the gate, co-terminus with all time and space. |

---

## 10. Priority & Scope

### 10.1 P0 — Must Have for Launch

These features are required for the first epoch to be a great experience:

| Feature | Description |
|---------|-------------|
| F1: Wallet Connection | Connect, show balances, chain detection |
| F2: Minting Curve | Deposit ETH, receive $RITUAL |
| F3: Sacrifice Interface | Amount selector, sacrifice button, approval flow |
| F4: Glyph Reveal | Full-screen gacha animation (all 5 tiers) |
| F5: Glyph Collection | Grid display with tier coloring and tooltips |
| F6: Epoch Status | Phase indicator, countdown, collective progress bar |
| F7: Cult Rank Bar | Current rank, progress to next rank |
| Portal Visualization | 6-stage SVG portal responding to collective progress |
| About Page | /about — mythos-flavored explainer with game loop, glyph tiers, cult ranks, CTA |
| Hero/Onboarding | Disconnected users see pitch text + "How it works" link before mint interface |
| Mobile Responsive | All P0 features work on mobile browsers |

### 10.2 P1 — Week 2 (Ship Within 1 Week of Launch)

| Feature | Description |
|---------|-------------|
| F8: Leaderboard | Top contributors + top glyph collectors |
| F9: Artifact Gallery | View earned ERC-1155 artifacts with metadata |
| F10: Social Share Card | One-tap share for rare glyph pulls |

### 10.3 P2 — Post-Launch

| Feature | Description |
|---------|-------------|
| F11: Lore Introduction | First-visit atmospheric lore scroll |
| Lore Library | Backstories for each Old One |
| Sound Effects | Ambient audio, sacrifice sounds, reveal sounds |
| Glyph detail view | Full-screen view of individual glyph with all metadata |

### 10.4 Explicitly Out of Scope for V1

- Weighted glyph odds by sacrifice amount
- Pity system (guaranteed rare after N pulls)
- Glyph fusion / combination mechanics
- Fast reveal toggle
- DAO governance
- L2 deployment (contingency only)
- Mobile native app
- Token staking / yield
- Cross-chain bridging
- On-chain generative art (glyphs use off-chain metadata API; on-chain SVG rendering is V2)

---

## 11. Success Metrics

### 11.1 Launch Metrics (First Epoch)

| Metric | Target | Measurement |
|--------|--------|-------------|
| Unique wallets participated | 5,000+ | On-chain: unique addresses in commitRitual events |
| Total $RITUAL burned | Exceed threshold | On-chain: epoch totalCommitted |
| Average sacrifices per wallet | 5+ | Backend: glyph count / unique wallets |
| Session duration | >10 minutes | Frontend analytics (if added) |
| Organic tweets mentioning The Summoning | 500+ | Social monitoring |
| Epoch 1 success | YES | First summoning must succeed |

### 11.2 Ongoing Metrics (Weekly)

| Metric | Target | Indicates |
|--------|--------|-----------|
| Returning wallets (epoch over epoch) | >40% | Retention — macro loop working |
| Average glyphs per session | >5 | Engagement — micro loop working |
| Breach glyph screenshots shared | Track volume | Viral mechanic working |
| New wallets per epoch | Growing | Growth — distribution working |
| Protocol revenue (ETH) | Track cumulative | Business health |
| Cult rank distribution | Healthy curve | Long-term progression working |

### 11.3 North Star Metric

**Average sacrifices per wallet per epoch.** This single number captures whether the gacha loop is working. If users are sacrificing >5 times per epoch, the micro-loop is compelling. If it's <3, the reveal experience needs to be more engaging.

---

## 12. Known Constraints & Tradeoffs

### 12.1 Technical Constraints

| Constraint | Impact | Mitigation |
|-----------|--------|------------|
| Block confirmation time (~12s) | Delay between sacrifice and glyph reveal | "Channeling..." animation fills the gap |
| 30-second on-chain cooldown | Limits pull speed for power users | Necessary to prevent glyph farming; V2 may add fast-pull option |
| Off-chain glyph assignment | Glyphs aren't "real" tokens | Deterministic verification possible; on-chain attestation in V2 |
| ERC-20 approve() required | Extra transaction before first sacrifice | One-time infinite approval; clear UX guidance |
| Gas costs (even at 0.03 gwei) | Non-zero cost per sacrifice | At current prices, 100 pulls < $1 total gas; negligible |

### 12.2 Product Tradeoffs

| Tradeoff | Decision | Rationale |
|----------|----------|-----------|
| Glyph odds fixed vs. weighted by sacrifice size | Fixed for V1 | Simpler, fairer, avoids pay-to-win perception. Weighted odds in V2. |
| Reveal animation length | ~2.5s common, ~4s rare | Fast enough for repeat pulls, slow enough to feel rewarding. Tunable post-launch. |
| No pity system in V1 | Ship without | Standard gacha practice, but adds complexity. Monitor frustration signals and add in V2 if needed. |
| Off-chain glyphs vs. on-chain | Off-chain | Speed (2s vs 12s delivery), cost (free vs gas), flexibility (tunable without redeploy). Verifiable via deterministic seed. |
| Single-chain (mainnet only) vs. multi-chain | Mainnet only for V1 | At 0.03 gwei, gas is not a barrier. Mainnet prestige and the "make Ethereum fun again" narrative are worth more than marginal gas savings on L2. |
| Owner-controlled epochs vs. automated | Owner-controlled with Chainlink Automation assist | Team needs to tune thresholds, timing, and Old One selection based on real engagement data. Full automation is premature for V1. |

### 12.3 Open Questions (Resolve During Development)

1. **Exact first epoch threshold**: Needs to be calibrated based on pre-launch token distribution. Set low enough to guarantee success. Can be adjusted right up until epoch start.
2. **Tier percentile calculation for rewards**: The simplified threshold-based approach (>10x average = Harbinger) may need tuning based on actual contribution distributions. Monitor Epoch 1 and adjust for Epoch 2.
3. **Reconnection handling**: If a user's WebSocket disconnects mid-sacrifice, they should still see their glyph on reconnect. Backend stores all assignments; frontend should query `/api/glyphs/:wallet` on reconnect and show any un-revealed glyphs.
4. **Browser tab backgrounding**: When the tab is backgrounded during "Channeling...", the WebSocket message may arrive while the tab is hidden. On tab refocus, check for pending glyph reveals and trigger the animation.
5. **Approval UX**: Should we prompt infinite approval once, or approval-per-sacrifice? Infinite approval is better UX (one tx ever) but feels scary to new users. Recommend infinite with clear explanation copy.
