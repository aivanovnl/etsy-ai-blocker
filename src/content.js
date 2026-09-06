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

  const THRESHOLDS = { low: 6, medium: 3, high: 2 };

  const EMOJI_RE = /\p{Extended_Pictographic}/gu;
  const MARKDOWN_ARTIFACT_RE = /\*\*[^*]{3,}\*\*/;
  const BIG_BUNDLE_RE =
    /\b([2-9]\d{2,}|\d{4,})\+?\s*(amigurumi|crochet|patterns?|designs?|templates?|clipart|svg|png|printables?|bundle|mega\s*pack)\b/i;

  let settings = null;
  let blocklistSet = new Set();

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

  function extractTitle(card) {
    const img = card.querySelector("img[alt]");
    if (img && img.alt) return img.alt;
    const heading = card.querySelector("h2, h3, [aria-label]");
    return heading ? heading.getAttribute("aria-label") || heading.textContent : card.innerText.slice(0, 200);
  }

  function score(title, shopName) {
    const reasons = [];
    let total = 0;

    if (shopName && blocklistSet.has(shopName.toLowerCase())) {
      total += 10;
      reasons.push("Shop is on the known AI-mill list");
    }
    if (title && BIG_BUNDLE_RE.test(title)) {
      total += 2;
      reasons.push("Suspiciously large “mega bundle” pattern count in the title");
    }
    if (title && MARKDOWN_ARTIFACT_RE.test(title)) {
      total += 3;
      reasons.push("Unedited AI text formatting (**asterisks**) left in the title");
    }
    const emojiCount = title ? (title.match(EMOJI_RE) || []).length : 0;
    if (emojiCount >= 3) {
      total += 1;
      reasons.push("Unusually heavy emoji use in the title");
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
    const { total, reasons } = score(title, shopName);
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
