# Chrome Web Store listing copy

Paste these directly into the Developer Dashboard fields.

## Extension name (max 45 chars)
AI Filter for Etsy

## Short description (max 132 chars)
Hides likely AI-mass-produced listings from Etsy search results, so real handmade items are easier to find.

## Detailed description

Etsy search is getting harder to use — flooded with "12,000+ patterns," "Whole Shop Bundle," and "Lifetime Access" digital-download listings that are clearly mass-produced, not handmade. AI Filter for Etsy hides them automatically.

**How it works**
Every search result gets scored on real, visible signals — not guesswork:
• Known AI-mill shops (community-maintained, auto-updating list)
• Absurd item counts ("30,000+ clipart" — no one hand-makes 30,000 anything)
• "Whole shop / lifetime access" listings that sell catalog access instead of one real item
• PLR/MRR resale-licensing jargon (never used by genuine makers)
• Unedited AI text artifacts, keyword-stuffed titles, and price-per-item that doesn't add up

You always see exactly why a listing was hidden, and can click "Show anyway" — that shop won't be hidden for you again. Adjust sensitivity from the popup: Low (known shops only), Medium (default), or High.

**Privacy**
No accounts, no tracking, no analytics, no data collection. Settings stay on your device. The only network request is a daily fetch of one public, static blocklist file — see the privacy policy for details.

**Open source**
The full source and the shared blocklist are public on GitHub: github.com/aivanovnl/etsy-ai-blocker — contributions and shop reports welcome.

Not affiliated with or endorsed by Etsy, Inc.

## Category
Shopping

## Language
English

## Privacy policy URL
https://aivanovnl.github.io/etsy-ai-blocker/privacy.html

## Single purpose description (required by CWS review)
This extension's single purpose is to let users hide listings on Etsy.com search results that show strong signs of being AI-mass-produced, based on the listing's own title, shop, and price.

## Permission justifications (required by CWS review)
- **storage**: to save the user's enabled/disabled state, sensitivity setting, and personal shop list locally.
- **alarms**: to schedule a once-daily background refresh of the shared blocklist file.
- **host permission on *.etsy.com**: to read listing titles/prices on Etsy search pages, which is the extension's entire function.
- **host permission on raw.githubusercontent.com**: to fetch the public, static shared blocklist JSON file.

## Screenshots needed (1280x800 or 640x400, at least 1, up to 5)
Use real screenshots from your own working install — the one you already sent showing the "Hidden · looks AI-mass-produced" panel on the SuzyFlowArt listing is a great first one. A couple more ideas:
1. A search results page with 2-3 listings visibly hidden among normal ones
2. The popup open, showing the sensitivity toggle and hidden-count stats
3. A "Show anyway" click revealing the reasons list
