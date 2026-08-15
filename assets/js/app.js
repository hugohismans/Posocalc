/*
 * Posocalc — interface
 */
(function (global) {
  'use strict';

  var Data = global.PosocalcData;
  var Calc = global.PosocalcCalc;
  var Search = global.PosocalcSearch;
  var I18n = global.PosocalcI18n;

  var t = function (c, p) { return I18n.t(c, p); };
  var tr = function (v) { return I18n.tr(v); };

  var CLE_DISCLAIMER = 'posocalc.disclaimer.v2';
  var CLE_MEDECIN = 'posocalc.medecin.v1';

  /* ---------------------------------------------------------------- */
  /* État                                                             */
  /* ---------------------------------------------------------------- */

  var etat = {
    poids: null,
    ageMois: null,
    prenom: '',
    requete: '',
    categorie: null,
    medId: null,
    schemaId: null,
    formeId: null,
    formeManuelle: false,
    prises: null,
    dosePerKg: null,
    detailOuvert: false
  };

  var medecin = { nom: '', qualif: '', inami: '', adresse: '', tel: '' };

  var $ = function (sel) { return document.querySelector(sel); };
  var els = {};

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
    return c ? tr(c.nom) : id;
  }

  /** 18 -> « 1 an et 6 mois » ; 3 -> « 3 mois ». */
  function formaterAge(mois) {
    if (mois === null || mois === undefined || isNaN(mois)) return '—';
    if (mois < 24) return t('age.mois', { n: Calc.nombre(mois) });
    var ans = Math.floor(mois / 12);
    var reste = Math.round(mois % 12);
    if (reste === 0) return t('age.ans', { n: ans });
    return t('age.ansMois', { a: ans, m: reste });
  }

  /**
   * Traduit un message { cle, params } venu du moteur de calcul. Les
   * paramètres peuvent eux-mêmes être bilingues (nom d'unité) ou nécessiter
   * un formatage dépendant de la langue (âge en mois).
   */
  function msg(m) {
    if (!m) return '';
    var params = {};
    Object.keys(m.params || {}).forEach(function (k) {
      var v = m.params[k];
      if (v && typeof v === 'object') params[k] = tr(v);
      else if (k === 'unite' && typeof v === 'string') params[k] = I18n.unite(v);
      else params[k] = v;
    });
    if (m.cle === 'w.ageMin') params.min = formaterAge(m.params.min);
    return t(m.cle, params);
  }

  /** Libellé de l'intervalle posologique d'un schéma. */
  function libelleIntervalle(schema) {
    if (schema.mode === 'paliers') {
      return I18n.langue() === 'nl' ? 'vaste dosis per groep' : 'dose fixe par tranche';
    }
    var u = ' ' + I18n.unite(schema.unite || 'mg');
    var suffixe = schema.mode === 'jour' ? '/kg/j'
      : schema.mode === 'prise' ? (I18n.langue() === 'nl' ? '/kg per inname' : '/kg par prise')
      : (I18n.langue() === 'nl' ? '/kg eenmalig' : '/kg en dose unique');
    if (I18n.langue() === 'nl' && schema.mode === 'jour') suffixe = '/kg/dag';
    if (schema.doseMin === schema.doseMax) return Calc.nombre(schema.doseMin) + u + suffixe;
    var lien = I18n.langue() === 'nl' ? ' tot ' : ' à ';
    return Calc.nombre(schema.doseMin) + lien + Calc.nombre(schema.doseMax) + u + suffixe;
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

  function lienCbip(med) {
    var kw = med.cbip ? tr(med.cbip) : tr(med.dci);
    var base = I18n.langue() === 'nl' ? 'https://www.bcfi.be/nl/' : 'https://www.cbip.be/fr/';
    return base + 'keywords/' + encodeURIComponent(kw) + '?type=substance';
  }

  function dateDuJour() {
    return new Date().toLocaleDateString(I18n.langue() === 'nl' ? 'nl-BE' : 'fr-BE', {
      day: '2-digit', month: 'long', year: 'numeric'
    });
  }

  /* ---------------------------------------------------------------- */
  /* Squelette : les textes statiques sont posés par JS (bilingue)     */
  /* ---------------------------------------------------------------- */

  function peindreStatiques() {
    document.title = 'Posocalc — ' + t('app.sous');
    $('#logo-sous').textContent = t('app.sous');
    $('#badge-dev').textContent = t('app.dev');
    $('#bandeau').innerHTML = t('app.bandeau');
    $('#btn-info').textContent = t('app.avertissement');
    $('#btn-langue').textContent = t('app.langue');

    $('#modal-titre').textContent = t('modal.titre');
    $('#modal-corps').innerHTML =
      '<p>' + t('modal.intro') + '</p><ul>' +
      ['modal.p1', 'modal.p2', 'modal.p3', 'modal.p4']
        .map(function (k) { return '<li>' + t(k) + '</li>'; }).join('') +
      '</ul>';
    $('#btn-accepter').textContent = t('modal.ok');

    $('#t-patient').innerHTML = '<span class="etape">1</span>' + esc(t('patient.titre'));
    $('#lbl-poids').innerHTML = esc(t('patient.poids')) + ' <span class="champ__requis">*</span>';
    $('#lbl-age').innerHTML = esc(t('patient.age')) +
      ' <span class="champ__option">' + esc(t('patient.facultatif')) + '</span>';
    $('#lbl-prenom').innerHTML = esc(t('patient.prenom')) +
      ' <span class="champ__option">' + esc(t('patient.facultatif')) + '</span>';
    $('#opt-ans').textContent = t('patient.ans');
    $('#opt-mois').textContent = t('patient.mois');
    $('#btn-reset').textContent = t('patient.effacer');
    $('#aide-patient').textContent = t('patient.aide') + ' ' + t('patient.local');

    $('#t-med').innerHTML = '<span class="etape">2</span>' + esc(t('med.titre'));
    els.recherche.placeholder = t('med.recherche');
    els.recherche.setAttribute('aria-label', t('med.recherche'));
    els.viderRecherche.setAttribute('aria-label', t('med.vider'));

    $('#t-medecin').textContent = t('md.titre');
    $('#aide-medecin').textContent = t('md.aide');
    $('#lbl-md-nom').textContent = t('md.nom');
    $('#lbl-md-qualif').textContent = t('md.qualif');
    $('#lbl-md-inami').textContent = t('md.inami');
    $('#lbl-md-adresse').textContent = t('md.adresse');
    $('#lbl-md-tel').textContent = t('md.tel');
    $('#md-qualif').placeholder = t('md.exemple.qualif');
    $('#btn-md-save').textContent = t('md.enregistrer');

    $('#pied-projet').innerHTML = t('pied.projet');
    $('#pied-sources-lbl').textContent = t('pied.sources');
    $('#pied-legal').textContent = t('pied.legal');
  }

  /* ---------------------------------------------------------------- */
  /* Avertissement initial                                            */
  /* ---------------------------------------------------------------- */

  function initDisclaimer() {
    var vu = false;
    try { vu = global.localStorage.getItem(CLE_DISCLAIMER) === 'ok'; } catch (e) { /* mode privé */ }
    if (!vu) els.modal.hidden = false;

    $('#btn-accepter').addEventListener('click', function () {
      els.modal.hidden = true;
      try { global.localStorage.setItem(CLE_DISCLAIMER, 'ok'); } catch (e) { /* ignore */ }
      els.poids.focus();
    });
    $('#btn-info').addEventListener('click', function () { els.modal.hidden = false; });
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
    etat.prenom = els.prenom.value.trim();
  }

  function initPatient() {
    ['input', 'change'].forEach(function (ev) {
      [els.poids, els.ageValeur, els.ageUnite, els.prenom].forEach(function (el) {
        el.addEventListener(ev, function () { lirePatient(); rendreDetail(); });
      });
    });
    $('#btn-reset').addEventListener('click', function () {
      els.poids.value = '';
      els.ageValeur.value = '';
      els.prenom.value = '';
      lirePatient();
      rendreDetail();
      els.poids.focus();
      toast(t('patient.efface'));
    });
  }

  /* ---------------------------------------------------------------- */
  /* Coordonnées du prescripteur                                      */
  /* ---------------------------------------------------------------- */

  function chargerMedecin() {
    try {
      var brut = global.localStorage.getItem(CLE_MEDECIN);
      if (brut) {
        var o = JSON.parse(brut);
        Object.keys(medecin).forEach(function (k) {
          if (typeof o[k] === 'string') medecin[k] = o[k];
        });
      }
    } catch (e) { /* stockage indisponible ou JSON corrompu */ }
    Object.keys(medecin).forEach(function (k) {
      var el = document.getElementById('md-' + k);
      if (el) el.value = medecin[k];
    });
  }

  function initMedecin() {
    $('#btn-md-save').addEventListener('click', function () {
      Object.keys(medecin).forEach(function (k) {
        var el = document.getElementById('md-' + k);
        if (el) medecin[k] = el.value.trim();
      });
      try {
        global.localStorage.setItem(CLE_MEDECIN, JSON.stringify(medecin));
        toast(t('md.enregistre'));
      } catch (e) {
        toast(t('res.copieKo'));
      }
    });
  }

  /* ---------------------------------------------------------------- */
  /* Recherche et filtres                                             */
  /* ---------------------------------------------------------------- */

  function peindreFiltres() {
    var html = '<button class="puce" type="button" data-cat="" aria-pressed="' +
      (etat.categorie ? 'false' : 'true') + '">' + esc(t('med.tout')) + '</button>';
    Data.CATEGORIES.forEach(function (c) {
      html += '<button class="puce" type="button" data-cat="' + esc(c.id) + '" aria-pressed="' +
        (etat.categorie === c.id ? 'true' : 'false') + '">' + esc(tr(c.nom)) + '</button>';
    });
    els.filtres.innerHTML = html;
  }

  function initFiltres() {
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
    return '<li>' +
      '<button class="item" type="button" data-med="' + esc(med.id) + '"' +
      (etat.medId === med.id ? ' aria-current="true"' : '') + '>' +
        (med.frequent ? '<span class="etoile" title="' + esc(t('med.frequent')) + '" aria-hidden="true">★</span>' : '') +
        '<span class="item__corps">' +
          '<span class="item__nom">' + esc(tr(med.dci)) + '</span>' +
          '<span class="item__marques">' + esc((med.marques || []).join(' · ')) + '</span>' +
        '</span>' +
        '<span class="item__fleche" aria-hidden="true">›</span>' +
      '</button></li>';
  }

  function rendreListe() {
    var resultats = Search.rechercher(Data.MEDICAMENTS, etat.requete, etat.categorie,
      function (m) { return tr(m.dci); });

    els.listeVide.textContent = t('med.aucun');

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
      els.listeEntete.textContent = t('med.frequents');
      els.liste.innerHTML =
        frequents.map(ligne).join('') +
        '<li><p class="liste__entete">' + esc(t('med.tous', { n: autres.length })) + '</p></li>' +
        autres.map(ligne).join('');
    } else {
      els.listeEntete.textContent = resultats.length > 1
        ? t('med.resultats', { n: resultats.length })
        : t('med.resultat', { n: resultats.length });
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
    etat.detailOuvert = false;
    autoForme(med, schema);

    if (global.location.hash !== '#/med/' + med.id) {
      global.history.replaceState(null, '', '#/med/' + med.id);
    }

    rendreListe();
    rendreDetail();
    if (!sansScroll) els.detail.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /** Présélectionne la présentation la plus praticable, sauf choix explicite. */
  function autoForme(med, schema) {
    if (!med.formes || !med.formes.length) { etat.formeId = null; return; }
    if (etat.formeManuelle && parId(med.formes, etat.formeId)) return;
    var f = Calc.meilleureForme({
      med: med, schema: schema,
      patient: { poids: etat.poids, ageMois: etat.ageMois },
      dosePerKg: etat.dosePerKg,
      prises: etat.prises || (schema.prises && schema.prises[0]) || 1,
      sufJour: t('res.sufJour')
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
  /* Contexte courant                                                 */
  /* ---------------------------------------------------------------- */

  /** Rassemble médicament + schéma + forme + résultat pour l'état courant. */
  function contexte() {
    var med = medParId(etat.medId);
    if (!med) return null;
    var schema = parId(med.schemas, etat.schemaId) || med.schemas[0];
    var forme = med.formes ? parId(med.formes, etat.formeId) : null;
    var prises = etat.prises || (schema.prises && schema.prises[0]) || 1;
    var res = Calc.calculer({
      med: med, schema: schema, forme: forme,
      patient: { poids: etat.poids, ageMois: etat.ageMois },
      dosePerKg: etat.dosePerKg,
      prises: prises,
      sufJour: t('res.sufJour')
    });
    return { med: med, schema: schema, forme: forme, res: res };
  }

  /* ---------------------------------------------------------------- */
  /* Rendu du détail                                                  */
  /* ---------------------------------------------------------------- */

  function rendreDetail() {
    if (!etat.medId) { els.detail.hidden = true; return; }
    var med = medParId(etat.medId);
    if (!med) { els.detail.hidden = true; return; }

    var schema = parId(med.schemas, etat.schemaId) || med.schemas[0];
    autoForme(med, schema);        // suit le poids tant que l'utilisateur n'a pas tranché
    var ctx = contexte();

    els.detail.hidden = false;
    els.detail.innerHTML = '<div class="carte">' + blocEntete(med) +
      blocReglages(med, ctx.schema, ctx.forme, ctx.res.prises) + corpsDetail(ctx) + '</div>';
    brancherDetail(med, ctx.schema);
  }

  /** Tout ce qui suit les réglages : résultat, alertes, sources, fiche. */
  function corpsDetail(ctx) {
    return (ctx.res.blocages.length ? blocBlocages(ctx.res) : blocResultat(ctx)) +
      blocAlertes(ctx.med, ctx.schema, ctx.res) +
      blocSources(ctx.med, ctx.schema) +
      blocInfos(ctx.med);
  }

  function blocEntete(med) {
    var badges =
      '<span class="badge badge--cat">' + esc(nomCategorie(med.categorie)) + '</span>' +
      (med.verifie
        ? '<span class="badge badge--ok">' + esc(t('med.verifiee')) + '</span>'
        : '<span class="badge badge--warn">' + esc(t('med.nonVerifiee')) + '</span>');

    return '<div class="detail__entete">' +
      '<div class="detail__titres">' +
        '<h2 class="detail__dci">' + esc(tr(med.dci)) + '</h2>' +
        '<p class="detail__marques">' + esc((med.marques || []).join(' · ')) + '</p>' +
        '<div class="detail__meta">' + badges + '</div>' +
      '</div>' +
      '<button class="btn--fermer" type="button" id="btn-fermer" aria-label="' +
        esc(t('med.fermer')) + '">&times;</button>' +
    '</div>';
  }

  function blocReglages(med, schema, forme, prises) {
    var html = '<div class="reglages">';

    /* Indication */
    var ref = esc(t('reg.reference')) + ' : <strong>' + esc(libelleIntervalle(schema)) + '</strong>' +
      (schema.duree ? ' — ' + esc(tr(schema.duree)) : '');

    if (med.schemas.length > 1) {
      html += '<div class="reglage"><label for="sel-schema">' + esc(t('reg.indication')) + '</label><select id="sel-schema">';
      med.schemas.forEach(function (s) {
        html += '<option value="' + esc(s.id) + '"' + (s.id === schema.id ? ' selected' : '') + '>' +
          esc(tr(s.indication)) + '</option>';
      });
      html += '</select><p class="reglage__note">' + ref + '</p></div>';
    } else {
      html += '<div class="reglage"><label>' + esc(t('reg.indication')) + '</label>' +
        '<p class="reglage__note" style="margin-top:0">' + esc(tr(schema.indication)) + '<br>' + ref + '</p></div>';
    }

    /* Curseur de dose dans l'intervalle */
    if (schema.mode !== 'paliers' && schema.doseMin !== schema.doseMax) {
      var pas = pasCurseur(schema.doseMax - schema.doseMin);
      html += '<div class="reglage">' +
        '<div class="curseur__ligne">' +
          '<label for="sel-dose" style="margin:0">' + esc(t('reg.dose')) + '</label>' +
          '<span class="curseur__valeur" id="dose-affichee">' + esc(suffixeDose(schema, etat.dosePerKg)) + '</span>' +
        '</div>' +
        '<input type="range" id="sel-dose" min="' + schema.doseMin + '" max="' + schema.doseMax +
          '" step="' + pas + '" value="' + etat.dosePerKg + '">' +
        '<div class="curseur__bornes"><span>' + Calc.nombre(schema.doseMin) + '</span>' +
          '<span>' + Calc.nombre(schema.doseMax) + '</span></div>' +
      '</div>';
    }

    /* Présentation */
    if (med.formes && med.formes.length) {
      html += '<div class="reglage"><label for="sel-forme">' + esc(t('reg.presentation')) + '</label><select id="sel-forme">';
      med.formes.forEach(function (f) {
        html += '<option value="' + esc(f.id) + '"' + (forme && f.id === forme.id ? ' selected' : '') + '>' +
          esc(tr(f.nom)) + '</option>';
      });
      html += '</select>';
      if (forme && forme.note) html += '<p class="reglage__note">' + esc(tr(forme.note)) + '</p>';
      html += '</div>';
    }

    /* Nombre de prises */
    if (schema.mode !== 'paliers' && schema.mode !== 'unique' && schema.prises && schema.prises.length > 1) {
      html += '<div class="reglage"><label>' + esc(t('reg.prises')) + '</label><div class="segmente" id="seg-prises">';
      schema.prises.forEach(function (n) {
        html += '<button type="button" data-prises="' + n + '" aria-pressed="' +
          (n === prises ? 'true' : 'false') + '">' + esc(t('reg.parJour', { n: n })) + '</button>';
      });
      html += '</div></div>';
    }

    return html + '</div>';
  }

  function suffixeDose(schema, valeur) {
    var u = I18n.unite(schema.unite || 'mg');
    var nl = I18n.langue() === 'nl';
    var suffixe = schema.mode === 'jour' ? (nl ? '/kg/dag' : '/kg/j')
      : schema.mode === 'prise' ? (nl ? '/kg per inname' : '/kg par prise')
      : '/kg';
    return Calc.nombre(valeur) + ' ' + u + suffixe;
  }

  function blocBlocages(res) {
    return '<div class="alerte alerte--info"><span class="alerte__icone">ℹ️</span><div>' +
      res.blocages.map(function (b) { return esc(msg(b)); }).join('<br>') + '</div></div>';
  }

  function qte(valeur, unite) {
    return Calc.nombre(valeur) + ' ' + I18n.unite(unite);
  }

  /** Nom de l'unité accordé en nombre, dans la langue courante. */
  function nomUnite(forme, n) {
    var u = forme.uniteNom;
    if (!u) return I18n.langue() === 'nl' ? 'eenheid' : 'unité';
    return tr(n > 1 ? u.pl : u.un);
  }

  /** « 6,4 ml (320 mg) » ou « 320 mg = 1 ½ comprimé ». */
  function valeurAffichee(forme, quantite, volume, unites, unite) {
    if (forme && forme.type === 'liquide' && forme.parMl) {
      return Calc.nombre(volume, volume < 1 ? 2 : 1) + ' ml <small>(' + qte(quantite, unite) + ')</small>';
    }
    if (forme && forme.parUnite) {
      return qte(quantite, unite) + ' <small>= ' + Calc.fractionUnites(unites) + ' ' +
        esc(nomUnite(forme, unites)) + '</small>';
    }
    return qte(quantite, unite);
  }

  function blocResultat(ctx) {
    var schema = ctx.schema, forme = ctx.forme, r = ctx.res;
    var uniqueDose = schema.mode === 'unique';

    var valeur1 = valeurAffichee(forme, r.parPrise, r.volumeParPrise, r.unitesParPrise, r.unite);
    var detail1 = uniqueDose ? t('res.doseUnique')
      : schema.prn ? t('res.repeter')
      : r.prises === 1 ? t('res.rythme1')
      : t('res.rythme', { n: r.prises, h: Calc.nombre(24 / r.prises) });

    var valeur2 = valeurAffichee(forme, r.totalJour, r.volumeJour, r.unitesJour, r.unite);
    var detail2 = uniqueDose ? t('res.totalAdmin') : t('res.total24');

    // Pour un médicament « à la demande », un total sur 24 h n'a pas de sens.
    var blocJour = schema.prn ? '' :
      '<div class="bloc bloc--secondaire">' +
        '<p class="bloc__etiquette">' + esc(uniqueDose ? t('res.total') : t('res.parJour')) + '</p>' +
        '<p class="bloc__valeur">' + valeur2 + '</p>' +
        '<p class="bloc__detail">' + esc(detail2) + '</p>' +
      '</div>';

    /* Vérification inverse */
    var controle = '';
    if (r.doseReelleParKg !== null && etat.poids && schema.mode !== 'paliers') {
      var nl = I18n.langue() === 'nl';
      var suffixe = ' ' + I18n.unite(r.unite) + (nl ? '/kg/dag' : '/kg/j') +
        (schema.mode === 'prise' ? (nl ? ' (totaal)' : ' (total)') : '');
      var hors = schema.mode === 'jour' && !r.plafonne &&
        (r.doseReelleParKg < schema.doseMin * 0.95 || r.doseReelleParKg > schema.doseMax * 1.05);
      controle = '<p class="controle">' +
        t('res.verif', { d: esc(Calc.nombre(r.doseReelleParKg) + suffixe) }) +
        (hors ? ' — <strong>' + esc(t('res.horsIntervalle')) + '</strong>' : '') +
        ' · ' + esc(t('res.poidsSaisi', { p: Calc.nombre(etat.poids) })) + '</p>';
    } else if (r.palier) {
      controle = '<p class="controle">' + esc(t('res.tranche')) + ' : <strong>' +
        esc(tr(r.palier.label)) + '</strong>' +
        (r.palier.libelle ? ' — ' + esc(tr(r.palier.libelle)) : '') + '</p>';
    }

    return '<div class="resultat">' +
      '<div class="resultat__grille' + (schema.prn ? ' resultat__grille--simple' : '') + '">' +
        '<div class="bloc">' +
          '<p class="bloc__etiquette">' +
            esc(uniqueDose ? t('res.doseUnique') : schema.prn ? t('res.parAdmin') : t('res.parPrise')) + '</p>' +
          '<p class="bloc__valeur">' + valeur1 + '</p>' +
          '<p class="bloc__detail">' + esc(detail1) + '</p>' +
        '</div>' + blocJour +
      '</div>' +
      controle +
      blocEtapes(r) +
      '<div class="resume">' +
        '<p class="resume__phrase">' + phraseOrdonnance(ctx).html + '</p>' +
        '<div class="resume__actions">' +
          '<button class="btn btn--fantome btn--petit" type="button" id="btn-copier">' + esc(t('res.copier')) + '</button>' +
          '<button class="btn btn--primary btn--petit" type="button" id="btn-feuille">' + esc(t('res.imprimer')) + '</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  /* ---------------------------------------------------------------- */
  /* Détail du calcul                                                 */
  /* ---------------------------------------------------------------- */

  function blocEtapes(r) {
    if (!r.etapes.length) return '';
    var lignes = r.etapes.map(function (e, i) {
      return '<li class="etape-calc">' +
        '<span class="etape-calc__num">' + (i + 1) + '</span>' +
        '<span class="etape-calc__corps">' +
          '<span class="etape-calc__label">' + esc(t(e.cle, e.cleParams || {})) + '</span>' +
          (e.formule ? '<span class="etape-calc__formule">' + esc(e.formule) + '</span>' : '') +
        '</span>' +
        '<span class="etape-calc__res">' + esc(e.resultat) + '</span>' +
      '</li>';
    }).join('');

    return '<details class="calcul"' + (etat.detailOuvert ? ' open' : '') + ' id="details-calcul">' +
      '<summary>' + esc(t('res.detail')) + '</summary>' +
      '<div class="calcul__corps">' +
        '<p class="calcul__intro">' + esc(t('calc.intro')) + '</p>' +
        '<ol class="calcul__liste">' + lignes + '</ol>' +
      '</div>' +
    '</details>';
  }

  /* ---------------------------------------------------------------- */
  /* Phrase récapitulative                                            */
  /* ---------------------------------------------------------------- */

  function phraseOrdonnance(ctx) {
    var schema = ctx.schema, forme = ctx.forme, r = ctx.res;
    var quantite;
    if (forme && forme.type === 'liquide' && forme.parMl) {
      quantite = Calc.nombre(r.volumeParPrise, r.volumeParPrise < 1 ? 2 : 1) + ' ml';
    } else if (forme && forme.parUnite) {
      quantite = Calc.fractionUnites(r.unitesParPrise) + ' ' + nomUnite(forme, r.unitesParPrise);
    } else {
      quantite = Calc.nombre(r.parPrise) + ' ' + I18n.unite(r.unite);
    }

    var rythme = schema.mode === 'unique' ? t('res.enDoseUnique')
      : schema.prn ? t('res.prnPhrase')
      : t('res.foisParJour', { n: r.prises });

    var texte = tr(ctx.med.dci) + (forme ? ' — ' + tr(forme.nom) : '') + ' : ' +
      quantite + ' ' + rythme +
      (schema.duree ? ' ' + t('res.pendant') + ' ' + tr(schema.duree) : '') +
      (etat.poids ? ' (' + t('res.enfantDe', { p: Calc.nombre(etat.poids) }) + ')' : '') + '.';

    var html = '<strong>' + esc(quantite) + '</strong> ' + esc(rythme) +
      (schema.duree ? ', ' + esc(tr(schema.duree)) : '') +
      (forme ? ' — ' + esc(tr(forme.nom)) : '') + '.';

    return { html: html, texte: texte, quantite: quantite, rythme: rythme };
  }

  /* ---------------------------------------------------------------- */
  /* Alertes, sources, informations                                   */
  /* ---------------------------------------------------------------- */

  function blocAlertes(med, schema, r) {
    var html = '';

    if (r.plafonne) {
      html += '<div class="alerte alerte--warn"><span class="alerte__icone">⚠️</span><div>' +
        '<strong>' + esc(t('al.plafond')) + '</strong>' +
        esc(t('al.plafondTexte', { motif: msg(r.plafondMotif) })) + '</div></div>';
    }
    if (r.avertissements.length) {
      html += '<div class="alerte alerte--warn"><span class="alerte__icone">⚠️</span><div>' +
        '<strong>' + esc(t('al.verifier')) + '</strong><ul>' +
        r.avertissements.map(function (a) { return '<li>' + esc(msg(a)) + '</li>'; }).join('') +
        '</ul></div></div>';
    }
    if (schema.note) {
      html += '<div class="alerte alerte--info"><span class="alerte__icone">ℹ️</span><div>' +
        esc(tr(schema.note)) + '</div></div>';
    }
    if (med.doseExprimee) {
      html += '<div class="alerte alerte--info"><span class="alerte__icone">ℹ️</span><div>' +
        esc(tr(med.doseExprimee)) + '</div></div>';
    }
    return html;
  }

  /** D'où vient le chiffre affiché : la question la plus importante. */
  function blocSources(med, schema) {
    var refs = (schema.sources && schema.sources.length ? schema.sources : med.sources) || [];
    var liens = refs.map(function (s) {
      return '<li><a href="' + esc(tr(s.url)) + '" target="_blank" rel="noopener">' +
        esc(tr(s.label)) + '</a></li>';
    }).join('');

    return '<div class="sourcebox">' +
      '<h3 class="sourcebox__titre">' + esc(t('src.titre')) + '</h3>' +
      '<p class="sourcebox__ligne">' + esc(t('src.doseTiree')) + '</p>' +
      '<ul class="sourcebox__liste">' + liens + '</ul>' +
      '<p class="sourcebox__ligne">' + esc(t('src.verifier')) + ' : ' +
        '<a href="' + esc(lienCbip(med)) + '" target="_blank" rel="noopener">' + esc(t('src.cbip')) + '</a>' +
      '</p>' +
      (med.verifie ? '' :
        '<p class="sourcebox__avert"><strong>' + esc(t('al.nonVerifiee')) + '.</strong> ' +
        esc(t('src.avert')) + '</p>') +
    '</div>';
  }

  function blocInfos(med) {
    var html = '';
    if (med.contreIndications && med.contreIndications.length) {
      html += '<div class="infos"><h3>' + esc(t('infos.ci')) + '</h3><ul>' +
        med.contreIndications.map(function (c) { return '<li>' + esc(tr(c)) + '</li>'; }).join('') +
        '</ul></div>';
    }
    if (med.precautions && med.precautions.length) {
      html += '<div class="infos"><h3>' + esc(t('infos.prec')) + '</h3><ul>' +
        med.precautions.map(function (p) { return '<li>' + esc(tr(p)) + '</li>'; }).join('') +
        '</ul></div>';
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
      selDose.addEventListener('input', function () {
        etat.dosePerKg = parseFloat(selDose.value);
        if (affiche) affiche.textContent = suffixeDose(schema, etat.dosePerKg);
        majResultatSeul();
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

    brancherActions();
  }

  /** Boutons présents dans le bloc résultat, reconstruits à chaque calcul. */
  function brancherActions() {
    var details = document.getElementById('details-calcul');
    if (details) {
      details.addEventListener('toggle', function () { etat.detailOuvert = details.open; });
    }
    var copier = document.getElementById('btn-copier');
    if (copier) {
      copier.addEventListener('click', function () {
        var ctx = contexte();
        if (ctx && ctx.res.ok) copierTexte(phraseOrdonnance(ctx).texte);
      });
    }
    var feuille = document.getElementById('btn-feuille');
    if (feuille) feuille.addEventListener('click', ouvrirFeuille);
  }

  /**
   * Ré-rend uniquement ce qui suit les réglages : évite de recréer le curseur
   * en cours de glissement, ce qui casserait le geste tactile.
   */
  function majResultatSeul() {
    var ctx = contexte();
    if (!ctx) return;
    var conteneur = els.detail.querySelector('.carte');
    var reglages = conteneur.querySelector('.reglages');
    if (!reglages) { rendreDetail(); return; }
    while (reglages.nextSibling) conteneur.removeChild(reglages.nextSibling);
    conteneur.insertAdjacentHTML('beforeend', corpsDetail(ctx));
    brancherActions();
  }

  /* ---------------------------------------------------------------- */
  /* Presse-papier                                                    */
  /* ---------------------------------------------------------------- */

  function copierTexte(texte) {
    if (global.navigator.clipboard && global.navigator.clipboard.writeText) {
      global.navigator.clipboard.writeText(texte).then(
        function () { toast(t('res.copie')); },
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
      toast(t('res.copie'));
    } catch (e) {
      toast(t('res.copieKo'));
    }
    document.body.removeChild(ta);
  }

  /* ---------------------------------------------------------------- */
  /* Feuille pour le patient                                          */
  /* ---------------------------------------------------------------- */

  /** Conseils pratiques choisis selon la catégorie du médicament. */
  function conseils(med, forme) {
    var liste = [];
    if (med.categorie === 'antibiotique') liste.push(t('f.conseilAtb'));
    if (med.categorie === 'antalgique') liste.push(t('f.conseilFievre'));
    if (forme && forme.type === 'liquide') liste.push(t('f.conseilSeringue'));
    liste.push(t('f.conseilContact'));
    return liste;
  }

  function construireFeuille(ctx) {
    var med = ctx.med, schema = ctx.schema, forme = ctx.forme, r = ctx.res;
    var p = phraseOrdonnance(ctx);
    var date = dateDuJour();

    var enTete = medecin.nom || medecin.inami || medecin.adresse || medecin.tel
      ? '<div class="feuille__medecin">' +
          (medecin.nom ? '<p class="feuille__nom">' + esc(medecin.nom) + '</p>' : '') +
          (medecin.qualif ? '<p>' + esc(medecin.qualif) + '</p>' : '') +
          (medecin.adresse ? '<p>' + esc(medecin.adresse) + '</p>' : '') +
          (medecin.tel ? '<p>' + esc(medecin.tel) + '</p>' : '') +
          (medecin.inami ? '<p>' + esc(t('md.inami')) + ' : ' + esc(medecin.inami) + '</p>' : '') +
        '</div>'
      : '<div class="feuille__medecin feuille__medecin--vide"><p>' + esc(t('f.sansCoord')) + '</p></div>';

    /* Identité du patient et données du calcul */
    var ligneP = [];
    if (etat.prenom) ligneP.push(esc(t('f.pour')) + ' : <strong>' + esc(etat.prenom) + '</strong>');
    if (etat.poids) ligneP.push(esc(t('f.poids')) + ' : <strong>' + Calc.nombre(etat.poids) + ' kg</strong>');
    if (etat.ageMois !== null) ligneP.push(esc(t('f.age')) + ' : <strong>' + esc(formaterAge(etat.ageMois)) + '</strong>');
    ligneP.push(esc(t('f.date')) + ' : <strong>' + esc(date) + '</strong>');

    /* Pourquoi cette dose */
    var pourquoi;
    if (schema.mode === 'paliers' && r.palier) {
      pourquoi = t('f.pourquoiPalier', { tranche: tr(r.palier.label) });
    } else {
      pourquoi = t(r.prises === 1 ? 'f.pourquoiTexte1' : 'f.pourquoiTexte', {
        dose: suffixeDose(schema, r.dosePerKg),
        poids: Calc.nombre(etat.poids),
        total: Calc.nombre(r.totalJour) + ' ' + I18n.unite(r.unite),
        prises: r.prises
      });
    }

    var horaires = schema.prn || schema.mode === 'unique' ? null : Calc.horaires(r.prises);

    return '' +
      '<div class="feuille__entete">' +
        enTete +
        '<div class="feuille__marque"><p class="feuille__titre">' + esc(t('f.titre')) + '</p></div>' +
      '</div>' +

      '<p class="feuille__patient">' + ligneP.join(' &nbsp;·&nbsp; ') + '</p>' +

      '<div class="feuille__med">' +
        '<p class="feuille__etiq">' + esc(t('f.medicament')) + '</p>' +
        '<p class="feuille__nomMed">' + esc(tr(med.dci)) +
          (med.marques && med.marques.length ? ' <span>(' + esc(med.marques[0]) + ')</span>' : '') + '</p>' +
        (forme ? '<p class="feuille__forme">' + esc(t('f.presentation')) + ' : ' + esc(tr(forme.nom)) + '</p>' : '') +
        '<p class="feuille__forme">' + esc(t('f.indication')) + ' : ' + esc(tr(schema.indication)) + '</p>' +
      '</div>' +

      '<div class="feuille__dose">' +
        '<p class="feuille__etiq">' + esc(t('f.aDonner')) + '</p>' +
        '<p class="feuille__gros">' + esc(p.quantite) +
          ' <span class="feuille__gros-sub">' + esc(t('f.parPrise')) + '</span></p>' +
        '<p class="feuille__rythme">' + esc(p.rythme) + '</p>' +
      '</div>' +

      (horaires
        ? '<div class="feuille__bloc"><p class="feuille__etiq">' + esc(t('f.quandTitre')) + '</p>' +
          '<p>' + esc(t('f.horaires')) + ' ' +
          horaires.map(function (h) { return '<span class="feuille__heure">' + esc(h) + '</span>'; }).join(' ') +
          '</p></div>'
        : '') +

      '<div class="feuille__bloc"><p class="feuille__etiq">' + esc(t('f.duree')) + '</p>' +
        '<p>' + esc(schema.duree ? tr(schema.duree) : t('f.dureeNP')) + '</p></div>' +

      '<div class="feuille__bloc"><p class="feuille__etiq">' + esc(t('f.pourquoi')) + '</p>' +
        '<p>' + esc(pourquoi) + '</p></div>' +

      '<div class="feuille__bloc"><p class="feuille__etiq">' + esc(t('f.conseils')) + '</p>' +
        '<ul class="feuille__conseils">' +
          conseils(med, forme).map(function (c) { return '<li>' + esc(c) + '</li>'; }).join('') +
        '</ul></div>' +

      '<p class="feuille__pied">' + esc(t('f.pied', { date: date })) + '</p>';
  }

  function ouvrirFeuille() {
    var ctx = contexte();
    if (!ctx || !ctx.res.ok) return;
    els.feuille.innerHTML = construireFeuille(ctx);
    els.apercu.hidden = false;
    $('#apercu-titre').textContent = t('f.apercu');
    $('#btn-apercu-fermer').textContent = t('f.fermer');
    $('#btn-apercu-imprimer').textContent = t('f.imprimer');
    document.body.classList.add('mode-apercu');
  }

  function fermerFeuille() {
    els.apercu.hidden = true;
    document.body.classList.remove('mode-apercu');
  }

  function initFeuille() {
    $('#btn-apercu-fermer').addEventListener('click', fermerFeuille);
    $('#btn-apercu-imprimer').addEventListener('click', function () { global.print(); });
    els.apercu.addEventListener('click', function (e) {
      if (e.target === els.apercu) fermerFeuille();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !els.apercu.hidden) fermerFeuille();
    });
  }

  /* ---------------------------------------------------------------- */
  /* Langue                                                           */
  /* ---------------------------------------------------------------- */

  function initLangue() {
    $('#btn-langue').addEventListener('click', function () {
      I18n.definir(I18n.autre());
      peindreStatiques();
      peindreFiltres();
      rendreListe();
      rendreDetail();
      if (!els.apercu.hidden) ouvrirFeuille();   // régénère la feuille traduite
    });
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
    els = {
      poids: $('#poids'),
      ageValeur: $('#age-valeur'),
      ageUnite: $('#age-unite'),
      prenom: $('#prenom'),
      recherche: $('#recherche'),
      viderRecherche: $('#btn-vider-recherche'),
      filtres: $('#filtres'),
      liste: $('#liste'),
      listeEntete: $('#liste-entete'),
      listeVide: $('#liste-vide'),
      detail: $('#detail'),
      modal: $('#modal-disclaimer'),
      toast: $('#toast'),
      apercu: $('#apercu'),
      feuille: $('#feuille')
    };

    I18n.initialiser();
    peindreStatiques();
    initDisclaimer();
    initPatient();
    chargerMedecin();
    initMedecin();
    peindreFiltres();
    initFiltres();
    initRecherche();
    initListe();
    initFeuille();
    initLangue();
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
