// Stockage local chiffré (IndexedDB) + synchronisation chiffrée de bout en bout (Supabase, facultatif).
import { deriveKeys, importKey, exportKey, encryptJSON, decryptJSON } from './crypto.js';
import { DEFAULT_LAYOUT, DEFAULT_SETTINGS, DEFAULT_SCAN } from './defaults.js';

const DB_NAME = 'ordonnance-app';
const SESSION_KEY = 'ordonnance-unlock';
const CFG_KEY = 'ordonnance-sync-config';

let db;
let key = null;
let authPassword = null;
let email = null;
const mem = new Map(); // id -> { id, type, updatedAt, data }
const listeners = new Set();
const statusListeners = new Set();
let status = { state: 'off', message: '' };

// ---------- IndexedDB ----------
const req = (r) => new Promise((res, rej) => ((r.onsuccess = () => res(r.result)), (r.onerror = () => rej(r.error))));
async function open() {
  if (db) return db;
  const r = indexedDB.open(DB_NAME, 1);
  r.onupgradeneeded = () => {
    r.result.createObjectStore('records', { keyPath: 'id' });
    r.result.createObjectStore('kv');
  };
  db = await req(r);
  return db;
}
const os = (name, mode = 'readonly') => db.transaction(name, mode).objectStore(name);
export const kvGet = (k) => req(os('kv').get(k));
export const kvSet = (k, v) => req(os('kv', 'readwrite').put(v, k));
const kvDel = (k) => req(os('kv', 'readwrite').delete(k));
const recGet = (id) => req(os('records').get(id));
const recPut = (r) => req(os('records', 'readwrite').put(r));
const recAll = () => req(os('records').getAll());

// ---------- Events ----------
const emit = () => listeners.forEach((fn) => fn());
export const onChange = (fn) => (listeners.add(fn), () => listeners.delete(fn));
export const onStatus = (fn) => (statusListeners.add(fn), fn(status), () => statusListeners.delete(fn));
function setStatus(state, message = '') {
  status = { state, message };
  statusListeners.forEach((fn) => fn(status));
}
export const getStatus = () => status;

// ---------- Sync configuration ----------
// La synchronisation se règle uniquement dans config.js (plus de réglage par appareil).
try {
  localStorage.removeItem(CFG_KEY); // ancien réglage par appareil, désormais ignoré
} catch {}
export function syncConfig() {
  const base = window.ORDONNANCE_CONFIG || {};
  const url = (base.supabaseUrl || '').trim().replace(/\/+$/, '');
  const anon = (base.supabaseAnonKey || '').trim();
  return { url, anon, enabled: !!(url && anon) };
}

// ---------- Account / unlock ----------
export const isUnlocked = () => !!key;
export const currentEmail = () => email;
export async function localAccount() {
  await open();
  return (await kvGet('account')) || null;
}

class AppError extends Error {}
export { AppError };

async function persistUnlock() {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ email, key: await exportKey(key), authPassword }));
}

async function loadAll() {
  mem.clear();
  for (const r of await recAll()) {
    if (r.deleted) continue;
    const p = await decryptJSON(key, r.enc);
    mem.set(r.id, { id: r.id, type: p.type, updatedAt: r.updatedAt, data: p.data });
  }
}

async function wipeLocal() {
  await req(os('records', 'readwrite').clear());
  for (const k of ['account', 'session', 'lastRev']) await kvDel(k);
  mem.clear();
}

// Efface toutes les données de CET appareil (les données synchronisées restent sur le serveur).
export async function resetDevice() {
  await open();
  lock();
  await wipeLocal();
}

async function adopt(e, keys) {
  email = e;
  key = keys.key;
  authPassword = keys.authPassword;
  await kvSet('account', { email, check: await encryptJSON(key, { ok: 1 }) });
}

// mode: 'login' | 'create'
export async function unlock(rawEmail, password, mode) {
  await open();
  const e = rawEmail.trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(e)) throw new AppError('Adresse e-mail invalide.');
  const account = await kvGet('account');
  if (account && account.email !== e)
    throw new AppError(`Cet appareil est associé à ${account.email}. Utilisez cette adresse, ou réinitialisez l'appareil.`);
  if (mode === 'create' && password.length < 10)
    throw new AppError('Choisissez un mot de passe d’au moins 10 caractères.');
  const keys = await deriveKeys(e, password);
  const cfg = syncConfig();

  if (account) {
    let ok = false;
    try {
      ok = (await decryptJSON(keys.key, account.check)).ok === 1;
    } catch {}
    if (!ok) {
      // Le mot de passe a peut-être été changé depuis un autre appareil.
      if (cfg.enabled && (await remoteLogin(e, keys.authPassword).catch(() => null))) {
        await wipeLocal();
        await adopt(e, keys);
      } else throw new AppError('Mot de passe incorrect.');
    } else {
      email = e;
      key = keys.key;
      authPassword = keys.authPassword;
    }
  } else if (mode === 'create') {
    if (cfg.enabled) {
      // Si un compte existe déjà sur le serveur avec ce mot de passe, on le reprend ; sinon on le crée.
      const s = await remoteLogin(e, keys.authPassword).catch(() => null);
      if (!s) await remoteSignup(e, keys.authPassword);
    }
    await adopt(e, keys);
  } else {
    if (!cfg.enabled) throw new AppError('Aucun accès n’existe encore sur cet appareil. Choisissez « Créer mon accès ».');
    let s;
    try {
      s = await remoteLogin(e, keys.authPassword);
    } catch (err) {
      throw new AppError(err instanceof AppError ? err.message : 'Connexion impossible. Vérifiez votre connexion internet.');
    }
    if (!s) throw new AppError('E-mail ou mot de passe incorrect.');
    await adopt(e, keys);
  }
  await loadAll();
  await persistUnlock();
  startSync();
}

// Reprise après rechargement de la page (même onglet uniquement).
export async function resume() {
  await open();
  const raw = sessionStorage.getItem(SESSION_KEY);
  if (!raw) return false;
  try {
    const s = JSON.parse(raw);
    const account = await kvGet('account');
    if (!account || account.email !== s.email) throw 0;
    const k = await importKey(s.key);
    await decryptJSON(k, account.check);
    email = s.email;
    key = k;
    authPassword = s.authPassword;
    await loadAll();
    startSync();
    return true;
  } catch {
    sessionStorage.removeItem(SESSION_KEY);
    return false;
  }
}

export function lock() {
  key = null;
  authPassword = null;
  mem.clear();
  sessionStorage.removeItem(SESSION_KEY);
  clearInterval(syncTimer);
  clearTimeout(syncDebounce);
  setStatus('off');
}

export async function changePassword(oldPw, newPw) {
  if (newPw.length < 10) throw new AppError('Le nouveau mot de passe doit contenir au moins 10 caractères.');
  const old = await deriveKeys(email, oldPw);
  if (old.authPassword !== authPassword) throw new AppError('Mot de passe actuel incorrect.');
  const next = await deriveKeys(email, newPw);
  if (syncConfig().enabled) {
    await syncNow();
    if (status.state !== 'ok')
      throw new AppError('Synchronisation impossible pour le moment : le mot de passe n’a pas été changé. Réessayez en ligne.');
    await api('PUT', '/auth/v1/user', { password: next.authPassword });
  }
  key = next.key;
  authPassword = next.authPassword;
  const now = Date.now();
  for (const r of mem.values()) {
    r.updatedAt = now;
    await recPut({ id: r.id, updatedAt: now, deleted: 0, dirty: 1, enc: await encryptJSON(key, { type: r.type, data: r.data }) });
  }
  await kvSet('account', { email, check: await encryptJSON(key, { ok: 1 }) });
  await persistUnlock();
  scheduleSync();
}

// ---------- Records ----------
export const uid = () =>
  crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
export const all = (type) => [...mem.values()].filter((r) => r.type === type);
export const get = (id) => mem.get(id) || null;

export async function put(type, data, id = uid()) {
  const rec = { id, type, updatedAt: Date.now(), data: structuredClone(data) };
  mem.set(id, rec);
  await recPut({ id, updatedAt: rec.updatedAt, deleted: 0, dirty: 1, enc: await encryptJSON(key, { type, data }) });
  emit();
  scheduleSync();
  return rec;
}

export async function remove(id) {
  mem.delete(id);
  await recPut({ id, updatedAt: Date.now(), deleted: 1, dirty: 1, enc: '' });
  emit();
  scheduleSync();
}

// « Mes médicaments » : un médicament n'y figure qu'une fois (comparaison sans casse ni accents).
const drugKey = (name) =>
  String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
export const findMyDrug = (name, exceptId) => all('mydrug').find((r) => r.id !== exceptId && drugKey(r.data.name) === drugKey(name)) || null;

// Supprime les doublons déjà présents (en gardant celui qui a une posologie, sinon le plus récent).
export async function dedupeMyDrugs() {
  const groups = new Map();
  for (const r of all('mydrug')) {
    const k = drugKey(r.data.name);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(r);
  }
  let removed = 0;
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    const score = (r) => [r.data.dose, r.data.freq, r.data.duration].filter(Boolean).length;
    list.sort((a, b) => score(b) - score(a) || b.updatedAt - a.updatedAt);
    for (const r of list.slice(1)) {
      await remove(r.id);
      removed++;
    }
  }
  return removed;
}

export const settings = () => ({ ...DEFAULT_SETTINGS, ...(get('settings')?.data || {}) });
export const saveSettings = (patch) => put('settings', { ...settings(), ...patch }, 'settings');
export const layout = () => structuredClone(get('layout')?.data || DEFAULT_LAYOUT);
export const saveLayout = (l) => put('layout', l, 'layout');
export const scan = () => get('scan')?.data?.image || DEFAULT_SCAN;
export const hasCustomScan = () => !!get('scan')?.data?.image;

// ---------- Supabase (REST, sans bibliothèque) ----------
async function http(method, path, body, token) {
  const cfg = syncConfig();
  const headers = { apikey: cfg.anon, 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  if (method === 'POST' && path.startsWith('/rest/')) headers.Prefer = 'resolution=merge-duplicates,return=minimal';
  const res = await fetch(cfg.url + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {}
  return { ok: res.ok, status: res.status, json };
}

async function saveSession(j) {
  const s = {
    access_token: j.access_token,
    refresh_token: j.refresh_token,
    expires_at: Date.now() + (j.expires_in || 3600) * 1000,
  };
  await kvSet('session', s);
  return s;
}

// Renvoie la session, ou null si les identifiants sont refusés. Lève une erreur en cas de panne réseau.
async function remoteLogin(e, pw) {
  const r = await http('POST', '/auth/v1/token?grant_type=password', { email: e, password: pw });
  if (r.ok && r.json?.access_token) return saveSession(r.json);
  if (r.status === 400 || r.status === 401 || r.status === 422) {
    const msg = JSON.stringify(r.json || '').toLowerCase();
    if (msg.includes('not confirmed'))
      throw new AppError('Adresse e-mail non confirmée : cliquez sur le lien reçu par e-mail, puis réessayez.');
    return null;
  }
  throw new Error('HTTP ' + r.status);
}

async function remoteSignup(e, pw) {
  const r = await http('POST', '/auth/v1/signup', { email: e, password: pw });
  if (r.ok && r.json?.access_token) return saveSession(r.json);
  if (r.ok) return null; // e-mail de confirmation envoyé
  const msg = JSON.stringify(r.json || '').toLowerCase();
  if (msg.includes('already')) throw new AppError('Un compte existe déjà avec cet e-mail : mot de passe incorrect.');
  if (msg.includes('database error') || msg.includes('single doctor'))
    throw new AppError('La création de compte est fermée : cette application est réservée à un seul médecin.');
  if (msg.includes('signup') && msg.includes('disabled'))
    throw new AppError('La création de compte est désactivée sur le serveur de synchronisation.');
  throw new AppError('Création du compte de synchronisation impossible (' + r.status + ').');
}

async function ensureSession() {
  let s = await kvGet('session');
  if (s && s.expires_at - Date.now() > 60000) return s.access_token;
  if (s?.refresh_token) {
    const r = await http('POST', '/auth/v1/token?grant_type=refresh_token', { refresh_token: s.refresh_token });
    if (r.ok && r.json?.access_token) return (await saveSession(r.json)).access_token;
  }
  s = await remoteLogin(email, authPassword);
  if (!s) s = await remoteSignup(email, authPassword);
  if (!s) throw new AppError('Confirmez votre adresse e-mail (lien reçu par e-mail) pour activer la synchronisation.');
  return s.access_token;
}

async function api(method, path, body) {
  const token = await ensureSession();
  const r = await http(method, path, body, token);
  if (!r.ok) throw new Error((r.json && (r.json.message || r.json.msg)) || 'HTTP ' + r.status);
  return r.json;
}

let syncing = false;
let again = false;
let syncTimer;
let syncDebounce;

function scheduleSync() {
  if (!syncConfig().enabled) return;
  clearTimeout(syncDebounce);
  syncDebounce = setTimeout(syncNow, 1500);
}

function startSync() {
  clearInterval(syncTimer);
  if (!syncConfig().enabled) return setStatus('off');
  syncNow();
  syncTimer = setInterval(syncNow, 60000);
}
addEventListener('online', () => key && syncNow());
document.addEventListener('visibilitychange', () => !document.hidden && key && syncNow());

export async function syncNow() {
  if (!key || !syncConfig().enabled) return;
  if (syncing) return void (again = true);
  syncing = true;
  setStatus('syncing');
  const k = key;
  try {
    // 1) Récupérer ce qui a changé sur le serveur
    let lastRev = (await kvGet('lastRev')) || 0;
    let changed = false;
    for (;;) {
      const rows = await api(
        'GET',
        `/rest/v1/records?select=id,updated_at,deleted,data,rev&rev=gt.${lastRev}&order=rev.asc&limit=500`
      );
      for (const r of rows) {
        const local = await recGet(r.id);
        if (local && local.updatedAt >= r.updated_at) continue; // la version locale est plus récente ou identique
        if (r.deleted) {
          mem.delete(r.id);
          await recPut({ id: r.id, updatedAt: r.updated_at, deleted: 1, dirty: 0, enc: '' });
        } else {
          let p;
          try {
            p = await decryptJSON(k, r.data);
          } catch {
            throw new AppError(
              'Le mot de passe a été changé sur un autre appareil. Verrouillez puis reconnectez-vous avec le nouveau mot de passe.'
            );
          }
          mem.set(r.id, { id: r.id, type: p.type, updatedAt: r.updated_at, data: p.data });
          await recPut({ id: r.id, updatedAt: r.updated_at, deleted: 0, dirty: 0, enc: r.data });
        }
        changed = true;
      }
      if (rows.length) await kvSet('lastRev', (lastRev = rows[rows.length - 1].rev));
      if (rows.length < 500) break;
    }
    // 2) Envoyer les modifications locales
    const dirty = (await recAll()).filter((r) => r.dirty);
    for (let i = 0; i < dirty.length; i += 20) {
      const chunk = dirty.slice(i, i + 20);
      await api(
        'POST',
        '/rest/v1/records?on_conflict=user_id,id',
        chunk.map((r) => ({ id: r.id, updated_at: r.updatedAt, deleted: !!r.deleted, data: r.enc }))
      );
      for (const r of chunk) {
        const cur = await recGet(r.id);
        if (cur && cur.updatedAt === r.updatedAt) await recPut({ ...cur, dirty: 0 });
      }
    }
    if (key !== k) return;
    setStatus('ok');
    if (changed) emit();
  } catch (e) {
    if (key === k)
      setStatus(
        'error',
        e instanceof AppError ? e.message : navigator.onLine ? 'Synchronisation impossible : ' + e.message : 'Hors ligne'
      );
  } finally {
    syncing = false;
    if (again) {
      again = false;
      syncNow();
    }
  }
}

// ---------- Sauvegarde ----------
export function exportData(includeHistory) {
  return {
    app: 'ordonnance',
    version: 1,
    exportedAt: new Date().toISOString(),
    records: [...mem.values()]
      .filter((r) => includeHistory || r.type !== 'history')
      .map(({ id, type, data }) => ({ id, type, data })),
  };
}

export async function importData(json) {
  if (json?.app !== 'ordonnance' || !Array.isArray(json.records)) throw new AppError('Ce fichier n’est pas une sauvegarde valide.');
  const types = ['preset', 'folder', 'history', 'settings', 'layout', 'scan', 'mydrug'];
  let n = 0;
  for (const r of json.records) {
    if (!r || typeof r.id !== 'string' || !types.includes(r.type)) continue;
    await put(r.type, r.data, r.id);
    n++;
  }
  return n;
}
