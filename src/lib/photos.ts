/**
 * L'ACCÈS AUX PHOTOGRAPHIES, EN UN SEUL ENDROIT.
 *
 * Le motif d'un « import.meta.glob » et la clé qui sert à y lire sont deux
 * chaînes qui doivent rester identiques, et qui se résolvent depuis le fichier
 * qui les écrit. Recopiées dans quatre composants, elles ont divergé au
 * premier déplacement : le motif avait suivi, la clé non, et la construction
 * s'arrêtait sur « Cannot read properties of undefined ».
 *
 * Elles vivent donc ici, ensemble, et l'absence d'une photographie lève une
 * erreur qui la NOMME plutôt que de casser trois cadres plus loin.
 */
const fichiers = import.meta.glob<{ default: ImageMetadata }>('../assets/photos/*.jpg', { eager: true });

export function photo(nom: string): ImageMetadata {
  const trouvee = fichiers[`../assets/photos/${nom}.jpg`];
  if (!trouvee) {
    throw new Error(
      `Photographie absente : « ${nom} ». Présentes : ` +
      Object.keys(fichiers).map((c) => c.replace(/.*\//, '').replace(/\.jpg$/, '')).join(', '),
    );
  }
  return trouvee.default;
}
