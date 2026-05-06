# Snaplex Branding Assets

This directory is the source of truth for the Snaplex mascot logo rollout.

## Source Assets

- `source/snaplex-mascot-full-1024.png`: full mascot icon with the cream rounded-square background and transparent pixels outside the rounded shape. Use it where the logo is shown independently, such as app icons, store artwork, social avatars, and favicons.
- `source/snaplex-mascot-mark-1024.png`: transparent-background mascot mark. Use it where the surrounding UI already provides a container, such as sidebars, headers, inline buttons, empty states, and loading illustrations.

## Exports

- `exports/full/`: generated full-icon PNG sizes: 16, 32, 48, 64, 128, 256, 512, and 1024.
- `exports/mark/`: generated transparent-mark PNG sizes: 24, 32, 48, 64, 128, and 256.
- `exports/favicon/`: generated browser favicon assets:
  - `favicon.ico`: 16, 32, and 48 pixel ICO layers.
  - `favicon-32.png`: 32 pixel PNG favicon.
  - `apple-touch-icon-180.png`: 180 pixel Apple touch icon.

## Regeneration

Run this from the `snaplex/` directory:

```sh
node scripts/generate-branding.mjs
```

The script is idempotent. It rebuilds source-normalized files from `snaplex-logo.png`, removes the cream background for the mark asset, writes all exports, and verifies that every required output exists and is non-empty.

If the transparent mark shows visible cream fringing after visual review, replace `source/snaplex-mascot-mark-1024.png` with a manually exported transparent source and rerun only the downstream export portion before continuing the rollout.
