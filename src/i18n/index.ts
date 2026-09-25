/**
 * DEUX LANGUES, UNE SEULE TABLE DE ROUTES.
 *
 * Chaque page porte une clé stable et une adresse par langue. Les composants
 * ne manipulent que la clé : changer un libellé d'URL se fait ici, en un seul
 * endroit, sans toucher à un lien du site.
 *
 * Les chemins sont ABSOLUS. Les pages anglaises vivent un cran plus bas, et
 * tout chemin relatif y désignerait autre chose — c'est ainsi qu'un héros et
 * une visionneuse s'étaient retrouvés vides sous /en/, sans rien signaler.
 */
import contenu from '../data/contenu.json';

export type Lang = 'fr' | 'en';
export const LANGS = ['fr', 'en'] as const;
export const DEFAUT: Lang = 'fr';

export type Bilingue<T = string> = { fr: T; en: T };

/** Résout une valeur bilingue, en retombant sur le français si l'anglais manque. */
export function t<T>(valeur: Bilingue<T> | T, langue: Lang): T {
  if (valeur && typeof valeur === 'object' && 'fr' in (valeur as object)) {
    const v = valeur as Bilingue<T>;
    return v[langue] ?? v.fr;
  }
  return valeur as T;
}

export type Cle = 'accueil' | 'sorties' | 'galerie' | 'avis' | 'questions' | 'reserver' | 'mentions' | 'merci';

const ROUTES: Record<Cle, Bilingue> = {
  accueil:   { fr: '/',                en: '/en/' },
  sorties:   { fr: '/sorties/',        en: '/en/trips/' },
  galerie:   { fr: '/galerie/',        en: '/en/gallery/' },
  avis:      { fr: '/avis/',           en: '/en/reviews/' },
  questions: { fr: '/questions/',      en: '/en/faq/' },
  reserver:  { fr: '/reserver/',       en: '/en/book/' },
  mentions:  { fr: '/mentions-legales/', en: '/en/legal-notice/' },
  merci:     { fr: '/merci/',          en: '/en/thank-you/' },
};

export const route = (cle: Cle, langue: Lang) => ROUTES[cle][langue];

/** L'adresse d'une sortie, par son identifiant. */
export const routeSortie = (id: string, langue: Lang) =>
  `${ROUTES.sorties[langue]}${id}/`;

/** Le lien WhatsApp, message pré-rempli compris. */
export function lienWhatsapp(langue: Lang): string {
  const { whatsapp, messageWhatsapp } = contenu.contact;
  return `https://wa.me/${whatsapp}?text=${encodeURIComponent(t(messageWhatsapp, langue))}`;
}

/** La langue d'une page, déduite de son adresse. */
export const langueDe = (chemin: string): Lang => (chemin.startsWith('/en/') ? 'en' : 'fr');
