/*
 * Posocalc — recherche
 * Insensible à la casse et aux accents, tolérante aux fautes de frappe.
 */
(function (global) {
  'use strict';

  /** « Céfuroxime » -> « cefuroxime ». */
  function normaliser(texte) {
    return String(texte || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  /** Distance de Levenshtein bornée : renvoie > limite dès qu'on dépasse. */
  function distance(a, b, limite) {
    if (a === b) return 0;
    if (Math.abs(a.length - b.length) > limite) return limite + 1;
    var precedente = [];
    var i, j;
    for (j = 0; j <= b.length; j++) precedente[j] = j;
    for (i = 1; i <= a.length; i++) {
      var courante = [i];
      var minLigne = i;
      for (j = 1; j <= b.length; j++) {
        var cout = a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1;
        courante[j] = Math.min(
          precedente[j] + 1,
          courante[j - 1] + 1,
          precedente[j - 1] + cout
        );
        if (courante[j] < minLigne) minLigne = courante[j];
      }
      if (minLigne > limite) return limite + 1;
      precedente = courante;
    }
    return precedente[b.length];
  }

  /** Index de recherche pré-calculé pour une fiche. */
  function indexer(med) {
    var champs = [];
    champs.push({ texte: normaliser(med.dci), poids: 100 });
    (med.marques || []).forEach(function (m) {
      champs.push({ texte: normaliser(m), poids: 90 });
    });
    (med.synonymes || []).forEach(function (s) {
      champs.push({ texte: normaliser(s), poids: 55 });
    });
    (med.schemas || []).forEach(function (s) {
      champs.push({ texte: normaliser(s.indication), poids: 40 });
    });
    return champs;
  }

  /**
   * Score d'une fiche pour une requête. 0 = pas de correspondance.
   */
  function score(champs, requete) {
    var mots = requete.split(' ').filter(Boolean);
    if (!mots.length) return 0;
    var total = 0;

    for (var m = 0; m < mots.length; m++) {
      var mot = mots[m];
      var meilleur = 0;

      for (var c = 0; c < champs.length; c++) {
        var champ = champs[c];
        var texte = champ.texte;
        var points = 0;

        if (texte === mot) {
          points = champ.poids * 3;
        } else if (texte.indexOf(mot) === 0) {
          points = champ.poids * 2;
        } else if (texte.indexOf(' ' + mot) !== -1) {
          points = champ.poids * 1.6;
        } else if (texte.indexOf(mot) !== -1) {
          points = champ.poids;
        } else if (mot.length >= 4) {
          // Tolérance aux fautes de frappe sur chaque mot du champ.
          var segments = texte.split(' ');
          for (var s = 0; s < segments.length; s++) {
            var limite = mot.length >= 7 ? 2 : 1;
            if (distance(mot, segments[s], limite) <= limite) {
              points = Math.max(points, champ.poids * 0.7);
            }
          }
        }
        if (points > meilleur) meilleur = points;
      }

      // Tous les mots de la requête doivent correspondre à quelque chose.
      if (meilleur === 0) return 0;
      total += meilleur;
    }
    return total;
  }

  /**
   * @param {Array} medicaments
   * @param {string} requete
   * @param {string|null} categorie  filtre facultatif
   * @returns {Array} fiches triées
   */
  function rechercher(medicaments, requete, categorie) {
    var q = normaliser(requete);
    var resultats = [];

    for (var i = 0; i < medicaments.length; i++) {
      var med = medicaments[i];
      if (categorie && med.categorie !== categorie) continue;
      if (!med._index) med._index = indexer(med);

      var s = q ? score(med._index, q) : 0;
      if (q && s === 0) continue;
      // Sans requête : tout est retenu, les « fréquents » remontent.
      resultats.push({ med: med, score: s + (med.frequent ? 15 : 0) });
    }

    resultats.sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      return a.med.dci.localeCompare(b.med.dci, 'fr');
    });

    return resultats.map(function (r) { return r.med; });
  }

  global.PosocalcSearch = {
    normaliser: normaliser,
    rechercher: rechercher
  };
})(window);
