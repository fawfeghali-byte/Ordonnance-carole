# Ordonnance

Private web app for one doctor in Lebanon to fill in and print the official
unified medical prescription (Ordonnance Médicale / الوصفة الطبية الموحدة) from
reusable presets.

The app never reprints the form. It prints **only the doctor's text**, positioned
in millimetres so it lands in the boxes of the blank, serial-numbered official
form fed into the printer. The pharmacist/laboratory section is never touched.

The interface is in French or English. No build step, no dependencies: plain HTML/CSS/JS.

## What it does

- **Presets ("modèles")** – create, edit, duplicate, rename, move, delete; folders,
  search, pinned favourites. More than 7 medications → warning and split onto a
  second form.
- **Daily flow** – pick a preset → type name / date of birth / insurer (today's
  date is filled in) → *Imprimer*. Changes stay on this ordonnance unless you
  click *Enregistrer dans le modèle*.
- **Live preview** – text over the scan of the form, exactly where it will print.
  Long text shrinks slightly, then a warning appears.
- **Medication autocomplete** – 4,988 products from the Ministry of Public
  Health's *Lebanon National Drugs Database*, with strength, form and **B**rand /
  **G**eneric flag, plus a personal list with usual dosage. The list updates itself
  on every device when a new version is published.
- **Printing** – impact (one pass on the full set) or inkjet/laser (1–3 copies,
  one per separated sheet). Page size = the form, zero margins, black text.
- **Calibration** – page size, global nudge, drag or type each field's position,
  scan as background, test print with guide lines on plain paper.
- **History** – printed ordonnances, search by patient, re-print.
- **Backup** – export/import everything in one file.

## First-time setup

1. Open the app and choose *Créer mon accès* (e-mail + password, 10+ characters).
2. *Réglages › Calibration*:
   - the page size is preset to 151 × 182 mm; change it if your forms differ;
   - check each box against the scan and drag it if needed, then *Enregistrer*.
3. *Imprimer un test* on plain paper, hold it against a real form in front of a
   window, and use the global offset arrows until it lines up.
4. In the browser's print dialog, once: margins **None**, scale **100 %**,
   **Headers and footers off**, paper size = the form.

> The preview background is `assets/formulaire.svg`, a clean redrawing of the form
> (regenerate it with `python3 scripts/build-form-svg.py`). It is never printed, and
> the serial number, seal, fiscal stamp and doctor's stamp are left as empty
> placeholders. Positions were taken from a phone photo of a 151 × 182 mm form, so
> expect a few millimetres of error until a test print has been checked against a
> real form.

## Security

- The password derives (PBKDF2-SHA-256, 600,000 rounds) an AES-256-GCM key that
  encrypts every record in the browser, both on the device and before upload.
  The sync server only ever stores ciphertext.
- Auto-lock after inactivity (10 min by default), manual lock button.
- **A forgotten password cannot be recovered.** Keep it somewhere safe and export
  a backup regularly. Backup files are *not* encrypted.
- The app must be served over **HTTPS** (browsers refuse to encrypt otherwise).

## Hosting

Any static host works (Cloudflare Pages, Netlify, Vercel, GitHub Pages): publish
the repository root as-is. To try it locally:

```
python3 -m http.server 8000      # then open http://localhost:8000
```

Without sync configured, the app runs in local mode: data stays encrypted on that
one device.

## Sync across devices, for one doctor only

Sync uses a free [Supabase](https://supabase.com) project as an encrypted mailbox.

1. Create a Supabase project (EU region recommended).
2. *SQL Editor* → paste all of `supabase/schema.sql` → *Run*. This creates the
   sync table and a lock that refuses any sign-up once one account exists.
3. *Authentication › Sign In / Providers › Email*: turn **Confirm email** off
   (simplest), or leave it on and click the link received at step 5.
4. *Project Settings › API*: copy the **Project URL** and the **anon / publishable
   key** into `config.js`, commit, and let the host redeploy.
5. Open the app, choose *Créer mon accès* and create the doctor's account.
6. Close the door:
   - Supabase *Authentication › Sign In / Providers*: turn **Allow new users to
     sign up** off;
   - in `config.js`, set `allowNewAccount: false` so the "create access" link
     disappears from the login page.
7. On the other devices, open the app and sign in with the same e-mail and password.

After step 6 nobody else can create an account, and without the doctor's password
nobody can read anything: the server only holds encrypted data.

The interface language (Français / English) is switched from the login page or the
top bar and is remembered per device.

If you self-host Supabase on another domain, add it to `connect-src` in the
`Content-Security-Policy` tag of `index.html`.

## Updating the drug list

```
node scripts/update-drugs.mjs    # rewrites data/drugs-moph.json from moph.gov.lb
```

Commit and redeploy: each device picks up the new list by itself the next time the app is opened.

## Project layout

| Path | Purpose |
| --- | --- |
| `index.html`, `css/app.css` | Page, styles, print rules |
| `config.js` | Sync settings |
| `js/defaults.js` | Default field positions (mm) and print settings |
| `assets/formulaire.svg`, `scripts/build-form-svg.py` | Redrawn form used as preview background (never printed) |
| `js/form.js` | Renders the form for preview, calibration and print |
| `js/editor.js` | Ordonnance / preset editor |
| `js/views.js` | Login, presets, history, drugs, settings, calibration |
| `js/store.js`, `js/crypto.js` | Encrypted storage and sync |
| `js/i18n.js` | English translations of the French interface |
| `js/drugs.js`, `data/drugs-moph.json` | Autocomplete and the Ministry list |
| `supabase/schema.sql` | Sync table with row-level security |
