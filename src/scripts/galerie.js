/**
 * LA VISIONNEUSE.
 *
 * Un <dialog> natif : le navigateur se charge de l'ouverture, de la fermeture
 * par Échap, du voile et du piège à focus. Rien de tout cela ne dépend d'une
 * règle d'auteur — c'est ce qui évite le piège de « hidden », battu par
 * n'importe quel « display » et qui avait rendu une page entière incliquable.
 *
 * Chaque vignette porte son grand format en attribut : aucune adresse n'est
 * construite ici, donc aucune ne peut se tromper de racine sous /en/.
 */
const galerie = document.querySelector('[data-galerie]');
const visio = document.querySelector('[data-visio]');

if (galerie && visio && typeof visio.showModal === 'function') {
  const image = visio.querySelector('[data-image]');
  const legende = visio.querySelector('[data-legende]');
  const boutons = [...galerie.querySelectorAll('[data-vue]')];
  let rang = 0;
  let appelant = null;

  function montrer(n) {
    rang = (n + boutons.length) % boutons.length;
    const b = boutons[rang];
    image.src = b.dataset.grande;
    image.alt = b.dataset.legende;
    legende.textContent = b.dataset.legende;
  }

  galerie.addEventListener('click', (e) => {
    const b = e.target.closest('[data-vue]');
    if (!b) return;
    appelant = b;
    montrer(Number(b.dataset.vue));
    visio.showModal();
    /* Le focus se pose APRÈS le rendu : appelé une trame trop tôt, sur un
       élément que la feuille laisse encore invisible, le navigateur refuse
       sans rien dire et la tabulation continue derrière la boîte. */
    requestAnimationFrame(() =>
      requestAnimationFrame(() => visio.querySelector('[data-fermer]')?.focus()),
    );
  });

  visio.addEventListener('click', (e) => {
    const pas = e.target.closest('[data-pas]');
    if (pas) { montrer(rang + Number(pas.dataset.pas)); return; }
    if (e.target.closest('[data-fermer]')) { visio.close(); return; }
    /* Un clic hors de l'image ferme : c'est le geste attendu. */
    if (e.target === visio) visio.close();
  });

  visio.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); montrer(rang + 1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); montrer(rang - 1); }
  });

  /* Le focus revient d'où il venait : sans cela, la tabulation repart du haut
     du document et l'on perd sa place dans la mosaïque. */
  visio.addEventListener('close', () => {
    image.removeAttribute('src');
    appelant?.focus();
  });
}
