/**
 * LE PLAN DU SITE, DANS LES DEUX LANGUES.
 *
 * Chaque adresse déclare sa jumelle en « xhtml:link » : sans cela, les deux
 * versions se font concurrence dans les résultats au lieu d'être reconnues
 * comme une même page en deux langues.
 *
 * La page de remerciement en est exclue : on n'y arrive que par un formulaire.
 */
import type { APIRoute } from 'astro';
import contenu from '../data/contenu.json';
import { route, routeSortie, LANGS, type Cle } from '../i18n';

const CLES: Cle[] = ['accueil', 'sorties', 'galerie', 'avis', 'questions', 'reserver', 'devis', 'mentions'];

export const GET: APIRoute = ({ site }) => {
  const racine = new URL(site!).origin;
  const abs = (chemin: string) => racine + chemin;

  const entrees = [
    ...CLES.map((cle) => ({ fr: route(cle, 'fr'), en: route(cle, 'en') })),
    ...contenu.sorties.map((s) => ({ fr: routeSortie(s.id, 'fr'), en: routeSortie(s.id, 'en') })),
  ];

  const corps = entrees
    .flatMap((e) =>
      LANGS.map((lg) => {
        const liens = LANGS.map(
          (autre) => `    <xhtml:link rel="alternate" hreflang="${autre}" href="${abs(e[autre])}"/>`,
        ).concat(`    <xhtml:link rel="alternate" hreflang="x-default" href="${abs(e.fr)}"/>`);
        return `  <url>\n    <loc>${abs(e[lg])}</loc>\n${liens.join('\n')}\n  </url>`;
      }),
    )
    .join('\n');

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n` +
      `${corps}\n</urlset>\n`,
    { headers: { 'Content-Type': 'application/xml; charset=utf-8' } },
  );
};
