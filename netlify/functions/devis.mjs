/**
 * LA DEMANDE DE DEVIS POUR UNE PRIVATISATION.
 *
 * Elle vérifie ce qu'on lui envoie plutôt que de faire semblant, et le dit :
 * une démonstration qui accepte n'importe quoi n'apprend rien au prospect.
 *
 * SANS JAVASCRIPT, le navigateur poste le formulaire lui-même et attend une
 * page, non du JSON. On reconnaît ce cas à l'en-tête « Accept » et l'on
 * redirige vers la page de remerciement — c'est ainsi qu'un visiteur sans
 * script recevait autrement du JSON brut à l'écran.
 */
import contenu from '../../src/data/contenu.json' with { type: 'json' };

const MESSAGES = {
  fr: { manquant: 'Il manque un renseignement obligatoire.', courriel: 'Cette adresse électronique paraît incomplète.',
        date: 'La date est absente ou mal formée.', personnes: 'Le nombre de personnes est hors limites.',
        consentement: 'Votre accord est nécessaire pour vous répondre.',
        recu: 'Bien reçu. Sur le site d’un vrai prestataire, un devis suivrait sous vingt-quatre heures.' },
  en: { manquant: 'A required detail is missing.', courriel: 'That email address looks incomplete.',
        date: 'The date is missing or malformed.', personnes: 'The number of guests is out of range.',
        consentement: 'Your agreement is needed so we can reply.',
        recu: 'Well received. On a real operator’s site, a quote would follow within twenty-four hours.' },
};

const CHEMIN_MERCI = { fr: '/merci/', en: '/en/thank-you/' };

export default async (requete) => {
  if (requete.method !== 'POST') return Response.json({ message: 'POST attendu.' }, { status: 405 });

  const type = requete.headers.get('content-type') || '';
  const champs = type.includes('application/json')
    ? await requete.json().catch(() => ({}))
    : Object.fromEntries(await requete.formData());

  const langue = champs.langue === 'en' ? 'en' : 'fr';
  const M = MESSAGES[langue];
  /* Le navigateur qui poste sans script demande du HTML ; celui qui passe par
     « fetch » demande du JSON. C'est ce qui distingue les deux. */
  const veutPage = !type.includes('application/json')
    && (requete.headers.get('accept') || '').includes('text/html');

  const rater = (message) =>
    veutPage
      ? Response.redirect(new URL(`${CHEMIN_MERCI[langue]}?erreur=1`, requete.url), 303)
      : Response.json({ message }, { status: 400 });

  /* Champ piège : rempli, c'est un robot. On répond comme si de rien n'était. */
  if (String(champs.site || '').trim() !== '') {
    return veutPage
      ? Response.redirect(new URL(CHEMIN_MERCI[langue], requete.url), 303)
      : Response.json({ mode: 'demonstration', message: M.recu });
  }

  const nom = String(champs.nom || '').trim();
  const courriel = String(champs.courriel || '').trim();
  const occasion = String(champs.occasion || '').trim();
  if (!nom || !courriel || !occasion) return rater(M.manquant);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(courriel)) return rater(M.courriel);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(champs.date || ''))) return rater(M.date);

  const sortie = contenu.sorties.find((s) => s.surDevis);
  const personnes = Number(champs.personnes);
  if (!Number.isInteger(personnes) || personnes < 1 || personnes > sortie.capacite) {
    return rater(M.personnes);
  }
  if (!champs.consentement) return rater(M.consentement);

  /* RIEN N'EST ENVOYÉ NI CONSERVÉ. Au réel, c'est ici qu'un courriel partirait.
     La démonstration s'arrête à la vérification, et l'annonce. */
  return veutPage
    ? Response.redirect(new URL(CHEMIN_MERCI[langue], requete.url), 303)
    : Response.json({ mode: 'demonstration', message: M.recu, nom, personnes });
};

export const config = { path: '/api/devis' };
