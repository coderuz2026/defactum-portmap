/* ===========================================================================
   PortMap — app logic
   Features: light/dark theme · font picker (+upload) · guest view / admin edit
   · GitHub direct save · VLAN names + tooltips · camera highlighting
   =========================================================================== */
(function () {
  "use strict";

  const app = document.getElementById("app");
  const STORE_KEY = "portmap.data.v1";
  const THEME_KEY = "portmap.theme";
  const FONT_KEY = "portmap.font";
  const FONTDATA_KEY = "portmap.fontdata";
  const PIN_KEY = "portmap.pin";
  const ADMIN_KEY = "portmap.admin";
  const GH_KEY = "portmap.gh";

  let state = { switches: [], vlans: {}, dirty: false, synced: false };

  /* =================== state =================== */
  const deep = (x) => JSON.parse(JSON.stringify(x));
  function useFile() {
    state.switches = deep(window.SWITCHES || []);
    state.vlans = deep(window.VLANS || {});
    state.dirty = false; state.synced = false;
    state.baseVersion = Number(window.DATA_VERSION || 0);
  }
  function loadState() {
    const fileVer = Number(window.DATA_VERSION || 0);
    let draft = null;
    try { draft = JSON.parse(localStorage.getItem(STORE_KEY) || "null"); } catch (e) {}
    if (draft && draft.switches) {
      const dVer = Number(draft.version || 0);
      // Если в репозитории опубликована более свежая версия и локально нет
      // несохранённых правок — берём файл (так ПК подхватит правки с телефона).
      if (fileVer > dVer && !draft.dirty) { useFile(); try { localStorage.removeItem(STORE_KEY); } catch (e) {} return; }
      state.switches = draft.switches;
      state.vlans = draft.vlans || deep(window.VLANS || {});
      state.dirty = !!draft.dirty;
      state.synced = !draft.dirty;
      state.baseVersion = dVer || fileVer;
      return;
    }
    useFile();
  }
  function persist() {
    state.dirty = true; state.synced = false;
    try { localStorage.setItem(STORE_KEY, JSON.stringify({ version: state.baseVersion || 0, switches: state.switches, vlans: state.vlans, dirty: true })); } catch (e) {}
  }
  function markSynced(ver) {
    state.baseVersion = ver; state.dirty = false; state.synced = true;
    try { localStorage.setItem(STORE_KEY, JSON.stringify({ version: ver, switches: state.switches, vlans: state.vlans, dirty: false })); } catch (e) {}
  }
  function resetToFile() {
    try { localStorage.removeItem(STORE_KEY); } catch (e) {}
    useFile();
  }

  /* =================== helpers =================== */
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const baseUrl = () => location.href.split("#")[0];
  const slug = (s) => String(s || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const vlanName = (v) => state.vlans[String(v)] || "";
  const isCamera = (p) => /camera|камера/i.test(vlanName(p.vlan)) || !!p.channel;
  function status(p) { if (p.off) return "off"; if (p.host || p.ip || p.mac) return "on"; return "empty"; }
  function ledClass(p) { if (p.off) return "off"; if (status(p) === "empty") return ""; return isCamera(p) ? "cam" : "on"; }
  function counts(sw) {
    let on = 0, off = 0, cam = 0;
    sw.ports.forEach((p) => { p.off ? off++ : on++; if (!p.off && isCamera(p)) cam++; });
    return { total: sw.ports.length, on, off, cam, vlans: new Set(sw.ports.map((p) => p.vlan)).size };
  }
  const findSwitch = (id) => state.switches.find((s) => s.id === id);

  /* =================== toast =================== */
  let toastTimer;
  function toast(msg) {
    let t = document.querySelector(".toast");
    if (!t) { t = document.createElement("div"); t.className = "toast"; document.body.appendChild(t); }
    t.textContent = msg;
    requestAnimationFrame(() => t.classList.add("show"));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 2200);
  }
  async function copy(text) {
    try { await navigator.clipboard.writeText(text); }
    catch { const ta = document.createElement("textarea"); ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0"; document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); } catch (e) {} ta.remove(); }
    toast("Скопировано: " + text);
  }

  /* =================== theme =================== */
  function getTheme() { return document.documentElement.getAttribute("data-theme") || "dark"; }
  function setTheme(t) {
    document.documentElement.setAttribute("data-theme", t);
    try { localStorage.setItem(THEME_KEY, t); } catch (e) {}
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", t === "light" ? "#eef1f5" : "#0d1014");
  }
  function toggleTheme() { setTheme(getTheme() === "light" ? "dark" : "light"); route(); }

  /* =================== fonts =================== */
  const FONTS = [
    { id: "Onest", g: "Onest:wght@400;500;600;700" },
    { id: "Inter", g: "Inter:wght@400;500;600;700" },
    { id: "Manrope", g: "Manrope:wght@400;500;600;700" },
    { id: "Golos Text", g: "Golos+Text:wght@400;500;600;700" },
    { id: "Unbounded", g: "Unbounded:wght@400;500;600;700" },
    { id: "system-ui", g: null },
  ];
  function loadGoogleFont(g) {
    if (!g) return;
    const id = "gf-" + g.replace(/[^a-z0-9]/gi, "");
    if (document.getElementById(id)) return;
    const l = document.createElement("link");
    l.id = id; l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=" + g + "&display=swap";
    document.head.appendChild(l);
  }
  function applyFont(id) {
    const f = FONTS.find((x) => x.id === id);
    if (f) loadGoogleFont(f.g);
    document.documentElement.style.setProperty("--ui-font", "'" + id + "', system-ui, -apple-system, sans-serif");
    try { localStorage.setItem(FONT_KEY, id); localStorage.removeItem(FONTDATA_KEY); } catch (e) {}
    const cf = document.getElementById("pm-custom-font"); if (cf) cf.remove();
  }
  function applyCustomFont(dataUrl) {
    let s = document.getElementById("pm-custom-font");
    if (!s) { s = document.createElement("style"); s.id = "pm-custom-font"; document.head.appendChild(s); }
    s.textContent = "@font-face{font-family:'PortMapCustom';src:url(" + dataUrl + ");font-display:swap}";
    document.documentElement.style.setProperty("--ui-font", "'PortMapCustom', system-ui, sans-serif");
    try { localStorage.setItem(FONT_KEY, "custom"); localStorage.setItem(FONTDATA_KEY, dataUrl); } catch (e) { toast("Шрифт слишком большой для сохранения"); }
  }
  function currentFont() { try { return localStorage.getItem(FONT_KEY) || "Onest"; } catch (e) { return "Onest"; } }
  function initFonts() { const f = currentFont(); if (f && f !== "custom") { const o = FONTS.find((x) => x.id === f); if (o) loadGoogleFont(o.g); } }

  /* =================== admin / pin =================== */
  function pinHash(s) { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return "h" + h; }
  function hasPin() { try { return !!localStorage.getItem(PIN_KEY); } catch (e) { return false; } }
  function checkPin(s) { try { return localStorage.getItem(PIN_KEY) === pinHash(s); } catch (e) { return false; } }
  function setPin(s) { try { localStorage.setItem(PIN_KEY, pinHash(s)); } catch (e) {} }
  function isAdmin() { try { return localStorage.getItem(ADMIN_KEY) === "1"; } catch (e) { return false; } }
  function setAdmin(v) { try { v ? localStorage.setItem(ADMIN_KEY, "1") : localStorage.removeItem(ADMIN_KEY); } catch (e) {} }

  /* =================== github =================== */
  function ghGet() { try { return JSON.parse(localStorage.getItem(GH_KEY) || "{}"); } catch (e) { return {}; } }
  function ghSet(c) { try { localStorage.setItem(GH_KEY, JSON.stringify(c)); } catch (e) {} }
  function ghReady() { const c = ghGet(); return !!(c.owner && c.repo && c.token); }
  const b64 = (str) => btoa(unescape(encodeURIComponent(str)));
  async function githubSave() {
    const c = ghGet();
    if (!ghReady()) { toast("Заполните данные GitHub в настройках"); return; }
    const path = c.path || "data.js";
    const branch = c.branch || "main";
    const api = `https://api.github.com/repos/${c.owner}/${c.repo}/contents/${path.split("/").map(encodeURIComponent).join("/")}`;
    const headers = { Authorization: "Bearer " + c.token, Accept: "application/vnd.github+json" };
    toast("Проверяю GitHub…");
    try {
      let sha, remoteVer = 0;
      const g = await fetch(api + "?ref=" + encodeURIComponent(branch), { headers });
      if (g.ok) {
        const j = await g.json();
        sha = j.sha;
        try { const m = atob((j.content || "").replace(/\s/g, "")).match(/DATA_VERSION\s*=\s*(\d+)/); if (m) remoteVer = Number(m[1]); } catch (e) {}
      }
      if (remoteVer && state.baseVersion && remoteVer > state.baseVersion) {
        if (!confirm("На GitHub уже есть более свежие данные — похоже, их опубликовали с другого устройства. Перезаписать их этой версией?")) { toast("Публикация отменена"); return; }
      }
      const ver = Date.now();
      const put = await fetch(api, {
        method: "PUT", headers: Object.assign({ "Content-Type": "application/json" }, headers),
        body: JSON.stringify({ message: "Обновление данных через PortMap", content: b64(serializeDataJs(ver)), branch, sha }),
      });
      if (!put.ok) { const e = await put.json().catch(() => ({})); throw new Error(e.message || ("HTTP " + put.status)); }
      markSynced(ver);
      toast("Сохранено на GitHub ✓ другие устройства увидят через ~1 мин");
      route();
    } catch (err) { toast("GitHub: " + err.message); }
  }
  async function githubTest() {
    const c = ghGet();
    if (!ghReady()) { toast("Сначала заполните owner, repo и токен"); return; }
    try {
      const r = await fetch(`https://api.github.com/repos/${c.owner}/${c.repo}`, { headers: { Authorization: "Bearer " + c.token, Accept: "application/vnd.github+json" } });
      if (r.ok) toast("Связь с GitHub есть ✓"); else { const e = await r.json().catch(() => ({})); toast("GitHub: " + (e.message || r.status)); }
    } catch (e) { toast("Ошибка сети: " + e.message); }
  }

  /* =================== export data.js =================== */
  function lit(v) { return (typeof v === "number" && isFinite(v)) ? String(v) : JSON.stringify(v == null ? "" : String(v)); }
  function serializeDataJs(ver) {
    ver = ver || Date.now();
    const L = ["// PortMap — данные (сгенерировано приложением).", "", "window.DATA_VERSION = " + ver + ";", "", "window.VLANS = {"];
    Object.keys(state.vlans).sort((a, b) => Number(a) - Number(b)).forEach((k) => {
      L.push("  " + (/^\d+$/.test(k) ? k : JSON.stringify(k)) + ": " + lit(state.vlans[k]) + ",");
    });
    L.push("};", "", "window.SWITCHES = [");
    state.switches.forEach((sw) => {
      L.push("  {");
      L.push("    id: " + lit(sw.id) + ",");
      L.push("    name: " + lit(sw.name) + ",");
      L.push("    location: " + lit(sw.location || "") + ",");
      L.push("    ports: [");
      (sw.ports || []).forEach((p) => {
        let seg = `{ port: ${Number(p.port)}, vlan: ${lit(p.vlan)}, ip: ${lit(p.ip || "")}, mac: ${lit(p.mac || "")}, host: ${lit(p.host || "")}`;
        if (p.channel) seg += `, channel: ${lit(p.channel)}`;
        if (p.off) seg += `, off: true`;
        L.push("      " + seg + " },");
      });
      L.push("    ],");
      L.push("  },");
    });
    L.push("];", "");
    return L.join("\n");
  }
  function downloadData() {
    const ver = Date.now();
    const blob = new Blob([serializeDataJs(ver)], { type: "text/javascript" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "data.js";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    markSynced(ver);
    toast("data.js скачан — залейте его в репозиторий, чтобы изменения увидели все устройства");
    route();
  }
  function resetData() { if (!confirm("Сбросить локальные изменения к версии из файла?")) return; resetToFile(); route(); toast("Сброшено к версии из файла"); }

  /* =================== icons =================== */
  const I = {
    search: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>',
    qr: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3M21 14v7h-7v-3"/></svg>',
    back: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>',
    arrow: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>',
    print: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="7" rx="1"/></svg>',
    pen: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
    trash: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>',
    plus: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>',
    sun: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    moon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z"/></svg>',
    gear: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 6.6 19l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 4 13.6H4a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 5 6.6l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3 1.6 1.6 0 0 0 1-1.5V2a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8 1.6 1.6 0 0 0 1.5 1H22a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z"/></svg>',
    cam: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>',
    save: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/></svg>',
    list: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>',
  };

  /* =================== top bar / edit bar =================== */
  function topbar(extra, lock) {
    const themeBtn = `<button class="iconbtn" data-theme-toggle title="${getTheme() === "light" ? "Тёмная тема" : "Светлая тема"}">${getTheme() === "light" ? I.moon : I.sun}</button>`;
    const gearBtn = `<button class="iconbtn" data-settings title="Настройки">${I.gear}</button>`;
    const brandInner = `<span class="brand-glyph"><i></i><i></i><i></i><i></i><i></i><i></i></span><b>PortMap</b><span class="sub">карта портов</span>`;
    const brand = lock ? `<span class="brand">${brandInner}</span>` : `<a class="brand" href="#/">${brandInner}</a>`;
    return `
      <div class="topbar"><div class="topbar-inner">
        ${brand}
        <span class="spacer"></span>
        ${extra || ""}
        ${themeBtn}${gearBtn}
      </div></div>
      ${editbar()}`;
  }
  function editbar() {
    if (!isAdmin()) return "";
    const tag = state.dirty
      ? `<span class="tag"><span class="dirty-dot"></span>Изменения не опубликованы</span>`
      : state.synced ? `<span class="tag">✓ Опубликовано</span>`
      : `<span class="tag">Админ-режим</span>`;
    const publishBtn = ghReady()
      ? `<button class="btn btn-primary btn-sm" data-gh-save>${I.save} Опубликовать на GitHub</button>`
      : (state.dirty ? `<button class="btn btn-primary btn-sm" data-settings>${I.gear} Настроить GitHub</button>` : "");
    return `<div class="editbar"><div class="editbar-in">
        ${tag}<span class="spacer"></span>
        <button class="btn btn-ghost btn-sm" data-vlan-ref>${I.list} VLAN</button>
        ${publishBtn}
        <button class="btn btn-ghost btn-sm" data-dl>Скачать data.js</button>
        ${state.dirty ? `<button class="btn btn-ghost btn-sm" data-reset>Сбросить</button>` : ""}
      </div></div>`;
  }

  /* =================== HOME =================== */
  function renderHome(q) {
    q = (q || "").trim().toLowerCase();
    const data = state.switches;
    const list = q ? data.filter((s) => (s.name + " " + (s.location || "") + " " + s.ports.map((p) => p.host + " " + p.ip).join(" ")).toLowerCase().includes(q)) : data;
    const totalPorts = data.reduce((a, s) => a + s.ports.length, 0);
    const activePorts = data.reduce((a, s) => a + s.ports.filter((p) => !p.off).length, 0);

    const cards = list.map((sw) => {
      const c = counts(sw);
      const leds = sw.ports.map((p) => `<i class="${ledClass(p)}"></i>`).join("");
      const right = isAdmin()
        ? `<span class="row-edit"><button class="iconbtn sm" data-edit-switch="${esc(sw.id)}" title="Изменить">${I.pen}</button></span>`
        : `<span class="arrow">${I.arrow}</span>`;
      return `
        <div class="card" data-go="#/sw/${esc(sw.id)}">
          <div class="card-top"><div><h3>${esc(sw.name)}</h3>${sw.location ? `<div class="loc">${esc(sw.location)}</div>` : ""}</div>${right}</div>
          <div class="ledstrip">${leds}</div>
          <div class="card-foot">
            <span><b>${c.total}</b> портов</span>
            <span><span class="dot green"></span><b>${c.on}</b> активно</span>
            ${c.cam ? `<span><span class="dot cam"></span><b>${c.cam}</b> камер</span>` : ""}
            <span><span class="dot red"></span><b>${c.off}</b> выкл</span>
          </div>
        </div>`;
    }).join("");
    const addCard = isAdmin() ? `<button class="card card-add" data-add-switch>${I.plus}<span>Добавить свитч</span></button>` : "";

    app.innerHTML = `
      ${topbar(`<a class="btn btn-ghost" href="#/qr">${I.qr} QR-коды</a>`)}
      <div class="wrap">
        <div class="section-head"><span class="eyebrow">Сеть · ${data.length} свитчей</span><h1>Свитчи</h1></div>
        <div class="search">${I.search}<input id="q" type="search" placeholder="Поиск по свитчу, хосту, IP…" value="${esc(q)}" autocomplete="off"></div>
        <div class="stats">
          <div class="stat"><div class="n">${data.length}</div><div class="l">Свитчей</div></div>
          <div class="stat"><div class="n">${totalPorts}</div><div class="l">Портов всего</div></div>
          <div class="stat"><div class="n green">${activePorts}</div><div class="l">Активно</div></div>
        </div>
        <div class="grid">${addCard}${cards || (q ? `<div class="empty-state">Ничего не найдено по запросу «${esc(q)}»</div>` : "")}</div>
      </div>`;
    const input = document.getElementById("q");
    input.addEventListener("input", () => renderHome(input.value));
    if (q) { input.focus(); input.setSelectionRange(q.length, q.length); }
    bindAll();
  }

  /* =================== SWITCH DETAIL =================== */
  function renderSwitch(id, q) {
    const sw = findSwitch(id);
    if (!sw) return renderHome("");
    q = (q || "").trim().toLowerCase();
    const c = counts(sw);
    const filtered = q ? sw.ports.filter((p) => (p.port + " " + p.host + " " + p.ip + " " + p.mac + " vlan" + p.vlan + " " + vlanName(p.vlan) + " " + (p.channel || "")).toLowerCase().includes(q)) : sw.ports;

    const tiles = sw.ports.map((p) => {
      const st = status(p), lc = ledClass(p);
      const cls = st === "off" ? "is-off" : st === "empty" ? "is-empty" : "";
      return `
        <button class="port ${cls} ${isCamera(p) && !p.off ? "cam" : ""}" data-port="${p.port}">
          <div class="port-top"><span class="port-num">${p.port}${isCamera(p) ? `<span class="cam-ic">${I.cam}</span>` : ""}</span><span class="led ${lc}"></span></div>
          <span class="port-host">${esc(p.host || "—")}</span>
          <span class="port-vlan">VLAN ${esc(p.vlan)}</span>
        </button>`;
    }).join("");

    const rows = filtered.map((p) => {
      const st = status(p), lc = ledClass(p);
      const meta = [];
      if (p.ip) meta.push(`<span class="ip">${esc(p.ip)}</span>`);
      if (p.mac) meta.push(`<span>${esc(p.mac)}</span>`);
      const badges = [
        `<span class="badge vlan" data-vlan="${esc(p.vlan)}" title="нажми — название VLAN">VLAN ${esc(p.vlan)}</span>`,
        p.channel ? `<span class="badge chan">${esc(p.channel)}</span>` : "",
        p.off ? `<span class="badge off">OFF</span>` : "",
      ].join("");
      const edit = isAdmin() ? `<span class="row-edit"><button class="iconbtn sm" data-edit-port="${p.port}" title="Изменить">${I.pen}</button><button class="iconbtn sm danger" data-del-port="${p.port}" title="Удалить">${I.trash}</button></span>` : "";
      return `
        <div class="row ${lc === "cam" ? "cam" : st === "off" ? "off" : st === "on" ? "on" : ""} ${st === "empty" ? "is-empty" : ""}" data-row="${p.port}">
          <div class="pnum">${p.port}<small>ПОРТ</small></div>
          <div class="pmain"><div class="phost">${isCamera(p) ? `<span class="cam-ic">${I.cam}</span>` : ""}${esc(p.host || "не подписан")}</div>${meta.length ? `<div class="pmeta">${meta.join("")}</div>` : ""}</div>
          <div class="pright">${badges}${edit}</div>
        </div>
        <div class="expand" id="exp-${p.port}" style="height:0"></div>`;
    }).join("");

    const admin = isAdmin();
    const actions = admin
      ? `<button class="btn btn-ghost btn-sm" data-edit-switch="${esc(sw.id)}">${I.pen} Изменить</button><button class="btn btn-primary btn-sm" data-add-port>${I.plus} Порт</button>`
      : "";

    app.innerHTML = `
      ${topbar("", !admin)}
      <div class="wrap">
        ${admin ? `<div class="back" data-go="#/">${I.back} Все свитчи</div>` : ""}
        <div class="detail-head"><div><span class="eyebrow">Свитч${sw.location ? " · " + esc(sw.location) : ""}</span><h1>${esc(sw.name)}</h1></div><div class="detail-actions">${actions}</div></div>
        <div class="stats">
          <div class="stat"><div class="n">${c.total}</div><div class="l">Портов</div></div>
          <div class="stat"><div class="n green">${c.on}</div><div class="l">Активно</div></div>
          ${c.cam ? `<div class="stat"><div class="n" style="color:var(--cam)">${c.cam}</div><div class="l">Камер</div></div>` : ""}
          <div class="stat"><div class="n red">${c.off}</div><div class="l">Выключено</div></div>
        </div>
        <div class="panel-label"><span>Лицевая панель</span><span class="line"></span><span>нажми на порт</span></div>
        <div class="faceplate"><div class="ports">${tiles || '<span class="muted" style="padding:8px">Портов пока нет</span>'}</div></div>
        <div class="search">${I.search}<input id="q" type="search" placeholder="Поиск порта: хост, IP, MAC, VLAN…" value="${esc(q)}" autocomplete="off"></div>
        <div class="list">${rows || `<div class="empty-state">Портов по запросу «${esc(q)}» нет</div>`}</div>
      </div>`;

    const input = document.getElementById("q");
    input.addEventListener("input", () => renderSwitch(id, input.value));
    if (q) { input.focus(); input.setSelectionRange(q.length, q.length); }

    let openPort = null;
    function toggle(port) {
      const p = sw.ports.find((x) => x.port === port);
      const exp = document.getElementById("exp-" + port);
      document.querySelectorAll(".port.sel").forEach((e) => e.classList.remove("sel"));
      if (openPort === port) { if (exp) { exp.style.height = "0"; exp.innerHTML = ""; } openPort = null; return; }
      if (openPort != null) { const prev = document.getElementById("exp-" + openPort); if (prev) { prev.style.height = "0"; prev.innerHTML = ""; } }
      openPort = port;
      const tile = document.querySelector(`.port[data-port="${port}"]`); if (tile) tile.classList.add("sel");
      if (!exp) { input.value = ""; renderSwitch(id, ""); setTimeout(() => toggle(port), 0); return; }
      const f = (k, v, cp) => `<div class="field"><div class="k">${k}</div><div class="v">${v ? esc(v) : "—"}${v && cp ? ` <button class="copy" data-copy="${esc(v)}">копи</button>` : ""}</div></div>`;
      const vn = vlanName(p.vlan);
      exp.innerHTML = `<div class="expand-inner">
        ${f("IP-адрес", p.ip, true)}${f("MAC-адрес", p.mac, true)}
        ${f("Хост", p.host, false)}${f("VLAN", "VLAN " + p.vlan + (vn ? " · " + vn : ""), false)}
        ${p.channel ? f("Канал камеры", p.channel, false) : ""}${f("Статус", p.off ? "Выключен" : "Активен", false)}
      </div>`;
      exp.style.height = exp.firstElementChild.offsetHeight + 18 + "px";
      exp.querySelectorAll(".copy").forEach((b) => b.addEventListener("click", (e) => { e.stopPropagation(); copy(b.dataset.copy); }));
    }

    document.querySelectorAll("[data-port]").forEach((el) => el.addEventListener("click", () => {
      const p = +el.dataset.port; toggle(p);
      const row = document.querySelector(`[data-row="${p}"]`); if (row) row.scrollIntoView({ behavior: "smooth", block: "center" });
    }));
    document.querySelectorAll("[data-row]").forEach((el) => el.addEventListener("click", () => toggle(+el.dataset.row)));
    document.querySelectorAll("[data-vlan]").forEach((el) => el.addEventListener("click", (e) => { e.stopPropagation(); showVlanPopover(el, el.dataset.vlan); }));

    bindAll(sw);
  }

  /* =================== VLAN popover =================== */
  function closePopover() { const p = document.querySelector(".popover"); if (p) p.remove(); document.removeEventListener("click", onDocClick, true); }
  function onDocClick(e) { const p = document.querySelector(".popover"); if (p && !p.contains(e.target)) closePopover(); }
  function showVlanPopover(anchor, vlan) {
    closePopover();
    const name = vlanName(vlan);
    const pop = document.createElement("div");
    pop.className = "popover";
    pop.innerHTML = `<div class="pv-id">VLAN ${esc(vlan)}</div><div class="pv-name">${name ? esc(name) : "без названия"}</div><div class="pv-type">universal VLAN</div>${isAdmin() ? `<button class="btn btn-ghost btn-sm pv-edit" data-edit-vlan="${esc(vlan)}">${I.pen} Изменить</button>` : ""}`;
    document.body.appendChild(pop);
    const r = anchor.getBoundingClientRect();
    let top = r.bottom + window.scrollY + 6, left = r.left + window.scrollX;
    if (left + pop.offsetWidth > window.scrollX + document.documentElement.clientWidth - 8) left = window.scrollX + document.documentElement.clientWidth - pop.offsetWidth - 8;
    pop.style.top = top + "px"; pop.style.left = left + "px";
    const eb = pop.querySelector("[data-edit-vlan]");
    if (eb) eb.addEventListener("click", (e) => { e.stopPropagation(); closePopover(); editVlan(vlan); });
    setTimeout(() => document.addEventListener("click", onDocClick, true), 0);
  }

  /* =================== QR =================== */
  function renderQR() {
    const base = baseUrl();
    const cards = state.switches.map((sw) => {
      const url = base + "#/sw/" + sw.id;
      let svg = "";
      try { const qr = qrcode(0, "M"); qr.addData(url); qr.make(); svg = qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true }); }
      catch (e) { svg = `<div style="color:#900;font-size:12px">QR error</div>`; }
      return `<div class="qr-card">${svg}<div class="qr-name">${esc(sw.name)}</div><div class="qr-url">${esc(url)}</div></div>`;
    }).join("");
    app.innerHTML = `
      ${topbar(`<button class="btn btn-primary" id="printBtn">${I.print} Печать</button>`)}
      <div class="wrap">
        <div class="back" data-go="#/">${I.back} Все свитчи</div>
        <div class="section-head"><span class="eyebrow">Только просмотр · для печати</span><h1>QR-коды</h1></div>
        <div class="qr-note">Распечатай лист и наклей каждый QR на свой свитч. Кто сканирует — попадает только на <b>просмотр</b> карты этого свитча (без редактирования).<br>Новый свитч откроется по QR на других устройствах только после публикации (кнопка «Опубликовать на GitHub» или загрузка <code>data.js</code> в репозиторий).<br>Адрес берётся автоматически: <code>${esc(base)}</code></div>
        <div class="qr-grid">${cards}</div>
      </div>`;
    document.getElementById("printBtn").addEventListener("click", () => window.print());
    bindAll();
  }

  /* =================== generic modal =================== */
  function openModal(opts) {
    const ov = document.createElement("div"); ov.className = "modal-ov";
    const fieldsHtml = opts.fields.map((f) => {
      if (f.type === "checkbox") return `<label class="mfield mcheck"><input type="checkbox" data-k="${f.key}" ${f.value ? "checked" : ""}><span>${esc(f.label)}</span></label>`;
      return `<label class="mfield"><span class="mk">${esc(f.label)}${f.required ? " *" : ""}</span><input type="${f.type || "text"}" data-k="${f.key}" value="${esc(f.value == null ? "" : f.value)}" placeholder="${esc(f.placeholder || "")}" ${f.type === "number" ? 'inputmode="numeric"' : ""}>${f.hint ? `<small>${esc(f.hint)}</small>` : ""}</label>`;
    }).join("");
    ov.innerHTML = `<div class="modal"><div class="modal-head"><h3>${esc(opts.title)}</h3><button class="modal-x">✕</button></div><div class="modal-body">${fieldsHtml}</div><div class="modal-foot">${opts.onDelete ? `<button class="btn btn-danger" data-act="del">${I.trash} Удалить</button>` : ""}<span class="spacer"></span><button class="btn btn-ghost" data-act="cancel">Отмена</button><button class="btn btn-primary" data-act="save">Сохранить</button></div></div>`;
    document.body.appendChild(ov);
    const close = () => ov.remove();
    const collect = () => { const o = {}; ov.querySelectorAll("[data-k]").forEach((i) => { o[i.dataset.k] = i.type === "checkbox" ? i.checked : i.value.trim(); }); return o; };
    ov.querySelector(".modal-x").onclick = close;
    ov.querySelector('[data-act="cancel"]').onclick = close;
    ov.addEventListener("click", (e) => { if (e.target === ov) close(); });
    ov.querySelector('[data-act="save"]').onclick = () => { const v = collect(); const err = opts.validate ? opts.validate(v) : null; if (err) { toast(err); return; } opts.onSave(v); close(); };
    if (opts.onDelete) ov.querySelector('[data-act="del"]').onclick = () => { if (confirm("Точно удалить?")) { opts.onDelete(); close(); } };
    const first = ov.querySelector("input"); if (first) setTimeout(() => first.focus(), 40);
  }

  function editSwitch(sw) {
    const isNew = !sw;
    openModal({
      title: isNew ? "Новый свитч" : "Изменить свитч",
      fields: [
        { key: "name", label: "Название", value: sw ? sw.name : "", required: true, placeholder: "Подвал · склад" },
        { key: "location", label: "Описание / где стоит", value: sw ? sw.location : "", placeholder: "Цоколь, шкаф №2" },
        { key: "id", label: "ID для ссылки и QR (латиницей)", value: sw ? sw.id : "", required: true, hint: "Без пробелов. От него зависит адрес QR." },
      ],
      validate: (v) => { if (!v.name) return "Введите название"; const id = slug(v.id) || slug(v.name); if (!id) return "Введите ID латиницей"; if (state.switches.some((s) => s.id === id && s !== sw)) return "Такой ID уже есть"; return null; },
      onSave: (v) => { const id = slug(v.id) || slug(v.name); if (isNew) { state.switches.push({ id, name: v.name, location: v.location, ports: [] }); persist(); toast("Свитч добавлен. Опубликуй на GitHub, чтобы QR заработал на других устройствах."); location.hash = "#/sw/" + id; } else { const old = sw.id; sw.id = id; sw.name = v.name; sw.location = v.location; persist(); if (old !== id) location.hash = "#/sw/" + id; else route(); } },
      onDelete: isNew ? null : () => { state.switches = state.switches.filter((s) => s !== sw); persist(); location.hash = "#/"; },
    });
  }

  function editPort(sw, p) {
    const isNew = !p;
    openModal({
      title: isNew ? "Новый порт" : "Порт " + p.port,
      fields: [
        { key: "port", label: "Номер порта", type: "number", value: p ? p.port : "", required: true },
        { key: "vlan", label: "VLAN ID", value: p ? p.vlan : "", placeholder: "3" },
        { key: "ip", label: "IP-адрес", value: p ? p.ip : "", placeholder: "192.168.100.10" },
        { key: "mac", label: "MAC-адрес", value: p ? p.mac : "", placeholder: "aa-bb-cc-dd-ee-ff" },
        { key: "host", label: "Имя хоста / устройство", value: p ? p.host : "", placeholder: "NVR-1" },
        { key: "channel", label: "Канал камеры (если камера)", value: p ? p.channel : "", placeholder: "D4" },
        { key: "off", label: "Порт выключен (красный)", type: "checkbox", value: p ? !!p.off : false },
      ],
      validate: (v) => { const n = Number(v.port); if (!v.port || !Number.isFinite(n)) return "Введите номер порта"; if (sw.ports.some((x) => Number(x.port) === n && x !== p)) return "Порт " + n + " уже есть"; return null; },
      onSave: (v) => { const vlan = /^\d+$/.test(String(v.vlan)) ? Number(v.vlan) : (v.vlan || ""); const obj = { port: Number(v.port), vlan, ip: v.ip || "", mac: v.mac || "", host: v.host || "" }; if (v.channel) obj.channel = v.channel; if (v.off) obj.off = true; if (isNew) sw.ports.push(obj); else { Object.keys(p).forEach((k) => delete p[k]); Object.assign(p, obj); } sw.ports.sort((a, b) => a.port - b.port); persist(); route(); },
      onDelete: isNew ? null : () => { sw.ports = sw.ports.filter((x) => x !== p); persist(); route(); },
    });
  }

  function editVlan(vlan) {
    const exists = vlan != null && state.vlans[String(vlan)] != null;
    openModal({
      title: exists ? "VLAN " + vlan : "Новый VLAN",
      fields: [
        { key: "id", label: "VLAN ID", type: "number", value: vlan != null ? vlan : "", required: true },
        { key: "name", label: "Название", value: vlan != null ? state.vlans[String(vlan)] || "" : "", required: true, placeholder: "CAMERA" },
      ],
      validate: (v) => { if (!v.id || !/^\d+$/.test(String(v.id))) return "Введите номер VLAN"; if (!v.name) return "Введите название"; return null; },
      onSave: (v) => { if (vlan != null && String(vlan) !== String(v.id)) delete state.vlans[String(vlan)]; state.vlans[String(v.id)] = v.name; persist(); route(); },
      onDelete: exists ? () => { delete state.vlans[String(vlan)]; persist(); route(); } : null,
    });
  }

  function openVlanRef() {
    const ov = document.createElement("div"); ov.className = "modal-ov";
    const rows = Object.keys(state.vlans).sort((a, b) => Number(a) - Number(b)).map((k) =>
      `<div class="row" data-vlan-row="${esc(k)}" style="grid-template-columns:70px 1fr ${isAdmin() ? "38px" : ""};cursor:${isAdmin() ? "pointer" : "default"}">
        <div class="pnum">${esc(k)}<small>VLAN</small></div>
        <div class="pmain"><div class="phost">${esc(state.vlans[k])}</div><div class="pmeta">universal VLAN</div></div>
        ${isAdmin() ? `<div class="pright"><button class="iconbtn sm" data-edit-vlan="${esc(k)}">${I.pen}</button></div>` : ""}
      </div>`).join("");
    ov.innerHTML = `<div class="modal wide"><div class="modal-head"><h3>Справочник VLAN</h3><button class="modal-x">✕</button></div><div class="modal-body"><div class="list">${rows}</div></div>${isAdmin() ? `<div class="modal-foot"><span class="spacer"></span><button class="btn btn-primary" data-add-vlan>${I.plus} Добавить VLAN</button></div>` : ""}</div>`;
    document.body.appendChild(ov);
    const close = () => ov.remove();
    ov.querySelector(".modal-x").onclick = close;
    ov.addEventListener("click", (e) => { if (e.target === ov) close(); });
    ov.querySelectorAll("[data-edit-vlan]").forEach((b) => b.addEventListener("click", (e) => { e.stopPropagation(); close(); editVlan(b.dataset.editVlan); }));
    const av = ov.querySelector("[data-add-vlan]"); if (av) av.addEventListener("click", () => { close(); editVlan(null); });
  }

  /* =================== settings modal =================== */
  function openSettings() {
    const ov = document.createElement("div"); ov.className = "modal-ov";
    const fontOpts = FONTS.map((f) => `<div class="font-opt ${currentFont() === f.id ? "active" : ""}" data-font="${f.id}" style="font-family:'${f.id}',system-ui">Aa Яя<small>${f.id === "system-ui" ? "Системный" : f.id}</small></div>`).join("");

    let adminHtml;
    if (isAdmin()) {
      const c = ghGet();
      adminHtml = `
        <div class="set-sec"><h4>Администрирование</h4>
          <div class="note-line">Вы вошли как админ. Гости (через QR) видят только просмотр.</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-ghost btn-sm" data-change-pin>Сменить PIN</button><button class="btn btn-danger btn-sm" data-admin-out>Выйти из админа</button></div>
        </div>
        <div class="set-sec"><h4>Сохранение на GitHub</h4>
          <div class="note-line">Чтобы изменения сразу попадали на сайт. Токен хранится только в этом браузере.</div>
          <label class="mfield"><span class="mk">Владелец (owner)</span><input type="text" data-gh="owner" value="${esc(c.owner || "")}" placeholder="coderuz2026"></label>
          <label class="mfield"><span class="mk">Репозиторий</span><input type="text" data-gh="repo" value="${esc(c.repo || "")}" placeholder="portmap"></label>
          <label class="mfield"><span class="mk">Ветка</span><input type="text" data-gh="branch" value="${esc(c.branch || "main")}" placeholder="main"></label>
          <label class="mfield"><span class="mk">Путь к файлу</span><input type="text" data-gh="path" value="${esc(c.path || "data.js")}" placeholder="data.js"></label>
          <label class="mfield"><span class="mk">Personal Access Token</span><input type="password" data-gh="token" value="${esc(c.token || "")}" placeholder="github_pat_…"><small>Fine-grained токен с правом Contents: Read and write на этот репозиторий.</small></label>
          <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-primary btn-sm" data-gh-savecfg>Сохранить</button><button class="btn btn-ghost btn-sm" data-gh-test>Проверить связь</button></div>
        </div>`;
    } else if (hasPin()) {
      adminHtml = `<div class="set-sec"><h4>Администрирование</h4><label class="mfield"><span class="mk">PIN-код</span><input type="password" data-pin inputmode="numeric" placeholder="••••"></label><button class="btn btn-primary btn-sm" data-pin-login>Войти как админ</button></div>`;
    } else {
      adminHtml = `<div class="set-sec"><h4>Администрирование</h4><div class="note-line">Задайте PIN, чтобы открывать редактирование только себе. Гости (через QR) останутся на просмотре.</div><label class="mfield"><span class="mk">Придумайте PIN</span><input type="password" data-pin inputmode="numeric" placeholder="например 2468"></label><button class="btn btn-primary btn-sm" data-pin-create>Создать PIN и войти</button></div>`;
    }

    ov.innerHTML = `<div class="modal wide">
      <div class="modal-head"><h3>Настройки</h3><button class="modal-x">✕</button></div>
      <div class="modal-body">
        <div class="set-sec"><h4>Тема</h4><div class="seg"><button data-set-theme="light" class="${getTheme() === "light" ? "active" : ""}">${I.sun} Светлая</button><button data-set-theme="dark" class="${getTheme() === "dark" ? "active" : ""}">${I.moon} Тёмная</button></div></div>
        <div class="set-sec"><h4>Шрифт</h4><div class="fontgrid">${fontOpts}</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><button class="btn btn-ghost btn-sm filebtn">Загрузить свой шрифт<input type="file" accept=".woff2,.woff,.ttf,.otf" data-font-file></button><span class="note-line">.woff2 / .ttf / .otf</span></div>
        </div>
        ${adminHtml}
      </div></div>`;
    document.body.appendChild(ov);
    const close = () => ov.remove();
    ov.querySelector(".modal-x").onclick = close;
    ov.addEventListener("click", (e) => { if (e.target === ov) close(); });

    ov.querySelectorAll("[data-set-theme]").forEach((b) => b.addEventListener("click", () => { setTheme(b.dataset.setTheme); ov.querySelectorAll("[data-set-theme]").forEach((x) => x.classList.toggle("active", x === b)); }));
    ov.querySelectorAll("[data-font]").forEach((b) => b.addEventListener("click", () => { applyFont(b.dataset.font); ov.querySelectorAll("[data-font]").forEach((x) => x.classList.toggle("active", x === b)); toast("Шрифт изменён"); }));
    const ff = ov.querySelector("[data-font-file]");
    if (ff) ff.addEventListener("change", () => { const file = ff.files[0]; if (!file) return; if (file.size > 3.5 * 1024 * 1024) { toast("Файл больше 3.5 МБ — не сохранится"); } const r = new FileReader(); r.onload = () => { applyCustomFont(r.result); ov.querySelectorAll("[data-font]").forEach((x) => x.classList.remove("active")); toast("Свой шрифт применён"); }; r.readAsDataURL(file); });

    const pinEl = () => ov.querySelector("[data-pin]");
    const create = ov.querySelector("[data-pin-create]"); if (create) create.addEventListener("click", () => { const v = pinEl().value.trim(); if (v.length < 3) { toast("PIN минимум 3 знака"); return; } setPin(v); setAdmin(true); close(); route(); toast("Админ-режим включён"); });
    const login = ov.querySelector("[data-pin-login]"); if (login) login.addEventListener("click", () => { if (checkPin(pinEl().value.trim())) { setAdmin(true); close(); route(); toast("Вход выполнен"); } else toast("Неверный PIN"); });
    const out = ov.querySelector("[data-admin-out]"); if (out) out.addEventListener("click", () => { setAdmin(false); close(); route(); toast("Вы вышли из админ-режима"); });
    const chpin = ov.querySelector("[data-change-pin]"); if (chpin) chpin.addEventListener("click", () => { const v = prompt("Новый PIN (минимум 3 знака):"); if (v && v.trim().length >= 3) { setPin(v.trim()); toast("PIN изменён"); } });

    ov.querySelectorAll("[data-gh]").forEach((i) => i.addEventListener("input", () => {}));
    const savecfg = ov.querySelector("[data-gh-savecfg]");
    if (savecfg) savecfg.addEventListener("click", () => { const c = {}; ov.querySelectorAll("[data-gh]").forEach((i) => (c[i.dataset.gh] = i.value.trim())); ghSet(c); close(); route(); toast("Настройки GitHub сохранены"); });
    const ghtest = ov.querySelector("[data-gh-test]"); if (ghtest) ghtest.addEventListener("click", () => { const c = {}; ov.querySelectorAll("[data-gh]").forEach((i) => (c[i.dataset.gh] = i.value.trim())); ghSet(c); githubTest(); });
  }

  /* =================== bindings =================== */
  function bindAll(currentSwitch) {
    document.querySelectorAll("[data-go]").forEach((el) => el.addEventListener("click", () => (location.hash = el.dataset.go)));
    const th = document.querySelector("[data-theme-toggle]"); if (th) th.addEventListener("click", toggleTheme);
    const st = document.querySelector("[data-settings]"); if (st) st.addEventListener("click", openSettings);
    const dl = document.querySelector("[data-dl]"); if (dl) dl.addEventListener("click", downloadData);
    const rs = document.querySelector("[data-reset]"); if (rs) rs.addEventListener("click", resetData);
    const gs = document.querySelector("[data-gh-save]"); if (gs) gs.addEventListener("click", githubSave);
    const vr = document.querySelector("[data-vlan-ref]"); if (vr) vr.addEventListener("click", openVlanRef);
    const add = document.querySelector("[data-add-switch]"); if (add) add.addEventListener("click", () => editSwitch(null));
    document.querySelectorAll("[data-edit-switch]").forEach((el) => el.addEventListener("click", (e) => { e.stopPropagation(); editSwitch(findSwitch(el.dataset.editSwitch)); }));
    if (currentSwitch) {
      const ap = document.querySelector("[data-add-port]"); if (ap) ap.addEventListener("click", () => editPort(currentSwitch, null));
      document.querySelectorAll("[data-edit-port]").forEach((el) => el.addEventListener("click", (e) => { e.stopPropagation(); editPort(currentSwitch, currentSwitch.ports.find((x) => x.port === +el.dataset.editPort)); }));
      document.querySelectorAll("[data-del-port]").forEach((el) => el.addEventListener("click", (e) => { e.stopPropagation(); const p = currentSwitch.ports.find((x) => x.port === +el.dataset.delPort); if (p && confirm("Удалить порт " + p.port + "?")) { currentSwitch.ports = currentSwitch.ports.filter((x) => x !== p); persist(); route(); } }));
    }
  }

  /* =================== guest kiosk lock =================== */
  let lastSwitchId = null;
  function renderScanPrompt() {
    app.innerHTML = `
      ${topbar("", true)}
      <div class="wrap">
        <div class="scan-prompt">
          <div class="scan-ic">${I.qr}</div>
          <h2>Отсканируйте QR-код</h2>
          <p>Наведите камеру на QR-код, наклеенный на свитче, чтобы увидеть его карту портов.</p>
        </div>
      </div>`;
    bindAll();
  }

  function route() {
    closePopover();
    const h = location.hash.replace(/^#\/?/, "");
    const parts = h.split("/").filter(Boolean);
    window.scrollTo(0, 0);

    // Гость (не админ): доступен только один свитч — тот, чей QR отсканировали.
    if (!isAdmin()) {
      if ((parts[0] === "sw" || parts[0] === "k") && parts[1]) {
        const id = decodeURIComponent(parts[1]);
        if (findSwitch(id)) { lastSwitchId = id; if (location.hash !== "#/sw/" + id) history.replaceState(null, "", "#/sw/" + id); return renderSwitch(id, ""); }
      }
      // Любая попытка уйти на главную / список / QR — возвращаем на свой свитч.
      if (lastSwitchId && findSwitch(lastSwitchId)) {
        if (location.hash !== "#/sw/" + lastSwitchId) history.replaceState(null, "", "#/sw/" + lastSwitchId);
        return renderSwitch(lastSwitchId, "");
      }
      return renderScanPrompt();
    }

    // Админ: полный доступ.
    if (parts[0] === "qr") return renderQR();
    if ((parts[0] === "sw" || parts[0] === "k") && parts[1]) return renderSwitch(decodeURIComponent(parts[1]), "");
    return renderHome("");
  }

  /* =================== init =================== */
  initFonts();
  loadState();
  window.addEventListener("hashchange", route);
  route();
})();
