import { h, toast } from './util.js';
import * as store from './store.js';
import { loadDrugs } from './drugs.js';
import { createEditor } from './editor.js';
import { loginView, presetsView, historyView, drugsView, settingsView, calibrationView } from './views.js';

const app = document.getElementById('app');
const TABS = [
  ['presets', 'Ordonnance'],
  ['history', 'Historique'],
  ['drugs', 'Médicaments'],
  ['settings', 'Réglages'],
];
let tab = 'presets';
let editor = null; // écran de saisie en cours (conservé quand on change d'onglet)
let current = null;
const main = h('main');
const tabsEl = h('nav', { class: 'tabs' });
const statusEl = h('button', { type: 'button', class: 'status', title: 'Synchronisation', onclick: () => store.syncNow() });

const nav = {
  go(t) {
    tab = t;
    render();
  },
  openEditor(opts) {
    editor = createEditor({ ...opts, onBack: () => ((editor = null), nav.go('presets')) });
    nav.go('presets');
  },
};

function render() {
  tabsEl.replaceChildren(
    ...TABS.map(([id, label]) =>
      h('button', { type: 'button', class: 'tab' + (id === tab || (id === 'settings' && tab === 'calibration') ? ' on' : ''), onclick: () => nav.go(id) }, label)
    )
  );
  if (tab === 'presets') current = editor || presetsView(nav);
  else if (tab === 'history') current = historyView(nav);
  else if (tab === 'drugs') current = drugsView();
  else if (tab === 'calibration') current = calibrationView(nav);
  else current = settingsView(nav);
  main.replaceChildren(current);
  scrollTo(0, 0);
}

function shell() {
  app.replaceChildren(
    h('header', { class: 'top' }, h('div', { class: 'brand' }, h('span', { class: 'logo sm' }, '℞'), 'Ordonnance'), tabsEl, h('div', { class: 'spacer' }), statusEl, h('button', { type: 'button', class: 'btn small', onclick: lock }, '🔒 Verrouiller')),
    main
  );
  tab = 'presets';
  editor = null;
  render();
  loadDrugs().catch(() => toast('Liste des médicaments indisponible (hors ligne ?). La saisie reste possible.', 'error'));
  armIdle();
}

async function showLogin() {
  app.replaceChildren(await loginView(shell));
}

function lock() {
  store.lock();
  editor = null;
  document.querySelectorAll('dialog').forEach((d) => d.close());
  document.getElementById('print-root').replaceChildren();
  showLogin();
}

// Verrouillage automatique après inactivité
let idleTimer;
function armIdle() {
  clearTimeout(idleTimer);
  if (!store.isUnlocked()) return;
  idleTimer = setTimeout(() => {
    if (store.isUnlocked()) {
      lock();
      toast('Session verrouillée après inactivité.');
    }
  }, store.settings().autoLockMin * 60000);
}
for (const ev of ['pointerdown', 'keydown', 'input', 'scroll']) addEventListener(ev, armIdle, { passive: true, capture: true });

store.onStatus((s) => {
  const map = { off: ['', ''], syncing: ['Synchronisation…', 'busy'], ok: ['✔ Synchronisé', 'ok'], error: ['⚠ Non synchronisé', 'err'] };
  const [label, cls] = map[s.state] || map.off;
  statusEl.textContent = label;
  statusEl.className = 'status ' + cls;
  statusEl.hidden = !label;
  statusEl.title = s.message || 'Synchroniser maintenant';
});

// Données reçues d'un autre appareil : rafraîchir la liste affichée (sans perturber une saisie en cours).
store.onChange(() => {
  if (!store.isUnlocked() || !current?.repaint || document.querySelector('dialog[open]')) return;
  if (/INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName || '')) return;
  current.repaint();
});

if (!window.isSecureContext || !crypto?.subtle) {
  app.replaceChildren(h('p', { class: 'boot' }, 'Cette application doit être ouverte en HTTPS (connexion sécurisée) pour chiffrer les données.'));
} else if (await store.resume()) shell();
else showLogin();
