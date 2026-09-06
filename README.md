# AI Filter for Etsy

A Chrome extension (Manifest V3) that hides likely AI-mass-produced listings from Etsy search results, so genuine handmade items are easier to find.

## Why this exists

Etsy buyers have been complaining since 2023 about a flood of AI-generated "crochet pattern," "clipart bundle," and similar digital-download listings crowding out real handmade sellers. Etsy removed ~12,000 such listings for policy violations in Q1 2026 alone, but plenty still slip through. The only prior response was a hobbyist-maintained ad-blocker filter list (~530 shop names, no UI, no auto-updates, no transparency about why a shop was blocked). This extension does the same job with a real interface, transparent reasoning, adjustable sensitivity, and an auto-updating shared blocklist.

## How detection works

Every listing card on an Etsy search page gets scored against a few signals, all visible to you in the "why was this hidden" panel:

- **Known AI-mill shop** — the shop name matches a community-maintained blocklist (seeded from a CC0-licensed list of ~530 shops, see Credits below).
- **Suspicious "mega bundle" title** — e.g. "12,000+ Amigurumi Patterns," a hallmark of AI-generated pattern mills (a real handmade seller doesn't have 12,000 patterns).
- **Unedited AI text artifacts** — literal `**asterisks**` left in the title from unedited AI/markdown output.
- **Emoji-stuffed titles** — a common AI-copywriting tell.

A listing needs enough combined signal to cross your chosen sensitivity threshold before it's hidden — nothing is a single-signal instant judgment except an exact match on the known-shops list. You can always click "Show anyway," and doing so remembers that shop so it won't be hidden for you again.

This is a heuristic filter, not a certainty machine. It will have false positives (an honest seller who over-uses emoji) and false negatives (a well-disguised AI-mill listing). Sensitivity is adjustable in the popup for this reason.

## Install (unpacked, for now)

1. Open `chrome://extensions`
2. Turn on **Developer mode** (top-right toggle)
3. Click **Load unpacked** and select this folder
4. Search anything on etsy.com — flagged listings will show a "Hidden · looks AI-mass-produced" panel instead of the product card

## Publishing to the Chrome Web Store (your part)

This needs your Google account and a one-time $5 developer registration fee that I can't pay on your behalf:

1. Go to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole), pay the one-time $5 fee if you haven't already registered as a developer.
2. Zip this folder's contents (not the folder itself — the zip root should contain `manifest.json` directly).
3. Upload the zip, fill in the listing (screenshots, description — ask me to help draft these), and submit for review.
4. Chrome Web Store review typically takes a few days to ~2 weeks for a new developer account.

**Privacy practices disclosure** (you'll need this for the listing): this extension stores settings and stats locally on the user's device only (`chrome.storage.local`), fetches one public, static JSON file (the shared blocklist) with no user data attached, and sends no personal or browsing data anywhere.

## Monetization

v1 has no monetization built in — it's free. Realistic paths once it has real users:
- A "Pro" tier (small one-time payment or subscription) for a faster-updating blocklist, cross-device sync of your personal list, or extending coverage to eBay/Depop.
- Keep it free and build a userbase first — a filter extension with zero users making zero income doesn't need a payment system yet; add one once there's real usage to justify it.

## Updating the shared blocklist

`src/background.js` fetches `src/blocklist.json` from this repo's `main` branch on GitHub once a day (`raw.githubusercontent.com/aivanovnl/etsy-ai-blocker/main/src/blocklist.json`). To add shops, edit `src/blocklist.json` and push to `main` — every installed copy of the extension picks up the change within 24 hours, no new release needed.

## Credits

The initial ~530-shop seed list in `src/blocklist.json` is extracted from [aneuroticdoctor/Etsy-AI-Store-Hider](https://github.com/aneuroticdoctor/Etsy-AI-Store-Hider) (CC0-1.0 — public domain), originally compiled by JessicaAmber.

## License

Code in this repository (everything except `src/blocklist.json`'s underlying shop-name data, credited above) is MIT licensed.
