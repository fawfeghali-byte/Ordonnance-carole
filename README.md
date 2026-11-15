# Ordonnance

Private web app for one doctor in Lebanon to fill in and print the official
unified medical prescription (Ordonnance Médicale / الوصفة الطبية الموحدة) from
reusable presets.

The app never reprints the form. It prints **only the doctor's text**, positioned
in millimetres so it lands in the boxes of the blank, serial-numbered official
form fed into the printer. The pharmacist/laboratory section is never touched.

The interface is in French. No build step, no dependencies: plain HTML/CSS/JS.

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
  **G**eneric flag, plus a personal list with usual dosage.
- **Printing** – impact (one pass on the full set) or inkjet/laser (1–3 copies,
  one per separated sheet). Page size = the form, zero margins, black text.
- **Calibration** – page size, global nudge, drag or type each field's position,
  scan as background, test print with guide lines on plain paper.
- **History** – printed ordonnances, search by patient, re-print.
- **Backup** – export/import everything in one file.

## First-time setup

1. Open the app and choose *Créer mon accès* (e-mail + password, 10+ characters).
2. *Réglages › Calibration*:
   - enter the form's real width and height in mm (measured with a ruler);
   - check each box against the scan and drag it if needed, then *Enregistrer*.
3. *Imprimer un test* on plain paper, hold it against a real form in front of a
   window, and use the global offset arrows until it lines up.
4. In the browser's print dialog, once: margins **None**, scale **100 %**,
   **Headers and footers off**, paper size = the form.

> The default positions in `js/defaults.js` were read off the scan in
> `assets/formulaire.jpg`, assuming a 170 × 210 mm page (the scan's proportions).
> The scan is a phone photo, so expect a few millimetres of error until the real
> page size is entered and a test print has been checked against a form.
>
> `assets/formulaire.jpg` shows the doctor's stamp and one form's serial number,
> and is publicly downloadable from wherever the app is hosted. Replace it with a
> blank scan if that matters.

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

## Sync across computer, tablet and phone (optional, free)

Sync uses a [Supabase](https://supabase.com) project as an encrypted mailbox.

1. Create a Supabase project (EU region recommended).
2. *SQL Editor* → paste `supabase/schema.sql` → *Run*.
3. *Project Settings › API*: copy the **Project URL** and the **anon / publishable
   key** into `config.js`, then redeploy. (Or paste them per device in
   *Réglages › Synchronisation*.)
4. Open the app and create the access. If Supabase asks to confirm the e-mail,
   click the link received, then *Synchroniser*.
5. In Supabase *Authentication › Sign In / Providers*, **turn off "Allow new users
   to sign up"** so nobody else can create an account.
6. On the other devices, open the app and sign in with the same e-mail and password.

If you self-host Supabase on another domain, add it to `connect-src` in the
`Content-Security-Policy` tag of `index.html`.

## Updating the drug list

```
node scripts/update-drugs.mjs    # rewrites data/drugs-moph.json from moph.gov.lb
```

Commit and redeploy, then click *Médicaments › Actualiser la liste* in the app.

## Project layout

| Path | Purpose |
| --- | --- |
| `index.html`, `css/app.css` | Page, styles, print rules |
| `config.js` | Sync settings |
| `js/defaults.js` | Default field positions (mm) and print settings |
| `assets/formulaire.jpg` | Scan of the form, preview background only (never printed) |
| `js/form.js` | Renders the form for preview, calibration and print |
| `js/editor.js` | Ordonnance / preset editor |
| `js/views.js` | Login, presets, history, drugs, settings, calibration |
| `js/store.js`, `js/crypto.js` | Encrypted storage and sync |
| `js/drugs.js`, `data/drugs-moph.json` | Autocomplete and the Ministry list |
| `supabase/schema.sql` | Sync table with row-level security |
