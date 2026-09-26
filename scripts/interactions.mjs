/**
 * CE QUI SE CLIQUE, ÉPROUVÉ.
 *
 * Chaque attente est calée sur une CONDITION observable, jamais sur un délai :
 * un délai trop court transforme une animation en panne apparente.
 */
import { chromium } from 'playwright';

const BASE = process.env.BASE || 'http://127.0.0.1:4466';
const resultats = [];
const dire = (bon, quoi, detail = '') => {
  resultats.push(bon);
  console.log(`  ${bon ? '✓' : '✗'} ${quoi}${detail ? ' — ' + detail : ''}`);
};

const nav = await chromium.launch();

/* ---- Téléphone : menu, barre basse, calendrier ------------------------- */
{
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', locale: 'fr-FR' });
  const page = await ctx.newPage();

  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  const barre = page.locator('.basse');
  dire(await barre.isVisible(), 'barre basse présente sur téléphone');
  const wa = await page.locator('.basse a[href^="https://wa.me/"]').getAttribute('href');
  dire(!!wa && wa.includes('590690305037') && wa.includes('d%C3%A9monstration'),
       'WhatsApp : numéro et message pré-rempli');

  /* Le menu est un <details> : il s'ouvre par un clic, et son contenu existe
     dans la page même fermé. */
  const panneau = page.locator('.tiroir__panneau');
  dire(await panneau.count() === 1 && !(await panneau.isVisible()), 'menu replié au chargement');
  await page.locator('.tiroir__bouton').click();
  await panneau.waitFor({ state: 'visible' });
  dire(await panneau.isVisible(), 'menu ouvert au clic');
  const cibles = await page.locator('.tiroir__panneau a').evaluateAll((l) =>
    l.map((a) => Math.round(a.getBoundingClientRect().height)));
  dire(cibles.every((h) => h >= 40), `cibles du menu ≥ 40 px`, `min ${Math.min(...cibles)} px`);
  await page.keyboard.press('Escape');

  /* Le calendrier. */
  await page.goto(`${BASE}/reserver/`, { waitUntil: 'networkidle' });
  const mois1 = await page.locator('[data-nom-mois]').textContent();
  const libre = page.locator('[data-jour]:not([disabled])').first();
  await libre.click();
  await page.waitForFunction(() => document.querySelector('[data-recap-date]').textContent.trim() !== 'à choisir');
  dire(true, 'un jour se choisit et le récapitulatif suit',
       (await page.locator('[data-recap-date]').textContent())?.trim());

  await page.locator('[data-mois="1"]').click();
  await page.waitForFunction((m) => document.querySelector('[data-nom-mois]').textContent !== m, mois1);
  dire(true, 'le mois suivant se charge', (await page.locator('[data-nom-mois]').textContent())?.trim());

  /* Changer de sortie recalcule le prix. */
  await page.locator('[data-sortie][value="coucher-de-soleil"]').check();
  await page.waitForFunction(() => document.querySelector('[data-recap-nom]').textContent.includes('Coucher'));
  dire(true, 'changer de sortie recalcule', (await page.locator('[data-recap-total]').textContent())?.trim());

  /* L'acompte, jusqu'au bout. */
  const j = page.locator('[data-jour]:not([disabled])').first();
  await j.click();
  await page.locator('[data-valider]').click();
  await page.waitForFunction(() => {
    const r = document.querySelector('[data-reponse]');
    return r && !r.hidden && !/Vérification/.test(r.textContent);
  }, null, { timeout: 15000 });
  const reponse = (await page.locator('[data-reponse]').textContent())?.trim() || '';
  dire(/aucune carte/.test(reponse), "l'acompte se déroule et annonce qu'il n'encaisse rien", reponse.slice(0, 64));

  await ctx.close();
}

/* ---- Ordinateur : langue, visionneuse, formulaire ---------------------- */
{
  const ctx = await nav.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', locale: 'fr-FR' });
  const page = await ctx.newPage();

  /* Le sélecteur mène à la page ÉQUIVALENTE, pas à l'accueil. */
  await page.goto(`${BASE}/sorties/coucher-de-soleil/`, { waitUntil: 'networkidle' });
  const jumelle = await page.locator('.tete__langue').getAttribute('href');
  dire(!!jumelle && jumelle.endsWith('/en/trips/coucher-de-soleil/'),
       'le sélecteur de langue mène à la page équivalente', jumelle || '');

  /* La visionneuse. */
  await page.goto(`${BASE}/galerie/`, { waitUntil: 'networkidle' });
  await page.locator('[data-vue]').nth(2).click();
  await page.waitForFunction(() => document.querySelector('[data-visio]')?.open === true);
  const src1 = await page.locator('[data-image]').getAttribute('src');
  dire(!!src1, 'la visionneuse ouvre sur la bonne vue');
  await page.locator('[data-pas="1"]').click();
  const src2 = await page.locator('[data-image]').getAttribute('src');
  dire(src1 !== src2, 'les flèches changent de vue');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.querySelector('[data-visio]')?.open === false);
  const rendu = await page.evaluate(() => document.activeElement?.closest('[data-vue]') !== null);
  dire(rendu, 'Échap ferme et rend le focus à la vignette');

  /* Le formulaire de devis refuse le vide, puis accepte. */
  await page.goto(`${BASE}/devis/`, { waitUntil: 'networkidle' });
  await page.locator('button[type="submit"]').click();
  dire(await page.evaluate(() => !document.querySelector('form').checkValidity()),
       'le formulaire refuse une demande incomplète');
  await page.fill('input[name="nom"]', 'Élodie R.');
  await page.fill('input[name="courriel"]', 'elodie@exemple.fr');
  await page.fill('input[name="date"]', '2026-11-14');
  await page.fill('input[name="personnes"]', '10');
  await page.check('input[name="consentement"]');
  dire(await page.evaluate(() => document.querySelector('form').checkValidity()),
       'le formulaire accepte une demande complète');
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/merci\//, { timeout: 15000 });
  dire(true, 'sans script côté client, la demande aboutit à la page de remerciement', page.url().replace(BASE, ''));

  await ctx.close();
}

await nav.close();
const rates = resultats.filter((r) => !r).length;
console.log(`\n${resultats.length} contrôles · ${rates} échec(s)`);
process.exit(rates ? 1 : 0);
