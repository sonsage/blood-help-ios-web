const BLOOD_BASE_URL = "https://www.blood.org.tw/xcevent";
const DEVELOPER_WEBSITE_URL = "https://www.oirgc.com.tw/";
const OFFICIAL_FALLBACK = "請以官方公告為準";
const ADDRESS_FALLBACK = "地址不足，請以官方公告為準";
const OFFICIAL_NOTICE = "本 APP 為非官方公益工具，捐血地點、時間、等候人數等資訊，來源為台灣血液基金會公開頁面。實際服務時間、地點與現場狀況，請以官方公告及現場人員說明為準。";
const WEBSITE_NOTICE = "官方網站內容與本 APP 公益功能無關，不影響本 APP 使用。";
const PRIVACY_NOTICE = [
  "本 APP 不需要註冊或登入。",
  "本 APP 不讀取捐血人專區資料。",
  "本 APP 不蒐集姓名、身分證字號、電話、生日、捐血紀錄等個資。",
  "定位功能僅在使用者主動點選「使用目前位置排序」後，用於裝置端判斷目前縣市與行政區，協助排序附近捐血地點。",
  "本 APP 不保存、不上傳、不分享定位資料，不建立移動軌跡。",
  "下次捐血提醒資料僅保存在使用者裝置。"
].join("\n\n");

const counties = [
  "臺北市", "新北市", "桃園市", "臺中市", "臺南市", "高雄市",
  "基隆市", "新竹市", "嘉義市", "新竹縣", "苗栗縣", "彰化縣",
  "南投縣", "雲林縣", "嘉義縣", "屏東縣", "宜蘭縣", "花蓮縣",
  "臺東縣", "澎湖縣", "金門縣", "連江縣"
];

const aliases = new Map([
  ["台北市", "臺北市"],
  ["台中市", "臺中市"],
  ["台南市", "臺南市"],
  ["台東縣", "臺東縣"]
]);

const bloodCenterRegions = new Map([
  ["台北捐血中心", new Set(["臺北市", "新北市", "基隆市", "宜蘭縣", "花蓮縣", "金門縣", "連江縣"])],
  ["新竹捐血中心", new Set(["桃園市", "新竹市", "新竹縣", "苗栗縣"])],
  ["台中捐血中心", new Set(["臺中市", "彰化縣", "南投縣", "雲林縣"])],
  ["高雄捐血中心", new Set(["嘉義市", "嘉義縣", "臺南市", "高雄市", "屏東縣", "臺東縣", "澎湖縣"])]
]);

const donationTypes = [
  { key: "WholeBlood250", label: "全血 250cc", months: 2, weeks: 0 },
  { key: "WholeBlood500", label: "全血 500cc", months: 3, weeks: 0 },
  { key: "Apheresis", label: "分離術捐血", months: 0, weeks: 2 }
];

const state = {
  tab: "home",
  loadState: { kind: "loading" },
  area: null,
  reminder: readReminder(),
  countyMenu: false,
  locationDisclosure: false,
  locating: false,
  siteFilter: "All"
};

const view = document.querySelector("#view");
const toast = document.querySelector("#toast");

document.addEventListener("click", handleClick);
document.addEventListener("change", handleChange);
window.addEventListener("DOMContentLoaded", () => {
  render();
  refresh();
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  }
});

function handleClick(event) {
  const button = event.target.closest("[data-action], [data-tab]");
  if (!button) return;

  const tab = button.dataset.tab;
  if (tab) {
    state.tab = tab;
    setActiveNav(tab);
    render();
    return;
  }

  const action = button.dataset.action;
  if (action === "refresh") refresh();
  if (action === "toggle-counties") {
    state.countyMenu = !state.countyMenu;
    render();
  }
  if (action === "select-county") {
    state.area = { county: button.dataset.county, district: "", fromGps: false };
    state.countyMenu = false;
    render();
  }
  if (action === "show-location-disclosure") {
    state.locationDisclosure = true;
    render();
  }
  if (action === "agree-location") {
    state.locationDisclosure = false;
    useCurrentLocation();
  }
  if (action === "manual-location") {
    state.locationDisclosure = false;
    state.countyMenu = true;
    render();
  }
  if (action === "filter") {
    state.siteFilter = button.dataset.filter;
    render();
  }
  if (action === "open-reminder") {
    state.tab = "reminder";
    setActiveNav("reminder");
    render();
  }
  if (action === "navigate") openMaps(button.dataset.address);
  if (action === "save-reminder") saveReminderFromForm();
  if (action === "about") {
    state.tab = "about";
    render();
  }
  if (action === "privacy") {
    state.tab = "privacy";
    render();
  }
  if (action === "exit") exitApp();
}

function handleChange(event) {
  if (event.target.name === "donationType") {
    state.reminderDraftType = event.target.value;
    renderReminder();
  }
}

function setActiveNav(tab) {
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.classList.toggle("is-active", item.dataset.tab === tab);
  });
}

function render() {
  if (state.tab === "home") renderHome();
  if (state.tab === "reminder") renderReminder();
  if (state.tab === "settings") renderSettings();
  if (state.tab === "about") renderAbout();
  if (state.tab === "privacy") renderPrivacy();
  view.focus({ preventScroll: true });
}

function renderHome() {
  const areaLabel = state.area ? `${state.area.county}${state.area.district || ""}` : "請手動選擇縣市";
  view.innerHTML = `
    <section class="stack">
      ${sectionTitle("⌖", "今日全台捐血地點")}
      <div class="card card-pad location-summary">
        <div class="location-summary">
          <div class="brand-mark" aria-hidden="true">⌖</div>
          <div class="summary-text">
            <div class="label">目前縣市</div>
            <div class="selected-area">${escapeHtml(areaLabel)}</div>
          </div>
        </div>
        <button class="ghost-button" type="button" data-action="toggle-counties">手動選縣市</button>
      </div>
      <button class="ghost-button full" type="button" data-action="show-location-disclosure" ${state.locating ? "disabled" : ""}>${state.locating ? "定位中..." : "使用目前位置排序"}</button>
      ${state.locationDisclosure ? locationDisclosureCard() : ""}
      ${state.countyMenu ? countyPickerCard() : ""}
      ${noticeCard()}
      <button class="ghost-button full" type="button" data-action="refresh">更新資料</button>
      ${filterChips()}
      <p class="muted">${state.area ? "依目前區域排序：同行政區優先、同縣市其次、同捐血中心服務區域再次。" : "可使用目前位置排序，或手動選擇縣市。定位僅在裝置端即時使用，不保存、不上傳。"}</p>
      ${renderLocations()}
      ${reminderEntryCard()}
      ${websiteFooter()}
      <p class="muted">${escapeHtml(OFFICIAL_NOTICE)}</p>
    </section>
  `;
}

function locationDisclosureCard() {
  return `
    <div class="card card-pad">
      <div class="stack">
        <strong class="strong-red">使用目前位置排序</strong>
        <p class="muted">定位僅用於本機判斷目前縣市與行政區，協助排序附近捐血地點。本 APP 不保存、不上傳、不分享定位資料，也不建立移動軌跡。</p>
        <div class="button-row">
          <button class="button full" type="button" data-action="agree-location">同意並定位</button>
          <button class="ghost-button full" type="button" data-action="manual-location">手動選縣市</button>
        </div>
      </div>
    </div>
  `;
}

function countyPickerCard() {
  return `
    <div class="card county-list">
      ${counties.map((county) => `<button type="button" data-action="select-county" data-county="${escapeHtml(county)}">${escapeHtml(county)}</button>`).join("")}
    </div>
  `;
}

function noticeCard() {
  return `
    <div class="card card-pad soft-card notice-row">
      <span class="big-icon" aria-hidden="true">🛡</span>
      <span>${escapeHtml(OFFICIAL_NOTICE)}</span>
    </div>
  `;
}

function filterChips() {
  const filters = [
    ["All", "全部"],
    ["Fixed", "固定"],
    ["Mobile", "巡迴"]
  ];
  return `
    <div class="chip-row" aria-label="捐血點類型">
      ${filters.map(([key, label]) => `<button class="chip ${state.siteFilter === key ? "is-active" : ""}" type="button" data-action="filter" data-filter="${key}">${label}</button>`).join("")}
    </div>
  `;
}

function renderLocations() {
  if (state.loadState.kind === "loading") {
    return `<p class="muted">正在讀取今日公開捐血地點...</p>`;
  }
  if (state.loadState.kind === "error") {
    return errorCard(state.loadState.message);
  }
  const list = filteredNearbyItems(sortedItems(state.loadState.items));
  if (!list.length) {
    return errorCard("目前沒有符合條件的今日捐血地點，請更新資料或以官方公開頁面為準。");
  }
  const groups = groupBy(list, groupLabel);
  return `
    <div class="strong-red">符合條件 ${list.length} 筆</div>
    ${Object.entries(groups).map(([label, locations]) => `
      <div class="group-title">${escapeHtml(label)}</div>
      ${locations.map(locationCard).join("")}
    `).join("")}
  `;
}

function locationCard(location) {
  const fixed = location.type === "定點";
  return `
    <article class="card location-card">
      <div class="location-art ${fixed ? "" : "mobile"}" aria-hidden="true">${fixed ? "♡" : "➤"}</div>
      <div class="location-body">
        <h2 class="location-name">${escapeHtml(safeText(location.name))}</h2>
        <span class="assist-chip">${escapeHtml(safeText(location.type))}</span>
        ${metaRow("◴", `${safeText(location.date)} ${safeText(location.time)}`)}
        ${metaRow("⌖", location.address || ADDRESS_FALLBACK)}
        <p class="muted">來源：台灣血液基金會公開頁面 第 ${location.sourcePage} 頁</p>
        ${location.parseWarning ? `<p class="strong-red">部分欄位解析不足，請以官方公告為準</p>` : ""}
        <div class="card-footer">
          <button class="button" type="button" data-action="navigate" data-address="${escapeHtml(location.address)}" ${location.address ? "" : "disabled"}>導航</button>
          <div class="waiting">等候<strong>${escapeHtml(safeText(location.waitingCount))}</strong>人</div>
        </div>
      </div>
    </article>
  `;
}

function metaRow(icon, text) {
  return `<div class="meta-row"><span class="meta-icon" aria-hidden="true">${icon}</span><span>${escapeHtml(safeText(text))}</span></div>`;
}

function reminderEntryCard() {
  return `
    <button class="card card-pad reminder-entry" type="button" data-action="open-reminder">
      <span class="brand-mark" aria-hidden="true">◴</span>
      <span style="flex:1;text-align:left">
        <strong class="strong-red">下次捐血提醒</strong><br>
        <span>紀錄本次捐血日期，提醒下次捐血日期</span>
      </span>
      <span aria-hidden="true">›</span>
    </button>
  `;
}

function websiteFooter() {
  return `
    <div class="footer-link">
      <a href="${DEVELOPER_WEBSITE_URL}" target="_blank" rel="noopener">正衡官方網站</a>
      <span class="muted">${escapeHtml(WEBSITE_NOTICE)}</span>
    </div>
  `;
}

function renderReminder() {
  const typeKey = state.reminderDraftType || state.reminder.donationType || "WholeBlood250";
  view.innerHTML = `
    <section class="stack">
      ${sectionTitle("◴", "下次捐血提醒")}
      <div class="card card-pad">
        <div class="stack">
          <div class="reminder-entry">
            <span class="brand-mark" aria-hidden="true">◴</span>
            <span class="muted">紀錄本次捐血日期，提醒下次捐血日期</span>
          </div>
          <div class="field">
            <label for="lastDate">本次捐血日期</label>
            <input id="lastDate" type="date" value="${escapeHtml(state.reminder.lastDate || "")}">
          </div>
          <div class="chip-row">
            ${donationTypes.map((type) => `
              <label class="chip ${type.key === typeKey ? "is-active" : ""}">
                <input class="visually-hidden" type="radio" name="donationType" value="${type.key}" ${type.key === typeKey ? "checked" : ""}>
                ${type.label}
              </label>
            `).join("")}
          </div>
          <button class="button full" type="button" data-action="save-reminder">設定提醒</button>
          ${state.reminder.nextDate ? `<p class="strong-red">下次可捐血日期：${escapeHtml(state.reminder.nextDate)}（${escapeHtml(donationTypeByKey(state.reminder.donationType).label)}）</p>` : ""}
        </div>
      </div>
    </section>
  `;
}

function renderSettings() {
  view.innerHTML = `
    <section class="stack">
      ${sectionTitle("⚙", "設定")}
      ${settingRow("ℹ", "關於本 APP", "about")}
      ${settingRow("🛡", "隱私權政策", "privacy")}
      ${settingRow("⇥", "退出 APP", "exit")}
      <p class="muted">${escapeHtml(OFFICIAL_NOTICE)}</p>
    </section>
  `;
}

function renderAbout() {
  view.innerHTML = `
    <section class="stack">
      ${sectionTitle("ℹ", "關於本 APP")}
      <div class="card card-pad"><p class="muted">${escapeHtml(OFFICIAL_NOTICE)}</p></div>
      <div class="card card-pad stack">
        <h2 class="location-name strong-red">開發者資訊</h2>
        <p class="muted">本 APP 由正衡調查與風險控管顧問有限公司製作。若需了解其他工具與服務，可前往正衡官方網站查看。</p>
        <a class="button full" style="display:grid;place-items:center;text-decoration:none" href="${DEVELOPER_WEBSITE_URL}" target="_blank" rel="noopener">開啟正衡官方網站</a>
      </div>
    </section>
  `;
}

function renderPrivacy() {
  view.innerHTML = `
    <section class="stack">
      ${sectionTitle("🛡", "隱私權政策")}
      <div class="card card-pad">
        <p class="muted">${escapeHtml(OFFICIAL_NOTICE)}</p>
        <p class="muted" style="white-space:pre-line">${escapeHtml(PRIVACY_NOTICE)}</p>
      </div>
    </section>
  `;
}

function sectionTitle(icon, title) {
  return `<h2 class="section-title"><span class="icon" aria-hidden="true">${icon}</span><span>${title}</span></h2>`;
}

function settingRow(icon, title, action) {
  return `
    <button class="card setting-row" type="button" data-action="${action}">
      <span class="left"><span aria-hidden="true">${icon}</span><span>${title}</span></span>
      <span aria-hidden="true">›</span>
    </button>
  `;
}

function errorCard(message) {
  return `<div class="card card-pad soft-card notice-row"><span aria-hidden="true">ℹ</span><span>${escapeHtml(message)}</span></div>`;
}

async function refresh() {
  state.loadState = { kind: "loading" };
  render();
  try {
    const items = await loadToday();
    state.loadState = { kind: "ready", items };
  } catch (error) {
    state.loadState = { kind: "error", message: "目前資料讀取失敗，請稍後再試，或以官方公開頁面為準。" };
  }
  render();
}

async function loadToday() {
  const first = await fetchDocument(BLOOD_BASE_URL);
  const pageCount = parseTotalPages(first);
  const pages = [];
  for (let page = 1; page <= pageCount; page += 1) {
    const url = page === 1 ? BLOOD_BASE_URL : pageUrl(page);
    const doc = page === 1 ? first : await fetchDocument(url);
    pages.push(...parsePage(doc, page, url));
  }
  return distinctBy(pages, (item) => `${item.date}|${item.time}|${item.name}|${item.address}`);
}

function pageUrl(page) {
  const url = new URL(BLOOD_BASE_URL);
  url.searchParams.set("page", String(page));
  return url.toString();
}

async function fetchDocument(url) {
  const response = await fetchWithCorsFallback(url);
  const html = await response.text();
  return new DOMParser().parseFromString(html, "text/html");
}

async function fetchWithCorsFallback(url) {
  const localProxy = localProxyUrl(url);
  if (localProxy) {
    const response = await fetch(localProxy, { cache: "no-store" });
    if (response.ok) return response;
  }

  throw new Error("Local proxy is required for browser testing");
}

function localProxyUrl(url) {
  const source = new URL(url);
  if (source.origin !== "https://www.blood.org.tw" || source.pathname !== "/xcevent") return "";
  return `/api/xcevent${source.search}`;
}

function parseTotalPages(doc) {
  const textMatch = doc.body.textContent.match(/共\s*(\d+)\s*頁/);
  const linkPages = [...doc.querySelectorAll('a[href*="page="]')]
    .map((link) => {
      const match = link.getAttribute("href").match(/page=(\d+)/);
      return match ? Number(match[1]) : 0;
    });
  return Math.max(1, Number(textMatch?.[1] || 0), ...linkPages);
}

function parsePage(doc, page, url) {
  const rows = [...doc.querySelectorAll("tr")].map((row) => {
    const cells = [...row.querySelectorAll("td")];
    if (cells.length >= 5) {
      return parseCells(cells[0].textContent, cells[1].textContent, cells[2].textContent, cells[3].textContent, cells[4].textContent, page, url);
    }
    if (cells.length >= 4) {
      return parseCells(cells[0].textContent, todayString(), cells[1].textContent, cells[2].textContent, cells[3].textContent, page, url);
    }
    return null;
  }).filter(Boolean);
  if (rows.length) return rows;

  const textRows = [];
  const datedRegex = /(\d{2}:\d{2}\s*[~-]\s*\d{2}:\d{2})\s+(\d{4}\/\d{2}\/\d{2})\s+(.+?)\s+((?:臺|台|新北|桃園|高雄|基隆|新竹|嘉義|苗栗|彰化|南投|雲林|屏東|宜蘭|花蓮|澎湖|金門|連江).+?)\s+(-|\d+)/g;
  for (const match of doc.body.textContent.matchAll(datedRegex)) {
    const parsed = parseCells(match[1], match[2], match[3], match[4], match[5], page, url);
    if (parsed) textRows.push(parsed);
  }
  const todayRegex = /(\d{2}:\d{2}\s*[~-]\s*\d{2}:\d{2})\s+(.+?)\s+((?:臺|台|新北|桃園|高雄|基隆|新竹|嘉義|苗栗|彰化|南投|雲林|屏東|宜蘭|花蓮|澎湖|金門|連江).+?)\s+(-|\d+)/g;
  for (const match of doc.body.textContent.matchAll(todayRegex)) {
    const parsed = parseCells(match[1], todayString(), match[2], match[3], match[4], page, url);
    if (parsed) textRows.push(parsed);
  }
  if (textRows.length) return textRows;

  return [{
    name: OFFICIAL_FALLBACK,
    type: OFFICIAL_FALLBACK,
    date: todayString(),
    time: OFFICIAL_FALLBACK,
    address: "",
    waitingCount: OFFICIAL_FALLBACK,
    sourcePage: page,
    sourceUrl: url,
    parseWarning: true,
    county: "",
    district: ""
  }];
}

function parseCells(rawTime, rawDate, rawName, rawAddress, rawWaiting, page, url) {
  const name = cleanCell(rawName);
  if (!name || name.includes("捐血點")) return null;
  const date = cleanCell(rawDate) || OFFICIAL_FALLBACK;
  if (date !== OFFICIAL_FALLBACK && date !== todayString()) return null;
  const time = cleanCell(rawTime) || OFFICIAL_FALLBACK;
  const address = cleanCell(rawAddress);
  const waitingCount = cleanCell(rawWaiting) || OFFICIAL_FALLBACK;
  const type = inferType(name, address);
  return {
    name: name || OFFICIAL_FALLBACK,
    type,
    date,
    time,
    address,
    waitingCount,
    sourcePage: page,
    sourceUrl: url,
    parseWarning: date === OFFICIAL_FALLBACK || time === OFFICIAL_FALLBACK,
    county: extractCounty(address),
    district: extractDistrict(address)
  };
}

function inferType(name, address) {
  const text = `${name} ${address}`;
  if (text.includes("捐血室") || text.includes("捐血站")) return "定點";
  return "巡迴";
}

function filteredNearbyItems(items) {
  const typeFiltered = state.siteFilter === "Fixed"
    ? items.filter((item) => item.type === "定點")
    : state.siteFilter === "Mobile"
      ? items.filter((item) => item.type !== "定點")
      : items;

  if (!state.area) return typeFiltered;
  const sameDistrict = typeFiltered.filter((item) => item.county === state.area.county && state.area.district && item.district === state.area.district);
  if (sameDistrict.length) return sameDistrict;
  const sameCounty = typeFiltered.filter((item) => item.county === state.area.county);
  if (sameCounty.length) return sameCounty;
  return typeFiltered.filter((item) => sameBloodCenter(state.area.county, item.county));
}

function sortedItems(items) {
  return [...items].sort((a, b) => {
    const rank = sortRank(state.area, a) - sortRank(state.area, b);
    if (rank) return rank;
    return [a.county.localeCompare(b.county), a.district.localeCompare(b.district), a.time.localeCompare(b.time), a.name.localeCompare(b.name)].find(Boolean) || 0;
  });
}

function sortRank(area, location) {
  if (!area) return 4;
  const selectedCounty = normalizeCounty(area.county);
  if (location.county === selectedCounty && area.district && location.district === area.district) return 0;
  if (location.county === selectedCounty) return 1;
  if (sameBloodCenter(selectedCounty, location.county)) return 2;
  return 3;
}

function groupLabel(location) {
  const center = bloodCenterForCounty(location.county) || "未分類捐血中心";
  const county = location.county || "未標示縣市";
  return `${center}｜${county}${location.district || ""}`;
}

function normalizeCounty(value) {
  const compact = (value || "").trim();
  return aliases.get(compact) || compact;
}

function extractCounty(address) {
  let normalized = address || "";
  aliases.forEach((value, key) => {
    normalized = normalized.replaceAll(key, value);
  });
  return counties.find((county) => normalized.includes(county)) || "";
}

function extractDistrict(address) {
  const county = extractCounty(address);
  if (!county) return "";
  const rest = address.split(county)[1] || "";
  return rest.match(/^[\u4e00-\u9fa5]{1,4}[區鄉鎮市]/)?.[0] || "";
}

function bloodCenterForCounty(county) {
  const normalized = normalizeCounty(county);
  for (const [center, region] of bloodCenterRegions) {
    if (region.has(normalized)) return center;
  }
  return "";
}

function sameBloodCenter(firstCounty, secondCounty) {
  const firstCenter = bloodCenterForCounty(firstCounty);
  return Boolean(firstCenter && firstCenter === bloodCenterForCounty(secondCounty));
}

async function useCurrentLocation() {
  if (!navigator.geolocation) {
    showToast("目前無法取得位置，請改用手動選縣市");
    return;
  }
  state.locating = true;
  render();
  navigator.geolocation.getCurrentPosition(async (position) => {
    const area = await reverseGeocode(position.coords.latitude, position.coords.longitude);
    if (area) {
      state.area = area;
      showToast("已使用目前位置排序附近捐血點");
    } else {
      showToast("目前無法取得位置，請改用手動選縣市");
    }
    state.locating = false;
    render();
  }, () => {
    state.locating = false;
    showToast("未取得定位權限，請改用手動選縣市");
    render();
  }, { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 });
}

async function reverseGeocode(latitude, longitude) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&accept-language=zh-TW`;
    const response = await fetch(url, { headers: { "Accept": "application/json" } });
    if (!response.ok) return null;
    const data = await response.json();
    const address = data.address || {};
    const county = normalizeCounty([address.city, address.county, address.state].find((value) => counties.includes(normalizeCounty(value))) || "");
    const district = [address.city_district, address.town, address.suburb, address.village].find((value) => /[區鄉鎮市]$/.test(value || "")) || "";
    return county ? { county, district, fromGps: true } : null;
  } catch (_) {
    return null;
  }
}

function saveReminderFromForm() {
  const dateInput = document.querySelector("#lastDate");
  const lastDate = dateInput?.value;
  if (!lastDate) {
    showToast("請使用日曆選擇本次捐血日期");
    return;
  }
  const typeKey = document.querySelector('input[name="donationType"]:checked')?.value || "WholeBlood250";
  const type = donationTypeByKey(typeKey);
  const nextDate = addDonationInterval(lastDate, type);
  state.reminder = { lastDate, donationType: type.key, nextDate };
  localStorage.setItem("local_reminder", JSON.stringify(state.reminder));
  scheduleNotification(nextDate, type.label);
  showToast(`已設定提醒：${nextDate}`);
  renderReminder();
}

function readReminder() {
  try {
    const parsed = JSON.parse(localStorage.getItem("local_reminder") || "null");
    return parsed || { lastDate: "", donationType: "WholeBlood250", nextDate: "" };
  } catch (_) {
    return { lastDate: "", donationType: "WholeBlood250", nextDate: "" };
  }
}

function addDonationInterval(dateString, type) {
  const date = new Date(`${dateString}T00:00:00`);
  if (type.months > 0) date.setMonth(date.getMonth() + type.months);
  if (type.weeks > 0) date.setDate(date.getDate() + type.weeks * 7);
  return toInputDate(date);
}

function donationTypeByKey(key) {
  return donationTypes.find((type) => type.key === key) || donationTypes[0];
}

function scheduleNotification(nextDate, label) {
  if (!("Notification" in window)) return;
  const notify = () => {
    new Notification("下次可捐血日期", { body: `${nextDate}（${label}）` });
  };
  if (Notification.permission === "granted") {
    const delay = new Date(`${nextDate}T09:00:00`).getTime() - Date.now();
    if (delay > 0 && delay < 2147483647) window.setTimeout(notify, delay);
  } else if (Notification.permission !== "denied") {
    Notification.requestPermission();
  }
}

function openMaps(address) {
  if (!address) {
    showToast("目前無法開啟地圖");
    return;
  }
  window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, "_blank", "noopener");
}

function exitApp() {
  window.close();
  showToast("若瀏覽器未關閉，請使用 Safari 返回或關閉分頁");
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("is-visible"), 2200);
}

function groupBy(items, keyFn) {
  return items.reduce((groups, item) => {
    const key = keyFn(item);
    groups[key] ||= [];
    groups[key].push(item);
    return groups;
  }, {});
}

function distinctBy(items, keyFn) {
  const seen = new Set();
  return items.filter((item) => {
    const key = keyFn(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function todayString() {
  return toInputDate(new Date()).replaceAll("-", "/");
}

function toInputDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function cleanCell(value) {
  return String(value || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function safeText(value) {
  const text = String(value || "").trim();
  return !text || ["null", "undefined", "NaN"].includes(text) ? OFFICIAL_FALLBACK : text;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
