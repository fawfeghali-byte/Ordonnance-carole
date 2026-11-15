// Valeurs par défaut. Tout est en millimètres et modifiable dans Réglages > Calibration ;
// ces positions sont un point de départ à ajuster sur le vrai formulaire.

const f = (id, label, x, y, w, extra = {}) => ({ id, label, kind: 'text', x, y, w, h: 6, size: 0, align: 'left', on: true, ...extra });

// Positions relevées sur le scan du formulaire (photo 1684 × 2081), en supposant une page de
// 170 × 210 mm. À confirmer avec les dimensions mesurées, puis à affiner dans la calibration.
const dateParts = (from, fromLabel, xs, y, w) =>
  ['jour', 'mois', 'année'].map((p, i) =>
    f(`${from}-${i}`, `${fromLabel} – ${p}`, xs[i], y, w, { from, fromLabel, part: i, align: 'center', h: 5.5 })
  );

const fields = [
  f('patientName', 'Nom et prénom du patient', 89, 33.5, 55),
  ...dateParts('birthDate', 'Date de naissance', [98.5, 110.5, 121.5], 40.5, 11),
  f('insurance', "L'assurance", 13, 49, 48),
  ...dateParts('date', 'Date', [24.8, 32.8, 40.8], 59.5, 7.6),
  f('diseaseCode', 'Code de la maladie', 13, 69, 48),
  f('workStop', "Durée d'arrêt de travail", 64, 53.5, 48, { h: 5.5 }),
  f('treatmentDuration', 'Durée estimée du traitement', 115, 53.5, 46, { h: 5.5 }),
  f('actNature', "Nature de l'acte médical", 76, 66, 28, { h: 5.5 }),
  f('consultFee', 'Frais de consultation', 76, 72, 28, { h: 5.5 }),
  f('transportFee', 'Frais de transport', 76, 78, 28, { h: 5.5 }),
  f('treatmentsDone', 'Traitements effectués par le médecin', 133, 66, 13.5, { h: 5.5 }),
  f('ordonnanceCount', 'Ordonnance médicale Nbre', 127, 72, 25, { h: 5.5 }),
  f('priorAgreement', 'Une entente préalable', 125, 78, 30, { h: 5.5 }),
];
// 7 lignes de prescription : case NS à gauche, texte sur deux lignes possibles.
[90.8, 101.5, 113.2, 125, 136.5, 148.3, 160].forEach((top, i) => {
  fields.push(f('ns' + (i + 1), 'NS ' + (i + 1), 66.5, top + 0.5, 9.5, { kind: 'ns', align: 'center', h: 10, size: 14 }));
  fields.push(f('med' + (i + 1), 'Médicament ' + (i + 1), 78, top + 1, 84, { kind: 'med', h: 9.5, wrap: true }));
});
fields.push(f('amountLetters', 'Montant en lettres', 64, 176.5, 55, { h: 6 }));

export const DEFAULT_SCAN = 'assets/formulaire.jpg';

export const DEFAULT_LAYOUT = {
  page: { w: 170, h: 210 }, // estimation d'après les proportions du scan — à remplacer par la mesure réelle
  offset: { dx: 0, dy: 0 }, // décalage global (calibration de l'imprimante)
  fields,
};

export const DEFAULT_SETTINGS = {
  printerType: 'inkjet', // 'inkjet' (jet d'encre / laser) ou 'impact' (matricielle)
  copies: 3, // pour jet d'encre / laser : un passage par feuillet
  fontFamily: 'Arial, Helvetica, sans-serif',
  fontSize: 10.5,
  minFontSize: 7.5,
  autoLockMin: 10,
  scanOpacity: 0.85,
};

// Champs propres au patient : jamais enregistrés dans un modèle depuis une ordonnance en cours.
export const PATIENT_FIELDS = ['patientName', 'birthDate', 'date'];
export const QUICK_FIELDS = ['patientName', 'birthDate', 'insurance', 'date'];

export const FONT_CHOICES = [
  ['Arial, Helvetica, sans-serif', 'Arial / Helvetica'],
  ['Verdana, Geneva, sans-serif', 'Verdana'],
  ['Tahoma, Geneva, sans-serif', 'Tahoma'],
  ['"Courier New", Courier, monospace', 'Courier (machine à écrire)'],
];
