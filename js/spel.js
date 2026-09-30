/* Kinderpagina: missies op basis van de eigen transacties en de "Wat als ik…?"-simulator. */
(function () {
  const MISSIONS_PREVIEW = 3;
  let childId = getChildId();
  let missionOrder = [];
  let showAllMissions = false;
  let openScenario = null; // { id, option }

  const kid = () => CHILDREN[childId];
  const missionRecord = (id) => state.missions[childId][id];

  // De volgorde ligt vast per paginabezoek (of na een wijziging door de ouder), zodat een kaart
  // niet wegspringt net nadat je ze beantwoordt. Open missies eerst, de focus van de ouder
  // bovenaan, daarna de zwakste onderwerpen.
  function computeMissionOrder() {
    const focus = settingsOf(childId).focusTopic;
    const done = (m) => Boolean(missionRecord(m.id)?.done);
    missionOrder = MISSIONS
      .filter((m) => m.child === childId)
      .sort((a, b) => {
        if (done(a) !== done(b)) return done(a) ? 1 : -1;
        if ((a.topic === focus) !== (b.topic === focus)) return a.topic === focus ? -1 : 1;
        return topicXp(childId, a.topic) - topicXp(childId, b.topic);
      })
      .map((m) => m.id);
  }

  /* ---------- Hero en niveaus ---------- */

  function renderHero() {
    const c = kid();
    const tl = totalLevel(childId);
    const goal = c.goals[0];
    render('kid-hero', html`
      <div class="kid-hero-main">
        <div class="avatar-xl" aria-hidden="true">${c.emoji}</div>
        <div>
          <p class="eyebrow">Jouw geldavontuur</p>
          <h1>Hey ${displayName(childId)}! 👋</h1>
          <p class="kid-hero-level">Niveau ${tl.level} · ${tl.name} — ${totalXp(childId)} XP</p>
          <div class="xp-bar" role="progressbar" aria-label="Voortgang naar het volgende niveau" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${tl.pct}"><span style="width:${tl.pct}%"></span></div>
          <p class="kid-hero-next">${tl.next ? `Nog ${tl.toNext} XP tot ${tl.next.name}` : 'Maximaal niveau bereikt!'}</p>
        </div>
      </div>
      <div class="hero-stats">
        <div class="stat"><strong>🔥 ${c.streak}</strong><small>dagen op rij</small></div>
        <div class="stat"><strong>${formatEuro(c.account.balance)}</strong><small>op je rekening</small></div>
        <div class="stat"><strong>${goal.emoji} ${Math.round((goal.saved / goal.target) * 100)}%</strong><small>${goal.name}</small></div>
      </div>`);
  }

  function renderLevels() {
    render('level-bars', levelRows(childId));
  }

  /* ---------- Missies ---------- */

  function missionCard(mission) {
    const c = kid();
    const topic = topicById(mission.topic);
    const record = missionRecord(mission.id);
    const done = Boolean(record?.done);
    const wrong = record?.wrong || [];
    const focus = mission.topic === settingsOf(childId).focusTopic;
    const txs = mission.txIds.map((id) => c.transactions.find((t) => t.id === id)).filter(Boolean);
    const shown = txs.slice(0, 4);

    return html`<article class="mission ${done ? 'is-done' : ''} ${focus && !done ? 'is-focus' : ''}" data-mission="${mission.id}">
      <div class="mission-head">
        <span class="chip">${topic.emoji} ${topic.label}</span>
        ${focus ? html`<span class="chip chip-focus">⭐ Aangeraden door je ouder</span>` : ''}
        <span class="mission-xp">${done ? `✓ +${missionXpEarned(mission, record)} XP` : `+${mission.xp} XP`}</span>
      </div>
      <h3>${mission.title}</h3>
      <div class="evidence">
        <p class="evidence-tag">📄 Uit jouw uitgaven</p>
        <ul class="evidence-list">
          ${shown.map((t) => html`<li><span>${formatShortDate(t.date)}</span><span>${t.desc}</span><span class="${t.amount > 0 ? 'pos' : ''}">${formatSignedEuro(t.amount)}</span></li>`)}
        </ul>
        ${txs.length > shown.length ? html`<p class="evidence-more">+ nog ${txs.length - shown.length} andere aankopen</p>` : ''}
        <p class="evidence-note">${mission.context}</p>
        ${mission.sms ? html`<p class="sms"><span class="sms-from">Sms van een onbekend nummer</span>${mission.sms}</p>` : ''}
      </div>
      <p class="mission-q">${mission.question}</p>
      <div class="options">
        ${mission.options.map((option, i) => {
          const cls = done ? (i === mission.correct ? 'is-correct' : '') : wrong.includes(i) ? 'is-wrong' : '';
          const disabled = done || wrong.includes(i);
          return html`<button type="button" class="opt ${cls}" data-option="${i}" ${disabled ? html`disabled` : ''}>${option}</button>`;
        })}
      </div>
      ${!done && wrong.length ? html`<p class="feedback bad" role="status" tabindex="-1">❌ Niet helemaal. Probeer nog eens (voor de helft van de XP)!</p>` : ''}
      ${done ? html`<p class="feedback good" role="status" tabindex="-1">✅ ${mission.explanation}</p>` : ''}
    </article>`;
  }

  function renderMissions() {
    const missions = missionOrder.map(findMission);
    const unlocked = missions.filter((m) => !isLocked(childId, m.topic));
    const visible = showAllMissions ? unlocked : unlocked.slice(0, MISSIONS_PREVIEW);
    const lockedLabels = [...new Set(missions.filter((m) => isLocked(childId, m.topic)).map((m) => topicById(m.topic).label))];
    const doneCount = unlocked.filter((m) => missionRecord(m.id)?.done).length;
    render('mission-progress', `${doneCount}/${unlocked.length} voltooid`);
    render('missions', html`${visible.map(missionCard)}
      ${unlocked.length > MISSIONS_PREVIEW ? html`<button type="button" class="more-btn" data-action="toggle-missions">${showAllMissions ? 'Toon minder missies' : `Toon alle ${unlocked.length} missies (+${unlocked.length - MISSIONS_PREVIEW})`}</button>` : ''}
      ${lockedLabels.length ? html`<p class="locked-note">🔒 Vergrendeld door je ouder: ${lockedLabels.join(', ')}</p>` : ''}`);
  }

  document.getElementById('missions').addEventListener('click', (e) => {
    if (e.target.closest('button[data-action="toggle-missions"]')) {
      showAllMissions = !showAllMissions;
      renderMissions();
      return;
    }
    const button = e.target.closest('button[data-option]');
    if (!button) return;
    const mission = findMission(button.closest('[data-mission]').dataset.mission);
    if (!mission || mission.child !== childId || isLocked(childId, mission.topic)) return;
    answerMission(childId, mission, Number(button.dataset.option));
    renderHero();
    renderLevels();
    renderMissions();
    // Focus terug naar de feedback, zodat toetsenbord- en schermlezergebruikers niet de draad kwijt zijn.
    document.querySelector(`[data-mission="${CSS.escape(mission.id)}"] .feedback`)?.focus({ preventScroll: true });
  });

  /* ---------- Simulator ---------- */

  function scenarioLocked(scenario) {
    return isLocked(childId, scenario.topics[0]);
  }

  function renderSimulator() {
    if (kid().age < SIMULATOR_MIN_AGE) {
      openScenario = null;
      render('sim-card', html`<h2>🔮 Wat als ik…?</h2>
        <div class="locked-box">🔒 De simulator gaat open vanaf ${SIMULATOR_MIN_AGE} jaar. Tot dan: verdien XP met je missies!</div>
        <p class="muted small">Scenario’s zoals gaan studeren, een studentenjob of op kot gaan worden pas echt interessant als je wat ouder bent.</p>`);
      return;
    }
    if (openScenario && scenarioLocked(findScenario(openScenario.id))) openScenario = null;

    render('sim-card', html`<h2>🔮 Wat als ik…?</h2>
      <p class="card-sub">Vertel wat je van plan bent. We simuleren wat je moet regelen en wat er verandert aan je budget — met je eigen cijfers.</p>
      <form class="sim-form" id="sim-form" autocomplete="off">
        <label class="sim-label" for="sim-input">Ik wil…</label>
        <input id="sim-input" type="text" maxlength="80" placeholder="bv. op kot gaan, een studentenjob, op reis">
        <button type="submit" class="btn">Simuleer</button>
      </form>
      <div class="chips" id="sim-chips"></div>
      <p class="hint" id="sim-hint" role="status" hidden></p>
      <div id="sim-result"></div>`);

    document.getElementById('sim-form').addEventListener('submit', onSimSubmit);
    document.getElementById('sim-chips').addEventListener('click', (e) => {
      const chip = e.target.closest('button[data-scenario]');
      if (chip) openScenarioById(chip.dataset.scenario);
    });
    bindResultEvents();
    renderChips();
    if (openScenario) renderScenario();
  }

  function renderChips() {
    render('sim-chips', SCENARIOS.map((sc) => {
      const locked = scenarioLocked(sc);
      const active = openScenario?.id === sc.id;
      const done = Boolean(state.scenarios[childId][sc.id]?.completed);
      return html`<button type="button" class="chip-btn ${active ? 'active' : ''} ${locked ? 'locked' : ''}" data-scenario="${sc.id}" aria-pressed="${active ? 'true' : 'false'}">${sc.emoji} ${sc.title}${locked ? ' 🔒' : done ? ' ✓' : ''}</button>`;
    }));
  }

  function showHint(content) {
    const hint = document.getElementById('sim-hint');
    render(hint, content);
    hint.hidden = !content;
  }

  function onSimSubmit(e) {
    e.preventDefault();
    const text = cleanText(document.getElementById('sim-input').value, 80);
    if (!text) {
      showHint(html`Typ wat je van plan bent, bv. “ik wil op kot” of “ik wil een studentenjob”.`);
      return;
    }
    const scenario = matchScenario(text);
    if (!scenario) {
      showHint(html`Hmm, “${text}” herken ik nog niet. Probeer bv. “op kot”, “studentenjob”, “op reis” of “beleggen”, of klik op een van de knoppen.`);
      return;
    }
    openScenarioById(scenario.id);
  }

  function openScenarioById(id) {
    const scenario = findScenario(id);
    if (!scenario) return;
    if (scenarioLocked(scenario)) {
      showHint(html`🔒 Je ouder heeft “${topicById(scenario.topics[0]).label}” vergrendeld. Vraag er eens naar!`);
      return;
    }
    showHint('');
    const savedOption = state.scenarios[childId][id]?.option;
    const option = scenario.options.some((o) => o.id === savedOption) ? savedOption : scenario.options[0].id;
    openScenario = { id, option };
    viewScenario(childId, scenario, option);
    renderChips();
    renderScenario();
    document.getElementById('sim-result').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function compareRows(nowRows, afterRows) {
    const labels = [...new Set([...nowRows, ...afterRows].map((r) => r.label))];
    const amountOf = (rows, label) => sumAmounts(rows.filter((r) => r.label === label));
    return labels.map((label) => {
      const now = amountOf(nowRows, label);
      const after = amountOf(afterRows, label);
      return { label, now, after, diff: Math.round((after - now) * 100) / 100 };
    });
  }

  function compareTable(now, option) {
    const row = (r, kind) => {
      const better = kind === 'in' ? r.diff > 0 : r.diff < 0;
      const isNew = r.now === 0 && r.after !== 0;
      return html`<tr>
        <th scope="row">${r.label}${isNew ? html` <span class="new-tag">nieuw</span>` : ''}</th>
        <td>${r.now ? formatEuro(r.now) : '—'}</td>
        <td>${r.after ? formatEuro(r.after) : '—'}</td>
        <td class="diff ${r.diff === 0 ? '' : better ? 'up-good' : 'up-bad'}">${r.diff === 0 ? '' : formatSignedEuro(r.diff)}</td>
      </tr>`;
    };
    const overNow = sumAmounts(now.income) - sumAmounts(now.expenses);
    const overAfter = sumAmounts(option.income) - sumAmounts(option.expenses);
    return html`<div class="table-wrap"><table class="cmp">
      <thead><tr><th scope="col">Per maand</th><th scope="col">Nu</th><th scope="col">Straks</th><th scope="col">Verschil</th></tr></thead>
      <tbody>
        <tr class="group"><th colspan="4">Inkomsten</th></tr>
        ${compareRows(now.income, option.income).map((r) => row(r, 'in'))}
        <tr class="group"><th colspan="4">Uitgaven &amp; sparen</th></tr>
        ${compareRows(now.expenses, option.expenses).map((r) => row(r, 'out'))}
      </tbody>
      <tfoot><tr>
        <th scope="row">Over per maand</th>
        <td class="${overNow < 0 ? 'neg' : 'pos'}">${formatSignedEuro(overNow)}</td>
        <td class="${overAfter < 0 ? 'neg' : 'pos'}">${formatSignedEuro(overAfter)}</td>
        <td></td>
      </tr></tfoot>
    </table></div>`;
  }

  function oneTimeBlock(scenario, option, now) {
    const total = sumAmounts(option.oneTime);
    let savingTime = '';
    if (scenario.showSavingTime) {
      const saved = scenario.alreadySaved || 0;
      const remaining = Math.max(0, Math.round((total - saved) * 100) / 100);
      const rateNow = sumAmounts(now.expenses.filter((r) => r.save));
      const ratePlan = sumAmounts(option.expenses.filter((r) => r.save));
      const months = (rate) => (rate > 0 ? `${Math.ceil(remaining / rate)} maanden` : 'nooit (je spaart nu niets)');
      savingTime = html`<div class="saving-time">
        <p>Al gespaard: <strong>${formatEuro(saved)}</strong> · nog nodig: <strong>${formatEuro(remaining)}</strong></p>
        ${remaining === 0
          ? html`<p class="pos"><strong>🎉 Je hebt al genoeg gespaard!</strong></p>`
          : html`<p>Aan je huidige tempo (${formatEuro(rateNow)} per maand): <strong>${months(rateNow)}</strong></p>
            ${ratePlan !== rateNow ? html`<p>Met dit plan (${formatEuro(ratePlan)} per maand): <strong class="pos">${months(ratePlan)}</strong></p>` : ''}`}
      </div>`;
    }
    return html`<section class="sim-block area-extra">
      <h4>🧾 Eenmalige kosten</h4>
      <ul class="cost-list">
        ${option.oneTime.map((c) => html`<li><span>${c.label}</span><span>${formatEuro(c.amount)}</span></li>`)}
        <li class="total"><span>Totaal</span><span>${formatEuro(total)}</span></li>
      </ul>
      ${savingTime}
    </section>`;
  }

  function futureValue(monthly, years, annualRate) {
    const n = years * 12;
    const i = annualRate / 12;
    return i === 0 ? monthly * n : monthly * ((Math.pow(1 + i, n) - 1) / i);
  }

  function growthBlock(scenario, option) {
    const g = scenario.growth;
    const m = option.monthly;
    const best = futureValue(m, g.years, g.goodRate);
    const rows = [
      { label: 'Zelf ingelegd', value: m * g.years * 12, cls: 'base' },
      { label: `Spaarrekening (± ${formatPercent(g.savingsRate)} per jaar)`, value: futureValue(m, g.years, g.savingsRate), cls: 'save' },
      { label: `Beleggen, gemiddeld (± ${formatPercent(g.investRate)} per jaar)`, value: futureValue(m, g.years, g.investRate), cls: 'invest' },
    ];
    return html`<section class="sim-block area-extra">
      <h4>📈 Na ${g.years} jaar (dan ben je ${kid().age + g.years})</h4>
      <div class="growth">
        ${rows.map((r) => html`<div class="growth-row">
          <span>${r.label}</span><strong>${formatEuro(Math.round(r.value))}</strong>
          <div class="growth-bar"><span class="${r.cls}" style="width:${Math.round((r.value / best) * 100)}%"></span></div>
        </div>`)}
      </div>
      <p class="small muted">Let op: beleggen is nooit gegarandeerd. In een slecht scenario (${formatPercent(g.badRate)} per jaar) heb je ± ${formatEuro(Math.round(futureValue(m, g.years, g.badRate)))}, minder dan je inlegde. In een goed scenario (+${formatPercent(g.goodRate)} per jaar) ± ${formatEuro(Math.round(best))}.</p>
    </section>`;
  }

  function renderScenario() {
    const scenario = findScenario(openScenario.id);
    const option = scenario.options.find((o) => o.id === openScenario.option) || scenario.options[0];
    const now = kid().monthlyNow;
    const record = state.scenarios[childId][scenario.id] || {};
    const checked = scenario.checklist.map((_, i) => Boolean(state.checklist[childId][`${scenario.id}:${i}`]));
    const xpTotal = scenario.xp * scenario.topics.length;
    let extraBlock = '';
    if (scenario.growth) extraBlock = growthBlock(scenario, option);
    else if (option.oneTime && option.oneTime.length) extraBlock = oneTimeBlock(scenario, option, now);

    render('sim-result', html`<article class="scenario">
      <header class="scenario-head">
        <div class="scenario-emoji" aria-hidden="true">${scenario.emoji}</div>
        <div>
          <p class="eyebrow">${scenario.when}</p>
          <h3>${scenario.title}</h3>
          <p>${scenario.intro}</p>
        </div>
      </header>
      <div class="seg" role="group" aria-label="Kies je situatie">
        ${scenario.options.map((o) => html`<button type="button" class="${o.id === option.id ? 'active' : ''}" data-choice="${o.id}" aria-pressed="${o.id === option.id ? 'true' : 'false'}">${o.label}</button>`)}
      </div>
      <div class="scenario-grid ${extraBlock ? '' : 'no-extra'}">
        <section class="sim-block area-check">
          <h4><span>✅ Wat moet je regelen?</span><span class="muted small" id="check-count">${checked.filter(Boolean).length}/${checked.length}</span></h4>
          <ul class="checklist">
            ${scenario.checklist.map((item, i) => html`<li><label><input type="checkbox" data-check="${i}" ${checked[i] ? html`checked` : ''}><span>${item}</span></label></li>`)}
          </ul>
        </section>
        <section class="sim-block area-table">
          <h4>💶 Wat verandert er per maand?</h4>
          ${compareTable(now, option)}
          <p class="small muted table-note">“Nu” = jouw september, berekend uit je eigen transacties.</p>
        </section>
        ${extraBlock}
        <section class="sim-block sim-tip area-tip">
          <h4>💡 Tip op basis van jouw uitgaven</h4>
          <p>${option.tip}</p>
        </section>
      </div>
      <footer class="scenario-foot">
        <p class="muted small">Vereenvoudigde cijfers, ter illustratie — geen financieel advies.</p>
        ${record.completed
          ? html`<span class="done-pill">✅ Afgerond · +${xpTotal} XP</span>`
          : html`<button type="button" class="btn" data-action="complete">Simulatie afronden (+${xpTotal} XP)</button>`}
      </footer>
    </article>`);
  }

  // Eén keer per simulatorkaart gekoppeld (event delegation), dus niet opnieuw na elke hertekening.
  function bindResultEvents() {
    const result = document.getElementById('sim-result');
    result.addEventListener('click', (e) => {
      if (!openScenario) return;
      const choice = e.target.closest('button[data-choice]');
      if (choice) {
        openScenario.option = choice.dataset.choice;
        viewScenario(childId, findScenario(openScenario.id), openScenario.option);
        renderScenario();
        result.querySelector(`button[data-choice="${CSS.escape(openScenario.option)}"]`)?.focus();
        return;
      }
      if (e.target.closest('button[data-action="complete"]')) {
        completeScenario(childId, findScenario(openScenario.id));
        renderHero();
        renderLevels();
        renderChips();
        renderScenario();
      }
    });
    result.addEventListener('change', (e) => {
      const box = e.target.closest('input[data-check]');
      if (!box || !openScenario) return;
      const scenario = findScenario(openScenario.id);
      const key = `${scenario.id}:${box.dataset.check}`;
      if (box.checked) state.checklist[childId][key] = true;
      else delete state.checklist[childId][key];
      saveState();
      const count = scenario.checklist.filter((_, i) => state.checklist[childId][`${scenario.id}:${i}`]).length;
      document.getElementById('check-count').textContent = `${count}/${scenario.checklist.length}`;
    });
  }

  /* ---------- Opstart ---------- */

  function renderAll() {
    childId = getChildId();
    renderChrome('spel');
    computeMissionOrder();
    renderHero();
    renderLevels();
    renderMissions();
    renderSimulator();
  }

  renderAll();
  onStateChange(() => {
    if (getChildId() !== childId) openScenario = null;
    renderAll();
  });
})();
