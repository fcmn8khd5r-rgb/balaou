/**
 * Un serveur statique pour les contrôles. On sert « dist », JAMAIS le serveur
 * de développement : son rechargement à chaud perd la position de défilement
 * entre deux appels et les captures tombent au mauvais endroit.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const RACINE = path.resolve(import.meta.dirname, '../dist');
const PORT = Number(process.env.PORT || 4455);
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif',
  '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8',
};

createServer(async (req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  let fichier = path.join(RACINE, url);
  try {
    if ((await stat(fichier)).isDirectory()) fichier = path.join(fichier, 'index.html');
  } catch {
    fichier = path.join(RACINE, '404.html');
  }
  try {
    const corps = await readFile(fichier);
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(fichier)] || 'application/octet-stream' });
    res.end(corps);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404');
  }
}).listen(PORT, () => console.log(`dist servi sur http://127.0.0.1:${PORT}`));
