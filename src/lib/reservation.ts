/**
 * LES PLACES ET LE PRIX — UN SEUL MODULE, DEUX CÔTÉS.
 *
 * Le navigateur affiche, le serveur facture. Si le calcul vivait à deux
 * endroits, l'affiché et le facturé finiraient par diverger : c'est ainsi
 * qu'un acompte annoncé « 30 % » se trouvait faux de trente-deux euros.
 *
 * LES DISPONIBILITÉS EN DÉMONSTRATION. Un flux iCal dit « pris » ou « libre » ;
 * il ne transporte aucun nombre de places. Le modèle est donc différent de
 * celui des villas : on part d'un calendrier d'exploitation et d'une capacité,
 * et l'on en retranche des réservations. En démonstration, celles-ci viennent
 * d'une EMPREINTE de la date et de la sortie — jamais d'un tirage au sort, qui
 * ferait changer les chiffres à chaque affichage.
 */

export const TAUX_ACOMPTE = 0.3;

/**
 * Empreinte stable : la même date rend toujours le même nombre.
 *
 * La boucle FNV seule ne suffit pas. Des graines qui ne diffèrent que par leur
 * DERNIER caractère — « 2026-09-01 » et « 2026-09-02 » — en ressortent
 * voisines, et le calendrier affichait alors six « 3 » de suite puis dix
 * « 10 ». On termine donc par un brassage final, qui disperse les bits de
 * poids faible sur tout le mot.
 */
function empreinte(graine: string): number {
  let h = 2166136261;
  for (let i = 0; i < graine.length; i++) {
    h ^= graine.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 2246822507);
  h ^= h >>> 13;
  h = Math.imul(h, 3266489909);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export const jour = (d: Date) => d.toISOString().slice(0, 10);

/** Le bateau sort tous les jours sauf le lundi — entretien. */
export const navigue = (d: Date) => d.getUTCDay() !== 1;

/**
 * Les places restantes d'une sortie, un jour donné.
 * Rend 0 les jours sans navigation, et un nombre stable sinon.
 */
export function placesRestantes(idSortie: string, capacite: number, d: Date): number {
  if (!navigue(d)) return 0;
  const e = empreinte(`${idSortie}:${jour(d)}`);
  /* Une saison plausible : souvent de la place, parfois complet. */
  if (e < 0.14) return 0;
  if (e < 0.34) return 1 + Math.floor(e * 8) % 3;
  return Math.max(1, Math.round(capacite * (0.35 + e * 0.6)));
}

export interface Devis {
  personnes: number;
  prixUnitaire: number;
  total: number;
  acompte: number;
  solde: number;
}

/** Le devis d'une sortie. L'acompte porte sur le TOTAL, et le libellé le dit. */
export function devis(prixUnitaire: number, personnes: number): Devis {
  const total = prixUnitaire * personnes;
  const acompte = Math.round(total * TAUX_ACOMPTE);
  return { personnes, prixUnitaire, total, acompte, solde: total - acompte };
}

/** Le premier jour, à partir d'aujourd'hui, où la sortie a de la place. */
export function premierJourLibre(idSortie: string, capacite: number, depuis = new Date()): Date {
  const d = new Date(Date.UTC(depuis.getUTCFullYear(), depuis.getUTCMonth(), depuis.getUTCDate()));
  for (let i = 1; i <= 120; i++) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (placesRestantes(idSortie, capacite, d) > 0) return new Date(d);
  }
  return d;
}
