import { t, getLang } from './i18n.js';

const TRANSLATED_PROPS = new Set(['placeholder', 'title', 'aria-label']);

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
    el.append(c.nodeType ? c : document.createTextNode(t(String(c))));
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
  setTimeout(() => t.remove(), kind === 'error' ? 6000 : 3000);
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
