// Liste des médicaments : base du Ministère (fichier local actualisable) + liste personnelle.
import { h, norm } from './util.js';
import * as store from './store.js';

let db = { rows: [], updated: '', source: '' };
let index = [];

function build() {
  index = db.rows.map(([name, strength, form, bg, ingredients]) => ({
    name, strength, form, bg, ingredients,
    key: norm(`${name} ${strength}`),
    ing: norm(ingredients),
  }));
}

// La copie locale sert tout de suite ; la version publiée sur le site la remplace automatiquement
// quand elle a changé (aucun bouton nécessaire).
async function fetchPublished() {
  const res = await fetch('data/drugs-moph.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error('Liste introuvable');
  return res.json();
}

export async function loadDrugs() {
  const cached = await store.kvGet('drugdb');
  if (cached) {
    db = cached;
    build();
    fetchPublished()
      .then(async (fresh) => {
        if (fresh?.rows?.length && fresh.updated !== db.updated) {
          await store.kvSet('drugdb', fresh);
          db = fresh;
          build();
        }
      })
      .catch(() => {}); // hors ligne : on garde la copie locale
    return info();
  }
  db = await fetchPublished();
  await store.kvSet('drugdb', db);
  build();
  return info();
}
export const info = () => ({ count: db.rows.length, updated: db.updated, source: db.source });

// "GLUCOPHAGE 850mg, Tablet" — évite de répéter le dosage s'il est déjà dans le nom.
export function drugLabel(d) {
  const s = (d.strength || '').trim();
  const hasStrength = s && norm(d.name).replace(/\s/g, '').includes(norm(s).replace(/\s/g, ''));
  return [d.name + (s && !hasStrength ? ' ' + s : ''), (d.form || '').trim()].filter(Boolean).join(', ');
}

export function search(q, limit = 12) {
  const tokens = norm(q).split(/\s+/).filter(Boolean);
  if (!tokens.length || tokens.join('').length < 2) return [];
  const score = (key, ing) => {
    let worst = 0;
    for (const t of tokens) {
      const i = key.indexOf(t);
      let s;
      if (i === 0) s = 0;
      else if (i > 0 && key[i - 1] === ' ') s = 1;
      else if (i > 0) s = 2;
      else if (ing.includes(t)) s = 3;
      else return -1;
      worst = Math.max(worst, s);
    }
    return worst;
  };
  const out = [];
  for (const r of store.all('mydrug')) {
    const d = r.data;
    const s = score(norm(`${d.name} ${d.strength}`), '');
    if (s >= 0) out.push({ ...d, mine: true, s: s - 10 });
  }
  for (const d of index) {
    const s = score(d.key, d.ing);
    if (s >= 0) out.push({ ...d, s });
  }
  out.sort((a, b) => a.s - b.s || a.name.localeCompare(b.name) || (a.strength || '').localeCompare(b.strength || '', 'fr', { numeric: true }));
  return out.slice(0, limit);
}

export const bgBadge = (bg) =>
  bg === 'B' || bg === 'G'
    ? h('span', { class: 'bg bg-' + bg, title: bg === 'B' ? 'Médicament de marque (Brand)' : 'Générique' }, bg)
    : null;

// Liste de suggestions attachée à un champ de saisie.
export function autocomplete(input, onPick) {
  const list = h('div', { class: 'ac-list', hidden: true });
  let items = [];
  let active = -1;
  const close = () => ((list.hidden = true), (active = -1));
  const pick = (i) => {
    if (items[i]) onPick(items[i]);
    close();
  };
  const paint = () => {
    if (!list.isConnected) input.after(list);
    list.replaceChildren(
      ...items.map((d, i) =>
        h(
          'div',
          { class: 'ac-item' + (i === active ? ' active' : ''), onmousedown: (e) => (e.preventDefault(), pick(i)) },
          h('div', { class: 'ac-main' }, d.mine ? h('span', { class: 'star' }, '★ ') : null, h('b', null, d.name), ' ', d.strength, d.form ? ' – ' + d.form : ''),
          bgBadge(d.bg),
          d.ingredients ? h('div', { class: 'ac-sub' }, d.ingredients) : null
        )
      )
    );
    list.hidden = !items.length;
  };
  input.addEventListener('input', () => {
    items = search(input.value);
    active = -1;
    paint();
  });
  input.addEventListener('keydown', (e) => {
    if (list.hidden) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      active = (active + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      paint();
      list.children[active]?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter' && active >= 0) {
      e.preventDefault();
      pick(active);
    } else if (e.key === 'Escape') close();
  });
  input.addEventListener('blur', close);
}
