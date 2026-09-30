/* Startpagina: kies wie je bent (kind → spel, ouder → dashboard). */
(function () {
  function renderAll() {
    renderChrome('start');

    const kidCards = CHILD_IDS.map((id) => {
      const c = CHILDREN[id];
      const tl = totalLevel(id);
      return html`<button type="button" class="who-card" data-child="${id}">
        <span class="who-emoji" aria-hidden="true">${c.emoji}</span>
        <span class="who-name">${displayName(id)}</span>
        <span class="who-meta">${c.age} jaar · Niveau ${tl.level} ${tl.name}</span>
        <span class="who-cta">Naar het spel →</span>
      </button>`;
    });

    render('who-grid', html`${kidCards}
      <a class="who-card who-parent" href="ouders.html">
        <span class="who-emoji" aria-hidden="true">${PARENT.emoji}</span>
        <span class="who-name">${PARENT.name}</span>
        <span class="who-meta">Ouder van ${CHILD_IDS.map(displayName).join(' en ')}</span>
        <span class="who-cta">Naar het ouderdashboard →</span>
      </a>`);
  }

  document.getElementById('who-grid').addEventListener('click', (e) => {
    const card = e.target.closest('button[data-child]');
    if (!card) return;
    setActiveChild(card.dataset.child);
    window.location.href = 'spel.html';
  });

  renderAll();
  onStateChange(renderAll);
})();
