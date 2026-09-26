import { chromium } from 'playwright';
import { createRequire } from 'node:module';
const exiger = createRequire(import.meta.url);
const axeSource = exiger('fs').readFileSync(exiger.resolve('axe-core/axe.min.js'), 'utf8');
const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: 390, height: 900 }, reducedMotion: 'reduce' });
const page = await ctx.newPage();
for (const chemin of ['/devis/', '/sorties/', '/']) {
  await page.goto('http://127.0.0.1:4466' + chemin, { waitUntil: 'networkidle' });
  await page.addScriptTag({ content: axeSource });
  const r = await page.evaluate(() => window.axe.run(document,
    { runOnly: ['wcag2aa', 'best-practice'] }));
  console.log(`── ${chemin} : ${r.violations.length} violation(s)`);
  for (const v of r.violations) for (const n of v.nodes)
    console.log(`   ${v.id} · ${n.target} · ${(n.failureSummary || '').split('\n').slice(0, 3).join(' ').slice(0, 150)}`);
}
await nav.close();
