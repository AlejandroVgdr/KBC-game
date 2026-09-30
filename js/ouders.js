/* Ouderdashboard: kind kiezen, niveaus en vooruitgang, signalen, activiteit en instellingen. */
(function () {
  let childId = getChildId();
  let formDirty = false;

  function renderTabs() {
    render('parent-greeting', `Dag ${PARENT.name} 👋`);
    render('child-tabs', CHILD_IDS.map((id) => html`<button type="button" class="tab ${id === childId ? 'active' : ''}" data-child="${id}" aria-pressed="${id === childId ? 'true' : 'false'}">
      <span aria-hidden="true">${CHILDREN[id].emoji}</span>${displayName(id)} <small>${CHILDREN[id].age} jaar</small>
    </button>`));
  }

  function renderStats() {
    const c = CHILDREN[childId];
    const tl = totalLevel(childId);
    const weekXp = c.weeklyXp[c.weeklyXp.length - 1] + state.weekXp[childId];
    const doneNow = Object.values(state.missions[childId]).filter((r) => r.done).length;
    const latest = allActivity(childId)[0];
    render('stat-tiles', html`
      <div class="stat-tile"><span>Totaalniveau</span><strong>${tl.level} · ${tl.name}</strong><small>${totalXp(childId)} XP</small></div>
      <div class="stat-tile"><span>XP deze week</span><strong>${weekXp}</strong><small>🔥 ${c.streak} dagen op rij</small></div>
      <div class="stat-tile"><span>Missies voltooid</span><strong>${c.missionsCompletedBefore + doneNow}</strong><small>${doneNow ? `waarvan ${doneNow} deze week` : 'sinds de start'}</small></div>
      <div class="stat-tile"><span>Rekening</span><strong>${formatEuro(c.account.balance)}</strong><small>${c.savings.type}: ${formatEuro(c.savings.balance)}</small></div>
      <div class="stat-tile"><span>Laatste activiteit</span><strong>${latest ? formatWhen(latest.at) : '—'}</strong><small>${latest ? `${latest.emoji} ${latest.text}` : ''}</small></div>`);
  }

  function renderProgress() {
    const c = CHILDREN[childId];
    render('progress-rows', TOPICS.map((t) => {
      const nowXp = topicXp(childId, t.id);
      const beforeXp = c.xp4WeeksAgo[t.id] || 0;
      const lvNow = levelFor(nowXp).level;
      const lvBefore = levelFor(beforeXp).level;
      const locked = isLocked(childId, t.id);
      let delta = html`<span class="delta">=</span>`;
      if (lvNow > lvBefore) delta = html`<span class="delta up">▲ +${lvNow - lvBefore} nv.</span>`;
      else if (nowXp > beforeXp) delta = html`<span class="delta">+${nowXp - beforeXp} XP</span>`;
      return html`<div class="prog-row ${locked ? 'is-locked' : ''}" title="${beforeXp} → ${nowXp} XP">
        <span class="lvl-emoji" aria-hidden="true">${t.emoji}</span>
        <span class="lvl-name">${t.label}${locked ? ' 🔒' : ''}</span>
        ${levelSegments(nowXp)}
        <span class="lvl-badge">Nv. ${lvNow}</span>
        ${delta}
      </div>`;
    }));
    render('parent-radar', radarSvg([
      { values: TOPICS.map((t) => levelValue(c.xp4WeeksAgo[t.id] || 0)), cls: 'before' },
      { values: TOPICS.map((t) => levelValue(topicXp(childId, t.id))), cls: 'now' },
    ]));
  }

  function renderWeekly() {
    const c = CHILDREN[childId];
    const weeks = c.weeklyXp.map((v, i) => (i === c.weeklyXp.length - 1 ? v + state.weekXp[childId] : v));
    const max = Math.max(...weeks, 1);
    render('weekly-bars', weeks.map((v, i) => {
      const current = i === weeks.length - 1;
      const label = current ? 'Deze week' : `Wk ${CURRENT_WEEK - (weeks.length - 1 - i)}`;
      return html`<div class="bar-col ${current ? 'current' : ''}">
        <span class="bar-val">${v}</span>
        <div class="bar-track"><div class="bar" style="height:${Math.max(3, Math.round((v / max) * 100))}%"></div></div>
        <span class="bar-label">${label}</span>
      </div>`;
    }));
  }

  function renderInsights() {
    const name = displayName(childId);
    const intents = SCENARIOS
      .filter((sc) => state.scenarios[childId][sc.id]?.viewed)
      .map((sc) => ({ tone: 'intent', title: `${TONE_ICON.intent} Intentie: ${sc.title} ${sc.emoji}`, text: fillName(sc.parentTip, childId) }));
    const struggles = MISSIONS
      .filter((m) => m.child === childId && (state.missions[childId][m.id]?.wrong || []).length)
      .map((m) => {
        const t = topicById(m.topic);
        return { tone: 'info', title: `${t.emoji} ${t.label}: even oefenen`, text: `${name} had de missie “${m.title}” niet meteen juist.`, tip: 'Goed onderwerp om samen over te praten.' };
      });
    const known = CHILDREN[childId].parentInsights.map((i) => ({
      tone: i.tone, title: `${TONE_ICON[i.tone]} ${i.title}`, text: fillName(i.text, childId), tip: i.tip ? fillName(i.tip, childId) : '',
    }));
    render('insights', [...intents, ...struggles, ...known].map((i) => html`<div class="insight tone-${i.tone}">
      <strong>${i.title}</strong>${i.text}${i.tip ? html`<p class="insight-tip">${i.tip}</p>` : ''}
    </div>`));
  }

  function renderActivity() {
    render('activity-feed', allActivity(childId).slice(0, 10).map((a) => html`<li class="${a.live ? 'live' : ''}">
      <span aria-hidden="true">${a.emoji}</span><span>${a.text}</span><span class="feed-when">${formatWhen(a.at)}</span>
    </li>`));
  }

  /* ---------- Instellingen ---------- */

  function renderSettings() {
    const s = settingsOf(childId);
    const name = displayName(childId);
    render('settings-title', `⚙️ Instellingen voor ${name}`);
    const link = document.getElementById('profile-link');
    link.href = `profiel.html?kind=${encodeURIComponent(childId)}`;
    link.textContent = `Bekijk het profiel van ${name} →`;

    render('settings', html`<form class="settings-form" id="settings-form" novalidate>
      <fieldset>
        <legend>Persoonlijke gegevens</legend>
        <label>Voornaam<input name="name" type="text" maxlength="30" value="${s.name}" autocomplete="off"></label>
        <label>School en klas<input name="school" type="text" maxlength="60" value="${s.school}" autocomplete="off"></label>
        <label>Woonplaats<input name="city" type="text" maxlength="40" value="${s.city}" autocomplete="off"></label>
      </fieldset>
      <fieldset>
        <legend>Zakgeld en sparen</legend>
        <div class="row-2">
          <label>Zakgeld (€)<input name="allowance" type="number" min="0" max="200" step="1" value="${s.allowance}"></label>
          <label>Per<select name="allowanceFrequency">
            <option value="week" ${s.allowanceFrequency === 'week' ? html`selected` : ''}>week</option>
            <option value="maand" ${s.allowanceFrequency === 'maand' ? html`selected` : ''}>maand</option>
          </select></label>
        </div>
        <label>Automatisch sparen per maand (€)<input name="autoSave" type="number" min="0" max="200" step="1" value="${s.autoSave}"></label>
        <label>Beloning bij een nieuw niveau<input name="reward" type="text" maxlength="60" value="${s.reward}" autocomplete="off"></label>
      </fieldset>
      <fieldset>
        <legend>Kaart en betalen</legend>
        <label>Weeklimiet voor de kaart (€)<input name="weeklyLimit" type="number" min="0" max="500" step="5" value="${s.weeklyLimit}"></label>
        <label class="switch"><input type="checkbox" name="onlinePayments" ${s.onlinePayments ? html`checked` : ''}>Online betalen toestaan</label>
        <label class="switch"><input type="checkbox" name="inAppPurchases" ${s.inAppPurchases ? html`checked` : ''}>In-app aankopen toestaan</label>
      </fieldset>
      <fieldset>
        <legend>Leerinhoud</legend>
        <p class="small muted">Vergrendel onderwerpen die nog niet aan de orde zijn.</p>
        <div class="topic-toggles">
          ${TOPICS.map((t) => html`<label class="toggle-chip"><input type="checkbox" name="lockedTopics" value="${t.id}" ${s.lockedTopics.includes(t.id) ? html`checked` : ''}>${t.emoji} ${t.label}</label>`)}
        </div>
        <label>Focus-onderwerp (komt eerst in het spel)<select name="focusTopic">
          <option value="">Geen focus</option>
          ${TOPICS.map((t) => html`<option value="${t.id}" ${s.focusTopic === t.id ? html`selected` : ''}>${t.emoji} ${t.label}</option>`)}
        </select></label>
      </fieldset>
      <div class="form-actions">
        <button type="submit" class="btn">Opslaan</button>
        <span class="muted small">${name} ziet de wijzigingen meteen in het spel en op het profiel.</span>
      </div>
    </form>`);

    formDirty = false;
    const form = document.getElementById('settings-form');
    form.addEventListener('input', () => { formDirty = true; });
    form.addEventListener('submit', onSave);
  }

  function describeChanges(prev, next) {
    const labels = (ids) => ids.map((id) => topicById(id).label).join(', ');
    const changes = [];
    if (prev.allowance !== next.allowance || prev.allowanceFrequency !== next.allowanceFrequency) {
      changes.push(`zakgeld ${formatEuro(next.allowance)} per ${next.allowanceFrequency}`);
    }
    if (prev.autoSave !== next.autoSave) changes.push(`automatisch sparen ${formatEuro(next.autoSave)} per maand`);
    if (prev.weeklyLimit !== next.weeklyLimit) changes.push(`weeklimiet ${formatEuro(next.weeklyLimit)}`);
    if (prev.onlinePayments !== next.onlinePayments) changes.push(`online betalen ${next.onlinePayments ? 'aan' : 'uit'}`);
    if (prev.inAppPurchases !== next.inAppPurchases) changes.push(`in-app aankopen ${next.inAppPurchases ? 'aan' : 'uit'}`);
    const locked = next.lockedTopics.filter((id) => !prev.lockedTopics.includes(id));
    const unlocked = prev.lockedTopics.filter((id) => !next.lockedTopics.includes(id));
    if (locked.length) changes.push(`${labels(locked)} vergrendeld`);
    if (unlocked.length) changes.push(`${labels(unlocked)} ontgrendeld`);
    if (prev.focusTopic !== next.focusTopic) changes.push(next.focusTopic ? `focus op ${topicById(next.focusTopic).label}` : 'geen focus meer');
    if (prev.reward !== next.reward) changes.push('nieuwe beloning');
    if (prev.name !== next.name || prev.school !== next.school || prev.city !== next.city) changes.push('persoonlijke gegevens');
    return changes;
  }

  // Alle invoer wordt opgeschoond en begrensd voor ze in de state komt.
  function onSave(e) {
    e.preventDefault();
    const data = new FormData(e.target);
    const previous = settingsOf(childId);
    const lockedIds = data.getAll('lockedTopics');
    const focus = data.get('focusTopic');
    const next = {
      name: cleanText(data.get('name'), 30) || CHILDREN[childId].defaults.name,
      school: cleanText(data.get('school'), 60),
      city: cleanText(data.get('city'), 40),
      allowance: clampNumber(data.get('allowance'), 0, 200, previous.allowance),
      allowanceFrequency: data.get('allowanceFrequency') === 'week' ? 'week' : 'maand',
      autoSave: clampNumber(data.get('autoSave'), 0, 200, previous.autoSave),
      weeklyLimit: clampNumber(data.get('weeklyLimit'), 0, 500, previous.weeklyLimit),
      onlinePayments: data.get('onlinePayments') === 'on',
      inAppPurchases: data.get('inAppPurchases') === 'on',
      lockedTopics: TOPICS.map((t) => t.id).filter((id) => lockedIds.includes(id)),
      focusTopic: TOPICS.some((t) => t.id === focus) ? focus : '',
      reward: cleanText(data.get('reward'), 60),
    };
    const changes = describeChanges(previous, next);
    state.settings[childId] = next;
    if (changes.length) addActivity(childId, '⚙️', `${PARENT.name} paste aan: ${changes.join(', ')}`);
    saveState();
    showToast(changes.length ? `✓ Opgeslagen — ${next.name} ziet dit meteen` : 'Niets gewijzigd');
    renderAll();
  }

  document.getElementById('child-tabs').addEventListener('click', (e) => {
    const tab = e.target.closest('button[data-child]');
    if (!tab || tab.dataset.child === childId) return;
    if (formDirty && !window.confirm('Je hebt niet-bewaarde wijzigingen. Toch van kind wisselen?')) return;
    childId = tab.dataset.child;
    setActiveChild(childId);
    renderAll();
  });

  function renderAll({ keepForm = false } = {}) {
    renderChrome('ouders');
    renderTabs();
    renderStats();
    renderProgress();
    renderWeekly();
    renderInsights();
    renderActivity();
    if (!keepForm) renderSettings();
  }

  renderAll();
  // Een ander tabblad (bv. het kind dat speelt) wijzigde de state: live bijwerken,
  // maar een half ingevuld formulier niet overschrijven.
  onStateChange(() => renderAll({ keepForm: formDirty }));
})();
