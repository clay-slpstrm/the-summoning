# Artifact Images

Static PNG artwork for ERC-1155 artifacts minted by `ElderArtifacts.sol`. Served
by the backend at `/images/artifact/{oldOneId}/{tierId}.png` and referenced from
the JSON metadata returned by `/api/metadata/artifact/:tokenId`.

## File layout

You need **20 PNG images total** — 5 Old Ones × 4 artifact tiers:

```
public/artifacts/
├── 1/                  # Cthulhu
│   ├── 0.png           # Shattered Ritual (failed epoch reward)
│   ├── 1.png           # Harbinger (top contributor)
│   ├── 2.png           # Acolyte
│   └── 3.png           # Cultist
├── 2/                  # Nyarlathotep
│   ├── 0.png
│   ├── 1.png
│   ├── 2.png
│   └── 3.png
├── 3/                  # Azathoth         (0.png .. 3.png)
├── 4/                  # Shub-Niggurath   (0.png .. 3.png)
└── 5/                  # Yog-Sothoth      (0.png .. 3.png)
```

## Image guidelines

- **Format**: any of `.png`, `.jpg`, `.jpeg`, `.webp`. The metadata URL is
  extension-agnostic (`/images/artifact/{oldOneId}/{tierId}` with no
  extension); the handler probes the supported extensions in order and
  serves the first match. You can mix formats per image — e.g. JPEG for
  most, PNG for any that need transparency.
- **Recommended choice**: JPEG (~75-85% quality) for painterly atmospheric
  images like ours — file size is ~4× smaller than PNG with no visible
  quality loss. PNG only if the image needs an alpha channel.
- **Dimensions**: 1024×1024 recommended. Marketplaces accept anything from
  ~400px up; 1024 looks crisp on detail pages without ballooning file size.
- **File size**: keep under 1 MB per image. Cloudflare will cache them
  aggressively but the first hit per edge still has to fetch from origin.
- **Naming**: tier IDs are 0/1/2/3 — filenames are `0.<ext>`, `1.<ext>`, etc.
  No leading zeros, no other variants. So `0.jpg`, `1.png`, `2.webp` in
  the same directory all work.

## Tier semantics

| tierId | Name | Meaning |
|---|---|---|
| 0 | Shattered Ritual | Failed epoch — every contributor gets this |
| 1 | Harbinger | Top ~1% contributor on a successful summoning (sole contributors auto-Harbinger, see M-01) |
| 2 | Acolyte | Top ~10% |
| 3 | Cultist | Everyone else on a successful summoning |

## What happens if a file is missing

The Express static handler returns 404. Marketplaces will fall back to showing
the JSON metadata's `name` + `description` with a broken-image placeholder.
This is recoverable — drop the file in, restart isn't needed (Express picks up
file changes for static assets), and the next marketplace refresh renders the
image.

## What's NOT covered

This directory is for **artifact** images (ElderArtifacts ERC-1155).

Glyph images (EldritchGlyphs ERC-1155) are **server-rendered SVG** on the fly
via `services/glyphSvg.ts` — they don't need static art files. Each glyph's
visual is derived from its on-chain `(tier, runeIndex, loreIndex)` data.
