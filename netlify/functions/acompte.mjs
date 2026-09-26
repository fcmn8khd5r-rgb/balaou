/**
 * L'ACOMPTE.
 *
 * Deux règles, et elles tiennent tout :
 *
 *   1. Le montant n'est JAMAIS reçu du navigateur. Il est recalculé ici, à
 *      partir du prix inscrit dans le contenu et du nombre de personnes. Un
 *      prix qui voyage est un prix qui se négocie.
 *   2. La disponibilité est revérifiée avant d'ouvrir le paiement : entre
 *      l'affichage du calendrier et le clic, les places ont pu partir.
 *
 * MODE DÉMONSTRATION. Aucune clé Stripe n'est déclarée, donc aucune carte
 * n'est demandée et rien n'est encaissé. Le parcours se déroule en entier et
 * les libellés le disent — « Acompte à régler », jamais « Acompte reçu ».
 * Pour passer au réel, il suffira de poser STRIPE_SECRET_KEY et d'ouvrir la
 * session de paiement là où le code le signale.
 */
import contenu from '../../src/data/contenu.json' with { type: 'json' };
import { devis, placesRestantes, estPasse, TAUX_ACOMPTE } from '../../src/lib/reservation.mjs';

const MESSAGES = {
  fr: {
    corps: 'Demande illisible.',
    sortie: 'Sortie inconnue.',
    date: 'Date absente ou mal formée.',
    personnes: 'Nombre de passagers hors limites.',
    complet: 'Il ne reste plus assez de places à cette date. Choisissez-en une autre.',
    passee: 'Cette date est passée. Choisissez un départ à venir.',
    simule: 'Démonstration : aucune carte demandée, aucune somme encaissée.',
  },
  en: {
    corps: 'Unreadable request.',
    sortie: 'Unknown trip.',
    date: 'Missing or malformed date.',
    personnes: 'Number of guests out of range.',
    complet: 'Not enough seats left on that date. Please pick another.',
    passee: 'That date has gone by. Please pick a departure still to come.',
    simule: 'Demonstration: no card requested, no money taken.',
  },
};

export default async (requete) => {
  if (requete.method !== 'POST') return Response.json({ message: 'POST attendu.' }, { status: 405 });

  let corps;
  try {
    corps = await requete.json();
  } catch {
    return Response.json({ message: MESSAGES.fr.corps }, { status: 400 });
  }

  const M = MESSAGES[corps.langue === 'en' ? 'en' : 'fr'];
  const sortie = contenu.sorties.find((s) => s.id === corps.sortie && !s.surDevis);
  if (!sortie) return Response.json({ message: M.sortie }, { status: 400 });

  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(corps.date || ''))) {
    return Response.json({ message: M.date }, { status: 400 });
  }
  const jourDemande = new Date(`${corps.date}T00:00:00Z`);

  const personnes = Number(corps.personnes);
  if (!Number.isInteger(personnes) || personnes < 1 || personnes > sortie.capacite) {
    return Response.json({ message: M.personnes }, { status: 400 });
  }

  /* UN REFUS DOIT NOMMER SA CAUSE. Une date passée et un départ complet
     rendent tous deux zéro place : les confondre envoyait le visiteur chercher
     une autre date alors que le problème était le calendrier de son appareil. */
  if (estPasse(jourDemande)) {
    return Response.json({ message: M.passee, motif: 'date-passee' }, { status: 409 });
  }

  /* La disponibilité, revérifiée ici et non crue sur parole. */
  const restantes = placesRestantes(sortie.id, sortie.capacite, jourDemande);
  if (restantes < personnes) {
    return Response.json({ message: M.complet, motif: 'complet', restantes }, { status: 409 });
  }

  /* Le montant, recalculé ici. */
  const d = devis(sortie.prix, personnes);

  /* ----- Passage au réel -------------------------------------------------
     const cle = process.env.STRIPE_SECRET_KEY;
     if (cle) { … ouvrir une session Stripe Checkout pour d.acompte … }
     Tout ce qui précède reste identique : le prix a été recalculé ici et la
     disponibilité revérifiée. Il ne manque que l'encaissement.
     --------------------------------------------------------------------- */

  return Response.json({
    mode: 'demonstration',
    message: M.simule,
    sortie: sortie.id,
    date: corps.date,
    personnes,
    tauxAcompte: TAUX_ACOMPTE,
    ...d,
  });
};

export const config = { path: '/api/acompte' };
