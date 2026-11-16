// Icônes SVG (tracés inspirés de Lucide/Feather, licence ISC/MIT) et logo de l'application.
const S = (inner, fill = false) =>
  `<svg viewBox="0 0 24 24" ${fill ? 'fill="currentColor" stroke="none"' : 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"'} aria-hidden="true" focusable="false">${inner}</svg>`;

export const ICONS = {
  printer: S('<path d="M6 9V3h12v6"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="7" rx="1"/>'),
  plus: S('<path d="M12 5v14M5 12h14"/>'),
  refresh: S('<path d="M21 12a9 9 0 1 1-2.64-6.36L21 8"/><path d="M21 3v5h-5"/>'),
  pencil: S('<path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/><path d="m15 5 4 4"/>'),
  download: S('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>'),
  upload: S('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>'),
  lock: S('<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'),
  'arrow-left': S('<path d="M19 12H5M12 19l-7-7 7-7"/>'),
  'arrow-right': S('<path d="M5 12h14M12 5l7 7-7 7"/>'),
  'arrow-up': S('<path d="M12 19V5M5 12l7-7 7 7"/>'),
  'arrow-down': S('<path d="M12 5v14M19 12l-7 7-7-7"/>'),
  settings: S('<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>'),
  star: S('<path d="m12 2.8 2.85 5.78 6.38.93-4.62 4.5 1.09 6.35L12 17.36 6.3 20.36l1.09-6.35-4.62-4.5 6.38-.93z"/>'),
  'star-fill': S('<path d="m12 2.8 2.85 5.78 6.38.93-4.62 4.5 1.09 6.35L12 17.36 6.3 20.36l1.09-6.35-4.62-4.5 6.38-.93z"/>', true),
  check: S('<path d="M20 6 9 17l-5-5"/>'),
  alert: S('<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4M12 17h.01"/>'),
  x: S('<path d="M18 6 6 18M6 6l12 12"/>'),
  more: S('<circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/>', true),
  chevron: S('<path d="m9 18 6-6-6-6"/>'),
  'file-text': S('<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/><path d="M14 2v5h6M8 13h8M8 17h5"/>'),
  clock: S('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  pill: S('<path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7z"/><path d="m8.5 8.5 7 7"/>'),
  shield: S('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>'),
  layers: S('<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/>'),
  target: S('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>'),
};

// Caractères utilisés dans les libellés, remplacés à l'affichage par l'icône correspondante.
export const GLYPHS = {
  '🖨': 'printer',
  '＋': 'plus',
  '↻': 'refresh',
  '✎': 'pencil',
  '⬇': 'download',
  '⬆': 'upload',
  '🔒': 'lock',
  '←': 'arrow-left',
  '→': 'arrow-right',
  '↑': 'arrow-up',
  '↓': 'arrow-down',
  '⚙': 'settings',
  '★': 'star-fill',
  '☆': 'star',
  '✔': 'check',
  '⚠': 'alert',
  '✕': 'x',
  '⋯': 'more',
  '›': 'chevron',
};

export function icon(name, cls = '') {
  const s = document.createElement('span');
  s.className = `i i-${name}${cls ? ' ' + cls : ''}`;
  s.innerHTML = ICONS[name] || '';
  return s;
}

// Logo : feuille d'ordonnance arrondie, monogramme « Rx » et petite croix médicale.
export const LOGO_SVG = `<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
  <defs>
    <linearGradient id="lg-bg" x1="8" y1="4" x2="58" y2="62" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#14b8a6"/><stop offset=".55" stop-color="#0e7490"/><stop offset="1" stop-color="#155e75"/>
    </linearGradient>
  </defs>
  <rect x="2" y="2" width="60" height="60" rx="17" fill="url(#lg-bg)"/>
  <path d="M2 34c14-6 30 8 60-6v17a17 17 0 0 1-17 17H19A17 17 0 0 1 2 45z" fill="#fff" opacity=".08"/>
  <g fill="none" stroke="#fff" stroke-width="5.2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M19 47V17h10.5a8 8 0 0 1 0 16H19"/>
    <path d="M27 33l17 16"/>
    <path d="M35.5 49 46 38.5"/>
  </g>
  <g class="logo-cross"><rect x="42" y="11" width="12" height="12" rx="3.5" fill="#fff"/><path d="M48 13.8v6.4M44.8 17h6.4" stroke="#0e7490" stroke-width="2.4" stroke-linecap="round"/></g>
</svg>`;

export function logo(cls = '') {
  const s = document.createElement('span');
  s.className = 'logo' + (cls ? ' ' + cls : '');
  s.innerHTML = LOGO_SVG;
  return s;
}
