/**
 * LES PLACES RESTANTES, SORTIE PAR SORTIE.
 *
 * Le modèle diffère de celui des villas, et ce n'est pas un détail : un flux
 * iCal dit « pris » ou « libre », il ne transporte AUCUN nombre de places. On
 * part donc d'un calendrier d'exploitation et d'une capacité, et l'on en
 * retranche des réservations.
 *
 * POUR PASSER AU RÉEL, rien à réécrire dans la page : il suffit de remplacer
 * « reservationsDe » par une lecture de la base des réservations. La forme de
 * la réponse ne bouge pas.
 *
 * Le calcul vit dans src/lib/reservation.mjs — le MÊME module que la page.
 * Deux calculs finiraient par diverger, et l'affiché contredirait le facturé.
 */
import contenu from '../../src/data/contenu.json' with { type: 'json' };
import { placesRestantes, jour } from '../../src/lib/reservation.mjs';

const CACHE_S = 300;

export default async (requete) => {
  const url = new URL(requete.url);
  const id = url.searchParams.get('sortie');
  const depuis = url.searchParams.get('depuis');   // AAAA-MM-JJ
  const jours = Math.min(Number(url.searchParams.get('jours') || 62), 186);

  const sortie = contenu.sorties.find((s) => s.id === id && !s.surDevis);
  if (!sortie) {
    return Response.json({ message: 'Sortie inconnue.' }, { status: 404 });
  }

  const debut = depuis && /^\d{4}-\d{2}-\d{2}$/.test(depuis)
    ? new Date(`${depuis}T00:00:00Z`)
    : new Date();
  const d = new Date(Date.UTC(debut.getUTCFullYear(), debut.getUTCMonth(), debut.getUTCDate()));

  const journees = [];
  for (let i = 0; i < jours; i++) {
    journees.push({ date: jour(d), places: placesRestantes(sortie.id, sortie.capacite, d) });
    d.setUTCDate(d.getUTCDate() + 1);
  }

  return Response.json(
    { sortie: sortie.id, capacite: sortie.capacite, mode: 'demonstration', journees },
    { headers: { 'Cache-Control': `public, max-age=${CACHE_S}` } },
  );
};

export const config = { path: '/api/disponibilites' };
