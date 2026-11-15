#!/usr/bin/env node
// Rebuilds data/drugs-moph.json from the Lebanese Ministry of Public Health
// "Lebanon National Drugs Database" (public pages on moph.gov.lb).
//
//   node scripts/update-drugs.mjs
//
// No dependencies (Node 18+). Takes a few minutes: one page at a time, politely.
// Output format: { source, updated, columns, rows: [[name, strength, form, bg, ingredients], ...] }

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = 'https://www.moph.gov.lb/en/Drugs/index/3/4848';
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'drugs-moph.json');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const decode = (s) =>
  s
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

async function fetchPage(n) {
  const url = `${BASE}/page:${n}/sort:Drug.brand_name/direction:ASC`;
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (drug-list-import)' } });
      if (res.status === 404) return null; // past the last page
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (e) {
      if (attempt >= 5) throw e;
      await sleep(1500 * attempt);
    }
  }
}

function parseRows(html) {
  const tbody = html.split(/<tbody[^>]*>/i)[1]?.split(/<\/tbody>/i)[0] ?? '';
  const rows = [];
  for (const tr of tbody.match(/<tr[\s\S]*?<\/tr>/gi) ?? []) {
    const td = (tr.match(/<td[\s\S]*?<\/td>/gi) ?? []).map(decode);
    if (td.length < 6 || !td[1]) continue;
    // columns on the site: ATC, Name, B/G, Ingredients, Dosage, Form, Price
    const [, name, bg, ingredients, strength, form] = td;
    rows.push([name, strength, form, /^[BG]$/i.test(bg) ? bg.toUpperCase() : '', ingredients]);
  }
  return rows;
}

const seen = new Set();
const all = [];
let previousFirst = '';
for (let page = 1; page < 2000; page++) {
  const html = await fetchPage(page);
  if (!html) break;
  const rows = parseRows(html);
  if (!rows.length) break;
  const first = rows[0].join('|');
  if (first === previousFirst) break; // site repeats the last page when out of range
  previousFirst = first;
  for (const r of rows) {
    const key = r.slice(0, 4).join('|').toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      all.push(r);
    }
  }
  if (page % 20 === 0) console.log(`page ${page} — ${all.length} médicaments`);
  await sleep(250);
}

if (all.length < 500) {
  console.error(`Seulement ${all.length} lignes trouvées : le site a peut-être changé. Fichier non modifié.`);
  process.exit(1);
}

all.sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]));
await mkdir(dirname(OUT), { recursive: true });
await writeFile(
  OUT,
  JSON.stringify({
    source: 'Ministère de la Santé Publique du Liban — Lebanon National Drugs Database (moph.gov.lb)',
    updated: new Date().toISOString().slice(0, 10),
    columns: ['name', 'strength', 'form', 'bg', 'ingredients'],
    rows: all,
  })
);
console.log(`OK — ${all.length} médicaments écrits dans ${OUT}`);
