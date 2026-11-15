// Valeurs par défaut. Tout est en millimètres et modifiable dans Réglages > Calibration ;
// ces positions sont un point de départ à ajuster sur le vrai formulaire.

const f = (id, label, x, y, w, extra = {}) => ({ id, label, kind: 'text', x, y, w, h: 6, size: 0, align: 'left', on: true, ...extra });

const fields = [
  f('patientName', 'Nom et prénom du patient', 80, 22, 76),
  f('birthDate', 'Date de naissance', 160, 22, 42),
  f('insurance', "L'assurance", 80, 30, 76),
  f('date', 'Date', 160, 30, 42),
  f('diseaseCode', 'Code de la maladie', 80, 38, 36),
  f('workStop', "Durée d'arrêt de travail", 120, 38, 38),
  f('treatmentDuration', 'Durée estimée du traitement', 162, 38, 40),
  f('actNature', "Nature de l'acte médical", 80, 46, 46),
  f('consultFee', 'Frais de consultation', 130, 46, 34),
  f('transportFee', 'Frais de transport', 168, 46, 34),
  f('treatmentsDone', 'Traitements effectués par le médecin', 80, 54, 46),
  f('ordonnanceCount', 'Ordonnance médicale Nbre', 130, 54, 34),
  f('priorAgreement', 'Une entente préalable', 168, 54, 34),
];
for (let i = 1; i <= 7; i++) {
  const y = 58 + i * 8;
  fields.push(f('ns' + i, 'NS ' + i, 80, y, 4, { kind: 'ns', align: 'center' }));
  fields.push(f('med' + i, 'Médicament ' + i, 86, y, 116, { kind: 'med' }));
}
fields.push(f('amountLetters', 'Montant en lettres', 80, 126, 122));

export const DEFAULT_LAYOUT = {
  page: { w: 210, h: 148 }, // à remplacer par les dimensions mesurées du formulaire
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
