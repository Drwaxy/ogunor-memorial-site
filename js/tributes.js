const CATEGORY_LABELS = {
  all: 'All Tributes',
  sons: 'Sons',
  daughters: 'Daughters',
  'daughters-in-law': 'Daughters-in-Law',
  grandchildren: 'Grandchildren',
  extended: 'Extended Family & Friends',
};

function renderTributeCard(t) {
  const [first, ...rest] = t.paragraphs;
  const restHtml = rest.map((p) => `<p>${p}</p>`).join('');
  return `
    <article class="tribute-card">
      <span class="relation">${t.relation}</span>
      <p class="author">${t.author}</p>
      ${t.title ? `<p class="tribute-title">&ldquo;${t.title}&rdquo;</p>` : ''}
      <p>${first}</p>
      ${rest.length ? `<details><summary></summary>${restHtml}</details>` : ''}
    </article>
  `;
}

function renderTributes(filter) {
  const grid = document.getElementById('tributeGrid');
  if (!grid) return;
  const list = filter === 'all' ? TRIBUTES : TRIBUTES.filter((t) => t.category === filter);
  grid.innerHTML = list.map(renderTributeCard).join('');
}

function initTributes() {
  const tabsEl = document.getElementById('tributeTabs');
  const countEl = document.getElementById('tributeCount');
  if (!tabsEl) return;

  const categories = ['all', ...Array.from(new Set(TRIBUTES.map((t) => t.category)))];
  tabsEl.innerHTML = categories.map((cat, i) =>
    `<button class="tribute-tab${i === 0 ? ' active' : ''}" data-category="${cat}">${CATEGORY_LABELS[cat] || cat}</button>`
  ).join('');

  if (countEl) countEl.textContent = `${TRIBUTES.length} tributes and counting`;

  tabsEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.tribute-tab');
    if (!btn) return;
    tabsEl.querySelectorAll('.tribute-tab').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    renderTributes(btn.getAttribute('data-category'));
  });

  renderTributes('all');
}

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(initTributes, 0);
});
