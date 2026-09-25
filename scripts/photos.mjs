/**
 * LES PHOTOGRAPHIES DU SITE.
 *
 * Source : le dossier « Photo source » de l'auteur, en HEIC pour l'essentiel.
 *
 * UN PIÈGE MESURÉ ICI. « sips » convertit le HEIC sans honorer l'orientation
 * EXIF : une photo prise en portrait ressort couchée, aux dimensions d'un
 * paysage, et rien ne le signale. Treize des vingt-et-une sources sont dans ce
 * cas. On relit donc l'orientation dans les métadonnées du système — que
 * « mdls » expose — et l'on ne redresse QUE si les deux se contredisent :
 * orientation « 1 » sur un fichier que sips annonce plus large que haut.
 * Redresser sur la seule orientation casserait les portraits déjà droits.
 *
 * Tout est ensuite ramené à un étalonnage commun, puis les métadonnées sont
 * retirées — position GPS comprise.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const lancer = promisify(execFile);
const RACINE = path.resolve(import.meta.dirname, '..');
const SOURCE = path.resolve(RACINE, '../Library/Mobile Documents/com~apple~CloudDocs/Villa Deshaies test site/Photo source');
const DEST = path.join(RACINE, 'src/assets/photos');
const TRAVAIL = path.join(RACINE, 'scripts/travail');

/* Ce que chaque photo montre, relu une par une sur la planche de contact.
   La légende décrit l'image ; le texte du site s'y accorde, jamais l'inverse. */
const CHOIX = [
  { de: 'IMG_0515', vers: 'mouillage-jour',      role: 'accueil',  legende: { fr: 'Voiliers au mouillage, en fin de matinée', en: 'Yachts at anchor, late morning' } },
  { de: 'IMG_3337', vers: 'ilet-turquoise',      role: 'lagon',    legende: { fr: 'Un îlet posé sur le lagon', en: 'An islet on the lagoon' } },
  { de: 'IMG_3322', vers: 'anse-claire',         role: 'lagon',    legende: { fr: "L'anse, par ciel bleu", en: 'The cove under a blue sky' } },
  { de: 'IMG_3321', vers: 'ressac-sable',        role: 'galerie',  legende: { fr: 'Le ressac sur le sable clair', en: 'Surf on pale sand' } },
  { de: 'IMG_3319', vers: 'baie-midi',           role: 'galerie',  legende: { fr: 'La baie au soleil haut', en: 'The bay at high sun' } },
  { de: 'IMG_0845', vers: 'mouillage-couchant',  role: 'couchant', legende: { fr: 'Le mouillage au couchant', en: 'The anchorage at sunset' } },
  { de: 'IMG_0848', vers: 'voiliers-or',         role: 'couchant', legende: { fr: 'Voiliers sur un horizon doré', en: 'Yachts against a golden horizon' } },
  { de: 'IMG_3842', vers: 'catamaran-soir',      role: 'couchant', legende: { fr: 'Un catamaran dans la lumière du soir', en: 'A catamaran in the evening light' } },
  { de: 'IMG_0842', vers: 'rade-mauve',          role: 'galerie',  legende: { fr: 'La rade, juste après le soleil', en: 'The roadstead, just after sundown' } },
  { de: 'IMG_5698', vers: 'plage-amandiers',     role: 'galerie',  legende: { fr: 'La plage sous les amandiers', en: 'The beach beneath the almond trees' } },
];

/** L'orientation telle que le système la lit, et les dimensions telles que sips les annonce. */
async function etat(fichier) {
  const { stdout: o } = await lancer('mdls', ['-name', 'kMDItemOrientation', '-raw', fichier]);
  const { stdout: d } = await lancer('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', fichier]);
  const l = Number(/pixelWidth: (\d+)/.exec(d)?.[1]);
  const h = Number(/pixelHeight: (\d+)/.exec(d)?.[1]);
  return { pivote: o.trim() === '1' && l > h, largeur: l, hauteur: h };
}

async function main() {
  await mkdir(DEST, { recursive: true });
  await mkdir(TRAVAIL, { recursive: true });
  const presents = new Set(await readdir(SOURCE));
  const credits = [];

  for (const item of CHOIX) {
    const nom = ['HEIC', 'JPG', 'jpg'].map((e) => `${item.de}.${e}`).find((n) => presents.has(n));
    if (!nom) throw new Error(`Photo source absente : ${item.de}`);
    const source = path.join(SOURCE, nom);
    const brut = path.join(TRAVAIL, `${item.de}.jpg`);

    await lancer('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '100', source, '--out', brut]);
    const { pivote } = await etat(source);

    /* SENS DE ROTATION. « sharp.rotate(90) » tourne dans le sens des aiguilles,
       là où « PIL.rotate(-90) » — avec lequel la planche de contact avait été
       validée — tourne dans l'autre. Le signe a donc été vérifié sur les
       pixels, et non déduit : voir scripts/verifier-rotation.mjs. */
    let img = sharp(brut, { failOn: 'none' });
    if (pivote) img = img.rotate(90);

    /* L'étalonnage commun : un peu de tenue dans les noirs, une saturation
       légèrement retenue. Les bleus des Antilles virent au laiteux si l'on
       pousse — mesuré sur les villas, 0,40 est le maximum utile. */
    const sortie = path.join(DEST, `${item.vers}.jpg`);
    const meta = await img
      .modulate({ saturation: 0.94 })
      .linear(1.04, -6)
      .jpeg({ quality: 92, mozjpeg: true })
      /* AUCUN « withMetadata » ICI, et c'est délibéré. Ce nom trompe : il ne
         retire pas les métadonnées, il les REPORTE. Appelé après une rotation,
         il réattachait l'orientation d'origine — que Astro et les navigateurs
         honorent — et la photographie se retrouvait tournée une seconde fois.
         Il conservait au passage les EXIF et la position GPS, exactement ce
         qu'on cherchait à supprimer. Sharp écrit sans métadonnées par défaut. */
      .toFile(sortie);

    /* LE CADRAGE VERTICAL. Une photo de paysage posée sur un écran de
       téléphone ne montre qu'une bande centrale : le sujet sort du cadre.
       On produit donc un second fichier recadré en 3/4 pour les écrans en
       portrait, servi par un <picture> écrit à la main — le composant d'Astro
       ne fait pas de direction artistique. */
    if (item.role === 'accueil') {
      const vertical = path.join(DEST, `${item.vers}-portrait.jpg`);
      const source2 = sharp(brut, { failOn: 'none' });
      const m = await (pivote ? source2.rotate(90) : source2).metadata();
      const l = pivote ? m.height : m.width;
      const h = pivote ? m.width : m.height;
      const largeurCible = Math.round(Math.min(l, (h * 3) / 4));
      let v = sharp(brut, { failOn: 'none' });
      if (pivote) v = v.rotate(90);
      await v
        .extract({ left: Math.round((l - largeurCible) / 2), top: 0, width: largeurCible, height: h })
        .modulate({ saturation: 0.94 })
        .linear(1.04, -6)
        .jpeg({ quality: 92, mozjpeg: true })
        .toFile(vertical);
      console.log(`  ${(item.vers + '-portrait').padEnd(20)} ${largeurCible}×${h}  cadrage vertical`);
    }

    credits.push({ ...item, largeur: meta.width, hauteur: meta.height, pivote });
    console.log(`  ${item.vers.padEnd(20)} ${meta.width}×${meta.height}  ${pivote ? 'redressée' : ''}`);
  }

  await writeFile(path.join(RACINE, 'src/data/photos.json'), JSON.stringify(credits, null, 1));
  await rm(TRAVAIL, { recursive: true, force: true });
  console.log(`\n${credits.length} photographies · ${credits.filter((c) => c.pivote).length} redressées`);
}

await main();
