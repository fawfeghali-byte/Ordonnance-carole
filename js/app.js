import { h, toast } from './util.js';
import * as store from './store.js';
import { loadDrugs } from './drugs.js';
import { createEditor } from './editor.js';
import { t } from './i18n.js';
import { langSwitch, loginView, presetsView, historyView, resetHistory, drugsView, settingsView, calibrationView } from './views.js';

const app = document.getElementById('app');
const TABS = [
  ['presets', 'Ordonnance'],
  ['history', 'Historique'],
  ['drugs', 'Médicaments'],
  ['settings', 'Réglages'],
];
let tab = 'presets';
let editor = null; // écran de saisie en cours (conservé quand on change d'onglet)
let editorOpts = null;
const langEl = h('div');
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
    editorOpts = { ...opts, onBack: () => ((editor = null), nav.go(opts.backTo || 'presets')) };
    editor = createEditor(editorOpts);
    nav.go('presets');
  },
  pendingPatient: null, // « Nouvelle ordonnance » lancée depuis la fiche d'un patient
};

// Changement de langue : tout est reconstruit ; l'ordonnance en cours est conservée.
function relabel() {
  if (editor) editor = createEditor({ ...editorOpts, preset: editorOpts.preset && (store.get(editorOpts.preset.id) || editorOpts.preset) });
  paintStatus(store.getStatus());
  render();
}

function render() {
  langEl.replaceChildren(langSwitch(relabel));
  lockBtn.textContent = t('🔒 Verrouiller');
  tabsEl.replaceChildren(
    ...TABS.map(([id, label]) =>
      h('button', { type: 'button', class: 'tab' + (id === tab || (id === 'settings' && tab === 'calibration') ? ' on' : ''), onclick: () => { if (id === 'history' && tab === 'history') resetHistory(); nav.go(id); } }, label)
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

const lockBtn = h('button', { type: 'button', class: 'btn small', onclick: () => lock() }, '🔒 Verrouiller');

function shell() {
  app.replaceChildren(
    h('header', { class: 'top' }, h('div', { class: 'brand' }, h('span', { class: 'logo sm' }, '℞'), document.createTextNode('Ordonnance')), tabsEl, h('div', { class: 'spacer' }), statusEl, langEl, lockBtn),
    main
  );
  tab = 'presets';
  editor = null;
  render();
  store.dedupeMyDrugs();
  loadDrugs().catch(() => toast('Liste des médicaments indisponible (hors ligne ?). La saisie reste possible.', 'error'));
  armIdle();
}

async function showLogin() {
  app.replaceChildren(await loginView(shell));
}

function lock() {
  store.lock();
  nav.pendingPatient = null;
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

function paintStatus(s) {
  const map = { off: ['', ''], syncing: ['Synchronisation…', 'busy'], ok: ['✔ Synchronisé', 'ok'], error: ['⚠ Non synchronisé', 'err'] };
  const [label, cls] = map[s.state] || map.off;
  statusEl.textContent = t(label);
  statusEl.className = 'status ' + cls;
  statusEl.hidden = s.state !== 'error'; // visible uniquement en cas de problème
  statusEl.title = t(s.message || 'Synchroniser maintenant');
}
store.onStatus(paintStatus);

// Données reçues d'un autre appareil : rafraîchir la liste affichée (sans perturber une saisie en cours).
store.onChange(() => {
  if (store.isUnlocked() && store.all('mydrug').length) store.dedupeMyDrugs();
  if (!store.isUnlocked() || !current?.repaint || document.querySelector('dialog[open]')) return;
  if (/INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName || '')) return;
  current.repaint();
});

if (!window.isSecureContext || !crypto?.subtle) {
  app.replaceChildren(h('p', { class: 'boot' }, 'Cette application doit être ouverte en HTTPS (connexion sécurisée) pour chiffrer les données.'));
} else if (await store.resume()) shell();
else showLogin();
