// Écrans : connexion, modèles, historique, médicaments, réglages, calibration.
import { h, norm, today, toast, dialog, confirmBox, promptBox, download, fmtDateTime } from './util.js';
import * as store from './store.js';
import { t, getLang, setLang } from './i18n.js';
import { renderPage, scaled, printPages, splitPages, medText } from './form.js';
import { patients, findPatient, searchPatients, patientValues, entryDate, docOf } from './patients.js';
import { info as drugInfo, search as drugSearch, bgBadge } from './drugs.js';
import { emptyDoc, emptyMed, docFromPreset, folderSelect } from './editor.js';
import { DEFAULT_LAYOUT, FONT_CHOICES } from './defaults.js';

const busy = async (btn, fn) => {
  const label = btn.textContent;
  btn.disabled = true;
  btn.textContent = t('Un instant…');
  try {
    await fn();
  } catch (e) {
    toast(e instanceof store.AppError ? e.message : 'Erreur : ' + (e.message || e), 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = label;
  }
};

// Bascule Français / English
export const langSwitch = (onChange) =>
  h('div', { class: 'lang' }, ['fr', 'en'].map((l) => h('button', { type: 'button', class: 'lang-btn' + (getLang() === l ? ' on' : ''), 'aria-pressed': String(getLang() === l), onclick: () => { if (getLang() !== l) { setLang(l); onChange(); } } }, l === 'fr' ? 'Français' : 'English')));

// ======================= Connexion =======================
export async function loginView(onUnlocked) {
  const account = await store.localAccount();
  const cfg = store.syncConfig();
  const closed = cfg.enabled && window.ORDONNANCE_CONFIG?.allowNewAccount === false; // un seul médecin : plus de création
  let mode = account || cfg.enabled ? 'login' : 'create';
  const root = h('div', { class: 'login' });

  const paint = () => {
    const email = h('input', { class: 'input', type: 'email', autocomplete: 'username', value: account?.email || '', placeholder: 'docteur@exemple.com', required: true });
    const pw = h('input', { class: 'input', type: 'password', autocomplete: mode === 'create' ? 'new-password' : 'current-password', required: true });
    const pw2 = h('input', { class: 'input', type: 'password', autocomplete: 'new-password' });
    const submit = h('button', { class: 'btn primary big', type: 'submit' }, mode === 'create' ? 'Créer mon accès' : 'Se connecter');
    const form = h(
      'form',
      {
        class: 'login-card',
        onsubmit: (e) => {
          e.preventDefault();
          if (mode === 'create' && pw.value !== pw2.value) return toast('Les deux mots de passe ne sont pas identiques.', 'error');
          busy(submit, async () => {
            await store.unlock(email.value, pw.value, mode);
            onUnlocked();
          });
        },
      },
      langSwitch(paint),
      h('div', { class: 'logo' }, '℞'),
      h('h1', null, 'Ordonnance'),
      h('p', { class: 'hint center' }, mode === 'create' ? 'Première utilisation : choisissez votre e-mail et un mot de passe.' : 'Accès réservé au médecin.'),
      h('label', { class: 'field' }, h('span', null, 'E-mail'), email),
      h('label', { class: 'field' }, h('span', null, 'Mot de passe'), pw),
      mode === 'create' ? h('label', { class: 'field' }, h('span', null, 'Confirmer le mot de passe'), pw2) : null,
      mode === 'create'
        ? h('div', { class: 'note warn' }, 'Ce mot de passe chiffre toutes les données. Personne ne peut le récupérer s’il est oublié : notez-le en lieu sûr et faites des sauvegardes régulières (Réglages › Sauvegarde).')
        : null,
      submit,
      !account && closed
        ? null
        : !account
        ? h('button', { type: 'button', class: 'link', onclick: () => ((mode = mode === 'create' ? 'login' : 'create'), paint()) }, mode === 'create' ? 'J’ai déjà un accès : me connecter' : 'Première utilisation ? Créer mon accès')
        : h(
            'button',
            {
              type: 'button',
              class: 'link',
              onclick: async () => {
                if (!(await confirmBox('Réinitialiser cet appareil', 'Toutes les données enregistrées sur CET appareil seront effacées (modèles, historique, réglages). Les données déjà synchronisées restent disponibles en vous reconnectant. Continuer ?', 'Tout effacer', true))) return;
                await store.resetDevice();
                location.reload();
              },
            },
            'Mot de passe oublié / autre compte : réinitialiser cet appareil'
          ),
      h('p', { class: 'hint center' }, cfg.enabled ? 'Synchronisation activée — données chiffrées de bout en bout.' : 'Mode local : les données restent chiffrées sur cet appareil (synchronisation non configurée).')
    );
    root.replaceChildren(form);
    (account ? pw : email).focus();
  };
  paint();
  return root;
}

// ======================= Modèles (accueil) =======================
const pv = { filter: 'all', q: '' };

export function presetsView(nav) {
  const root = h('div', { class: 'view' });
  const folders = () => store.all('folder').sort((a, b) => a.data.name.localeCompare(b.data.name));
  const folderName = (id) => store.get(id)?.data.name || '';

  const use = (p) => {
    const doc = docFromPreset(p);
    if (nav.pendingPatient) Object.assign(doc.values, nav.pendingPatient);
    nav.pendingPatient = null;
    nav.openEditor({ mode: 'ordonnance', preset: p, doc });
  };
  const edit = (p) => nav.openEditor({ mode: 'preset', preset: p, doc: p ? { values: {}, ...structuredClone(p.data.doc), meds: [...structuredClone(p.data.doc.meds || []), emptyMed()] } : emptyDoc() });
  const patch = (p, d) => store.put('preset', { ...p.data, ...d }, p.id).then(paint);

  async function manageFolders() {
    const list = h('div', { class: 'rows' });
    const fill = () =>
      list.replaceChildren(
        ...folders().map((f) =>
          h(
            'div',
            { class: 'row' },
            h('div', { class: 'grow', dir: 'auto' }, f.data.name),
            h('button', { type: 'button', class: 'btn small', onclick: async () => { const n = await promptBox('Renommer le dossier', 'Nom', f.data.name); if (n) (await store.put('folder', { name: n }, f.id), fill()); } }, 'Renommer'),
            h('button', { type: 'button', class: 'btn small danger', onclick: async () => {
              if (!(await confirmBox('Supprimer le dossier', `Supprimer « ${f.data.name} » ? Les modèles qu'il contient ne sont pas supprimés.`, 'Supprimer', true))) return;
              for (const p of store.all('preset').filter((p) => p.data.folderId === f.id)) await store.put('preset', { ...p.data, folderId: '' }, p.id);
              await store.remove(f.id);
              if (pv.filter === f.id) pv.filter = 'all';
              fill();
            } }, 'Supprimer')
          )
        ),
        folders().length ? '' : h('p', { class: 'hint' }, 'Aucun dossier pour le moment.')
      );
    fill();
    await dialog({
      title: 'Dossiers',
      body: [list, h('button', { type: 'button', class: 'btn', onclick: async () => { const n = await promptBox('Nouveau dossier', 'Nom du dossier (ex. Diabétologie)'); if (n) (await store.put('folder', { name: n }), fill()); } }, '＋ Nouveau dossier')],
      buttons: [{ label: 'Fermer', value: true, class: 'primary' }],
    });
    paint();
  }

  function card(p) {
    const meds = (p.data.doc.meds || []).map((m) => m.drug).filter(Boolean);
    const menu = h('details', { class: 'menu' }, h('summary', { title: 'Autres actions', onclick: (e) => e.stopPropagation() }, '⋯'));
    const item = (label, fn, cls = '') => h('button', { type: 'button', class: cls, onclick: (e) => (e.stopPropagation(), (menu.open = false), fn()) }, label);
    menu.append(
      h(
        'div',
        { class: 'menu-list' },
        item('Modifier', () => edit(p)),
        item('Renommer', async () => { const n = await promptBox('Renommer le modèle', 'Nom', p.data.name); if (n) patch(p, { name: n }); }),
        item('Dupliquer', () => store.put('preset', { ...structuredClone(p.data), name: p.data.name + ' (copie)', favorite: false }).then(paint)),
        item('Déplacer…', async () => {
          const sel = folderSelect(p.data.folderId);
          if (await dialog({ title: 'Déplacer le modèle', body: h('label', { class: 'field' }, h('span', null, 'Dossier'), sel), buttons: [{ label: 'Annuler', value: null }, { label: 'Déplacer', value: true, class: 'primary' }] })) patch(p, { folderId: sel.value });
        }),
        item('Supprimer', async () => { if (await confirmBox('Supprimer le modèle', `Supprimer définitivement « ${p.data.name} » ?`, 'Supprimer', true)) store.remove(p.id).then(paint); }, 'danger-text')
      )
    );
    return h(
      'div',
      { class: 'pcard', tabIndex: 0, role: 'button', onclick: () => use(p), onkeydown: (e) => e.key === 'Enter' && e.target === e.currentTarget && use(p) },
      h('div', { class: 'pcard-top' },
        h('button', { type: 'button', class: 'fav' + (p.data.favorite ? ' on' : ''), title: p.data.favorite ? 'Retirer des favoris' : 'Épingler en favori', onclick: (e) => (e.stopPropagation(), patch(p, { favorite: !p.data.favorite })) }, p.data.favorite ? '★' : '☆'),
        h('div', { class: 'pcard-name', dir: 'auto' }, p.data.name),
        menu
      ),
      h('div', { class: 'pcard-meds', dir: 'auto' }, meds.length ? meds.slice(0, 4).join(' · ') + (meds.length > 4 ? ` · +${meds.length - 4}` : '') : 'Aucun médicament'),
      h('div', { class: 'pcard-foot' }, folderName(p.data.folderId) ? h('span', { class: 'tag' }, folderName(p.data.folderId)) : h('span'), h('span', { class: 'use' }, 'Utiliser →'))
    );
  }

  function paint() {
    const chip = (id, label) => h('button', { type: 'button', class: 'chip' + (pv.filter === id ? ' on' : ''), onclick: () => ((pv.filter = id), paint()) }, label);
    const search = h('input', { class: 'input search', type: 'search', placeholder: 'Rechercher un modèle ou un médicament…', value: pv.q, dir: 'auto', oninput: () => ((pv.q = search.value), paintGrid()) });
    const grid = h('div', { class: 'pgrid' });
    const paintGrid = () => {
      const qq = norm(pv.q);
      const shown = qq ? list0().filter((p) => norm(p.data.name + ' ' + (p.data.doc.meds || []).map((m) => m.drug).join(' ')).includes(qq)) : list0();
      grid.replaceChildren(...shown.map(card));
      if (!shown.length) grid.append(h('p', { class: 'empty' }, store.all('preset').length ? 'Aucun modèle ne correspond.' : 'Aucun modèle pour le moment. Créez votre premier modèle, ou commencez par une ordonnance vierge.'));
    };
    const list0 = () => {
      let l = store.all('preset');
      if (pv.filter === 'fav') l = l.filter((p) => p.data.favorite);
      else if (pv.filter !== 'all') l = l.filter((p) => p.data.folderId === pv.filter);
      return l.sort((a, b) => !!b.data.favorite - !!a.data.favorite || a.data.name.localeCompare(b.data.name, 'fr'));
    };
    const pending = nav.pendingPatient;
    root.replaceChildren(
      pending
        ? h('div', { class: 'note info pending' },
            h('div', { dir: 'auto' }, t('Nouvelle ordonnance pour') + ' ', h('b', null, pending.patientName), ' — ' + t('choisissez un modèle ou une ordonnance vierge.')),
            h('button', { type: 'button', class: 'btn small', onclick: () => ((nav.pendingPatient = null), paint()) }, 'Annuler'))
        : null,
      h('div', { class: 'toolbar' },
        h('button', { type: 'button', class: 'btn primary big', onclick: () => use(null) }, '＋ Ordonnance vierge'),
        h('button', { type: 'button', class: 'btn big', onclick: () => edit(null) }, '＋ Nouveau modèle'),
        search
      ),
      h('div', { class: 'chips' }, chip('all', 'Tous'), chip('fav', '★ Favoris'), folders().map((f) => chip(f.id, f.data.name)), h('button', { type: 'button', class: 'chip ghost', onclick: manageFolders }, '⚙ Dossiers')),
      grid
    );
    paintGrid();
  }
  paint();
  root.repaint = paint;
  return root;
}

// ======================= Historique : patients › ordonnances › détail =======================
const hv = { q: '', patient: null, entry: null };
export const resetHistory = () => Object.assign(hv, { patient: null, entry: null });

const medsOf = (r) => (r.data.doc.meds || []).filter((m) => medText(m));
const initials = (name) =>
  (name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('') || '?';
const countLabel = (n) => `${n} ordonnance${n > 1 ? 's' : ''}`;

// Ré-impression à l'identique (même date, mêmes lignes) : n'ajoute rien à l'historique.
async function reprint(r) {
  const layout = store.layout();
  const settings = store.settings();
  const { pages } = splitPages({ ...docOf(r), split: true }, layout);
  const copies = settings.printerType === 'inkjet' ? Math.max(1, Math.min(3, settings.copies)) : 1;
  const sheets = pages.length * copies;
  if (sheets > 1 && !(await confirmBox('Prêt à imprimer', `${sheets} feuilles vont être imprimées. Placez les feuillets dans le bac, dans l’ordre.`, 'Imprimer'))) return;
  await printPages(layout, settings, pages, { copies });
}

export function historyView(nav) {
  const root = h('div', { class: 'view' });

  const openEditor = (r, renew) => {
    const doc = structuredClone(docOf(r));
    if (renew) doc.values.date = today();
    doc.split = true;
    doc.meds = [...(doc.meds || []).filter((m) => medText(m)), emptyMed()];
    const who = r.data.patient || 'sans nom';
    nav.openEditor({ mode: 'ordonnance', preset: null, presetName: r.data.presetName, doc, title: (renew ? 'Renouvellement — ' : 'Modification — ') + who, backTo: 'history', backLabel: '← Retour' });
  };
  const newFor = (p) => {
    nav.pendingPatient = patientValues(p);
    nav.go('presets');
  };
  const del = async (r) => {
    if (!(await confirmBox('Supprimer', 'Supprimer cette ordonnance de l’historique ?', 'Supprimer', true))) return;
    await store.remove(r.id);
    hv.entry = null;
    paint();
  };

  // --- 1. Liste des patients ---
  function patientList() {
    const list = h('div', { class: 'rows' });
    const fill = () => {
      const found = searchPatients(hv.q);
      const noName = hv.q.trim() ? [] : patients().filter((p) => !p.name);
      const shown = [...found, ...noName];
      list.replaceChildren(
        ...shown.slice(0, 200).map((p) =>
          h(
            'button',
            { type: 'button', class: 'row prow', onclick: () => ((hv.patient = p.key), paint()) },
            h('span', { class: 'avatar', dir: 'auto' }, p.name ? initials(p.name) : '?'),
            h(
              'span',
              { class: 'grow' },
              h('span', { class: 'row-title', dir: 'auto' }, p.name || '(sans nom)'),
              h('span', { class: 'row-sub' }, [p.birthDate, p.insurance].filter(Boolean).join(' · ') || ' ')
            ),
            h('span', { class: 'row-meta' }, h('b', null, countLabel(p.entries.length)), h('span', null, entryDate(p.entries[0]))),
            h('span', { class: 'chev' }, '›')
          )
        )
      );
      if (!shown.length) list.append(h('p', { class: 'empty' }, hv.q.trim() ? 'Aucun patient ne correspond.' : 'Les ordonnances imprimées apparaîtront ici, classées par patient.'));
      else if (shown.length > 200) list.append(h('p', { class: 'hint' }, 'Affinez la recherche pour voir les autres patients.'));
    };
    const search = h('input', { class: 'input search', type: 'search', dir: 'auto', placeholder: 'Rechercher un patient…', value: hv.q, oninput: () => ((hv.q = search.value), fill()) });
    fill();
    return [h('div', { class: 'toolbar' }, h('h2', null, 'Patients'), search), list];
  }

  // --- 2. Fiche d'un patient : ses ordonnances ---
  function patientPage(p) {
    const cards = p.entries.map((r) => {
      const meds = medsOf(r);
      return h(
        'button',
        { type: 'button', class: 'hcard', onclick: () => ((hv.entry = r.id), paint()) },
        h('span', { class: 'hcard-head' }, h('b', null, entryDate(r)), h('span', { class: 'tag' }, r.data.presetName || 'Ordonnance vierge')),
        h(
          'span',
          { class: 'hcard-meds' },
          meds.slice(0, 4).map((m) => h('span', { class: 'hmed', dir: 'auto' }, m.ns ? h('i', { class: 'ns-tag' }, 'NS') : null, medText(m))),
          meds.length > 4 ? h('span', { class: 'hint' }, `+ ${meds.length - 4}`) : null,
          meds.length ? null : h('span', { class: 'hint' }, 'Aucun médicament')
        ),
        h('span', { class: 'use' }, 'Voir →')
      );
    });
    return [
      h(
        'div',
        { class: 'ed-head' },
        h('button', { type: 'button', class: 'btn', onclick: () => ((hv.patient = null), paint()) }, '← Patients'),
        h('span', { class: 'avatar big', dir: 'auto' }, initials(p.name)),
        h('div', { class: 'grow' }, h('h2', { class: 'ed-title', dir: 'auto' }, p.name || '(sans nom)'), h('div', { class: 'row-sub' }, [p.birthDate && t('Né(e) le') + ' ' + p.birthDate, p.insurance, countLabel(p.entries.length)].filter(Boolean).join(' · '))),
        p.name ? h('button', { type: 'button', class: 'btn primary big', onclick: () => newFor(p) }, '＋ Nouvelle ordonnance') : null
      ),
      h('div', { class: 'hgrid' }, cards),
    ];
  }

  // --- 3. Une ordonnance : aperçu, modifier, renouveler, ré-imprimer ---
  function entryPage(p, r) {
    const layout = store.layout();
    const settings = store.settings();
    const { pages } = splitPages({ ...docOf(r), split: true }, layout);
    let pi = 0;
    const host = h('div', { class: 'preview-host' });
    const tabs = h('div', { class: 'page-tabs' });
    const show = () => {
      const { el } = renderPage(layout, settings, pages[pi], { scan: store.scan(), scanOpacity: settings.scanOpacity });
      host.replaceChildren(scaled(el, layout).el);
      tabs.replaceChildren(...(pages.length > 1 ? pages.map((_, i) => h('button', { type: 'button', class: 'chip' + (i === pi ? ' on' : ''), onclick: () => ((pi = i), show()) }, `Formulaire ${i + 1}/${pages.length}`)) : []));
    };
    show();
    const v = docOf(r).values;
    const fields = layout.fields.filter((f) => f.kind === 'text' && !f.from && !['patientName'].includes(f.id) && (v[f.id] || '').trim());
    const meds = medsOf(r);
    return [
      h(
        'div',
        { class: 'ed-head' },
        h('button', { type: 'button', class: 'btn', onclick: () => ((hv.entry = null), paint()) }, '← ' + (p.name || t('(sans nom)'))),
        h('h2', { class: 'ed-title' }, t('Ordonnance du') + ' ' + entryDate(r)),
        h('div', { class: 'spacer' }),
        h('button', { type: 'button', class: 'btn', onclick: () => openEditor(r, false), title: 'Ouvrir cette ordonnance pour la corriger, puis l’imprimer' }, '✎ Modifier'),
        h('button', { type: 'button', class: 'btn', onclick: () => openEditor(r, true), title: 'Même ordonnance, datée d’aujourd’hui' }, '↻ Renouveler'),
        h('button', { type: 'button', class: 'btn primary big', onclick: () => reprint(r), title: 'Imprimer exactement la même ordonnance' }, '🖨 Ré-imprimer')
      ),
      h(
        'div',
        { class: 'ed-cols' },
        h(
          'div',
          null,
          h(
            'section',
            { class: 'card' },
            h('h3', null, 'Patient'),
            h('dl', { class: 'facts' }, [
              h('dt', null, 'Nom et prénom du patient'), h('dd', { dir: 'auto' }, r.data.patient || '—'),
              v.birthDate ? [h('dt', null, 'Date de naissance'), h('dd', null, v.birthDate)] : null,
              v.date ? [h('dt', null, 'Date'), h('dd', null, v.date)] : null,
              fields.filter((f) => f.id !== 'birthDate' && f.id !== 'date').map((f) => [h('dt', null, f.label), h('dd', { dir: 'auto' }, v[f.id])]),
            ])
          ),
          h(
            'section',
            { class: 'card' },
            h('h3', null, 'Médicaments, traitements et examens prescrits'),
            meds.length ? h('ol', { class: 'hlist' }, meds.map((m) => h('li', { dir: 'auto' }, m.ns ? h('i', { class: 'ns-tag' }, 'NS') : null, medText(m)))) : h('p', { class: 'hint' }, 'Aucun médicament')
          ),
          h(
            'p',
            { class: 'hint' },
            t('Imprimée le') + ' ' + fmtDateTime(r.data.at) + (r.data.presetName ? ' · ' + t('Modèle') + ' : ' + r.data.presetName : ''),
            ' · ',
            h('button', { type: 'button', class: 'link danger-text', onclick: () => del(r) }, 'Supprimer de l’historique')
          )
        ),
        h('div', { class: 'ed-preview' }, h('div', { class: 'preview-sticky' }, tabs, host))
      ),
    ];
  }

  function paint() {
    const p = hv.patient ? findPatient(hv.patient) : null;
    if (!p) Object.assign(hv, { patient: null, entry: null });
    const r = p && hv.entry ? p.entries.find((e) => e.id === hv.entry) : null;
    if (!r) hv.entry = null;
    root.replaceChildren(...(r ? entryPage(p, r) : p ? patientPage(p) : patientList()).flat());
    scrollTo(0, 0);
  }
  paint();
  root.repaint = paint;
  return root;
}

// ======================= Médicaments =======================
export function drugsView() {
  const root = h('div', { class: 'view' });
  const mine = h('div', { class: 'rows' });
  const results = h('div', { class: 'rows' });
  const infoLine = h('p', { class: 'hint' });
  const paintInfo = () => {
    const i = drugInfo();
    infoLine.textContent = t(i.count ? `${i.count.toLocaleString('fr-FR')} médicaments enregistrés au Liban — liste du ${i.updated.split('-').reverse().join('/')}. Source : ${i.source}.` : 'Liste non chargée.');
  };

  async function editMine(rec) {
    const d = rec?.data || { name: '', strength: '', form: '', bg: '', dose: '', freq: '', duration: '' };
    const inp = (k, ph) => h('input', { class: 'input', type: 'text', dir: 'auto', value: d[k] || '', placeholder: ph });
    const f = { name: inp('name', 'ex. Glucophage 850mg, comprimé'), dose: inp('dose', 'ex. 1 cp'), freq: inp('freq', 'ex. 2 fois par jour'), duration: inp('duration', 'ex. 3 mois') };
    const bg = h('select', { class: 'input' }, [['', '—'], ['B', 'B – Marque'], ['G', 'G – Générique']].map(([v, l]) => h('option', { value: v, selected: d.bg === v }, l)));
    const ok = await dialog({
      title: rec ? 'Modifier le médicament' : 'Ajouter à mes médicaments',
      body: [h('label', { class: 'field' }, h('span', null, 'Médicament (nom, dosage, forme)'), f.name), h('label', { class: 'field' }, h('span', null, 'Type'), bg), h('p', { class: 'hint' }, 'Posologie habituelle (remplie automatiquement quand vous choisissez ce médicament) :'), h('div', { class: 'grid' }, h('label', { class: 'field' }, h('span', null, 'Dose'), f.dose), h('label', { class: 'field' }, h('span', null, 'Fréquence'), f.freq), h('label', { class: 'field' }, h('span', null, 'Durée'), f.duration))],
      buttons: [{ label: 'Annuler', value: null }, { label: 'Enregistrer', class: 'primary', value: () => {
        const name = f.name.value.trim();
        if (!name) return undefined;
        if (store.findMyDrug(name, rec?.id)) return toast('Ce médicament est déjà dans « Mes médicaments ».', 'error'), undefined;
        return true;
      } }],
    });
    if (!ok) return;
    await store.put('mydrug', { name: f.name.value.trim(), strength: rec ? d.strength : '', form: rec ? d.form : '', bg: bg.value, dose: f.dose.value.trim(), freq: f.freq.value.trim(), duration: f.duration.value.trim() }, rec?.id);
    paintMine();
  }

  function paintMine() {
    const items = store.all('mydrug').sort((a, b) => a.data.name.localeCompare(b.data.name));
    mine.replaceChildren(
      ...items.map((r) =>
        h('div', { class: 'row' },
          h('div', { class: 'grow' }, h('div', { class: 'row-title', dir: 'auto' }, r.data.name, ' ', bgBadge(r.data.bg)), h('div', { class: 'row-sub', dir: 'auto' }, [r.data.dose, r.data.freq, r.data.duration].filter(Boolean).join(' – ') || 'Sans posologie habituelle')),
          h('button', { type: 'button', class: 'btn small', onclick: () => editMine(r) }, 'Modifier'),
          h('button', { type: 'button', class: 'icon', title: 'Supprimer', onclick: async () => { if (await confirmBox('Supprimer', `Retirer « ${r.data.name} » de vos médicaments ?`, 'Supprimer', true)) (await store.remove(r.id), paintMine()); } }, '✕')
        )
      )
    );
    if (!items.length) mine.append(h('p', { class: 'empty' }, 'Votre liste est vide. Ajoutez vos médicaments fréquents ici, ou avec le bouton ★ sur une ligne d’ordonnance.'));
  }

  const q = h('input', { class: 'input search', type: 'search', placeholder: 'Vérifier un médicament dans la liste du Ministère…', oninput: () => {
    results.replaceChildren(...drugSearch(q.value, 40).filter((d) => !d.mine).map((d) => h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 'row-title' }, d.name, ' ', d.strength, d.form ? ' – ' + d.form : '', ' ', bgBadge(d.bg)), h('div', { class: 'row-sub' }, d.ingredients)))));
  } });

  paintMine();
  paintInfo();
  root.append(
    h('section', { class: 'card' }, h('div', { class: 'toolbar' }, h('h2', null, 'Mes médicaments'), h('button', { type: 'button', class: 'btn primary', onclick: () => editMine(null) }, '＋ Ajouter')), h('p', { class: 'hint' }, 'Proposés en premier (★) pendant la saisie, avec leur posologie habituelle.'), mine),
    h('section', { class: 'card' }, h('div', { class: 'toolbar' }, h('h2', null, 'Liste du Ministère de la Santé')), infoLine, q, results)
  );
  root.repaint = paintMine;
  return root;
}

// ======================= Réglages =======================
export function settingsView(nav) {
  const root = h('div', { class: 'view narrow' });
  const paint = () => {
    const s = store.settings();
    const set = (patch) => store.saveSettings(patch).then(paint);
    const radio = (value, title, text) =>
      h('label', { class: 'option' + (s.printerType === value ? ' on' : '') }, h('input', { type: 'radio', name: 'ptype', checked: s.printerType === value, onchange: () => set({ printerType: value }) }), h('div', null, h('b', null, title), h('div', { class: 'hint' }, text)));
    const numInput = (key, min, max, step) => {
      const i = h('input', { class: 'input num', type: 'number', min, max, step, value: s[key], onchange: () => { const v = parseFloat(i.value); if (v >= min && v <= max) set({ [key]: v }); else i.value = s[key]; } });
      return i;
    };
    const font = h('select', { class: 'input', onchange: () => set({ fontFamily: font.value }) }, FONT_CHOICES.map(([v, l]) => h('option', { value: v, selected: s.fontFamily === v }, l)));
    const includeHistory = h('input', { type: 'checkbox' });
    const file = h('input', { type: 'file', accept: '.json,application/json', hidden: true, onchange: async () => {
      const f = file.files[0];
      if (!f) return;
      try {
        const json = JSON.parse(await f.text());
        if (!(await confirmBox('Restaurer la sauvegarde', `Restaurer ${json.records?.length ?? 0} éléments de la sauvegarde du ${(json.exportedAt || '').slice(0, 10)} ? Les éléments identiques existants seront remplacés ; rien d'autre n'est supprimé.`, 'Restaurer'))) return;
        const n = await store.importData(json);
        toast(`${n} éléments restaurés.`);
        paint();
      } catch (e) {
        toast(e instanceof store.AppError ? e.message : 'Fichier illisible.', 'error');
      }
      file.value = '';
    } });

    root.replaceChildren(
      h('section', { class: 'card' },
        h('h2', null, 'Imprimante'),
        radio('inkjet', 'Jet d’encre ou laser', 'N’imprime que la feuille du dessus : séparez les feuillets et imprimez l’ordonnance une fois par feuillet.'),
        s.printerType === 'inkjet' ? h('label', { class: 'field inline' }, h('span', null, 'Nombre d’exemplaires par ordonnance (blanc, rose, jaune)'), h('select', { class: 'input num', onchange: (e) => set({ copies: +e.target.value }) }, [1, 2, 3].map((n) => h('option', { value: n, selected: s.copies === n }, n)))) : null,
        radio('impact', 'Matricielle (à impact)', 'Marque tous les feuillets carbone en un seul passage : une seule impression sur la liasse complète.'),
        h('div', { class: 'grid' }, h('label', { class: 'field' }, h('span', null, 'Police'), font), h('label', { class: 'field' }, h('span', null, 'Taille du texte (pt)'), numInput('fontSize', 7, 14, 0.5)), h('label', { class: 'field' }, h('span', null, 'Taille minimale si le texte est long (pt)'), numInput('minFontSize', 5, 14, 0.5))),
        h('div', { class: 'note info' }, 'Dans la fenêtre d’impression du navigateur : Marges « Aucune », Échelle « 100 % », et décochez « En-têtes et pieds de page ». À régler une seule fois.')
      ),
      h('section', { class: 'card' }, h('h2', null, 'Calibration du formulaire'), h('p', { class: 'hint' }, 'Dimensions de la page, scan de fond, position de chaque champ et test d’alignement.'), h('button', { type: 'button', class: 'btn primary big', onclick: () => nav.go('calibration') }, 'Ouvrir la calibration')),
      h('section', { class: 'card' },
        h('h2', null, 'Sécurité'),
        h('label', { class: 'field inline' }, h('span', null, 'Verrouillage automatique après inactivité (minutes)'), numInput('autoLockMin', 1, 120, 1)),
        h('button', { type: 'button', class: 'btn', onclick: async () => {
          const f = ['Mot de passe actuel', 'Nouveau mot de passe (10 caractères minimum)', 'Confirmer le nouveau mot de passe'].map(() => h('input', { class: 'input', type: 'password', autocomplete: 'new-password' }));
          const labels = ['Mot de passe actuel', 'Nouveau mot de passe (10 caractères minimum)', 'Confirmer le nouveau mot de passe'];
          const ok = await dialog({ title: 'Changer le mot de passe', body: [f.map((i, k) => h('label', { class: 'field' }, h('span', null, labels[k]), i)), h('p', { class: 'hint' }, 'Les autres appareils devront se reconnecter avec le nouveau mot de passe.')], buttons: [{ label: 'Annuler', value: null }, { label: 'Changer', class: 'primary', value: () => (f[1].value === f[2].value ? true : (toast('Les deux nouveaux mots de passe ne sont pas identiques.', 'error'), undefined)) }] });
          if (!ok) return;
          try { await store.changePassword(f[0].value, f[1].value); toast('Mot de passe changé.'); } catch (e) { toast(e instanceof store.AppError ? e.message : 'Erreur : ' + e.message, 'error'); }
        } }, 'Changer le mot de passe'),
        h('p', { class: 'hint' }, `Connecté : ${store.currentEmail()}. Les données sont chiffrées (AES-256) avec votre mot de passe, sur cet appareil comme sur le serveur de synchronisation.`)
      ),
      h('section', { class: 'card' },
        h('h2', null, 'Sauvegarde'),
        h('p', { class: 'hint' }, 'Un seul fichier contenant tous vos modèles, dossiers, médicaments personnels, réglages et positions des champs.'),
        h('label', { class: 'check' }, includeHistory, ' Inclure l’historique des ordonnances (données de patients)'),
        h('div', { class: 'note warn' }, 'Le fichier de sauvegarde n’est pas chiffré : conservez-le en lieu sûr, surtout s’il contient l’historique.'),
        h('div', { class: 'toolbar' },
          h('button', { type: 'button', class: 'btn primary', onclick: () => download(`ordonnance-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(store.exportData(includeHistory.checked))) }, '⬇ Exporter la sauvegarde'),
          h('button', { type: 'button', class: 'btn', onclick: () => file.click() }, '⬆ Restaurer une sauvegarde…'),
          file
        )
      )
    );
  };
  paint();
  return root;
}

// ======================= Calibration =======================
function readScan(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, 2000 / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = () => reject(new store.AppError('Image illisible. Utilisez un scan au format JPG ou PNG.'));
    img.src = URL.createObjectURL(file);
  });
}

export function calibrationView(nav) {
  let layout = store.layout();
  let selected = null;
  let dirty = false;
  let step = 0.5;
  const round = (v) => Math.round(v * 10) / 10;
  const root = h('div', { class: 'view calib' });
  const host = h('div', { class: 'preview-host' });
  const panel = h('div', { class: 'calib-panel' });
  let sc;

  const field = () => layout.fields.find((f) => f.id === selected);
  const changed = () => ((dirty = true), paintPreview());

  function paintPreview() {
    const s = store.settings();
    const { el } = renderPage(layout, s, { values: {}, meds: [] }, {
      scan: store.scan(),
      scanOpacity: s.scanOpacity,
      sample: true,
      onField: (box, f) => {
        box.classList.add('editable');
        if (f.id === selected) box.classList.add('selected');
        const handle = h('b', { class: 'resize' });
        box.append(handle);
        box.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          const resizing = e.target === handle;
          const start = { x: e.clientX, y: e.clientY, fx: f.x, fy: f.y, fw: f.w };
          const k = sc.pxPerMm();
          box.setPointerCapture(e.pointerId);
          let moved = false;
          const move = (ev) => {
            const dx = (ev.clientX - start.x) / k;
            const dy = (ev.clientY - start.y) / k;
            if (Math.abs(dx) + Math.abs(dy) > 0.3) moved = true;
            if (resizing) { f.w = Math.max(2, round(Math.round((start.fw + dx) * 2) / 2)); box.style.width = f.w + 'mm'; }
            else { f.x = round(Math.round((start.fx + dx) * 2) / 2); f.y = round(Math.round((start.fy + dy) * 2) / 2); box.style.left = f.x + (layout.offset.dx || 0) + 'mm'; box.style.top = f.y + (layout.offset.dy || 0) + 'mm'; }
          };
          const up = () => {
            box.removeEventListener('pointermove', move);
            box.removeEventListener('pointerup', up);
            selected = f.id;
            if (moved) dirty = true;
            paintPreview();
            paintPanel();
          };
          box.addEventListener('pointermove', move);
          box.addEventListener('pointerup', up);
        });
      },
    });
    el.classList.add('calibrating');
    if (!store.scan()) el.classList.add('no-scan');
    sc = scaled(el, layout);
    host.replaceChildren(sc.el);
  }

  function paintPanel() {
    const s = store.settings();
    const num = (obj, key, opts = {}) => {
      const i = h('input', { class: 'input num', type: 'number', step: opts.step || 0.5, value: obj[key], onchange: () => { const v = parseFloat(i.value); if (!isNaN(v) && v >= (opts.min ?? -500)) { obj[key] = round(v); changed(); } else i.value = obj[key]; } });
      return h('label', { class: 'field' }, h('span', null, opts.label || key), i);
    };
    const nudge = (dx, dy) => { layout.offset.dx = round((layout.offset.dx || 0) + dx * step); layout.offset.dy = round((layout.offset.dy || 0) + dy * step); changed(); paintPanel(); };
    const scanFile = h('input', { type: 'file', accept: 'image/*', hidden: true, onchange: async () => {
      if (!scanFile.files[0]) return;
      try { await store.put('scan', { image: await readScan(scanFile.files[0]) }, 'scan'); toast('Scan enregistré.'); paintPreview(); paintPanel(); } catch (e) { toast(e.message, 'error'); }
    } });
    const f = field();
    const sel = h('select', { class: 'input', onchange: () => ((selected = sel.value || null), paintPreview(), paintPanel()) }, h('option', { value: '' }, '— Choisir un champ (ou cliquer dessus) —'), layout.fields.map((x) => h('option', { value: x.id, selected: x.id === selected }, x.label + (x.on === false ? ' (masqué)' : ''))));

    panel.replaceChildren(
      h('section', { class: 'card' }, h('h3', null, '1. Dimensions du formulaire (mm)'), h('p', { class: 'hint' }, 'Mesurez le formulaire à la règle, bord à bord.'), h('div', { class: 'grid two' }, num(layout.page, 'w', { label: 'Largeur', min: 50, step: 1 }), num(layout.page, 'h', { label: 'Hauteur', min: 50, step: 1 }))),
      h('section', { class: 'card' },
        h('h3', null, '2. Scan du formulaire (fond de l’aperçu)'),
        h('p', { class: 'hint' }, 'Image JPG/PNG recadrée exactement aux bords du papier. Elle sert de repère à l’écran et n’est jamais imprimée.'),
        h('div', { class: 'toolbar' }, h('button', { type: 'button', class: 'btn', onclick: () => scanFile.click() }, 'Remplacer le scan…'), store.hasCustomScan() ? h('button', { type: 'button', class: 'btn', onclick: async () => { await store.remove('scan'); paintPreview(); paintPanel(); } }, 'Revenir au scan d’origine') : null, scanFile),
        true ? h('label', { class: 'field' }, h('span', null, 'Opacité du fond'), h('input', { type: 'range', min: 0.1, max: 1, step: 0.05, value: s.scanOpacity, onchange: async (e) => { await store.saveSettings({ scanOpacity: +e.target.value }); paintPreview(); } })) : null
      ),
      h('section', { class: 'card' },
        h('h3', null, '3. Décalage global de l’imprimante'),
        h('p', { class: 'hint' }, 'Si tout le texte est décalé à l’impression, déplacez l’ensemble.'),
        h('div', { class: 'nudge' },
          h('button', { type: 'button', class: 'btn', onclick: () => nudge(0, -1), title: 'Vers le haut' }, '↑'),
          h('div', null, h('button', { type: 'button', class: 'btn', onclick: () => nudge(-1, 0), title: 'Vers la gauche' }, '←'), h('span', { class: 'nudge-val' }, `${layout.offset.dx || 0} ; ${layout.offset.dy || 0} mm`), h('button', { type: 'button', class: 'btn', onclick: () => nudge(1, 0), title: 'Vers la droite' }, '→')),
          h('button', { type: 'button', class: 'btn', onclick: () => nudge(0, 1), title: 'Vers le bas' }, '↓')
        ),
        h('label', { class: 'field inline' }, h('span', null, 'Pas'), h('select', { class: 'input num', onchange: (e) => (step = +e.target.value) }, [0.1, 0.5, 1, 5].map((v) => h('option', { value: v, selected: v === step }, v + ' mm'))))
      ),
      h('section', { class: 'card' },
        h('h3', null, '4. Position de chaque champ'),
        h('p', { class: 'hint' }, 'Faites glisser un champ sur l’aperçu (poignée à droite pour la largeur), ou saisissez ses valeurs. Le bas de la case = la ligne d’écriture.'),
        sel,
        f ? [
          h('label', { class: 'field' }, h('span', null, 'Libellé'), h('input', { class: 'input', type: 'text', value: f.label, onchange: (e) => ((f.label = e.target.value.trim() || f.label), changed(), paintPanel()) })),
          h('div', { class: 'grid two' }, num(f, 'x', { label: 'X – depuis la gauche (mm)' }), num(f, 'y', { label: 'Y – depuis le haut (mm)' }), num(f, 'w', { label: 'Largeur (mm)', min: 2 }), num(f, 'h', { label: 'Hauteur (mm)', min: 2 }), num(f, 'size', { label: 'Taille texte (pt, 0 = standard)', min: 0 }),
            h('label', { class: 'field' }, h('span', null, 'Alignement'), h('select', { class: 'input', onchange: (e) => ((f.align = e.target.value), changed()) }, [['left', 'Gauche'], ['center', 'Centre'], ['right', 'Droite']].map(([v, l]) => h('option', { value: v, selected: f.align === v }, l))))),
          h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: f.on !== false, onchange: (e) => ((f.on = e.target.checked), changed(), paintPanel()) }), ' Champ utilisé (décochez pour le masquer)'),
          f.kind !== 'ns' ? h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: !!f.wrap, onchange: (e) => ((f.wrap = e.target.checked), changed()) }), ' Texte sur plusieurs lignes si la case est assez haute') : null,
          f.custom ? h('button', { type: 'button', class: 'btn small danger', onclick: () => { layout.fields = layout.fields.filter((x) => x !== f); selected = null; changed(); paintPanel(); } }, 'Supprimer ce champ') : null,
        ] : null,
        h('div', { class: 'toolbar' },
          h('button', { type: 'button', class: 'btn small', onclick: async () => {
            const label = await promptBox('Nouveau champ', 'Libellé du champ');
            if (!label) return;
            const id = 'custom-' + Date.now().toString(36);
            layout.fields.push({ id, label, kind: 'text', x: 20, y: 20, w: 50, h: 6, size: 0, align: 'left', on: true, custom: true });
            selected = id; changed(); paintPanel();
          } }, '＋ Ajouter un champ'),
          h('button', { type: 'button', class: 'btn small', onclick: async () => { if (await confirmBox('Réinitialiser', 'Remettre tous les champs et dimensions aux valeurs de départ ?', 'Réinitialiser', true)) { layout = structuredClone(DEFAULT_LAYOUT); selected = null; changed(); paintPanel(); } } }, 'Réinitialiser')
        )
      )
    );
  }

  const save = async () => { await store.saveLayout(layout); dirty = false; toast('Calibration enregistrée.'); };
  root.addEventListener('keydown', (e) => {
    const f = field();
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (!f || !d || /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
    e.preventDefault();
    f.x = round(f.x + d[0] * step);
    f.y = round(f.y + d[1] * step);
    changed();
    paintPanel();
  });
  root.tabIndex = -1;

  root.append(
    h('div', { class: 'ed-head' },
      h('button', { type: 'button', class: 'btn', onclick: async () => { if (dirty && !(await confirmBox('Modifications non enregistrées', 'Quitter sans enregistrer la calibration ?', 'Quitter', true))) return; nav.go('settings'); } }, '← Réglages'),
      h('h2', { class: 'ed-title' }, 'Calibration'),
      h('div', { class: 'spacer' }),
      h('button', { type: 'button', class: 'btn', onclick: () => printPages(layout, store.settings(), [{ values: {}, meds: [] }], { test: true }), title: 'Sur papier ordinaire, avec des repères : superposez la feuille à un vrai formulaire devant une fenêtre.' }, '🖨 Imprimer un test (papier ordinaire)'),
      h('button', { type: 'button', class: 'btn primary big', onclick: save }, 'Enregistrer')
    ),
    h('div', { class: 'ed-cols' }, panel, h('div', { class: 'ed-preview' }, h('div', { class: 'preview-sticky' }, host, h('p', { class: 'hint' }, 'Les cases en pointillés montrent où le texte sera imprimé. Flèches du clavier : déplacer le champ sélectionné.'))))
  );
  paintPreview();
  paintPanel();
  return root;
}
