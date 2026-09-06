const REMOTE_BLOCKLIST_URL =
  "https://raw.githubusercontent.com/aivanovnl/etsy-ai-blocker/main/src/blocklist.json";
const REFRESH_ALARM = "aif-refresh-blocklist";

async function refreshBlocklist() {
  try {
    const res = await fetch(REMOTE_BLOCKLIST_URL, { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    if (data && Array.isArray(data.shops)) {
      await chrome.storage.local.set({ remoteBlocklist: data });
    }
  } catch (e) {
    // offline or rate-limited — bundled list already loaded by content script
  }
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(REFRESH_ALARM, { periodInMinutes: 60 * 24 });
  refreshBlocklist();
});

chrome.runtime.onStartup.addListener(() => {
  refreshBlocklist();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === REFRESH_ALARM) refreshBlocklist();
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "AIF_STATS_UPDATED") {
    const n = msg.stats?.hiddenToday ?? 0;
    chrome.action.setBadgeText({ text: n > 0 ? String(n) : "" });
    chrome.action.setBadgeBackgroundColor({ color: "#F26639" });
  }
  sendResponse?.({ ok: true });
});
