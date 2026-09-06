(() => {
  const PROCESSED_ATTR = "data-aif-processed";
  const CARD_SELECTOR = "li.wt-list-unstyled:has(a[href*='/listing/'])";

  const DEFAULTS = {
    enabled: true,
    sensitivity: "medium", // low | medium | high
    personalBlocklist: [], // shop names the user added themselves
    personalAllowlist: [], // shop names the user explicitly un-hid, remembered
    stats: { today: "", hiddenToday: 0, hiddenTotal: 0 },
  };

  const THRESHOLDS = { low: 8, medium: 3, high: 2 };

  const EMOJI_RE = /\p{Extended_Pictographic}/gu;
  const MARKDOWN_ARTIFACT_RE = /\*\*[^*]{3,}\*\*/;
  // A big standalone count like "500+" or "12,000+" anywhere in the title.
  const BIG_NUMBER_RE = /\b(\d{1,3}(?:,\d{3})+|\d{2,})\+/;
  // Any of these words appearing anywhere in the title (not necessarily next to the number).
  const BUNDLE_CATEGORY_RE =
    /\b(amigurumi|crochet|patterns?|designs?|templates?|clipart|printables?|svg|png|fonts?|planners?|stickers?|bundle|mega\s*pack|collection)\b/i;
  const SUPERLATIVE_RE = /\b(ultimate|mega|huge|massive|giant|complete\s+collection|all[- ]in[- ]one)\b/i;
  const PRICE_RE = /(?:CA\$|C\$|US\$|NZ\$|AU\$|\$|£|€)\s?(\d+(?:[.,]\d{2})?)/;
  const DISCOUNT_RE = /\((\d{1,3})%\s*off\)/i;
  const SHOP_REPEAT_MIN = 4;

  function normalizeNumber(str) {
    return parseInt(str.replace(/,/g, ""), 10);
  }

  // Removes digit-grouping commas ("12,000" -> "12000") so they aren't
  // mistaken for keyword-stuffing separators when counting commas.
  function stripNumberCommas(s) {
    let prev;
    do {
      prev = s;
      s = s.replace(/(\d),(\d{3})\b/, "$1$2");
    } while (s !== prev);
    return s;
  }

  let settings = null;
  let blocklistSet = new Set();
  const shopFrequency = new Map(); // shop name (lowercase) -> how many of its listings we've seen this page load

  function todayStr() {
    return new Date().toISOString().slice(0, 10);
  }

  async function loadSettings() {
    const stored = await chrome.storage.local.get(DEFAULTS);
    settings = { ...DEFAULTS, ...stored };
    if (settings.stats.today !== todayStr()) {
      settings.stats = { today: todayStr(), hiddenToday: 0, hiddenTotal: settings.stats.hiddenTotal || 0 };
      await chrome.storage.local.set({ stats: settings.stats });
    }
  }

  async function loadBlocklist() {
    let list = [];
    try {
      const remote = await chrome.storage.local.get({ remoteBlocklist: null });
      if (remote.remoteBlocklist && Array.isArray(remote.remoteBlocklist.shops)) {
        list = remote.remoteBlocklist.shops;
      }
    } catch (e) {
      /* ignore */
    }
    if (list.length === 0) {
      try {
        const res = await fetch(chrome.runtime.getURL("src/blocklist.json"));
        const data = await res.json();
        list = data.shops || [];
      } catch (e) {
        /* ignore */
      }
    }
    const merged = new Set(list.map((s) => s.toLowerCase()));
    (settings.personalBlocklist || []).forEach((s) => merged.add(s.toLowerCase()));
    blocklistSet = merged;
  }

  function extractShopName(card) {
    const text = card.innerText || "";
    const m = text.match(/(?:From shop|By)\s+([A-Za-z0-9_.\-]{2,40})/);
    return m ? m[1].trim() : null;
  }

  function extractPriceInfo(card) {
    const text = card.innerText || "";
    const priceMatch = text.match(PRICE_RE);
    const discountMatch = text.match(DISCOUNT_RE);
    return {
      price: priceMatch ? parseFloat(priceMatch[1].replace(",", ".")) : null,
      discountPct: discountMatch ? parseInt(discountMatch[1], 10) : null,
    };
  }

  function extractTitle(card) {
    const img = card.querySelector("img[alt]");
    if (img && img.alt) return img.alt;
    const heading = card.querySelector("h2, h3, [aria-label]");
    return heading ? heading.getAttribute("aria-label") || heading.textContent : card.innerText.slice(0, 200);
  }

  // Title + known-shop signals only. Pure function of the listing itself —
  // used both as the base score and to decide whether this listing counts
  // toward its shop's "repeat offender" tally.
  function baseScore(title, shopName) {
    const reasons = [];
    let total = 0;
    let numMatch = null;

    if (shopName && blocklistSet.has(shopName.toLowerCase())) {
      total += 10;
      reasons.push("Shop is on the known AI-mill list");
    }

    if (title) {
      const m = title.match(BIG_NUMBER_RE);
      const hasCategory = BUNDLE_CATEGORY_RE.test(title);
      if (m && hasCategory) {
        numMatch = m;
        const n = normalizeNumber(m[1]);
        const weight = n >= 200 ? 3 : n >= 50 ? 2 : 1;
        total += weight;
        reasons.push(`Suspiciously large item count in the title ("${m[0]}")`);
      }

      if (SUPERLATIVE_RE.test(title)) {
        total += 1;
        reasons.push("Hype/superlative marketing language in the title");
      }

      if (MARKDOWN_ARTIFACT_RE.test(title)) {
        total += 3;
        reasons.push("Unedited AI text formatting (**asterisks**) left in the title");
      }

      const emojiCount = (title.match(EMOJI_RE) || []).length;
      if (emojiCount >= 3) {
        total += 1;
        reasons.push("Unusually heavy emoji use in the title");
      }

      const pipeSegments = title.split("|").length - 1;
      const commaSegments = stripNumberCommas(title).split(",").length - 1;
      if (pipeSegments >= 2 || commaSegments >= 4) {
        total += 1;
        reasons.push("Keyword-stuffed title (many | or , separated phrases)");
      }
    }

    return { total, reasons, numMatch };
  }

  // Reinforcement-only signals: these never fire on a listing that's
  // otherwise clean (base.total === 0) — they only push an ALREADY
  // suspicious listing further, so a prolific-but-genuine shop or a normal
  // sale price never gets penalized on its own.
  function applyReinforcement(base, { shopRepeatCount = 0, priceInfo = {} } = {}) {
    if (base.total === 0) return base;
    let total = base.total;
    const reasons = base.reasons.slice();

    if (base.numMatch && priceInfo.price != null) {
      const n = normalizeNumber(base.numMatch[1]);
      if (priceInfo.price / n < 0.02) {
        total += 2;
        reasons.push(`Price works out to under $0.02 per item for ${base.numMatch[0]} items — not a realistic value`);
      }
    }
    if (priceInfo.discountPct >= 40 && priceInfo.price != null && priceInfo.price < 10) {
      total += 1;
      reasons.push("Steep discount stacked on an already very low price");
    }
    if (shopRepeatCount >= SHOP_REPEAT_MIN) {
      total += 1;
      reasons.push(`This shop has ${shopRepeatCount}+ similarly-flagged listings in this search`);
    }

    return { total, reasons };
  }

  function buildOverlay(card, shopName, reasons) {
    const overlay = document.createElement("div");
    overlay.className = "aif-overlay";
    const reasonList = reasons.map((r) => `<li>${r}</li>`).join("");
    overlay.innerHTML = `
      <div class="aif-overlay-inner">
        <div class="aif-overlay-title">Hidden · looks AI-mass-produced</div>
        <ul class="aif-overlay-reasons">${reasonList}</ul>
        <div class="aif-overlay-actions">
          <button type="button" class="aif-show-btn">Show anyway</button>
        </div>
      </div>`;
    overlay.querySelector(".aif-show-btn").addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      card.classList.remove("aif-hidden");
      overlay.remove();
      if (shopName) {
        const allow = new Set(settings.personalAllowlist || []);
        allow.add(shopName.toLowerCase());
        settings.personalAllowlist = [...allow];
        chrome.storage.local.set({ personalAllowlist: settings.personalAllowlist });
      }
    });
    return overlay;
  }

  async function bumpStats() {
    settings.stats.hiddenToday += 1;
    settings.stats.hiddenTotal += 1;
    await chrome.storage.local.set({ stats: settings.stats });
    chrome.runtime.sendMessage({ type: "AIF_STATS_UPDATED", stats: settings.stats }).catch(() => {});
  }

  function processCard(card) {
    if (card.getAttribute(PROCESSED_ATTR)) return;
    card.setAttribute(PROCESSED_ATTR, "1");
    if (!settings.enabled) return;

    const shopName = extractShopName(card);
    if (shopName && (settings.personalAllowlist || []).includes(shopName.toLowerCase())) {
      return;
    }
    const title = extractTitle(card);
    const base = baseScore(title, shopName);

    let shopRepeatCount = 0;
    if (shopName) {
      const key = shopName.toLowerCase();
      if (base.total > 0) {
        shopRepeatCount = (shopFrequency.get(key) || 0) + 1;
        shopFrequency.set(key, shopRepeatCount);
      } else {
        shopRepeatCount = shopFrequency.get(key) || 0;
      }
    }

    const priceInfo = extractPriceInfo(card);
    const { total, reasons } = applyReinforcement(base, { shopRepeatCount, priceInfo });
    const threshold = THRESHOLDS[settings.sensitivity] ?? THRESHOLDS.medium;

    if (total >= threshold) {
      card.classList.add("aif-hidden");
      const overlay = buildOverlay(card, shopName, reasons);
      card.appendChild(overlay);
      bumpStats();
    }
  }

  function scan() {
    document.querySelectorAll(CARD_SELECTOR).forEach(processCard);
  }

  function observe() {
    const obs = new MutationObserver(() => {
      clearTimeout(observe._t);
      observe._t = setTimeout(scan, 150);
    });
    obs.observe(document.body, { childList: true, subtree: true });
  }

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.enabled || changes.sensitivity || changes.personalBlocklist || changes.personalAllowlist) {
      loadSettings().then(loadBlocklist).then(() => {
        document.querySelectorAll(`[${PROCESSED_ATTR}]`).forEach((c) => c.removeAttribute(PROCESSED_ATTR));
        document.querySelectorAll(".aif-overlay").forEach((o) => o.remove());
        document.querySelectorAll(".aif-hidden").forEach((c) => c.classList.remove("aif-hidden"));
        scan();
      });
    }
  });

  (async function init() {
    await loadSettings();
    await loadBlocklist();
    scan();
    observe();
  })();
})();
