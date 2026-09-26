/**
 * L'ACCESSIBILITÉ, SUR L'ARBRE RÉEL.
 *
 * axe-core est chargé dans la page et tranche sur ce que le navigateur rend
 * vraiment — un validateur statique croirait que le menu d'ordinateur et le
 * tiroir de téléphone coexistent, faute de voir le CSS.
 *
 * Les BONNES PRATIQUES sont incluses, et pas seulement les règles WCAG : la
 * règle « landmark-unique » en fait partie, et c'est elle qui avait manqué le
 * jour où deux navigations portaient le même nom, menu ouvert.
 *
 * Chaque ÉTAT compte : menu replié, menu ouvert, visionneuse ouverte.
 */
import { chromium } from 'playwright';
import { createRequire } from 'node:module';
const exiger = createRequire(import.meta.url);
const axeSource = exiger('fs').readFileSync(exiger.resolve('axe-core/axe.min.js'), 'utf8');

const BASE = process.env.BASE || 'http://127.0.0.1:4466';
const PAGES = ['/', '/sorties/', '/sorties/privatisation/', '/galerie/', '/avis/',
               '/questions/', '/reserver/', '/devis/', '/merci/', '/mentions-legales/', '/404.html',
               '/en/', '/en/trips/privatisation/', '/en/book/', '/en/quote/'];
const REGLES = { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] };

const nav = await chromium.launch();
const violations = [];
let passes = 0;

async function examiner(page, nom) {
  await page.addScriptTag({ content: axeSource });
  const r = await page.evaluate((o) => window.axe.run(document, o), REGLES);
  passes++;
  for (const v of r.violations) {
    violations.push(`${nom} — ${v.id} (${v.impact}) ×${v.nodes.length} : ${v.help}`);
  }
}

for (const largeur of [390, 1440]) {
  const ctx = await nav.newContext({ viewport: { width: largeur, height: 900 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  for (const chemin of PAGES) {
    await page.goto(BASE + chemin, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await examiner(page, `${chemin} @${largeur}`);

    if (largeur === 390 && chemin === '/') {
      await page.locator('.tiroir__bouton').click();
      await page.locator('.tiroir__panneau').waitFor({ state: 'visible' });
      await examiner(page, `/ @390 menu ouvert`);
    }
    if (chemin === '/galerie/') {
      await page.locator('[data-vue]').first().click();
      await page.waitForFunction(() => document.querySelector('[data-visio]')?.open === true);
      await examiner(page, `/galerie/ @${largeur} visionneuse ouverte`);
      await page.keyboard.press('Escape');
    }
  }
  await ctx.close();
}

/* ---- Le texte à 200 %, et le clavier ---------------------------------- */
const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
const page = await ctx.newPage();
const zoomProblemes = [];
for (const chemin of PAGES) {
  for (const racine of [16, 20, 24, 32]) {
    await page.goto(BASE + chemin, { waitUntil: 'networkidle' });
    await page.addStyleTag({ content: `html { font-size: ${racine}px !important; }` });
    await page.evaluate(() => document.fonts.ready);
    const d = await page.evaluate(() => {
      const de = document.documentElement;
      return de.scrollWidth - de.clientWidth;
    });
    if (d > 1) zoomProblemes.push(`${chemin} à ${Math.round((racine / 16) * 100)} % : ${d} px`);
  }
}

await page.goto(`${BASE}/reserver/`, { waitUntil: 'networkidle' });
let arrets = 0;
const vus = new Set();
for (let i = 0; i < 200; i++) {
  await page.keyboard.press('Tab');
  const sig = await page.evaluate(() => {
    const a = document.activeElement;
    if (!a || a === document.body) return null;
    const b = a.getBoundingClientRect();
    /* La signature doit distinguer deux boutons de MÊME classe sur la même
       ligne — les jours du calendrier, par exemple. Sans l'abscisse, le
       compteur s'arrêtait au deuxième et annonçait huit arrêts pour quarante. */
    return `${a.tagName}.${a.className}|${Math.round(b.top)}|${Math.round(b.left)}`;
  });
  if (!sig || vus.has(sig)) break;
  vus.add(sig); arrets++;
}

await nav.close();

console.log(`axe : ${passes} passes · ${violations.length} violation(s)`);
for (const v of [...new Set(violations)].slice(0, 12)) console.log('   ·', v);
console.log(`texte agrandi : ${zoomProblemes.length ? zoomProblemes.length + ' débordement(s)' : 'aucun débordement de 100 à 200 %'}`);
for (const z of zoomProblemes.slice(0, 8)) console.log('   ·', z);
console.log(`clavier : ${arrets} arrêts distincts sur la page de réservation`);

const rate = violations.length || zoomProblemes.length;
console.log(rate ? '\n✗ À REPRENDRE.' : '\n✓ ACCESSIBILITÉ : RIEN À SIGNALER.');
process.exit(rate ? 1 : 0);
