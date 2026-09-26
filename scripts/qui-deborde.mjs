import { chromium } from 'playwright';
const BASE = 'http://127.0.0.1:4466';
const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
const page = await ctx.newPage();
for (const racine of [24, 32]) {
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.addStyleTag({ content: `html { font-size: ${racine}px !important; }` });
  await page.evaluate(() => document.fonts.ready);
  const r = await page.evaluate(() => {
    const de = document.documentElement;
    const p = (s) => { const e = document.querySelector(s); if (!e) return null;
      const b = e.getBoundingClientRect(); return { l: Math.round(b.width), d: Math.round(b.right) }; };
    return {
      ecart: de.scrollWidth - de.clientWidth,
      fenetre: de.clientWidth,
      coque: p('.tete__coque'), marque: p('.marque'), nom: p('.marque__nom'),
      suite: p('.marque__suite'), actions: p('.tete__actions'),
      langue: p('.tete__langue'), bouton: p('.tiroir__bouton'),
      marge: getComputedStyle(document.querySelector('.tete__coque')).paddingLeft,
    };
  });
  console.log(`\n── ${Math.round(racine / 16 * 100)} % · fenêtre ${r.fenetre} · écart ${r.ecart} px · marge ${r.marge}`);
  for (const [k, v] of Object.entries(r)) {
    if (v && typeof v === 'object') console.log(`   ${k.padEnd(9)} largeur ${String(v.l).padStart(4)}  droite ${v.d}`);
  }
}
await nav.close();
