// Écran de saisie d'une ordonnance (ou d'un modèle) avec aperçu en direct.
import { h, today, dateMask, toast, confirmBox, promptBox, dialog } from './util.js';
import { t } from './i18n.js';
import * as store from './store.js';
import { renderPage, scaled, splitPages, printPages, medText } from './form.js';
import { autocomplete, drugLabel, bgBadge } from './drugs.js';
import { PATIENT_FIELDS, QUICK_FIELDS } from './defaults.js';

export const emptyMed = () => ({ drug: '', dose: '', freq: '', duration: '', ns: false, bg: '' });
export const emptyDoc = () => ({ values: {}, meds: [emptyMed()], split: false });
const clone = (x) => structuredClone(x);

// Prépare une ordonnance à partir d'un modèle : la date du jour est remplie automatiquement.
export function docFromPreset(preset) {
  const doc = preset ? clone(preset.data.doc) : emptyDoc();
  doc.values = { ...doc.values, date: today() };
  doc.meds = (doc.meds || []).filter((m) => medText(m));
  doc.meds.push(emptyMed());
  return doc;
}

const cleanDoc = (doc, stripPatient) => {
  const d = clone(doc);
  d.meds = d.meds.filter((m) => medText(m));
  for (const k of stripPatient ? PATIENT_FIELDS : ['date']) delete d.values[k];
  for (const k of Object.keys(d.values)) if (!d.values[k]) delete d.values[k];
  return d;
};

export function folderSelect(value) {
  const sel = h('select', { class: 'input' }, h('option', { value: '' }, '— Sans dossier —'));
  for (const f of store.all('folder').sort((a, b) => a.data.name.localeCompare(b.data.name)))
    sel.append(h('option', { value: f.id, selected: f.id === value }, f.data.name));
  return sel;
}

// opts: { mode: 'ordonnance' | 'preset', doc, preset (enregistrement ou null), title, onBack() }
export function createEditor(opts) {
  const { mode } = opts;
  const doc = opts.doc;
  let preset = opts.preset || null;
  let pageIndex = 0;
  let dirty = false;
  const meta = { name: preset?.data.name || '', folderId: preset?.data.folderId || '', favorite: !!preset?.data.favorite };

  const previewHost = h('div', { class: 'preview-host' });
  const pageTabs = h('div', { class: 'page-tabs' });
  const warnings = h('div', { class: 'warnings' });
  const medRows = h('div', { class: 'meds' });

  function refresh() {
    const layout = store.layout();
    const settings = store.settings();
    const { pages, count, per } = splitPages(doc, layout);
    pageIndex = Math.min(pageIndex, pages.length - 1);
    const overflowLabels = new Set();
    pages.forEach((p) => renderPage(layout, settings, p).overflows.forEach((f) => overflowLabels.add(f.label)));
    const { el } = renderPage(layout, settings, pages[pageIndex], { scan: store.scan(), scanOpacity: settings.scanOpacity });
    if (!store.scan()) el.classList.add('no-scan');
    previewHost.replaceChildren(scaled(el, layout).el);

    pageTabs.replaceChildren(
      ...(pages.length > 1
        ? pages.map((_, i) =>
            h('button', { type: 'button', class: 'chip' + (i === pageIndex ? ' on' : ''), onclick: () => ((pageIndex = i), refresh()) }, `Formulaire ${i + 1}/${pages.length}`)
          )
        : [])
    );

    warnings.replaceChildren();
    if (count > per) {
      const n = pages.length;
      if (doc.split)
        warnings.append(h('div', { class: 'note info' }, `${count} médicaments : l'ordonnance sera imprimée sur ${n} formulaires (${per} lignes par formulaire).`));
      else
        warnings.append(
          h(
            'div',
            { class: 'note warn' },
            h('div', null, `Attention : ${count} médicaments, mais le formulaire n'a que ${per} lignes.`),
            h('button', { type: 'button', class: 'btn small', onclick: () => ((doc.split = true), (dirty = true), refresh()) }, `Répartir sur ${n} formulaires`)
          )
        );
    }
    if (overflowLabels.size)
      warnings.append(h('div', { class: 'note warn' }, 'Texte trop long pour la case (il débordera) : ' + [...overflowLabels].join(', ') + '. Raccourcissez le texte.'));
  }

  const touch = () => ((dirty = true), refresh());

  // ----- Champs -----
  function valueInput(f) {
    const input = h('input', {
      class: 'input',
      type: 'text',
      dir: 'auto',
      value: doc.values[f.id] || '',
      autocomplete: 'off',
      placeholder: f.id === 'birthDate' || f.id === 'date' ? 'jj/mm/aaaa' : '',
      inputMode: f.id === 'birthDate' || f.id === 'date' ? 'numeric' : undefined,
      oninput: () => ((doc.values[f.id] = input.value), touch()),
    });
    if (f.id === 'birthDate' || f.id === 'date') dateMask(input);
    return h('label', { class: 'field' + (f.id === 'patientName' || f.id === 'amountLetters' ? ' wide' : '') }, h('span', null, f.label), input);
  }

  function fieldsSection() {
    // Une saisie par valeur : les trois cases d'une date (jour, mois, année) partagent le même champ.
    const seen = new Set();
    const fields = store
      .layout()
      .fields.filter((f) => f.kind === 'text' && f.on !== false)
      .map((f) => ({ id: f.from || f.id, label: f.from ? f.fromLabel || f.label : f.label }))
      .filter((f) => !seen.has(f.id) && seen.add(f.id));
    if (mode === 'preset')
      return h('section', { class: 'card' }, h('h3', null, 'Champs pré-remplis'), h('p', { class: 'hint' }, 'Laissez vide ce qui change à chaque patient. La date du jour est ajoutée automatiquement.'), h('div', { class: 'grid' }, fields.filter((f) => f.id !== 'date').map(valueInput)));
    const quick = QUICK_FIELDS.map((id) => fields.find((f) => f.id === id)).filter(Boolean);
    const rest = fields.filter((f) => !QUICK_FIELDS.includes(f.id));
    return [
      h('section', { class: 'card patient' }, h('h3', null, 'Patient'), h('div', { class: 'grid' }, quick.map(valueInput))),
      h('details', { class: 'card', open: rest.some((f) => doc.values[f.id]) }, h('summary', null, 'Autres champs (code maladie, arrêt de travail, frais…)'), h('div', { class: 'grid' }, rest.map(valueInput))),
    ];
  }

  // ----- Médicaments -----
  function medRow(m) {
    const idx = () => doc.meds.indexOf(m);
    const badge = h('span', { class: 'bg-slot' }, bgBadge(m.bg));
    const addRowIfLast = () => {
      if (idx() !== doc.meds.length - 1) return;
      const next = emptyMed();
      doc.meds.push(next);
      medRows.append(medRow(next)); // on ajoute sans reconstruire : la saisie en cours n'est pas interrompue
    };
    const text = (key, placeholder, cls) => {
      const input = h('input', {
        class: 'input ' + cls,
        type: 'text',
        dir: 'auto',
        placeholder,
        'aria-label': placeholder,
        value: m[key] || '',
        autocomplete: 'off',
        oninput: () => {
          m[key] = input.value;
          if (key === 'drug' && m.bg) (m.bg = ''), badge.replaceChildren();
          if (input.value.trim()) addRowIfLast();
          touch();
        },
      });
      return input;
    };
    const drug = text('drug', 'Médicament', 'm-drug');
    const dose = text('dose', 'Dose', 'm-dose');
    const freq = text('freq', 'Fréquence', 'm-freq');
    const duration = text('duration', 'Durée', 'm-dur');
    autocomplete(drug, (d) => {
      Object.assign(m, { drug: drugLabel(d), bg: d.bg || '' });
      if (d.mine) Object.assign(m, { dose: d.dose || m.dose, freq: d.freq || m.freq, duration: d.duration || m.duration });
      drug.value = m.drug;
      paintStar(star, m);
      dose.value = m.dose;
      freq.value = m.freq;
      duration.value = m.duration;
      badge.replaceChildren(bgBadge(m.bg) || '');
      addRowIfLast();
      touch();
      dose.focus();
    });
    const move = (d) => {
      const i = idx();
      const j = i + d;
      if (j < 0 || j >= doc.meds.length) return;
      [doc.meds[i], doc.meds[j]] = [doc.meds[j], doc.meds[i]];
      renderMeds();
      touch();
    };
    const del = () => {
      doc.meds.splice(idx(), 1);
      if (!doc.meds.length) doc.meds.push(emptyMed());
      renderMeds();
      touch();
    };
    const star = h('button', { type: 'button', class: 'icon star-btn', onclick: () => toggleMyDrug(m, star) }, '★');
    paintStar(star, m);
    drug.addEventListener('input', () => paintStar(star, m));
    const row = h(
      'div',
      { class: 'med' + (m.ns ? ' is-ns' : '') },
      h(
        'label',
        { class: 'ns', title: 'Non Substituable : le pharmacien doit délivrer exactement cette marque' },
        h('input', { type: 'checkbox', checked: !!m.ns, onchange: (e) => ((m.ns = e.target.checked), row.classList.toggle('is-ns', m.ns), touch()) }),
        h('span', null, 'NS')
      ),
      h('div', { class: 'med-drug' }, h('div', { class: 'ac-wrap' }, drug), badge),
      dose,
      freq,
      duration,
      h(
        'div',
        { class: 'med-tools' },
        star,
        h('button', { type: 'button', class: 'icon', title: 'Monter', onclick: () => move(-1) }, '↑'),
        h('button', { type: 'button', class: 'icon', title: 'Descendre', onclick: () => move(1) }, '↓'),
        h('button', { type: 'button', class: 'icon', title: 'Supprimer la ligne', onclick: del }, '✕')
      )
    );
    return row;
  }

  function renderMeds() {
    medRows.replaceChildren(...doc.meds.map(medRow));
  }

  // ★ : ajoute le médicament à « Mes médicaments », ou l'en retire s'il y est déjà.
  const findMyDrug = (m) => store.findMyDrug(m.drug);
  function paintStar(btn, m) {
    const on = !!findMyDrug(m);
    btn.classList.toggle('on', on);
    btn.title = t(on ? 'Retirer de mes médicaments' : 'Ajouter à mes médicaments');
    btn.setAttribute('aria-pressed', String(on));
  }
  async function toggleMyDrug(m, btn) {
    if (!m.drug.trim()) return toast('Saisissez d’abord le médicament.');
    const existing = findMyDrug(m);
    if (existing) {
      await store.remove(existing.id);
      await store.dedupeMyDrugs();
      toast('Retiré de « Mes médicaments ».');
    } else {
      await store.put('mydrug', { name: m.drug.trim(), strength: '', form: '', bg: m.bg || '', dose: m.dose, freq: m.freq, duration: m.duration });
      toast('Ajouté à « Mes médicaments » avec sa posologie.');
    }
    paintStar(btn, m);
  }

  // ----- Actions -----
  async function saveToPreset() {
    if (!preset) return saveAsNew();
    await store.put('preset', { ...store.get(preset.id)?.data, ...preset.data, doc: cleanDoc(doc, true) }, preset.id);
    preset = store.get(preset.id);
    toast(`Modèle « ${preset.data.name} » mis à jour.`);
  }

  async function saveAsNew() {
    const name = h('input', { class: 'input', type: 'text', dir: 'auto', value: preset ? preset.data.name + ' (copie)' : '' });
    const folder = folderSelect(preset?.data.folderId || '');
    const ok = await dialog({
      title: 'Nouveau modèle',
      body: [h('label', { class: 'field' }, h('span', null, 'Nom du modèle'), name), h('label', { class: 'field' }, h('span', null, 'Dossier'), folder), h('p', { class: 'hint' }, 'Le nom et la date de naissance du patient ne sont pas enregistrés dans le modèle.')],
      buttons: [
        { label: 'Annuler', value: null },
        { label: 'Enregistrer', class: 'primary', value: () => (name.value.trim() ? true : undefined) },
      ],
    });
    if (!ok) return;
    preset = await store.put('preset', { name: name.value.trim(), folderId: folder.value, favorite: false, doc: cleanDoc(doc, true) });
    title.textContent = preset.data.name;
    toast('Modèle enregistré.');
  }

  async function savePresetMode() {
    if (!meta.name.trim()) return toast('Donnez un nom au modèle.', 'error');
    const data = { name: meta.name.trim(), folderId: meta.folderId, favorite: meta.favorite, doc: cleanDoc(doc, false) };
    preset = await store.put('preset', data, preset?.id);
    dirty = false;
    toast('Modèle enregistré.');
    opts.onBack();
  }

  async function print() {
    const layout = store.layout();
    const settings = store.settings();
    const { pages, count, per } = splitPages(doc, layout);
    if (!count && !(await confirmBox('Aucun médicament', 'Cette ordonnance ne contient aucune ligne de prescription. Imprimer quand même ?', 'Imprimer'))) return;
    if (count > per && !doc.split) {
      const ok = await confirmBox(
        'Trop de médicaments pour un formulaire',
        `Cette ordonnance contient ${count} médicaments et le formulaire n'a que ${per} lignes. Voulez-vous la répartir sur ${pages.length} formulaires ?`,
        `Répartir sur ${pages.length} formulaires`
      );
      if (!ok) return;
      doc.split = true;
      refresh();
    }
    const copies = settings.printerType === 'inkjet' ? Math.max(1, Math.min(3, settings.copies)) : 1;
    const sheets = pages.length * copies;
    if (sheets > 1) {
      const text =
        settings.printerType === 'inkjet'
          ? `${sheets} feuilles vont être imprimées` + (pages.length > 1 ? ` (${pages.length} formulaires × ${copies} feuillets).` : ` : ${copies} fois la même ordonnance, une par feuillet (blanc, rose, jaune).`) + ' Placez les feuillets séparés dans le bac, dans l’ordre.'
          : `${pages.length} formulaires vont être imprimés. Placez ${pages.length} liasses dans l'imprimante.`;
      if (!(await confirmBox('Prêt à imprimer', text, 'Imprimer'))) return;
    }
    await store.put('history', {
      at: Date.now(),
      patient: (doc.values.patientName || '').trim(),
      date: doc.values.date || '',
      presetName: preset?.data.name || '',
      doc: cleanDoc(doc, false),
    });
    await printPages(layout, settings, pages, { copies });
  }

  // ----- Mise en page -----
  const title = h('h2', { class: 'ed-title', dir: 'auto' }, opts.title || preset?.data.name || 'Ordonnance vierge');
  const back = async () => {
    if (mode === 'preset' && dirty && !(await confirmBox('Modifications non enregistrées', 'Quitter sans enregistrer ce modèle ?', 'Quitter', true))) return;
    opts.onBack();
  };

  const header =
    mode === 'preset'
      ? h('div', { class: 'ed-head' }, h('button', { type: 'button', class: 'btn', onclick: back }, '← Retour'), h('h2', { class: 'ed-title' }, preset ? 'Modifier le modèle' : 'Nouveau modèle'), h('div', { class: 'spacer' }), h('button', { type: 'button', class: 'btn primary big', onclick: savePresetMode }, 'Enregistrer le modèle'))
      : h(
          'div',
          { class: 'ed-head' },
          h('button', { type: 'button', class: 'btn', onclick: back }, '← Modèles'),
          title,
          h('div', { class: 'spacer' }),
          preset ? h('button', { type: 'button', class: 'btn', onclick: saveToPreset, title: 'Enregistre les médicaments et champs actuels dans le modèle (sans le nom du patient)' }, 'Enregistrer dans le modèle') : null,
          h('button', { type: 'button', class: 'btn', onclick: saveAsNew }, 'Nouveau modèle…'),
          h('button', { type: 'button', class: 'btn primary big', id: 'print-btn', onclick: print }, '🖨 Imprimer')
        );

  let metaCard = null;
  if (mode === 'preset') {
    const name = h('input', { class: 'input', type: 'text', dir: 'auto', value: meta.name, placeholder: 'ex. Diabète type 2 – début', oninput: () => ((meta.name = name.value), (dirty = true)) });
    const folder = folderSelect(meta.folderId);
    folder.addEventListener('change', () => ((meta.folderId = folder.value), (dirty = true)));
    metaCard = h(
      'section',
      { class: 'card patient' },
      h('div', { class: 'grid' }, h('label', { class: 'field wide' }, h('span', null, 'Nom du modèle'), name), h('label', { class: 'field' }, h('span', null, 'Dossier'), folder), h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: meta.favorite, onchange: (e) => ((meta.favorite = e.target.checked), (dirty = true)) }), ' ★ Favori (épinglé en haut)'))
    );
  }

  renderMeds();
  const el = h(
    'div',
    { class: 'editor' },
    header,
    h(
      'div',
      { class: 'ed-cols' },
      h(
        'div',
        { class: 'ed-form' },
        metaCard,
        fieldsSection(),
        h(
          'section',
          { class: 'card' },
          h('h3', null, 'Médicaments, traitements et examens prescrits'),
          h('p', { class: 'hint' }, 'Cochez NS (Non Substituable) pour imposer la marque : un « X » sera imprimé dans la case. B = marque, G = générique.'),
          medRows
        )
      ),
      h('div', { class: 'ed-preview' }, h('div', { class: 'preview-sticky' }, pageTabs, previewHost, warnings, h('p', { class: 'hint' }, 'Aperçu : le fond du formulaire n’est pas imprimé, seul le texte l’est.')))
    )
  );
  refresh();
  queueMicrotask(() => el.querySelector(mode === 'preset' ? '.card input' : '.patient input')?.focus());
  return el;
}
