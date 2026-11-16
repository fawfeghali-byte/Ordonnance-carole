import { t, getLang } from './i18n.js';
import { GLYPHS, icon } from './icons.js';

const TRANSLATED_PROPS = new Set(['placeholder', 'title', 'aria-label']);

// Un libellé comme « 🖨 Imprimer » devient icône SVG + texte ; « ✕ » seul devient une icône.
const GLYPH_RE = new RegExp(`^(${Object.keys(GLYPHS).join('|')}) (.+)$`, 'u');
const GLYPH_END_RE = new RegExp(`^(.+) (${Object.keys(GLYPHS).join('|')})$`, 'u');
function textNode(s) {
  const k = s.trim();
  if (GLYPHS[k]) return icon(GLYPHS[k]);
  let m = s.match(GLYPH_RE);
  if (m) {
    const f = document.createDocumentFragment();
    f.append(icon(GLYPHS[m[1]]), document.createTextNode(m[2]));
    return f;
  }
  m = s.match(GLYPH_END_RE);
  if (m) {
    const f = document.createDocumentFragment();
    f.append(document.createTextNode(m[1]), icon(GLYPHS[m[2]], 'trail'));
    return f;
  }
  return document.createTextNode(s);
}
export const label = (s) => textNode(t(s));

export function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (let [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (TRANSLATED_PROPS.has(k)) v = t(v);
    if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k in el && k !== 'list' && k !== 'form') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c.nodeType ? c : textNode(t(String(c))));
  }
  return el;
}

export const norm = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

export const today = () => {
  const d = new Date();
  return [d.getDate(), d.getMonth() + 1].map((n) => String(n).padStart(2, '0')).join('/') + '/' + d.getFullYear();
};

export const fmtDateTime = (ms) =>
  new Date(ms).toLocaleString(getLang() === 'en' ? 'en-GB' : 'fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

// Saisie rapide d'une date : 01021980 -> 01/02/1980
export function dateMask(input) {
  input.addEventListener('input', (e) => {
    if (e.inputType && e.inputType.startsWith('delete')) return;
    const v = input.value;
    if (!/^[\d/]*$/.test(v)) return;
    const d = v.replace(/\D/g, '').slice(0, 8);
    input.value = d.length > 4 ? `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}` : d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
  });
}

export function toast(msg, kind = '') {
  let box = document.getElementById('toasts');
  if (!box) document.body.append((box = h('div', { id: 'toasts' })));
  const t = h('div', { class: 'toast ' + kind, role: 'status' }, msg);
  box.append(t);
  setTimeout(() => t.remove(), kind === 'error' ? 6000 : kind === 'success' ? 4500 : 3000);
}

// Boîte de dialogue générique. Renvoie la valeur du bouton choisi (ou null si fermée).
export function dialog({ title, body, buttons }) {
  return new Promise((resolve) => {
    let result = null;
    const d = h(
      'dialog',
      { class: 'dlg' },
      h('h2', null, title),
      h('div', { class: 'dlg-body' }, body),
      h(
        'div',
        { class: 'dlg-actions' },
        buttons.map((b) =>
          h(
            'button',
            {
              class: 'btn ' + (b.class || ''),
              type: 'button',
              onclick: () => {
                const v = typeof b.value === 'function' ? b.value() : b.value;
                if (v === undefined) return; // validation refusée
                result = v;
                d.close();
              },
            },
            b.label
          )
        )
      )
    );
    d.addEventListener('close', () => (d.remove(), resolve(result)));
    document.body.append(d);
    d.showModal();
    d.querySelector('input,select,textarea')?.focus();
  });
}

export const confirmBox = (title, text, okLabel = 'Confirmer', danger = false) =>
  dialog({
    title,
    body: text,
    buttons: [
      { label: 'Annuler', value: false },
      { label: okLabel, value: true, class: danger ? 'danger' : 'primary' },
    ],
  });

export function promptBox(title, label, value = '') {
  const input = h('input', { type: 'text', value, dir: 'auto', class: 'input' });
  input.addEventListener('keydown', (e) => e.key === 'Enter' && (e.preventDefault(), input.closest('dialog').querySelector('.primary').click()));
  return dialog({
    title,
    body: h('label', { class: 'field' }, h('span', null, label), input),
    buttons: [
      { label: 'Annuler', value: null },
      { label: 'OK', class: 'primary', value: () => input.value.trim() || undefined },
    ],
  });
}

export function download(name, text, type = 'application/json') {
  const a = h('a', { href: URL.createObjectURL(new Blob([text], { type })), download: name });
  document.body.append(a);
  a.click();
  setTimeout(() => (URL.revokeObjectURL(a.href), a.remove()), 1000);
}

// Liste de suggestions sous un champ de saisie (clavier : ↑ ↓ Entrée Échap).
// search(texte) -> éléments ; render(élément) -> contenu d'une ligne ; onPick(élément).
export function suggest(input, search, render, onPick) {
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
        h('div', { class: 'ac-item' + (i === active ? ' active' : ''), onmousedown: (e) => (e.preventDefault(), pick(i)) }, render(d))
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

// Menu « ⋯ » flottant : affiché au-dessus de tout, près du bouton, et refermé au clic ailleurs.
let openMenu = null;
export function closeMenu() {
  if (!openMenu) return;
  const { el, btn, off } = openMenu;
  openMenu = null;
  off();
  btn.setAttribute('aria-expanded', 'false');
  btn.classList.remove('open');
  el.remove();
}
export function menuButton(items, title = 'Autres actions') {
  const btn = h('button', { type: 'button', class: 'menu-btn', title, 'aria-label': title, 'aria-haspopup': 'menu', 'aria-expanded': 'false' }, '⋯');
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const wasMine = openMenu?.btn === btn;
    closeMenu();
    if (wasMine) return;
    const el = h(
      'div',
      { class: 'menu-list floating', role: 'menu' },
      items.filter(Boolean).map(([text, fn, cls]) =>
        h('button', { type: 'button', role: 'menuitem', class: cls || '', onclick: (ev) => (ev.stopPropagation(), closeMenu(), fn()) }, text)
      )
    );
    document.body.append(el);
    const r = btn.getBoundingClientRect();
    const w = el.offsetWidth;
    const hgt = el.offsetHeight;
    const below = r.bottom + 6 + hgt <= innerHeight - 8;
    el.style.left = Math.max(8, Math.min(r.right - w, innerWidth - w - 8)) + 'px';
    el.style.top = (below ? r.bottom + 6 : Math.max(8, r.top - 6 - hgt)) + 'px';
    el.style.transformOrigin = below ? 'top right' : 'bottom right';
    // Le bouton ⋯ lui-même gère l'ouverture/fermeture : on l'ignore ici.
    const onDoc = (ev) => !el.contains(ev.target) && !btn.contains(ev.target) && closeMenu();
    const onKey = (ev) => ev.key === 'Escape' && (closeMenu(), btn.focus());
    const onMove = () => closeMenu();
    // Fermeture au toucher / clic n'importe où ailleurs (plusieurs événements pour iPad, souris et clavier).
    const outside = ['pointerdown', 'mousedown', 'touchstart', 'focusin'];
    setTimeout(() => outside.forEach((t) => document.addEventListener(t, onDoc, { capture: true, passive: true })));
    document.addEventListener('keydown', onKey);
    addEventListener('scroll', onMove, { passive: true, capture: true });
    addEventListener('resize', onMove);
    openMenu = {
      el,
      btn,
      off: () => {
        outside.forEach((t) => document.removeEventListener(t, onDoc, { capture: true }));
        document.removeEventListener('keydown', onKey);
        removeEventListener('scroll', onMove, { capture: true });
        removeEventListener('resize', onMove);
      },
    };
    btn.setAttribute('aria-expanded', 'true');
    btn.classList.add('open');
    el.querySelector('button')?.focus({ preventScroll: true });
  });
  return btn;
}
