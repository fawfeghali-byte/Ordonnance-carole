// Rendu du formulaire en millimètres : même code pour l'aperçu, la calibration et l'impression.
import { h } from './util.js';

const PX_PER_MM = 96 / 25.4;
let ctx;

export function textWidthMm(text, pt, family, bold) {
  ctx ||= document.createElement('canvas').getContext('2d');
  ctx.font = `${bold ? 'bold ' : ''}${pt}pt ${family}`;
  return ctx.measureText(text).width / PX_PER_MM;
}

// Réduit légèrement la police si le texte dépasse ; signale un dépassement s'il ne tient toujours pas.
export function fit(text, field, settings) {
  let size = field.size || settings.fontSize;
  const min = Math.min(size, settings.minFontSize);
  // Champ sur plusieurs lignes : capacité = largeur × nombre de lignes qui tiennent dans la hauteur.
  const room = (pt) => (field.wrap ? field.w * Math.max(1, Math.floor(field.h / (pt * 0.3528 * 1.15))) * 0.9 : field.w);
  const width = (pt) => textWidthMm(text, pt, settings.fontFamily);
  while (size > min && width(size) > room(size)) size = Math.max(min, size - 0.25);
  return { size, overflow: width(size) > room(size) + 0.05 };
}

// Valeur d'un champ texte. Un champ « partie de date » (from + part) n'imprime que le jour, le mois ou l'année.
export function fieldValue(f, values) {
  const v = (values[f.from || f.id] || '').trim();
  return f.from && f.part != null ? v.split(/[\/.\-\s]+/)[f.part] || '' : v;
}

// Sens d'écriture d'un texte : celui de sa première lettre (arabe/hébreu → droite à gauche).
const STRONG = /[A-Za-z\u00C0-\u024F\u0370-\u03FF\u0400-\u04FF]|([\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF])/;
export function isRtl(text) {
  const m = String(text || '').match(STRONG);
  return !!(m && m[1]);
}

const num = (id) => parseInt(id.replace(/\D/g, ''), 10) || 0;
export const slots = (layout, kind) =>
  layout.fields.filter((f) => f.kind === kind && f.on !== false).sort((a, b) => num(a.id) - num(b.id));
export const medsPerPage = (layout) => slots(layout, 'med').length || 1;

export const medText = (m) =>
  [m.drug, m.dose, m.freq, m.duration]
    .map((s) => (s || '').trim())
    .filter(Boolean)
    .join(' – ');

// Découpe une ordonnance en formulaires (7 lignes de médicaments par formulaire par défaut).
export function splitPages(doc, layout) {
  const meds = (doc.meds || []).map((m) => ({ text: medText(m), ns: !!m.ns })).filter((m) => m.text);
  const per = medsPerPage(layout);
  const pages = [];
  for (let i = 0; i < Math.max(meds.length, 1); i += per) pages.push({ values: doc.values || {}, meds: meds.slice(i, i + per) });
  return { pages, count: meds.length, per };
}

// opts: { scan, scanOpacity, guides, sample, onField(el, field) }
export function renderPage(layout, settings, page, opts = {}) {
  const { w, h: ph } = layout.page;
  const { dx = 0, dy = 0 } = layout.offset || {};
  const overflows = [];
  const el = h('div', { class: 'page' + (opts.guides ? ' guides' : ''), style: { width: w + 'mm', height: ph + 'mm', fontFamily: settings.fontFamily } });
  if (opts.scan) el.append(h('img', { class: 'scan', src: opts.scan, alt: '', style: { opacity: opts.scanOpacity ?? 1 } }));
  if (opts.guides) {
    el.append(h('div', { class: 'guide-frame' }));
    for (const [gx, gy] of [[10, 10], [w - 10, 10], [10, ph - 10], [w - 10, ph - 10]])
      el.append(h('div', { class: 'guide-cross', style: { left: gx + 'mm', top: gy + 'mm' } }));
    el.append(h('div', { class: 'guide-note', style: { left: '12mm', top: '4mm' } }, `Test d'alignement — ${w} × ${ph} mm — les croix sont à 10 mm des bords`));
  }
  const medSlots = slots(layout, 'med');
  const nsSlots = slots(layout, 'ns');
  for (const f of layout.fields) {
    if (f.on === false) continue;
    let text = '';
    if (f.kind === 'med') text = page.meds[medSlots.indexOf(f)]?.text || '';
    else if (f.kind === 'ns') text = page.meds[nsSlots.indexOf(f)]?.ns ? 'X' : '';
    else text = fieldValue(f, page.values);
    let sample = false;
    if (!text && opts.sample) {
      text = f.kind === 'ns' ? 'X' : f.label;
      sample = true;
    }
    const rtl = f.kind !== 'ns' && isRtl(text);
    const r = f.kind === 'ns' ? { size: f.size || settings.fontSize, overflow: false } : fit(text, f, settings);
    if (r.overflow && !sample) overflows.push(f);
    const box = h(
      'div',
      {
        class: `f f-${f.kind}${f.wrap ? ' f-wrap' : ''}${r.overflow && !sample ? ' over' : ''}${sample ? ' sample' : ''}`,
        'data-id': f.id,
        style: {
          left: f.x + dx + 'mm',
          top: f.y + dy + 'mm',
          width: f.w + 'mm',
          height: f.h + 'mm',
          fontSize: r.size + 'pt',
          // Texte arabe : il part du bord droit de la case et s'écrit de droite à gauche.
          justifyContent: f.align === 'center' ? 'center' : (f.align === 'right') !== rtl ? 'flex-end' : 'flex-start',
        },
      },
      h('span', { dir: rtl ? 'rtl' : 'ltr', style: f.wrap ? { width: '100%', textAlign: f.align === 'center' ? 'center' : (f.align === 'right') !== rtl ? 'right' : 'left' } : null }, text)
    );
    if (opts.guides) box.append(h('i', { class: 'guide-label' }, f.label));
    opts.onField?.(box, f);
    el.append(box);
  }
  return { el, overflows };
}

// Aperçu mis à l'échelle de son conteneur. Renvoie { el, scale() }.
export function scaled(pageEl, layout) {
  const wrap = h('div', { class: 'page-wrap' }, pageEl);
  const wpx = layout.page.w * PX_PER_MM;
  const hpx = layout.page.h * PX_PER_MM;
  let s = 1;
  const apply = () => {
    const avail = wrap.parentElement?.clientWidth || wpx;
    s = Math.min(avail / wpx, 2.2);
    pageEl.style.transform = `scale(${s})`;
    wrap.style.width = wpx * s + 'px';
    wrap.style.height = hpx * s + 'px';
  };
  new ResizeObserver(apply).observe(document.body);
  queueMicrotask(apply);
  requestAnimationFrame(apply);
  return { el: wrap, pxPerMm: () => s * PX_PER_MM, apply };
}

// Impression : uniquement le texte, aux dimensions exactes du formulaire, sans marges.
export function printPages(layout, settings, pages, { test = false, copies = 1 } = {}) {
  const root = document.getElementById('print-root');
  root.replaceChildren();
  let style = document.getElementById('print-page-size');
  if (!style) document.head.append((style = h('style', { id: 'print-page-size' })));
  style.textContent = `@page { size: ${layout.page.w}mm ${layout.page.h}mm; margin: 0; }`;
  for (const p of pages)
    for (let c = 0; c < copies; c++) root.append(renderPage(layout, settings, p, { guides: test, sample: test }).el);
  return new Promise((resolve) => {
    let finished = false;
    const mq = matchMedia('print');
    const onMq = (e) => !e.matches && done();
    const done = () => {
      if (finished) return;
      finished = true;
      removeEventListener('afterprint', done);
      mq.removeEventListener?.('change', onMq);
      root.replaceChildren();
      resolve();
    };
    // Fin d'impression : « afterprint », ou la sortie du mode impression selon le navigateur.
    addEventListener('afterprint', done);
    mq.addEventListener?.('change', onMq);
    // Laisse le navigateur mettre en page avant d'ouvrir la boîte d'impression.
    requestAnimationFrame(() =>
      setTimeout(() => {
        const t0 = Date.now();
        window.print();
        // Sur ordinateur, print() attend la fermeture de la fenêtre d'impression.
        if (Date.now() - t0 > 400) setTimeout(done, 0);
      }, 50)
    );
  });
}
