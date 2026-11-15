// Chiffrement côté navigateur (WebCrypto). Le mot de passe ne quitte jamais l'appareil.
const te = new TextEncoder();
const td = new TextDecoder();

const b64 = (buf) => {
  const a = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < a.length; i += 0x8000) s += String.fromCharCode(...a.subarray(i, i + 0x8000));
  return btoa(s);
};
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const hex = (a) => [...a].map((x) => x.toString(16).padStart(2, '0')).join('');

// Un seul mot de passe donne deux secrets indépendants :
//  - key          : clé AES-256-GCM qui chiffre les données (reste dans le navigateur)
//  - authPassword : mot de passe envoyé au serveur de synchronisation (ne permet pas de déchiffrer)
export async function deriveKeys(email, password) {
  const salt = await crypto.subtle.digest('SHA-256', te.encode('ordonnance-v1|' + email.trim().toLowerCase()));
  const base = await crypto.subtle.importKey('raw', te.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 600000 }, base, 512)
  );
  return { key: await importKey(b64(bits.slice(0, 32))), authPassword: hex(bits.slice(32)) };
}

export const importKey = (raw) =>
  crypto.subtle.importKey('raw', unb64(raw), 'AES-GCM', true, ['encrypt', 'decrypt']);
export const exportKey = async (key) => b64(await crypto.subtle.exportKey('raw', key));

export async function encryptJSON(key, obj) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, te.encode(JSON.stringify(obj))));
  const out = new Uint8Array(12 + ct.length);
  out.set(iv);
  out.set(ct, 12);
  return b64(out);
}

export async function decryptJSON(key, s) {
  const raw = unb64(s);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: raw.subarray(0, 12) }, key, raw.subarray(12));
  return JSON.parse(td.decode(pt));
}
