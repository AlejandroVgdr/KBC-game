/*
 * LevelUp — gedeelde logica voor alle pagina's.
 *
 * - Veilige HTML: html`` escapet elke ingevoegde waarde automatisch (geen XSS via
 *   vrije tekst of door de ouder aangepaste namen).
 * - State: verdiende XP, missies, scenario's en ouderinstellingen in localStorage,
 *   zodat spel, profiel en ouderpagina live op elkaar afgestemd blijven (ook tussen tabbladen).
 * - Niveaus, XP-toekenning met toasts, radargrafiek en de navigatie.
 */

/* ---------- Veilige HTML-templates ---------- */

class SafeHtml {
  constructor(value) { this.value = value; }
  toString() { return this.value; }
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function toHtml(value) {
  if (value instanceof SafeHtml) return value.value;
  if (Array.isArray(value)) return value.map(toHtml).join('');
  if (value === null || value === undefined || value === false) return '';
  return escapeHtml(value);
}

// Tagged template: elke ${waarde} wordt geëscaped, tenzij ze zelf met html`` gemaakt is.
function html(strings, ...values) {
  let out = strings[0];
  values.forEach((v, i) => { out += toHtml(v) + strings[i + 1]; });
  return new SafeHtml(out);
}

function render(target, content) {
  const el = typeof target === 'string' ? document.getElementById(target) : target;
  if (el) el.innerHTML = toHtml(content);
}

/* ---------- Opmaak ---------- */

const EURO = new Intl.NumberFormat('nl-BE', { style: 'currency', currency: 'EUR' });
const EURO_ROUND = new Intl.NumberFormat('nl-BE', {
  style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0,
});

function formatEuro(n) {
  const v = Math.round(n * 100) / 100;
  return Number.isInteger(v) ? EURO_ROUND.format(v) : EURO.format(v);
}

function formatSignedEuro(n) {
  const v = Math.round(n * 100) / 100;
  return (v > 0 ? '+' : v < 0 ? '−' : '') + formatEuro(Math.abs(v));
}

function formatPercent(rate) {
  const sign = rate < 0 ? '−' : '';
  return `${sign}${Math.abs(rate * 100).toLocaleString('nl-BE', { maximumFractionDigits: 1 })}%`;
}

function parseDate(str) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(str);
}

function formatShortDate(str) {
  return parseDate(str).toLocaleDateString('nl-BE', { day: 'numeric', month: 'short' });
}

function formatLongDate(str) {
  return parseDate(str).toLocaleDateString('nl-BE', { day: 'numeric', month: 'long', year: 'numeric' });
}

// Activiteit van vandaag (live in de demo) toont het uur, oudere items de datum.
function formatWhen(str) {
  const d = parseDate(str);
  if (str.length > 10 && d.toDateString() === new Date().toDateString()) {
    return `vandaag ${d.toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' })}`;
  }
  return formatShortDate(str);
}

function sumAmounts(rows) {
  return Math.round(rows.reduce((s, r) => s + r.amount, 0) * 100) / 100;
}

function cleanText(value, maxLength) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function clampNumber(value, min, max, fallback) {
  if (value === null || String(value).trim() === '') return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/* ---------- State (localStorage, met fallback in het geheugen) ---------- */

const STORAGE_KEY = 'levelup-demo-v1';
const CHILD_IDS = Object.keys(CHILDREN);

function defaultSettings(childId) {
  const d = CHILDREN[childId].defaults;
  return { ...d, lockedTopics: [...d.lockedTopics] };
}

function defaultState() {
  const perChild = (make) => Object.fromEntries(CHILD_IDS.map((id) => [id, make(id)]));
  return {
    activeChild: CHILD_IDS[0],
    earnedXp: perChild(() => ({})),
    weekXp: perChild(() => 0),
    missions: perChild(() => ({})),
    scenarios: perChild(() => ({})),
    checklist: perChild(() => ({})),
    activity: perChild(() => []),
    settings: perChild(defaultSettings),
  };
}

function loadState() {
  const base = defaultState();
  let saved = null;
  try {
    saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || 'null');
  } catch (e) {
    saved = null;
  }
  if (!saved || typeof saved !== 'object') return base;

  if (CHILD_IDS.includes(saved.activeChild)) base.activeChild = saved.activeChild;
  for (const key of ['earnedXp', 'weekXp', 'missions', 'scenarios', 'checklist', 'activity', 'settings']) {
    for (const id of CHILD_IDS) {
      const value = saved[key] && saved[key][id];
      if (value === undefined || value === null) continue;
      const fallback = base[key][id];
      if (typeof value !== typeof fallback || Array.isArray(value) !== Array.isArray(fallback)) continue;
      base[key][id] = key === 'settings' ? { ...fallback, ...value } : value;
    }
  }
  for (const id of CHILD_IDS) {
    if (!Array.isArray(base.settings[id].lockedTopics)) base.settings[id].lockedTopics = [];
  }
  return base;
}

let state = loadState();

function saveState() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    // Geen opslag beschikbaar (bv. privévenster): de demo werkt verder in het geheugen.
  }
}

function resetDemo() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    // Negeren: we herladen hoe dan ook met de standaarddata.
  }
  state = defaultState();
  window.location.reload();
}

// Hertekenen wanneer een ander tabblad (bv. de ouderpagina) de state wijzigt.
const stateListeners = [];
function onStateChange(fn) { stateListeners.push(fn); }
window.addEventListener('storage', (e) => {
  if (e.key !== null && e.key !== STORAGE_KEY) return;
  state = loadState();
  stateListeners.forEach((fn) => fn());
});

/* ---------- Kinderen, instellingen en onderwerpen ---------- */

function getChildId() {
  const param = new URLSearchParams(window.location.search).get('kind');
  if (param && CHILD_IDS.includes(param)) return param;
  return state.activeChild;
}

function setActiveChild(id) {
  if (!CHILD_IDS.includes(id)) return;
  state.activeChild = id;
  saveState();
}

function settingsOf(childId) { return state.settings[childId]; }
function displayName(childId) { return settingsOf(childId).name || CHILDREN[childId].defaults.name; }
function topicById(topicId) { return TOPICS.find((t) => t.id === topicId); }
function isLocked(childId, topicId) { return settingsOf(childId).lockedTopics.includes(topicId); }
function findMission(id) { return MISSIONS.find((m) => m.id === id); }
function findScenario(id) { return SCENARIOS.find((s) => s.id === id); }
function fillName(text, childId) { return text.split('{name}').join(displayName(childId)); }

/* ---------- Niveaus en XP ---------- */

function levelFor(xp, table = LEVELS) {
  let current = table[0];
  table.forEach((l) => { if (xp >= l.minXp) current = l; });
  const next = table.find((l) => l.minXp > xp) || null;
  const pct = next ? Math.round(((xp - current.minXp) / (next.minXp - current.minXp)) * 100) : 100;
  return { level: current.level, name: current.name, next, pct, toNext: next ? next.minXp - xp : 0 };
}

// Niveau als kommagetal (bv. 2,4) zodat de radar ook binnen een niveau meebeweegt.
function levelValue(xp) {
  const lv = levelFor(xp);
  return lv.next ? lv.level + lv.pct / 100 : lv.level;
}

function topicXp(childId, topicId) {
  return (CHILDREN[childId].baseXp[topicId] || 0) + (state.earnedXp[childId][topicId] || 0);
}

function totalXp(childId) {
  return TOPICS.reduce((sum, t) => sum + topicXp(childId, t.id), 0);
}

function totalLevel(childId) { return levelFor(totalXp(childId), TOTAL_LEVELS); }

function badgeEarned(childId, badge) {
  if (badge.earned) return true;
  if (badge.unlockMission) return Boolean(state.missions[childId][badge.unlockMission]?.done);
  if (badge.unlockScenario) return badge.unlockScenario.some((id) => state.scenarios[childId][id]?.completed);
  return false;
}

function earnedBadgeNames(childId) {
  return CHILDREN[childId].badges.filter((b) => badgeEarned(childId, b)).map((b) => b.name);
}

function addActivity(childId, emoji, text) {
  state.activity[childId].unshift({ at: new Date().toISOString(), emoji, text });
  state.activity[childId] = state.activity[childId].slice(0, 30);
}

function allActivity(childId) {
  return [...state.activity[childId].map((a) => ({ ...a, live: true })), ...CHILDREN[childId].activity];
}

// Kent XP toe aan één of meer onderwerpen, logt de activiteit en toont toasts
// voor XP, nieuwe niveaus, de beloning van de ouder en nieuwe badges.
function awardXp(childId, topicIds, xpEach, label, emoji, badgesBefore) {
  const totalBefore = totalLevel(childId).level;
  const levelUps = [];
  topicIds.forEach((topicId) => {
    const before = levelFor(topicXp(childId, topicId)).level;
    state.earnedXp[childId][topicId] = (state.earnedXp[childId][topicId] || 0) + xpEach;
    const after = levelFor(topicXp(childId, topicId));
    if (after.level > before) levelUps.push({ topic: topicById(topicId), level: after.level, name: after.name });
  });
  const gained = xpEach * topicIds.length;
  state.weekXp[childId] += gained;
  addActivity(childId, emoji, `${label} (+${gained} XP)`);
  levelUps.forEach((u) => addActivity(childId, '🎉', `Haalde niveau ${u.level} in ${u.topic.label}`));
  const newBadges = earnedBadgeNames(childId).filter((name) => !badgesBefore.includes(name));
  newBadges.forEach((name) => addActivity(childId, '🏅', `Kreeg de badge “${name}”`));
  saveState();

  if (levelUps.length) {
    levelUps.forEach((u) => showToast(`🎉 Level up! ${u.topic.emoji} ${u.topic.label} → niveau ${u.level} (${u.name}) · +${gained} XP`, 'toast-levelup'));
  } else {
    showToast(`+${gained} XP · ${topicIds.map((id) => `${topicById(id).emoji} ${topicById(id).label}`).join(' + ')}`);
  }
  const totalAfter = totalLevel(childId);
  if (totalAfter.level > totalBefore) showToast(`Nieuw totaalniveau: ${totalAfter.name} 🚀`, 'toast-levelup');
  const reward = settingsOf(childId).reward;
  if (levelUps.length && reward) showToast(`🎁 Beloning van je ouder: ${reward}`, 'toast-reward');
  newBadges.forEach((name) => showToast(`🏅 Nieuwe badge: ${name}`, 'toast-reward'));
}

function answerMission(childId, mission, optionIndex) {
  const record = state.missions[childId][mission.id] || { tries: 0, wrong: [], done: false };
  if (record.done) return record;
  const badgesBefore = earnedBadgeNames(childId);
  record.tries += 1;
  if (optionIndex === mission.correct) {
    record.done = true;
    record.firstTry = record.tries === 1;
    state.missions[childId][mission.id] = record;
    const xp = record.firstTry ? mission.xp : Math.round(mission.xp / 2);
    awardXp(childId, [mission.topic], xp, `Missie “${mission.title}” voltooid`, '✅', badgesBefore);
  } else {
    if (!record.wrong.includes(optionIndex)) record.wrong.push(optionIndex);
    state.missions[childId][mission.id] = record;
    saveState();
  }
  return record;
}

function missionXpEarned(mission, record) {
  return record.firstTry ? mission.xp : Math.round(mission.xp / 2);
}

function viewScenario(childId, scenario, optionId) {
  const record = state.scenarios[childId][scenario.id] || {};
  if (!record.viewed) {
    record.viewed = new Date().toISOString();
    addActivity(childId, '🧭', `Bekeek het scenario “${scenario.title}”`);
  }
  record.option = optionId;
  state.scenarios[childId][scenario.id] = record;
  saveState();
}

function completeScenario(childId, scenario) {
  const record = state.scenarios[childId][scenario.id] || {};
  if (record.completed) return;
  const badgesBefore = earnedBadgeNames(childId);
  record.completed = new Date().toISOString();
  state.scenarios[childId][scenario.id] = record;
  awardXp(childId, scenario.topics, scenario.xp, `Simulatie “${scenario.title}” afgerond`, '🔮', badgesBefore);
}

/* ---------- Vrije tekst → scenario ---------- */

function normalizeText(text) {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Langste/meeste trefwoorden winnen: "studentenjob" verslaat "job", "vakantiejob" verslaat "vakantie".
function matchScenario(text) {
  const query = normalizeText(text);
  let best = null;
  let bestScore = 0;
  SCENARIOS.forEach((scenario) => {
    const score = scenario.keywords.reduce(
      (sum, keyword) => (query.includes(normalizeText(keyword)) ? sum + keyword.length : sum), 0,
    );
    if (score > bestScore) {
      best = scenario;
      bestScore = score;
    }
  });
  return best;
}

/* ---------- Toasts ---------- */

function showToast(text, variant = '') {
  let box = document.getElementById('toasts');
  if (!box) {
    box = document.createElement('div');
    box.id = 'toasts';
    box.className = 'toasts';
    box.setAttribute('aria-live', 'polite');
    document.body.appendChild(box);
  }
  // Hoogstens 3 tegelijk, zodat toasts de inhoud niet bedekken.
  while (box.children.length >= 3) box.firstElementChild.remove();
  const toast = document.createElement('div');
  toast.className = `toast ${variant}`;
  toast.textContent = text;
  box.appendChild(toast);
  setTimeout(() => toast.classList.add('toast-out'), 3600);
  setTimeout(() => toast.remove(), 4100);
}

/* ---------- Gedeelde weergaven ---------- */

const TONE_ICON = { good: '✅', warn: '⚠️', info: '💡', intent: '🧭' };

// Vijf vakjes = vijf niveaus; het huidige vakje vult zich met de XP binnen dat niveau.
function levelSegments(xp) {
  const lv = levelFor(xp);
  return html`<span class="segs" aria-hidden="true">${LEVELS.map((l) => {
    const fill = l.level < lv.level ? 100 : l.level === lv.level ? lv.pct : 0;
    return html`<span class="seg-cell"><span style="width:${fill}%"></span></span>`;
  })}</span>`;
}

function levelRows(childId) {
  return TOPICS.map((t) => {
    const xp = topicXp(childId, t.id);
    const lv = levelFor(xp);
    const locked = isLocked(childId, t.id);
    return html`<div class="lvl-row ${locked ? 'is-locked' : ''}" title="${xp} XP">
      <span class="lvl-emoji" aria-hidden="true">${t.emoji}</span>
      <span class="lvl-name">${t.label}${locked ? ' 🔒' : ''}</span>
      ${levelSegments(xp)}
      <span class="lvl-badge" aria-label="Niveau ${lv.level}">Nv. ${lv.level}</span>
    </div>`;
  });
}

// Radargrafiek (inline SVG) van de 8 onderwerpen; series: [{ values: [0..5], cls }].
function radarSvg(series) {
  const n = TOPICS.length;
  const cx = 170;
  const cy = 160;
  const radius = 105;
  const angle = (i) => -Math.PI / 2 + (2 * Math.PI * i) / n;
  const point = (i, v) => [cx + ((radius * v) / 5) * Math.cos(angle(i)), cy + ((radius * v) / 5) * Math.sin(angle(i))];
  const points = (values) => values.map((v, i) => point(i, v).map((c) => c.toFixed(1)).join(',')).join(' ');

  const rings = [1, 2, 3, 4, 5].map((lv) => html`<polygon class="radar-ring" points="${points(TOPICS.map(() => lv))}"/>`);
  const axes = TOPICS.map((t, i) => {
    const [x, y] = point(i, 5);
    return html`<line class="radar-axis" x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}"/>`;
  });
  const shapes = series.map((s) => html`<polygon class="radar-shape radar-${s.cls}" points="${points(s.values)}"/>`);
  const last = series[series.length - 1];
  const dots = last.values.map((v, i) => {
    const [x, y] = point(i, v);
    return html`<circle class="radar-dot" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.5"/>`;
  });
  const labels = TOPICS.map((t, i) => {
    const cos = Math.cos(angle(i));
    const sin = Math.sin(angle(i));
    const x = cx + (radius + 20) * cos;
    const y = cy + (radius + 20) * sin + (sin < -0.9 ? -4 : sin > 0.9 ? 12 : 4);
    const anchor = Math.abs(cos) < 0.3 ? 'middle' : cos > 0 ? 'start' : 'end';
    return html`<text class="radar-label" x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="${anchor}">${t.emoji} ${t.short}</text>`;
  });
  return html`<svg class="radar" viewBox="-45 0 430 320" role="img" aria-label="Radargrafiek met het niveau per geldonderwerp">
    ${rings}${axes}${shapes}${dots}${labels}
  </svg>`;
}

/* ---------- Navigatie en footer ---------- */

function renderChrome(page) {
  const kidId = getChildId();
  const links = [
    ['index.html', 'start', 'Start'],
    ['spel.html', 'spel', 'Spel'],
    ['profiel.html', 'profiel', 'Profiel'],
    ['ouders.html', 'ouders', 'Ouders'],
  ];
  const showKid = page === 'spel' || page === 'profiel';
  render('topbar', html`<div class="topbar-inner">
    <a class="wordmark" href="index.html"><span class="wordmark-mark" aria-hidden="true">▲</span>LevelUp<span class="wordmark-tag">KBC-demo</span></a>
    <nav class="nav" aria-label="Hoofdmenu">
      ${links.map(([href, id, label]) => html`<a href="${href}" class="${id === page ? 'active' : ''}" ${id === page ? html`aria-current="page"` : ''}>${label}</a>`)}
    </nav>
    ${showKid ? html`<a class="who-chip" href="index.html" title="Wissel van speler"><span aria-hidden="true">${CHILDREN[kidId].emoji}</span>${displayName(kidId)}<span class="who-chip-switch">wissel</span></a>` : ''}
  </div>`);

  render('footer', html`<div class="footer-inner">
    <p>Demo — volledig fictieve data, geen bestaand bankproduct en geen financieel advies. Gebouwd voor de KBC-case (Tectonic Hackathon 2026).</p>
    <button type="button" class="link-btn" id="reset-demo">↺ Reset demo</button>
  </div>`);
  document.getElementById('reset-demo').addEventListener('click', () => {
    if (window.confirm('Alle demo-voortgang en instellingen wissen?')) resetDemo();
  });
}
