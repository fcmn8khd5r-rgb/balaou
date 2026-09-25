/**
 * DEUX MESURES SUR L'OUVERTURE.
 *
 * 1. Les appels à l'action sont-ils dans le premier écran ? Un bouton sous la
 *    ligne de flottaison n'existe pas pour un visiteur pressé.
 * 2. Le contraste des textes sur la PHOTOGRAPHIE, et non sur une couleur
 *    supposée : on relève la luminance des pixels réellement peints sous
 *    chaque ligne, voile compris, puis on la confronte à celle du texte.
 */
import { chromium } from 'playwright';

const BASE = process.env.BASE || 'http://127.0.0.1:4466';
const ECRANS = [['téléphone', 390, 844, 3], ['ordinateur', 1440, 900, 2]];

const nav = await chromium.launch();
for (const [nom, l, h, echelle] of ECRANS) {
  const ctx = await nav.newContext({ viewport: { width: l, height: h }, deviceScaleFactor: echelle, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);

  const visibles = await page.evaluate(() => {
    const dans = (e) => {
      const b = e.getBoundingClientRect();
      return { haut: Math.round(b.top), bas: Math.round(b.bottom), visible: b.bottom <= innerHeight && b.top >= 0 };
    };
    const barre = document.querySelector('.basse');
    const hautBarre = barre && getComputedStyle(barre).display !== 'none'
      ? Math.round(barre.getBoundingClientRect().top) : innerHeight;
    return {
      fenetre: innerHeight,
      hautBarreBasse: hautBarre,
      actions: [...document.querySelectorAll('.ouverture__actions .btn')].map((b) => ({
        texte: b.textContent.trim(), ...dans(b),
        degageDeLaBarre: b.getBoundingClientRect().bottom <= hautBarre,
      })),
      gaucheTitre: Math.round(document.querySelector('.ouverture__titre').getBoundingClientRect().left),
      gaucheColonne: Math.round(document.querySelector('.ouverture__texte').getBoundingClientRect().left)
                    + Math.round(parseFloat(getComputedStyle(document.querySelector('.ouverture__texte')).paddingLeft)),
    };
  });

  console.log(`\n── ${nom} ${l}×${h} ──`);
  console.log(`  fenêtre ${visibles.fenetre} px · haut de la barre basse à ${visibles.hautBarreBasse}`);
  for (const a of visibles.actions) {
    const etat = a.visible && a.degageDeLaBarre ? '✓' : '✗';
    console.log(`  ${etat} « ${a.texte} » ${a.haut}→${a.bas} px`);
  }
  console.log(`  titre à ${visibles.gaucheTitre} px, colonne à ${visibles.gaucheColonne} px  ${visibles.gaucheTitre === visibles.gaucheColonne ? '✓ aligné' : '✗ décalé'}`);

  /* LE CONTRASTE, RELEVÉ SUR LE FOND SEUL.
     Premier essai : j'échantillonnais la capture ordinaire à l'aplomb des
     lignes — donc À TRAVERS les lettres. Le rapport tombait à 1,00, ce qui ne
     dit rien du site et tout de la méthode : du blanc comparé à du blanc.
     On prend donc une seconde capture, textes RENDUS INVISIBLES mais toujours
     en place : la photographie et le voile y sont intacts, et les rectangles
     de ligne relevés sur la première désignent exactement le fond à mesurer. */
  const zones = await page.evaluate(() => {
    const lignes = (sel) => {
      const e = document.querySelector(sel);
      if (!e) return null;
      const r = document.createRange(); r.selectNodeContents(e);
      const couleur = getComputedStyle(e).color;
      return { rects: [...r.getClientRects()].map((b) => ({ x: b.x, y: b.y, w: b.width, h: b.height })), couleur };
    };
    return { titre: lignes('.ouverture__titre'), lead: lignes('.ouverture__lead'), rail: lignes('.ouverture__rail') };
  });
  await page.addStyleTag({ content:
    '.ouverture__titre, .ouverture__lead, .ouverture__rail { visibility: hidden !important; }' });
  await page.waitForTimeout(120);
  const tampon = await page.screenshot({ type: 'png' });

  const { default: sharp } = await import('sharp');
  const img = sharp(tampon);
  const meta = await img.metadata();
  const brut = await img.raw().toBuffer();
  const canaux = brut.length / (meta.width * meta.height);

  const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const lum = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);

  for (const [nomZone, z] of Object.entries(zones)) {
    if (!z) continue;
    const m = /rgb\((\d+),\s*(\d+),\s*(\d+)/.exec(z.couleur);
    const lTexte = lum(+m[1], +m[2], +m[3]);
    let pire = Infinity;
    for (const r of z.rects) {
      /* On échantillonne la bande juste SOUS la ligne de texte : c'est le fond
         que l'œil compare, et non la moyenne de la boîte, qui contient déjà
         les lettres. */
      /* Le fond est mesuré au MILIEU de la ligne : c'est là que les lettres se
         trouvent, donc là que le contraste compte. Les textes étant masqués,
         on ne relève plus qu'eux. */
      const y0 = Math.round((r.y + r.h * 0.5) * echelle);
      for (let x = Math.round(r.x * echelle); x < Math.round((r.x + r.w) * echelle); x += 6 * echelle) {
        const i = (y0 * meta.width + x) * canaux;
        if (i < 0 || i + 2 >= brut.length) continue;
        const lFond = lum(brut[i], brut[i + 1], brut[i + 2]);
        const hi = Math.max(lTexte, lFond), lo = Math.min(lTexte, lFond);
        pire = Math.min(pire, (hi + 0.05) / (lo + 0.05));
      }
    }
    console.log(`  contraste ${nomZone.padEnd(6)} ${pire.toFixed(2)} ${pire >= 4.5 ? '✓' : '✗ (4,5 exigé)'}`);
  }
  await ctx.close();
}
await nav.close();
