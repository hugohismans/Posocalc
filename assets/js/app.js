/*
 * Posocalc — interface
 */
(function (global) {
  'use strict';

  var Data = global.PosocalcData;
  var Calc = global.PosocalcCalc;
  var Search = global.PosocalcSearch;

  var CLE_DISCLAIMER = 'posocalc.disclaimer.v1';

  /* ---------------------------------------------------------------- */
  /* État                                                             */
  /* ---------------------------------------------------------------- */

  var etat = {
    poids: null,
    ageMois: null,
    requete: '',
    categorie: null,
    medId: null,
    schemaId: null,
    formeId: null,
    formeManuelle: false,   // l'utilisateur a choisi la présentation lui-même
    prises: null,
    dosePerKg: null
  };

  var $ = function (sel) { return document.querySelector(sel); };

  var els = {
    poids: $('#poids'),
    ageValeur: $('#age-valeur'),
    ageUnite: $('#age-unite'),
    reset: $('#btn-reset'),
    recherche: $('#recherche'),
    viderRecherche: $('#btn-vider-recherche'),
    filtres: $('#filtres'),
    liste: $('#liste'),
    listeEntete: $('#liste-entete'),
    listeVide: $('#liste-vide'),
    detail: $('#detail'),
    modal: $('#modal-disclaimer'),
    accepter: $('#btn-accepter'),
    info: $('#btn-info'),
    toast: $('#toast')
  };

  /* ---------------------------------------------------------------- */
  /* Utilitaires                                                      */
  /* ---------------------------------------------------------------- */

  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function medParId(id) {
    for (var i = 0; i < Data.MEDICAMENTS.length; i++) {
      if (Data.MEDICAMENTS[i].id === id) return Data.MEDICAMENTS[i];
    }
    return null;
  }

  function parId(liste, id) {
    for (var i = 0; i < (liste || []).length; i++) {
      if (liste[i].id === id) return liste[i];
    }
    return null;
  }

  function nomCategorie(id) {
    var c = parId(Data.CATEGORIES, id);
    return c ? c.nom : id;
  }

  var toastTimer = null;
  function toast(message) {
    els.toast.textContent = message;
    els.toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { els.toast.hidden = true; }, 2200);
  }

  /** Pas du curseur adapté à l'amplitude de l'intervalle. */
  function pasCurseur(span) {
    if (span <= 1) return 0.05;
    if (span <= 2) return 0.1;
    if (span <= 10) return 0.5;
    return 1;
  }

  /* ---------------------------------------------------------------- */
  /* Avertissement initial                                            */
  /* ---------------------------------------------------------------- */

  function initDisclaimer() {
    var vu = false;
    try { vu = global.localStorage.getItem(CLE_DISCLAIMER) === 'ok'; } catch (e) { /* mode privé */ }
    if (!vu) els.modal.hidden = false;

    els.accepter.addEventListener('click', function () {
      els.modal.hidden = true;
      try { global.localStorage.setItem(CLE_DISCLAIMER, 'ok'); } catch (e) { /* ignore */ }
      els.poids.focus();
    });
    els.info.addEventListener('click', function () { els.modal.hidden = false; });
  }

  /* ---------------------------------------------------------------- */
  /* Patient                                                          */
  /* ---------------------------------------------------------------- */

  function lirePatient() {
    var p = parseFloat(String(els.poids.value).replace(',', '.'));
    etat.poids = isNaN(p) || p <= 0 ? null : p;

    var a = parseFloat(String(els.ageValeur.value).replace(',', '.'));
    if (isNaN(a) || a < 0) {
      etat.ageMois = null;
    } else {
      etat.ageMois = els.ageUnite.value === 'ans' ? a * 12 : a;
    }
  }

  function initPatient() {
    ['input', 'change'].forEach(function (ev) {
      els.poids.addEventListener(ev, function () { lirePatient(); rendreDetail(); });
      els.ageValeur.addEventListener(ev, function () { lirePatient(); rendreDetail(); });
      els.ageUnite.addEventListener(ev, function () { lirePatient(); rendreDetail(); });
    });
    els.reset.addEventListener('click', function () {
      els.poids.value = '';
      els.ageValeur.value = '';
      lirePatient();
      rendreDetail();
      els.poids.focus();
      toast('Données patient effacées');
    });
  }

  /* ---------------------------------------------------------------- */
  /* Recherche et filtres                                             */
  /* ---------------------------------------------------------------- */

  function initFiltres() {
    var html = '<button class="puce" type="button" data-cat="" aria-pressed="true">Tout</button>';
    Data.CATEGORIES.forEach(function (c) {
      html += '<button class="puce" type="button" data-cat="' + esc(c.id) + '" aria-pressed="false">' + esc(c.nom) + '</button>';
    });
    els.filtres.innerHTML = html;

    els.filtres.addEventListener('click', function (e) {
      var btn = e.target.closest('.puce');
      if (!btn) return;
      etat.categorie = btn.dataset.cat || null;
      Array.prototype.forEach.call(els.filtres.children, function (b) {
        b.setAttribute('aria-pressed', String(b === btn));
      });
      rendreListe();
    });
  }

  function initRecherche() {
    els.recherche.addEventListener('input', function () {
      etat.requete = els.recherche.value;
      els.viderRecherche.hidden = !etat.requete;
      rendreListe();
    });
    els.viderRecherche.addEventListener('click', function () {
      els.recherche.value = '';
      etat.requete = '';
      els.viderRecherche.hidden = true;
      rendreListe();
      els.recherche.focus();
    });
  }

  /* ---------------------------------------------------------------- */
  /* Liste des médicaments                                            */
  /* ---------------------------------------------------------------- */

  function ligne(med) {
    var marques = (med.marques || []).join(' · ');
    return '<li>' +
      '<button class="item" type="button" data-med="' + esc(med.id) + '"' +
      (etat.medId === med.id ? ' aria-current="true"' : '') + '>' +
        (med.frequent ? '<span class="etoile" title="Fréquemment prescrit" aria-hidden="true">★</span>' : '') +
        '<span class="item__corps">' +
          '<span class="item__nom">' + esc(med.dci) + '</span>' +
          '<span class="item__marques">' + esc(marques) + '</span>' +
        '</span>' +
        '<span class="item__fleche" aria-hidden="true">›</span>' +
      '</button></li>';
  }

  function rendreListe() {
    var resultats = Search.rechercher(Data.MEDICAMENTS, etat.requete, etat.categorie);

    if (!resultats.length) {
      els.liste.innerHTML = '';
      els.listeEntete.textContent = '';
      els.listeVide.hidden = false;
      return;
    }
    els.listeVide.hidden = true;

    if (!etat.requete && !etat.categorie) {
      var frequents = resultats.filter(function (m) { return m.frequent; });
      var autres = resultats.filter(function (m) { return !m.frequent; });
      els.listeEntete.textContent = 'Les plus prescrits';
      els.liste.innerHTML =
        frequents.map(ligne).join('') +
        '<li class="liste__separateur" aria-hidden="true"></li>' +
        autres.map(ligne).join('');
      // Titre intermédiaire injecté après les fréquents.
      var sep = els.liste.querySelector('.liste__separateur');
      if (sep) {
        sep.outerHTML = '<li><p class="liste__entete">Tous les médicaments (' + autres.length + ')</p></li>';
      }
    } else {
      els.listeEntete.textContent = resultats.length + (resultats.length > 1 ? ' résultats' : ' résultat');
      els.liste.innerHTML = resultats.map(ligne).join('');
    }
  }

  function initListe() {
    els.liste.addEventListener('click', function (e) {
      var btn = e.target.closest('.item');
      if (!btn) return;
      selectionner(btn.dataset.med);
    });
  }

  /* ---------------------------------------------------------------- */
  /* Sélection d'un médicament                                        */
  /* ---------------------------------------------------------------- */

  function selectionner(medId, sansScroll) {
    var med = medParId(medId);
    if (!med) return;

    etat.medId = med.id;
    var schema = med.schemas[0];
    etat.schemaId = schema.id;
    etat.prises = schema.prises && schema.prises.length ? schema.prises[0] : 1;
    etat.dosePerKg = schema.doseUsuelle !== undefined ? schema.doseUsuelle : schema.doseMin;
    etat.formeManuelle = false;
    autoForme(med, schema);

    if (global.location.hash !== '#/med/' + med.id) {
      global.history.replaceState(null, '', '#/med/' + med.id);
    }

    rendreListe();
    rendreDetail();
    if (!sansScroll) {
      els.detail.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  /** Présélectionne la présentation la plus praticable, sauf choix explicite. */
  function autoForme(med, schema) {
    if (!med.formes || !med.formes.length) { etat.formeId = null; return; }
    if (etat.formeManuelle && parId(med.formes, etat.formeId)) return;
    var f = Calc.meilleureForme({
      med: med, schema: schema,
      patient: { poids: etat.poids, ageMois: etat.ageMois },
      dosePerKg: etat.dosePerKg,
      prises: etat.prises || (schema.prises && schema.prises[0]) || 1
    });
    etat.formeId = f ? f.id : med.formes[0].id;
  }

  function fermerDetail() {
    etat.medId = null;
    els.detail.hidden = true;
    els.detail.innerHTML = '';
    global.history.replaceState(null, '', '#/');
    rendreListe();
  }

  /* ---------------------------------------------------------------- */
  /* Rendu du détail                                                  */
  /* ---------------------------------------------------------------- */

  function rendreDetail() {
    if (!etat.medId) { els.detail.hidden = true; return; }
    var med = medParId(etat.medId);
    if (!med) { els.detail.hidden = true; return; }

    var schema = parId(med.schemas, etat.schemaId) || med.schemas[0];
    autoForme(med, schema);   // suit le poids tant que l'utilisateur n'a pas tranché
    var forme = med.formes ? parId(med.formes, etat.formeId) : null;
    var prises = etat.prises || (schema.prises && schema.prises[0]) || 1;

    var resultat = Calc.calculer({
      med: med,
      schema: schema,
      forme: forme,
      patient: { poids: etat.poids, ageMois: etat.ageMois },
      dosePerKg: etat.dosePerKg,
      prises: prises
    });

    els.detail.hidden = false;
    els.detail.innerHTML =
      '<div class="carte">' +
        blocEntete(med) +
        blocReglages(med, schema, forme, prises) +
        (resultat.blocages.length ? blocBlocages(resultat) : blocResultat(med, schema, forme, resultat)) +
        blocAlertes(med, schema, resultat) +
        blocInfos(med, schema) +
      '</div>';

    brancherDetail(med, schema);
  }

  function blocEntete(med) {
    var badges =
      '<span class="badge badge--cat">' + esc(nomCategorie(med.categorie)) + '</span>' +
      (med.verifie
        ? '<span class="badge badge--ok">fiche vérifiée</span>'
        : '<span class="badge badge--warn">fiche non vérifiée</span>');

    return '<div class="detail__entete">' +
      '<div class="detail__titres">' +
        '<h2 class="detail__dci">' + esc(med.dci) + '</h2>' +
        '<p class="detail__marques">' + esc((med.marques || []).join(' · ')) + '</p>' +
        '<div class="detail__meta">' + badges + '</div>' +
      '</div>' +
      '<button class="btn--fermer" type="button" id="btn-fermer" aria-label="Fermer la fiche">&times;</button>' +
    '</div>';
  }

  function blocReglages(med, schema, forme, prises) {
    var html = '<div class="reglages">';

    /* Indication */
    if (med.schemas.length > 1) {
      html += '<div class="reglage"><label for="sel-schema">Indication</label><select id="sel-schema">';
      med.schemas.forEach(function (s) {
        html += '<option value="' + esc(s.id) + '"' + (s.id === schema.id ? ' selected' : '') + '>' +
          esc(s.indication) + '</option>';
      });
      html += '</select>';
      html += '<p class="reglage__note">Posologie de référence : <strong>' +
        esc(Calc.libelleIntervalle(schema)) + '</strong>' +
        (schema.duree ? ' — ' + esc(schema.duree) : '') + '</p>';
      html += '</div>';
    } else {
      html += '<div class="reglage"><label>Indication</label>' +
        '<p class="reglage__note" style="margin-top:0">' + esc(schema.indication) + '<br>' +
        'Posologie de référence : <strong>' + esc(Calc.libelleIntervalle(schema)) + '</strong>' +
        (schema.duree ? ' — ' + esc(schema.duree) : '') + '</p></div>';
    }

    /* Curseur de dose dans l'intervalle */
    if (schema.mode !== 'paliers' && schema.doseMin !== schema.doseMax) {
      var suffixe = schema.mode === 'jour' ? '/kg/j' : (schema.mode === 'prise' ? '/kg par prise' : '/kg');
      var pas = pasCurseur(schema.doseMax - schema.doseMin);
      var val = etat.dosePerKg;
      html += '<div class="reglage">' +
        '<div class="curseur__ligne">' +
          '<label for="sel-dose" style="margin:0">Dose retenue</label>' +
          '<span class="curseur__valeur" id="dose-affichee">' + Calc.nombre(val) + ' ' +
            esc(schema.unite) + suffixe + '</span>' +
        '</div>' +
        '<input type="range" id="sel-dose" min="' + schema.doseMin + '" max="' + schema.doseMax +
          '" step="' + pas + '" value="' + val + '">' +
        '<div class="curseur__bornes"><span>' + Calc.nombre(schema.doseMin) + '</span>' +
          '<span>' + Calc.nombre(schema.doseMax) + '</span></div>' +
      '</div>';
    }

    /* Présentation */
    if (med.formes && med.formes.length) {
      html += '<div class="reglage"><label for="sel-forme">Présentation délivrée</label><select id="sel-forme">';
      med.formes.forEach(function (f) {
        html += '<option value="' + esc(f.id) + '"' + (forme && f.id === forme.id ? ' selected' : '') + '>' +
          esc(f.nom) + '</option>';
      });
      html += '</select>';
      if (forme && forme.note) {
        html += '<p class="reglage__note">' + esc(forme.note) + '</p>';
      }
      html += '</div>';
    }

    /* Nombre de prises */
    if (schema.mode !== 'paliers' && schema.mode !== 'unique' && schema.prises && schema.prises.length > 1) {
      html += '<div class="reglage"><label>Nombre de prises par jour</label><div class="segmente" id="seg-prises">';
      schema.prises.forEach(function (n) {
        html += '<button type="button" data-prises="' + n + '" aria-pressed="' +
          (n === prises ? 'true' : 'false') + '">' + n + ' ×/jour</button>';
      });
      html += '</div></div>';
    }

    html += '</div>';
    return html;
  }

  function blocBlocages(resultat) {
    return '<div class="alerte alerte--info"><span class="alerte__icone">ℹ️</span><div>' +
      resultat.blocages.map(esc).join('<br>') + '</div></div>';
  }

  /** Quantité + unité, en gérant les grands nombres (UI). */
  function qte(valeur, unite) {
    return Calc.nombre(valeur) + ' ' + unite;
  }

  function blocResultat(med, schema, forme, r) {
    var unite = r.unite;
    var estLiquide = forme && forme.type === 'liquide' && forme.parMl;
    var estUnitaire = forme && forme.parUnite && !estLiquide;
    var uniqueDose = schema.mode === 'unique';

    /* --- Bloc « par prise » ------------------------------------- */
    var valeur1, detail1;
    if (estLiquide) {
      valeur1 = Calc.nombre(r.volumeParPrise, r.volumeParPrise < 1 ? 2 : 1) +
        ' ml <small>(' + qte(r.parPrise, unite) + ')</small>';
    } else if (estUnitaire) {
      valeur1 = qte(r.parPrise, unite) +
        ' <small>= ' + Calc.fractionUnites(r.unitesParPrise) + ' ' + esc(forme.uniteNom || 'unité') +
        (r.unitesParPrise > 1 ? 's' : '') + '</small>';
    } else {
      valeur1 = qte(r.parPrise, unite);
    }
    detail1 = uniqueDose ? 'Dose unique'
      : schema.prn ? 'À répéter selon la réponse clinique'
      : r.prises + ' prise' + (r.prises > 1 ? 's' : '') + ' par jour, soit toutes les ' +
        Calc.nombre(24 / r.prises) + ' h';

    /* --- Bloc « par jour » -------------------------------------- */
    var valeur2, detail2;
    if (uniqueDose) {
      valeur2 = qte(r.totalJour, unite);
      detail2 = 'Total administré';
    } else if (estLiquide) {
      valeur2 = Calc.nombre(r.volumeJour, r.volumeJour < 1 ? 2 : 1) +
        ' ml <small>(' + qte(r.totalJour, unite) + ')</small>';
      detail2 = 'Total sur 24 h';
    } else if (estUnitaire) {
      valeur2 = qte(r.totalJour, unite) +
        ' <small>= ' + Calc.fractionUnites(r.unitesJour) + ' ' + esc(forme.uniteNom || 'unité') +
        (r.unitesJour > 1 ? 's' : '') + '</small>';
      detail2 = 'Total sur 24 h';
    } else {
      valeur2 = qte(r.totalJour, unite);
      detail2 = 'Total sur 24 h';
    }

    /* --- Vérification inverse ----------------------------------- */
    var controle = '';
    if (r.doseReelleParKg !== null && etat.poids && schema.mode !== 'paliers') {
      var suffixe = schema.mode === 'prise' ? '/kg/j (total)' : '/kg/j';
      var hors = schema.mode === 'jour' &&
        (r.doseReelleParKg < schema.doseMin * 0.95 || r.doseReelleParKg > schema.doseMax * 1.05) &&
        !r.plafonne;
      controle = '<p class="controle">Vérification : dose réellement administrée ≈ <strong>' +
        Calc.nombre(r.doseReelleParKg) + ' ' + unite + suffixe + '</strong>' +
        (hors ? ' — <strong>hors de l’intervalle de référence</strong>' : '') +
        ' · poids saisi : ' + Calc.nombre(etat.poids) + ' kg</p>';
    } else if (r.palier) {
      controle = '<p class="controle">Tranche appliquée : <strong>' + esc(r.palier.label) + '</strong>' +
        (r.palier.libelle ? ' — ' + esc(r.palier.libelle) : '') + '</p>';
    }

    var phrase = phraseOrdonnance(med, schema, forme, r);

    // Pour un médicament « à la demande », un total sur 24 h n'a pas de sens.
    var blocJour = schema.prn ? '' :
        '<div class="bloc bloc--secondaire">' +
          '<p class="bloc__etiquette">' + (uniqueDose ? 'Total' : 'Par jour') + '</p>' +
          '<p class="bloc__valeur">' + valeur2 + '</p>' +
          '<p class="bloc__detail">' + esc(detail2) + '</p>' +
        '</div>';

    return '<div class="resultat">' +
      '<div class="resultat__grille' + (schema.prn ? ' resultat__grille--simple' : '') + '">' +
        '<div class="bloc">' +
          '<p class="bloc__etiquette">' + (uniqueDose ? 'Dose unique' : schema.prn ? 'Par administration' : 'Par prise') + '</p>' +
          '<p class="bloc__valeur">' + valeur1 + '</p>' +
          '<p class="bloc__detail">' + esc(detail1) + '</p>' +
        '</div>' +
        blocJour +
      '</div>' +
      controle +
      '<div class="resume">' +
        '<p class="resume__phrase">' + phrase.html + '</p>' +
        '<div class="resume__actions">' +
          '<button class="btn btn--fantome btn--petit" type="button" id="btn-copier">Copier</button>' +
          '<button class="btn btn--fantome btn--petit" type="button" id="btn-imprimer">Imprimer</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  /** Construit la phrase récapitulative (HTML + texte brut pour le presse-papier). */
  function phraseOrdonnance(med, schema, forme, r) {
    var unite = r.unite;
    var quantite;
    if (forme && forme.type === 'liquide' && forme.parMl) {
      quantite = Calc.nombre(r.volumeParPrise, r.volumeParPrise < 1 ? 2 : 1) + ' ml';
    } else if (forme && forme.parUnite) {
      quantite = Calc.fractionUnites(r.unitesParPrise) + ' ' + (forme.uniteNom || 'unité') +
        (r.unitesParPrise > 1 ? 's' : '');
    } else {
      quantite = Calc.nombre(r.parPrise) + ' ' + unite;
    }

    var rythme = schema.mode === 'unique' ? 'en dose unique'
      : schema.prn ? 'par administration, à répéter selon la réponse clinique'
      : r.prises + ' fois par jour';

    var texte = med.dci +
      (forme ? ' — ' + forme.nom : '') + ' : ' +
      quantite + ' ' + rythme +
      (schema.duree ? ' pendant ' + schema.duree : '') +
      ' (enfant de ' + Calc.nombre(etat.poids) + ' kg).';

    var html = '<strong>' + esc(quantite) + '</strong> ' + esc(rythme) +
      (schema.duree ? ', ' + esc(schema.duree) : '') +
      (forme ? ' — ' + esc(forme.nom) : '') + '.';

    return { html: html, texte: texte };
  }

  function blocAlertes(med, schema, r) {
    var html = '';

    if (r.plafonne) {
      html += '<div class="alerte alerte--warn"><span class="alerte__icone">⚠️</span><div>' +
        '<strong>Dose plafonnée</strong>' +
        'Le calcul au poids dépassait la ' + esc(r.plafondMotif) + '. La dose affichée a été ramenée à ce plafond.' +
        '</div></div>';
    }

    if (r.avertissements.length) {
      html += '<div class="alerte alerte--warn"><span class="alerte__icone">⚠️</span><div>' +
        '<strong>À vérifier</strong><ul>' +
        r.avertissements.map(function (a) { return '<li>' + esc(a) + '</li>'; }).join('') +
        '</ul></div></div>';
    }

    if (schema.note) {
      html += '<div class="alerte alerte--info"><span class="alerte__icone">ℹ️</span><div>' +
        esc(schema.note) + '</div></div>';
    }
    if (med.doseExprimee) {
      html += '<div class="alerte alerte--info"><span class="alerte__icone">ℹ️</span><div>' +
        esc(med.doseExprimee) + '</div></div>';
    }

    if (!med.verifie) {
      html += '<div class="alerte alerte--danger"><span class="alerte__icone">🔍</span><div>' +
        '<strong>Fiche non vérifiée</strong>' +
        'Les valeurs de cette fiche n’ont pas encore été relues par un professionnel. ' +
        'Confrontez-les à la notice, au CBIP ou au guide BAPCOC avant de prescrire.' +
        '</div></div>';
    }

    return html;
  }

  function blocInfos(med, schema) {
    var html = '';

    if (med.contreIndications && med.contreIndications.length) {
      html += '<div class="infos"><h3>Contre-indications</h3><ul>' +
        med.contreIndications.map(function (c) { return '<li>' + esc(c) + '</li>'; }).join('') +
        '</ul></div>';
    }
    if (med.precautions && med.precautions.length) {
      html += '<div class="infos"><h3>Précautions</h3><ul>' +
        med.precautions.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') +
        '</ul></div>';
    }
    if (med.sources && med.sources.length) {
      html += '<div class="infos"><h3>Sources</h3><p class="sources">' +
        med.sources.map(function (s) {
          return '<a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(s.label) + '</a>';
        }).join(' · ') + '</p></div>';
    }
    return html;
  }

  /* ---------------------------------------------------------------- */
  /* Branchements du détail (re-créés à chaque rendu)                  */
  /* ---------------------------------------------------------------- */

  function brancherDetail(med, schema) {
    var fermer = document.getElementById('btn-fermer');
    if (fermer) fermer.addEventListener('click', fermerDetail);

    var selSchema = document.getElementById('sel-schema');
    if (selSchema) {
      selSchema.addEventListener('change', function () {
        etat.schemaId = selSchema.value;
        var s = parId(med.schemas, etat.schemaId);
        etat.dosePerKg = s.doseUsuelle !== undefined ? s.doseUsuelle : s.doseMin;
        etat.prises = s.prises && s.prises.length ? s.prises[0] : 1;
        rendreDetail();
      });
    }

    var selForme = document.getElementById('sel-forme');
    if (selForme) {
      selForme.addEventListener('change', function () {
        etat.formeId = selForme.value;
        etat.formeManuelle = true;
        rendreDetail();
      });
    }

    var selDose = document.getElementById('sel-dose');
    if (selDose) {
      var affiche = document.getElementById('dose-affichee');
      var suffixe = schema.mode === 'jour' ? '/kg/j' : (schema.mode === 'prise' ? '/kg par prise' : '/kg');
      selDose.addEventListener('input', function () {
        etat.dosePerKg = parseFloat(selDose.value);
        if (affiche) {
          affiche.textContent = Calc.nombre(etat.dosePerKg) + ' ' + schema.unite + suffixe;
        }
        majResultatSeul(med, schema);
      });
    }

    var seg = document.getElementById('seg-prises');
    if (seg) {
      seg.addEventListener('click', function (e) {
        var b = e.target.closest('button[data-prises]');
        if (!b) return;
        etat.prises = parseInt(b.dataset.prises, 10);
        rendreDetail();
      });
    }

    var copier = document.getElementById('btn-copier');
    if (copier) {
      copier.addEventListener('click', function () {
        var forme = med.formes ? parId(med.formes, etat.formeId) : null;
        var r = Calc.calculer({
          med: med, schema: schema, forme: forme,
          patient: { poids: etat.poids, ageMois: etat.ageMois },
          dosePerKg: etat.dosePerKg,
          prises: etat.prises || (schema.prises && schema.prises[0]) || 1
        });
        if (!r.ok) return;
        var texte = phraseOrdonnance(med, schema, forme, r).texte;
        copierTexte(texte);
      });
    }

    var imprimer = document.getElementById('btn-imprimer');
    if (imprimer) imprimer.addEventListener('click', function () { global.print(); });
  }

  /**
   * Ré-rend uniquement le bloc résultat et les alertes : évite de recréer
   * le curseur en cours de glissement (ce qui casserait le geste tactile).
   */
  function majResultatSeul(med, schema) {
    var forme = med.formes ? parId(med.formes, etat.formeId) : null;
    var prises = etat.prises || (schema.prises && schema.prises[0]) || 1;
    var r = Calc.calculer({
      med: med, schema: schema, forme: forme,
      patient: { poids: etat.poids, ageMois: etat.ageMois },
      dosePerKg: etat.dosePerKg,
      prises: prises
    });

    var ancien = els.detail.querySelector('.resultat, .alerte--info');
    if (!ancien) { rendreDetail(); return; }

    var conteneur = els.detail.querySelector('.carte');
    var reglages = conteneur.querySelector('.reglages');
    // Supprime tout ce qui suit les réglages, puis reconstruit.
    while (reglages.nextSibling) conteneur.removeChild(reglages.nextSibling);
    conteneur.insertAdjacentHTML('beforeend',
      (r.blocages.length ? blocBlocages(r) : blocResultat(med, schema, forme, r)) +
      blocAlertes(med, schema, r) +
      blocInfos(med, schema));

    var copier = document.getElementById('btn-copier');
    if (copier) {
      copier.addEventListener('click', function () {
        copierTexte(phraseOrdonnance(med, schema, forme, r).texte);
      });
    }
    var imprimer = document.getElementById('btn-imprimer');
    if (imprimer) imprimer.addEventListener('click', function () { global.print(); });
  }

  function copierTexte(texte) {
    if (global.navigator.clipboard && global.navigator.clipboard.writeText) {
      global.navigator.clipboard.writeText(texte).then(
        function () { toast('Posologie copiée'); },
        function () { copierRepli(texte); }
      );
    } else {
      copierRepli(texte);
    }
  }

  function copierRepli(texte) {
    var ta = document.createElement('textarea');
    ta.value = texte;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      toast('Posologie copiée');
    } catch (e) {
      toast('Copie impossible');
    }
    document.body.removeChild(ta);
  }

  /* ---------------------------------------------------------------- */
  /* Démarrage                                                        */
  /* ---------------------------------------------------------------- */

  function lireHash() {
    var m = /^#\/med\/([a-z0-9-]+)$/i.exec(global.location.hash || '');
    if (m) {
      var med = medParId(m[1]);
      if (med) { selectionner(med.id, true); return; }
    }
    els.detail.hidden = true;
  }

  function init() {
    initDisclaimer();
    initPatient();
    initFiltres();
    initRecherche();
    initListe();
    lirePatient();
    rendreListe();
    lireHash();

    global.addEventListener('hashchange', function () {
      if (!global.location.hash || global.location.hash === '#/') {
        etat.medId = null;
        els.detail.hidden = true;
        rendreListe();
      } else {
        lireHash();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
