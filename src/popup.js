const DEFAULTS = {
  enabled: true,
  sensitivity: "medium",
  personalBlocklist: [],
  personalAllowlist: [],
  stats: { today: "", hiddenToday: 0, hiddenTotal: 0 },
};

const enabledEl = document.getElementById("enabled");
const sensitivityEl = document.getElementById("sensitivity");
const todayEl = document.getElementById("today");
const totalEl = document.getElementById("total");
const shopInputEl = document.getElementById("shopInput");
const addBtnEl = document.getElementById("addBtn");
const msgEl = document.getElementById("msg");

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

async function render() {
  const s = { ...DEFAULTS, ...(await chrome.storage.local.get(DEFAULTS)) };
  enabledEl.checked = s.enabled;
  sensitivityEl.value = s.sensitivity;
  const hiddenToday = s.stats.today === todayStr() ? s.stats.hiddenToday : 0;
  todayEl.textContent = hiddenToday;
  totalEl.textContent = s.stats.hiddenTotal || 0;
}

enabledEl.addEventListener("change", () => {
  chrome.storage.local.set({ enabled: enabledEl.checked });
});

sensitivityEl.addEventListener("change", () => {
  chrome.storage.local.set({ sensitivity: sensitivityEl.value });
});

addBtnEl.addEventListener("click", async () => {
  const name = shopInputEl.value.trim();
  if (!name) return;
  const { personalBlocklist = [] } = await chrome.storage.local.get({ personalBlocklist: [] });
  const set = new Set(personalBlocklist.map((s) => s.toLowerCase()));
  set.add(name.toLowerCase());
  await chrome.storage.local.set({ personalBlocklist: [...set] });
  shopInputEl.value = "";
  msgEl.textContent = `Added "${name}" — it'll be hidden on your next search.`;
  setTimeout(() => (msgEl.textContent = ""), 2500);
});

chrome.storage.onChanged.addListener(render);
render();
