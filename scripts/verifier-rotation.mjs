/**
 * QUEL SENS ? On ne le déduit pas, on le mesure.
 *
 * La planche de contact avait été redressée avec Pillow, dont « rotate(-90) »
 * tourne dans le sens inverse des aiguilles d'une montre ; sharp, lui, tourne
 * dans l'autre. Plutôt que de raisonner sur des conventions, on produit les
 * deux versions et on les compare à la vignette de référence, pixel à pixel.
 */
import sharp from 'sharp';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const lancer = promisify(execFile);

const [heic, reference] = process.argv.slice(2);
const brut = '/tmp/rot-brut.jpg';
await lancer('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '100', heic, '--out', brut]);

const ref = await sharp(reference).resize(160, 160, { fit: 'fill' }).greyscale().raw().toBuffer();
for (const angle of [90, -90]) {
  const essai = await sharp(brut).rotate(angle).resize(160, 160, { fit: 'fill' }).greyscale().raw().toBuffer();
  let somme = 0;
  for (let i = 0; i < ref.length; i++) somme += Math.abs(ref[i] - essai[i]);
  console.log(`  rotate(${String(angle).padStart(3)})  écart moyen ${(somme / ref.length).toFixed(1)}`);
}
