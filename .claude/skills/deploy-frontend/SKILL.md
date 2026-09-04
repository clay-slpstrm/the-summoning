---
name: deploy-frontend
description: Build and deploy the frontend to production (Cloudflare Pages → thesummoning.xyz) with the mainnet env. Use for ANY frontend change going live, including copy edits, social-CTA URL updates, or setting the launch countdown.
---

# Deploy Frontend to Production

The site is a Next.js static export on Cloudflare Pages (project `the-summoning`,
production branch `master`). NEXT_PUBLIC_* values are inlined AT BUILD TIME.

## Critical gotchas (each one has bitten before)

1. **Shell env, not files**: `frontend/.env.local` is Sepolia (for dev) and Next.js
   gives `.env.local` precedence over `.env.production` — so mainnet values MUST be
   passed as shell env vars, which outrank all env files.
2. **Kill `next dev` first** — dev and build corrupt each other via `.next/`.
3. **wrangler via npx needs a cache workaround** (root-owned ~/.npm bug):
   `npm_config_cache=/tmp/npm-cache-clay`.
4. Commit source changes BEFORE deploying so the deployment maps to a commit.

## Recipe

```bash
pkill -f "next dev"; cd frontend && rm -rf .next out
RPC_URL_MAINNET=$(grep '^RPC_URL=' ../backend/.env.mainnet | cut -d= -f2)

NEXT_PUBLIC_CHAIN_ID=1 \
NEXT_PUBLIC_RPC_URL=$RPC_URL_MAINNET \
NEXT_PUBLIC_RITUAL_TOKEN_ADDRESS=0x8daA5B21136de9B5ac43fd89fDc98cDe934E7863 \
NEXT_PUBLIC_MINTING_CURVE_ADDRESS=0x8c7c1C76f32277EDc12B28440224fEF0f6985462 \
NEXT_PUBLIC_SUMMONING_ENGINE_ADDRESS=0x5029DDfcb2f6BA72f7C618FFd8B1237c246298d0 \
NEXT_PUBLIC_ELDER_ARTIFACTS_ADDRESS=0x832436cdf21d6732fAfD22938ee2b7617D74af5A \
NEXT_PUBLIC_ELDRITCH_GLYPHS_ADDRESS=0xe820607743E95a694Aa50a9BFFf628C3E202D156 \
NEXT_PUBLIC_API_URL=https://api.thesummoning.xyz \
NEXT_PUBLIC_WS_URL=wss://api.thesummoning.xyz/ws \
NEXT_PUBLIC_OFFERING_ADDRESS=0x47602E8a26dE46fa8e00B1449017ab154ceDFA42 \
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=adeec4f3d311f13a4fd6e53ea44f2200 \
npm run build
```

Optional launch-phase vars (add to the same block when set):
- `NEXT_PUBLIC_X_URL=` / `NEXT_PUBLIC_DISCORD_URL=` — hero CTA buttons (hidden when unset)
- `NEXT_PUBLIC_LAUNCH_AT=` — ISO 8601 or unix seconds; flips PreLaunchHero from
  soft mode to a hard countdown. ONLY set once the T0 date is publicly committed.

## Verify the build BEFORE deploying (leakage check)

```bash
cd out
grep -rl "0x5029DDfcb2f6BA72f7C618FFd8B1237c246298d0" . | wc -l   # ≥1 (NEW mainnet engine present)
grep -rl "0x5D474E68c08B2aF16dFEd50377B98573e17a5be5" . | wc -l   # MUST be 0 (retired old engine)
grep -rl "0x48d37A403e382ac14B090578a4243F85F9ff7183" . | wc -l   # MUST be 0 (Sepolia engine)
grep -rl "localhost:3002" . | wc -l                               # MUST be 0
# grep -rl "sepolia" hits ~5 files = wallet-library chain tables — EXPECTED, ignore.
```

## Deploy + verify live

```bash
cd frontend
npm_config_cache=/tmp/npm-cache-clay npx -y wrangler pages deploy out \
  --project-name=the-summoning --branch=master --commit-dirty=true
# wrangler auth: user's OAuth (wrangler login). If unauthenticated, ONLY the user can log in.

sleep 10
curl -s "https://thesummoning.xyz/?v=$(date +%s)" | grep -o "<title>[^<]*</title>"
# Spot-check whatever changed. NOTE: page body is client-rendered — dynamic copy
# (e.g. the pre-launch hero) will NOT appear in curl'd HTML; verify in a browser.
```
