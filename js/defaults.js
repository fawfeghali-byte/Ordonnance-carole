// Valeurs par défaut. Tout est en millimètres et modifiable dans Réglages > Calibration ;
// ces positions sont un point de départ à ajuster sur le vrai formulaire.

const f = (id, label, x, y, w, extra = {}) => ({ id, label, kind: 'text', x, y, w, h: 6, size: 0, align: 'left', on: true, ...extra });

// Positions relevées sur le scan du formulaire, pour une page mesurée de 151 × 182 mm.
// Le scan est une photo : prévoir quelques millimètres d'écart, à corriger dans la calibration.
const dateParts = (from, fromLabel, xs, y, w) =>
  ['jour', 'mois', 'année'].map((p, i) =>
    f(`${from}-${i}`, `${fromLabel} – ${p}`, xs[i], y, w, { from, fromLabel, part: i, align: 'center', h: 5 })
  );

const fields = [
  f('patientName', 'Nom et prénom du patient', 78.5, 29.5, 49.0, { h: 5.0 }),
  ...dateParts('birthDate', 'Date de naissance', [87.0, 98.0, 107.5], 35.5, 10.0),
  f('insurance', "L'assurance", 10.5, 43.0, 43.0, { h: 5.0 }),
  ...dateParts('date', 'Date', [21.5, 28.5, 35.5], 52.0, 7.0),
  f('diseaseCode', 'Code de la maladie', 10.5, 60.5, 43.0, { h: 5.0 }),
  f('workStop', "Durée d'arrêt de travail", 56.5, 46.5, 43.0, { h: 5.0 }),
  f('treatmentDuration', 'Durée estimée du traitement', 102.0, 46.5, 41.0, { h: 5.0 }),
  f('actNature', "Nature de l'acte médical", 67.0, 57.5, 25.0, { h: 5.0 }),
  f('consultFee', 'Frais de consultation', 67.0, 63.0, 25.0, { h: 5.0 }),
  f('transportFee', 'Frais de transport', 67.0, 68.0, 25.0, { h: 5.0 }),
  f('treatmentsDone', 'Traitements effectués par le médecin', 118.0, 57.5, 12.0, { h: 5.0 }),
  f('ordonnanceCount', 'Ordonnance médicale Nbre', 112.5, 63.0, 22.5, { h: 5.0 }),
  f('priorAgreement', 'Une entente préalable', 111.0, 68.0, 27.0, { h: 5.0 }),
];
// 7 lignes de prescription : case NS à gauche, texte sur deux lignes possibles.
[79.5, 88.5, 99.0, 109.0, 119.0, 129.5, 140.0].forEach((top, i) => {
  fields.push(f('ns' + (i + 1), 'NS ' + (i + 1), 58.5, top + 0.5, 8.5, { kind: 'ns', align: 'center', h: 8.5, size: 13 }));
  fields.push(f('med' + (i + 1), 'Médicament ' + (i + 1), 69.0, top + 0.5, 75.0, { kind: 'med', h: 9, wrap: true }));
});
fields.push(f('amountLetters', 'Montant en lettres', 56.5, 154, 49, { h: 5 }));

export const DEFAULT_SCAN = 'assets/formulaire.jpg';

export const DEFAULT_LAYOUT = {
  page: { w: 151, h: 182 }, // mesuré à la règle : 15,1 × 18,2 cm
  offset: { dx: 0, dy: 0 }, // décalage global (calibration de l'imprimante)
  fields,
};

export const DEFAULT_SETTINGS = {
  printerType: 'inkjet', // 'inkjet' (jet d'encre / laser) ou 'impact' (matricielle)
  copies: 3, // pour jet d'encre / laser : un passage par feuillet
  fontFamily: 'Arial, Helvetica, sans-serif',
  fontSize: 10,
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
