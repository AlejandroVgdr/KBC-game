/* Profielpagina: persoonlijke info, geldprofiel (radar, niveaus, signalen), badges, doelen, afspraken en transacties. */
(function () {
  const TX_PREVIEW = 8;
  let showAllTx = false;

  function renderHead(id) {
    const c = CHILDREN[id];
    const s = settingsOf(id);
    const tl = totalLevel(id);
    render('profile-head', html`
      <div class="avatar-lg" aria-hidden="true">${c.emoji}</div>
      <div class="profile-head-main">
        <p class="eyebrow">Geldprofiel</p>
        <h1>${displayName(id)}</h1>
        <p class="muted">${[`${c.age} jaar`, s.school, s.city].filter(Boolean).join(' · ')}</p>
        <div class="profile-chips">
          <span class="chip">Niveau ${tl.level} · ${tl.name}</span>
          <span class="chip">${totalXp(id)} XP</span>
          <span class="chip">🔥 ${c.streak} dagen op rij</span>
        </div>
      </div>
      <div class="money-type"><strong>${c.moneyType.title}</strong>${c.moneyType.text}</div>`);
  }

  function renderInfo(id) {
    const c = CHILDREN[id];
    const s = settingsOf(id);
    const rows = [
      ['Naam', `${displayName(id)} ${c.lastName}`],
      ['Geboortedatum', `${formatLongDate(c.birthDate)} (${c.age} jaar)`],
      ['School', s.school || '—'],
      ['Woonplaats', s.city || '—'],
      ['Klant sinds', c.customerSince],
      [c.account.type, c.account.iban],
      ['Saldo', formatEuro(c.account.balance)],
      [c.savings.type, formatEuro(c.savings.balance)],
      ['Zakgeld', `${formatEuro(s.allowance)} per ${s.allowanceFrequency}`],
      ['Ouder', PARENT.fullName],
    ];
    render('profile-info', rows.map(([label, value]) => html`<dt>${label}</dt><dd>${value}</dd>`));
  }

  function renderRadar(id) {
    render('profile-radar', radarSvg([{ values: TOPICS.map((t) => levelValue(topicXp(id, t.id))), cls: 'now' }]));
  }

  function topicCard(id, topic) {
    const xp = topicXp(id, topic.id);
    const lv = levelFor(xp);
    const locked = isLocked(id, topic.id);
    const signals = CHILDREN[id].signals[topic.id] || [];
    const learned = MISSIONS.filter((m) => m.child === id && m.topic === topic.id && state.missions[id][m.id]?.done);
    const explored = SCENARIOS.filter((sc) => sc.topics.includes(topic.id) && state.scenarios[id][sc.id]?.completed);
    return html`<article class="topic-card ${locked ? 'is-locked' : ''}">
      <header>
        <span class="topic-emoji" aria-hidden="true">${topic.emoji}</span>
        <div>
          <h3>${topic.label}</h3>
          <p class="muted small">${locked ? '🔒 Vergrendeld door je ouder' : `Niveau ${lv.level} · ${lv.name}`}</p>
        </div>
        <span class="lvl-big" aria-label="Niveau ${lv.level}">${lv.level}</span>
      </header>
      ${levelSegments(xp)}
      <p class="muted small">${xp} XP${lv.next ? ` · nog ${lv.toNext} XP tot ${lv.next.name}` : ' · maximaal niveau'}</p>
      <ul class="signals">
        ${signals.map((s) => html`<li class="sig-${s.tone}">${TONE_ICON[s.tone]} ${s.text}</li>`)}
        ${learned.map((m) => html`<li class="sig-game">🎮 Missie “${m.title}” voltooid</li>`)}
        ${explored.map((sc) => html`<li class="sig-game">🎮 Simulatie “${sc.title}” afgerond</li>`)}
      </ul>
    </article>`;
  }

  function renderBadges(id) {
    const badges = CHILDREN[id].badges;
    render('badge-count', `${badges.filter((b) => badgeEarned(id, b)).length} van ${badges.length} verdiend`);
    render('profile-badges', badges.map((b) => {
      const earned = badgeEarned(id, b);
      return html`<div class="badge ${earned ? 'is-earned' : ''}" title="${earned ? 'Verdiend' : 'Nog niet verdiend'}">
        <span class="badge-emoji" aria-hidden="true">${b.emoji}</span><strong>${b.name}</strong><span>${b.desc}</span>
      </div>`;
    }));
  }

  function renderGoals(id) {
    render('profile-goals', CHILDREN[id].goals.map((g) => {
      const pct = Math.min(100, Math.round((g.saved / g.target) * 100));
      return html`<div class="goal">
        <div class="goal-top"><span>${g.emoji} ${g.name}</span><span>${formatEuro(g.saved)} / ${formatEuro(g.target)}</span></div>
        <div class="goal-bar" role="progressbar" aria-label="${g.name}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><span style="width:${pct}%"></span></div>
      </div>`;
    }));
  }

  function renderPlans(id) {
    if (CHILDREN[id].age < SIMULATOR_MIN_AGE) {
      render('profile-plans', html`<li>🔒 De simulator gaat open vanaf ${SIMULATOR_MIN_AGE} jaar.</li>`);
      return;
    }
    const plans = SCENARIOS.filter((sc) => state.scenarios[id][sc.id]?.viewed);
    if (!plans.length) {
      render('profile-plans', html`<li>Nog geen plannen verkend. Probeer “Wat als ik…?” in het&nbsp;<a href="spel.html">spel</a>.</li>`);
      return;
    }
    render('profile-plans', plans.map((sc) => {
      const record = state.scenarios[id][sc.id];
      const option = sc.options.find((o) => o.id === record.option);
      return html`<li>
        <span aria-hidden="true">${sc.emoji}</span>
        <span><strong>${sc.title}</strong>${option ? html`<br><span class="muted small">${option.label}</span>` : ''}</span>
        <span class="plan-status ${record.completed ? 'done' : ''}">${record.completed ? '✓ Afgerond' : 'Bekeken'}</span>
      </li>`;
    }));
  }

  function renderRules(id) {
    const s = settingsOf(id);
    const locked = s.lockedTopics.map(topicById).filter(Boolean);
    const focus = topicById(s.focusTopic);
    const rows = [
      ['💶 Zakgeld', `${formatEuro(s.allowance)} per ${s.allowanceFrequency}`],
      ['🐷 Automatisch sparen', `${formatEuro(s.autoSave)} per maand`],
      ['💳 Weeklimiet kaart', formatEuro(s.weeklyLimit)],
      ['🌐 Online betalen', s.onlinePayments ? 'Toegestaan' : 'Uit'],
      ['🎮 In-app aankopen', s.inAppPurchases ? 'Toegestaan' : 'Geblokkeerd'],
      ['🔒 Vergrendelde onderwerpen', locked.length ? locked.map((t) => t.label).join(', ') : 'Geen'],
      ['⭐ Focus van je ouder', focus ? `${focus.emoji} ${focus.label}` : 'Geen'],
      ['🎁 Beloning bij nieuw niveau', s.reward || '—'],
    ];
    render('profile-rules', rows.map(([label, value]) => html`<li><span>${label}</span><span>${value}</span></li>`));
  }

  function renderTransactions(id) {
    const all = [...CHILDREN[id].transactions].reverse();
    const list = showAllTx ? all : all.slice(0, TX_PREVIEW);
    render('profile-tx', list.map((t) => {
      const cat = TX_CATEGORIES[t.cat];
      return html`<li class="tx-row">
        <span class="tx-icon" aria-hidden="true">${cat.emoji}</span>
        <span class="tx-desc"><span>${t.desc}</span><span>${formatShortDate(t.date)} · ${cat.label}</span></span>
        <span class="tx-amount ${t.amount > 0 ? 'pos' : ''}">${formatSignedEuro(t.amount)}</span>
      </li>`;
    }));
    const toggle = document.getElementById('tx-toggle');
    toggle.hidden = all.length <= TX_PREVIEW;
    toggle.textContent = showAllTx ? 'Toon minder' : `Toon alle ${all.length}`;
  }

  document.getElementById('tx-toggle').addEventListener('click', () => {
    showAllTx = !showAllTx;
    renderTransactions(getChildId());
  });

  function renderAll() {
    const id = getChildId();
    renderChrome('profiel');
    document.title = `LevelUp — profiel van ${displayName(id)}`;
    renderHead(id);
    renderInfo(id);
    renderRadar(id);
    render('profile-topics', TOPICS.map((t) => topicCard(id, t)));
    renderBadges(id);
    renderGoals(id);
    renderPlans(id);
    renderRules(id);
    renderTransactions(id);
  }

  renderAll();
  onStateChange(renderAll);
})();
