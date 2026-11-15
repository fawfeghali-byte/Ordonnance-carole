// Synchronisation entre appareils (facultatif) — voir README.md.
// Collez ici l'URL et la clé « anon » de votre projet Supabase.
// Ces deux valeurs ne sont pas secrètes : les données sont chiffrées dans le
// navigateur avant l'envoi, et chaque compte ne voit que ses propres lignes.
window.ORDONNANCE_CONFIG = {
  supabaseUrl: '',
  supabaseAnonKey: '',
  // Une fois le compte du médecin créé, mettez false : le lien « Créer mon accès » disparaît.
  allowNewAccount: true,
};
