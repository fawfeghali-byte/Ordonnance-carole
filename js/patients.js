// Patients, déduits de l'historique des ordonnances imprimées (aucune fiche à tenir à part).
// Un patient = un même nom (sans tenir compte des majuscules, accents ou espaces) ;
// deux homonymes sont séparés quand leurs dates de naissance diffèrent.
import { norm } from './util.js';
import * as store from './store.js';

const nameKey = (s) => norm(s).replace(/\s+/g, ' ').trim();
const dobKey = (s) => String(s || '').replace(/\D/g, '');

export function patients() {
  const byName = new Map();
  for (const r of store.all('history')) {
    const k = nameKey(r.data.patient);
    if (!byName.has(k)) byName.set(k, []);
    byName.get(k).push(r);
  }
  const out = [];
  for (const [nk, entries] of byName) {
    entries.sort((a, b) => b.data.at - a.data.at);
    const dob = (r) => dobKey(r.data.doc.values?.birthDate);
    const ins = (r) => nameKey(r.data.doc.values?.insurance);
    const dobs = [...new Set(entries.map(dob).filter(Boolean))];
    // Sans date de naissance (et plusieurs homonymes) : même assurance si elle désigne un seul
    // d'entre eux, sinon le plus récent.
    const guess = (r) => {
      const byIns = dobs.filter((d) => ins(r) && entries.some((e) => dob(e) === d && ins(e) === ins(r)));
      return byIns.length === 1 ? byIns[0] : dob(entries.find((e) => dob(e)));
    };
    const groups = new Map();
    for (const r of entries) {
      const d = dobs.length > 1 ? dob(r) || guess(r) : '';
      if (!groups.has(d)) groups.set(d, []);
      groups.get(d).push(r);
    }
    for (const [d, list] of groups) {
      const v = (key) => list.map((r) => (r.data.doc.values?.[key] || '').trim()).find(Boolean) || '';
      out.push({
        key: nk + '|' + d,
        // Nom affiché : la saisie la plus récente qui a des majuscules (« Rita Haddad » plutôt que « rita haddad »).
        name: (list.find((r) => /\p{Lu}/u.test(r.data.patient)) || list[0]).data.patient.replace(/\s+/g, ' ').trim(),
        birthDate: v('birthDate'),
        insurance: v('insurance'),
        entries: list,
        last: list[0].data.at,
      });
    }
  }
  return out.sort((a, b) => b.last - a.last);
}

export const findPatient = (key) => patients().find((p) => p.key === key) || null;

// Recherche par morceaux de nom, dans n'importe quel ordre (« haddad rita » trouve « Rita Haddad »).
export function searchPatients(q, limit = Infinity) {
  const tokens = nameKey(q).split(' ').filter(Boolean);
  const list = patients().filter((p) => p.name);
  if (!tokens.length) return list.slice(0, limit);
  return list
    .map((p) => {
      const words = nameKey(p.name).split(' ');
      let score = 0;
      for (const t of tokens) {
        if (words.some((w) => w.startsWith(t))) continue;
        if (nameKey(p.name).includes(t)) score += 1;
        else return null;
      }
      return { p, score };
    })
    .filter(Boolean)
    .sort((a, b) => a.score - b.score || b.p.last - a.p.last)
    .slice(0, limit)
    .map((x) => x.p);
}

// Valeurs à reporter sur une nouvelle ordonnance pour ce patient.
export const patientValues = (p) =>
  Object.fromEntries(Object.entries({ patientName: p.name, birthDate: p.birthDate, insurance: p.insurance }).filter(([, v]) => v));

// L'ordonnance telle qu'elle a été imprimée (la date est conservée à part dans l'historique).
export const docOf = (r) => ({ ...r.data.doc, values: { ...(r.data.doc.values || {}), ...(r.data.date ? { date: r.data.date } : {}) } });

// Date affichée d'une ordonnance : celle écrite sur le formulaire, sinon la date d'impression.
export const entryDate = (r) => (r.data.date || '').trim() || new Date(r.data.at).toLocaleDateString('fr-FR');
