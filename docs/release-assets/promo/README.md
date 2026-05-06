# Chrome Web Store Promo Assets

Generated from the current Snaplex mascot logo and product screenshots.

## Files

| File | Size | Use |
|---|---:|---|
| [`small-promo-440x280.png`](./small-promo-440x280.png) | 440x280 | Chrome Web Store small promo tile |
| [`large-promo-920x680.png`](./large-promo-920x680.png) | 920x680 | Chrome Web Store large promo tile |
| [`marquee-promo-1400x560.png`](./marquee-promo-1400x560.png) | 1400x560 | Chrome Web Store marquee tile |

## Regenerate

```bash
cd snaplex
node scripts/generate-release-promos.mjs
```

Inputs:

- `branding/exports/full/512.png`
- `public/screenshots/home.png`
- `public/screenshots/library.png`
