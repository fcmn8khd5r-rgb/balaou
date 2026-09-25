// @ts-check
import { defineConfig } from 'astro/config';
import { readFileSync } from 'node:fs';

/**
 * L'ADRESSE DÉCLARÉE DANS LE CONTENU FAIT FOI.
 *
 * Netlify expose l'adresse du site dans URL au moment de construire — mais
 * c'est le domaine PRINCIPAL à cet instant : tant qu'un domaine acheté n'a pas
 * été promu, URL vaut encore « quelquechose.netlify.app », et le site demande
 * alors à Google d'indexer l'adresse de l'hébergeur à la place de la sienne.
 * Le contenu, lui, est versionné et relu. URL ne sert donc que de repli, et
 * l'absence des deux arrête la construction plutôt que de produire un site qui
 * se désigne mal en silence.
 */
const contenu = JSON.parse(readFileSync(new URL('./src/data/contenu.json', import.meta.url), 'utf8'));
const adresse = contenu.site?.url || process.env.URL;
if (!adresse) throw new Error('Aucune adresse : ni site.url dans contenu.json, ni URL fournie par l’hébergeur.');

export default defineConfig({
  site: adresse,
  trailingSlash: 'always',
  i18n: {
    defaultLocale: 'fr',
    locales: ['fr', 'en'],
    routing: { prefixDefaultLocale: false },
  },
  build: {
    // La feuille est petite : l'insérer supprime un aller-retour réseau avant
    // le premier rendu, ce qui compte pour un visiteur arrivé d'Instagram.
    inlineStylesheets: 'always',
    format: 'directory',
  },
  compressHTML: true,
  prefetch: { prefetchAll: true, defaultStrategy: 'hover' },
  image: { service: { entrypoint: 'astro/assets/services/sharp' } },
  devToolbar: { enabled: false },
});
