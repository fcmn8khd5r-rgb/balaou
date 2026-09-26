/**
   * LA RÉSERVATION, CÔTÉ NAVIGATEUR.
   *
   * Le premier mois est rendu par le serveur : la page est donc lisible et
   * chiffrée avant qu'une ligne de script ne s'exécute. Le script ne fait
   * qu'ajouter le changement de sortie, la navigation par mois et le calcul.
   *
   * Aucun prix n'est écrit ici : ils viennent du contenu, engendrés dans la
   * page. Le serveur les recalcule de toute façon avant tout encaissement.
   */
  const racine = document.querySelector('[data-reserve]');
  if (racine) {
    const D = JSON.parse(document.getElementById('donnees-reservation').textContent);
    const euro = new Intl.NumberFormat(D.langue === 'fr' ? 'fr-FR' : 'en-GB',
      { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
    const dateLongue = new Intl.DateTimeFormat(D.langue === 'fr' ? 'fr-FR' : 'en-GB',
      { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
    const moisLong = new Intl.DateTimeFormat(D.langue === 'fr' ? 'fr-FR' : 'en-GB',
      { month: 'long', year: 'numeric', timeZone: 'UTC' });

    const q = (s) => racine.querySelector(s);
    const grille = q('[data-grille]');
    const nomMois = q('[data-nom-mois]');
    const champPersonnes = q('[data-personnes]');
    const avis = q('[data-avis]');
    const reponse = q('[data-reponse]');
    const valider = q('[data-valider]');

    const etat = {
      sortie: q('[data-sortie]:checked').value,
      mois: D.premierMois,
      date: null,
      places: null,
      personnes: Number(champPersonnes.value),
    };
    const cache = new Map();

    /* L'adresse de la sortie est reprise si elle est passée en paramètre :
       « Réserver cette sortie » arrive ainsi sur le bon choix. */
    const voulue = new URLSearchParams(location.search).get('sortie');
    if (voulue && D.sorties[voulue]) {
      const bouton = racine.querySelector(`[data-sortie][value="${CSS.escape(voulue)}"]`);
      if (bouton) { bouton.checked = true; etat.sortie = voulue; }
    }

    const moisEn = (cle, pas) => {
      const [a, m] = cle.split('-').map(Number);
      const d = new Date(Date.UTC(a, m - 1 + pas, 1));
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    };

    async function journees(sortie, cleMois) {
      const cle = `${sortie}:${cleMois}`;
      if (cache.has(cle)) return cache.get(cle);
      const [a, m] = cleMois.split('-').map(Number);
      const fin = new Date(Date.UTC(a, m, 0)).getUTCDate();
      const url = `/api/disponibilites?sortie=${encodeURIComponent(sortie)}&depuis=${cleMois}-01&jours=${fin}`;
      const r = await fetch(url);
      if (!r.ok) throw new Error(`disponibilités ${r.status}`);
      const { journees: j } = await r.json();
      cache.set(cle, j);
      return j;
    }

    function dessiner(j, cleMois) {
      const [a, m] = cleMois.split('-').map(Number);
      const premier = (new Date(Date.UTC(a, m - 1, 1)).getUTCDay() + 6) % 7;
      const cases = [...Array(premier).fill(null), ...j];
      const nom = moisLong.format(new Date(Date.UTC(a, m - 1, 1)));
      nomMois.textContent = nom;

      let html = '';
      for (let l = 0; l < Math.ceil(cases.length / 7); l++) {
        html += '<tr>';
        for (const c of cases.slice(l * 7, l * 7 + 7)) {
          if (!c) { html += '<td><span class="jour jour--vide"></span></td>'; continue; }
          const n = Number(c.date.slice(8, 10));
          const complet = c.places === 0;
          html += `<td><button type="button" class="jour${complet ? ' jour--complet' : ''}"`
            + `${complet ? ' disabled' : ''} data-jour="${c.date}" data-places="${c.places}"`
            + ` aria-label="${n} ${nom} — ${complet ? 'complet' : `${c.places} places`}">`
            + `<span class="jour__chiffre">${n}</span>`
            + `<span class="jour__places">${complet ? '—' : c.places}</span></button></td>`;
        }
        html += '</tr>';
      }
      grille.innerHTML = html;
      if (etat.date) {
        const b = grille.querySelector(`[data-jour="${etat.date}"]`);
        if (b) b.setAttribute('aria-pressed', 'true');
      }
      q('[data-mois="-1"]').disabled = cleMois <= D.moisPlancher;
    }

    function recalculer() {
      const s = D.sorties[etat.sortie];
      champPersonnes.max = String(s.capacite);
      if (etat.personnes > s.capacite) { etat.personnes = s.capacite; champPersonnes.value = String(s.capacite); }

      const total = s.prix * etat.personnes;
      const acompte = Math.round(total * D.taux);
      q('[data-recap-nom]').textContent = s.nom;
      q('[data-recap-detail]').textContent = `${euro.format(s.prix)} × ${etat.personnes}`;
      q('[data-recap-date]').textContent = etat.date
        ? dateLongue.format(new Date(`${etat.date}T00:00:00Z`))
        : (D.langue === 'fr' ? 'à choisir' : 'to be chosen');
      q('[data-recap-total]').textContent = euro.format(total);
      q('[data-recap-acompte]').textContent = euro.format(acompte);
      q('[data-recap-solde]').textContent = euro.format(total - acompte);

      /* Le bouton n'ouvre que ce qu'il pourra tenir : pas de date, ou trop de
         passagers pour ce jour, et il attend. Un parcours qui laisse cliquer
         pour refuser ensuite est un parcours qui fait perdre la réservation. */
      const trop = etat.places !== null && etat.personnes > etat.places;
      avis.hidden = !trop;
      if (trop) avis.textContent = `Il reste ${etat.places} place${etat.places > 1 ? 's' : ''} ce jour-là.`;
      valider.disabled = !etat.date || trop;
    }

    async function charger(cleMois) {
      grille.setAttribute('aria-busy', 'true');
      try {
        dessiner(await journees(etat.sortie, cleMois), cleMois);
        etat.mois = cleMois;
      } catch {
        nomMois.textContent = D.langue === 'fr'
          ? 'Calendrier indisponible pour l’instant'
          : 'Calendar unavailable right now';
      } finally {
        grille.removeAttribute('aria-busy');
      }
      recalculer();
    }

    racine.addEventListener('change', (e) => {
      const c = e.target.closest('[data-sortie]');
      if (c) {
        etat.sortie = c.value;
        etat.date = null; etat.places = null;
        reponse.hidden = true;
        charger(etat.mois);
        return;
      }
      if (e.target.closest('[data-personnes]')) {
        const n = Math.max(1, Math.min(Number(champPersonnes.value) || 1, D.sorties[etat.sortie].capacite));
        champPersonnes.value = String(n);
        etat.personnes = n;
        recalculer();
      }
    });

    racine.addEventListener('click', (e) => {
      const fleche = e.target.closest('[data-mois]');
      if (fleche) { charger(moisEn(etat.mois, Number(fleche.dataset.mois))); return; }

      const bouton = e.target.closest('[data-jour]');
      if (bouton && !bouton.disabled) {
        grille.querySelectorAll('[aria-pressed]').forEach((b) => b.removeAttribute('aria-pressed'));
        bouton.setAttribute('aria-pressed', 'true');
        etat.date = bouton.dataset.jour;
        etat.places = Number(bouton.dataset.places);
        reponse.hidden = true;
        recalculer();
      }
    });

    valider.addEventListener('click', async () => {
      valider.disabled = true;
      reponse.hidden = false;
      reponse.textContent = D.langue === 'fr' ? 'Vérification…' : 'Checking…';
      try {
        const r = await fetch('/api/acompte', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sortie: etat.sortie, date: etat.date, personnes: etat.personnes, langue: D.langue }),
        });
        const j = await r.json();
        reponse.textContent = r.ok
          ? `${j.message} ${D.langue === 'fr' ? 'Acompte' : 'Deposit'} ${euro.format(j.acompte)}.`
          : j.message;
        reponse.classList.toggle('recap__reponse--refus', !r.ok);
        /* Une place a pu partir entre l'affichage et le clic : on rafraîchit. */
        if (r.status === 409) { cache.clear(); charger(etat.mois); }
      } catch {
        reponse.textContent = D.langue === 'fr'
          ? 'La vérification a échoué. Réessayez, ou écrivez-nous sur WhatsApp.'
          : 'The check failed. Try again, or message us on WhatsApp.';
        reponse.classList.add('recap__reponse--refus');
      } finally {
        recalculer();
      }
    });

    recalculer();
  }
