/**
 * robots.txt ENGENDRÉ, jamais recopié.
 *
 * Écrit à la main dans « public/ », il désigne tôt ou tard un domaine mort :
 * c'est arrivé sur trois sites, et rien ne le signale. Il vient donc de
 * l'adresse déclarée, comme le plan du site.
 */
import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ site }) => {
  const racine = new URL(site!).origin;
  return new Response(
    [
      'User-agent: *',
      'Allow: /',
      '',
      `Sitemap: ${racine}/sitemap.xml`,
      '',
    ].join('\n'),
    { headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
  );
};
