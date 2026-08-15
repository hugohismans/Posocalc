/*
 * Posocalc — moteur de calcul
 * Fonctions pures : aucune dépendance au DOM.
 */
(function (global) {
  'use strict';

  /* ---------------------------------------------------------------- */
  /* Formatage                                                        */
  /* ---------------------------------------------------------------- */

  /** Arrondi « intelligent » : plus de décimales pour les petites valeurs. */
  function arrondi(valeur) {
    if (!isFinite(valeur)) return 0;
    var abs = Math.abs(valeur);
    if (abs === 0) return 0;
    if (abs < 1) return Math.round(valeur * 1000) / 1000;
    if (abs < 10) return Math.round(valeur * 100) / 100;
    if (abs < 100) return Math.round(valeur * 10) / 10;
    return Math.round(valeur);
  }

  /** Nombre formaté à la belge : virgule décimale, espace fine pour les milliers. */
  function nombre(valeur, decimales) {
    if (valeur === null || valeur === undefined || !isFinite(valeur)) return '—';
    var v = decimales === undefined ? arrondi(valeur) : Math.round(valeur * Math.pow(10, decimales)) / Math.pow(10, decimales);
    var opts = decimales === undefined
      ? { maximumFractionDigits: 3 }
      : { minimumFractionDigits: decimales, maximumFractionDigits: decimales };
    return v.toLocaleString('fr-BE', opts);
  }

  /**
   * Volume arrondi au pas de mesure réaliste d'une seringue doseuse.
   * < 1 ml  -> 0,05 ml ; < 10 ml -> 0,1 ml ; sinon 0,5 ml.
   */
  function arrondiVolume(ml) {
    if (!isFinite(ml) || ml <= 0) return 0;
    var pas = ml < 1 ? 0.05 : (ml < 10 ? 0.1 : 0.5);
    // Le produit réintroduit du bruit flottant (11 * 0,05 = 0,55000000000000004).
    return Math.round(Math.round(ml / pas) * pas * 1000) / 1000;
  }

  /** Fraction lisible pour les formes solides : 0,5 -> « ½ ». */
  function fractionUnites(n) {
    var entier = Math.floor(n + 1e-9);
    var reste = n - entier;
    var frac = '';
    if (Math.abs(reste - 0.25) < 0.02) frac = '¼';
    else if (Math.abs(reste - 0.5) < 0.02) frac = '½';
    else if (Math.abs(reste - 0.75) < 0.02) frac = '¾';
    else if (reste > 0.02) return nombre(n, 2);
    if (entier === 0) return frac || '0';
    return frac ? entier + ' ' + frac : String(entier);
  }

  /* ---------------------------------------------------------------- */
  /* Sélection du palier (modes 'paliers')                            */
  /* ---------------------------------------------------------------- */

  /**
   * Retrouve le palier correspondant au patient.
   * @param {object} schema  schéma de mode 'paliers'
   * @param {object} patient { poids: number|null, ageMois: number|null }
   * @returns {{palier: object|null, raison: string|null}}
   */
  function trouverPalier(schema, patient) {
    var critere = schema.critere === 'poids' ? 'poids' : 'age';
    var valeur = critere === 'poids' ? patient.poids : patient.ageMois;
    if (valeur === null || valeur === undefined || isNaN(valeur)) {
      return {
        palier: null,
        raison: critere === 'poids'
          ? 'Indiquez le poids pour sélectionner la tranche.'
          : 'Indiquez l’âge pour sélectionner la tranche.'
      };
    }
    for (var i = 0; i < schema.paliers.length; i++) {
      var p = schema.paliers[i];
      var minOk = p.min === null || p.min === undefined || valeur >= p.min;
      var maxOk = p.max === null || p.max === undefined || valeur <= p.max;
      if (minOk && maxOk) return { palier: p, raison: null };
    }
    return {
      palier: null,
      raison: critere === 'poids'
        ? 'Aucune tranche de poids ne correspond à ce patient.'
        : 'Aucune tranche d’âge ne correspond à ce patient.'
    };
  }

  /* ---------------------------------------------------------------- */
  /* Calcul principal                                                 */
  /* ---------------------------------------------------------------- */

  /**
   * @param {object} params
   *   med      fiche médicament
   *   schema   schéma posologique choisi
   *   forme    présentation choisie (peut être null)
   *   patient  { poids, ageMois }
   *   dosePerKg  valeur retenue dans l'intervalle (modes jour/prise/unique)
   *   prises     nombre de prises par jour retenu
   * @returns {object} résultat de calcul
   */
  function calculer(params) {
    var schema = params.schema;
    var forme = params.forme || null;
    var patient = params.patient || {};
    var poids = patient.poids;
    var prises = params.prises || (schema.prises && schema.prises[0]) || 1;

    var res = {
      ok: false,
      unite: schema.unite || 'mg',
      mode: schema.mode,
      prises: prises,
      totalJour: null,      // quantité totale par jour
      parPrise: null,       // quantité par prise
      volumeParPrise: null, // ml par prise (formes liquides)
      volumeJour: null,
      unitesParPrise: null, // nombre de comprimés / sachets / suppos
      unitesJour: null,
      plafonne: false,
      plafondApplique: null,
      plafondMotif: null,
      doseReelleParKg: null, // rétro-calcul après arrondi du volume
      palier: null,
      avertissements: [],
      blocages: []
    };

    /* --- 1. Quantité journalière brute ---------------------------- */

    if (schema.mode === 'paliers') {
      var sel = trouverPalier(schema, patient);
      if (!sel.palier) {
        res.blocages.push(sel.raison);
        return res;
      }
      res.palier = sel.palier;
      res.prises = sel.palier.prises || 1;
      prises = res.prises;
      res.totalJour = sel.palier.dose;
    } else {
      if (poids === null || poids === undefined || isNaN(poids) || poids <= 0) {
        res.blocages.push('Indiquez le poids de l’enfant pour lancer le calcul.');
        return res;
      }
      var dose = params.dosePerKg;
      if (dose === null || dose === undefined || isNaN(dose)) dose = schema.doseUsuelle;

      if (schema.mode === 'jour') {
        res.totalJour = dose * poids;
      } else if (schema.mode === 'prise') {
        res.parPrise = dose * poids;
        res.totalJour = res.parPrise * prises;
      } else if (schema.mode === 'unique') {
        res.prises = 1;
        prises = 1;
        res.totalJour = dose * poids;
      }
    }

    /* --- 2. Plafonds absolus -------------------------------------- */

    // Plafond exprimé en <unite>/kg/jour (ex. paracétamol 60 mg/kg/j).
    if (schema.maxParKgJour && poids > 0) {
      var plafondKg = schema.maxParKgJour * poids;
      if (res.totalJour > plafondKg + 1e-9) {
        res.totalJour = plafondKg;
        res.plafonne = true;
        res.plafondApplique = plafondKg;
        res.plafondMotif = 'dose maximale de ' + nombre(schema.maxParKgJour) + ' ' + res.unite + '/kg/j';
      }
    }

    // Plafond absolu journalier (dose adulte).
    if (schema.maxJour && res.totalJour > schema.maxJour + 1e-9) {
      res.totalJour = schema.maxJour;
      res.plafonne = true;
      res.plafondApplique = schema.maxJour;
      res.plafondMotif = 'dose maximale adulte de ' + nombre(schema.maxJour) + ' ' + res.unite + '/j';
    }

    res.parPrise = res.totalJour / prises;

    // Plafond absolu par prise.
    if (schema.maxPrise && res.parPrise > schema.maxPrise + 1e-9) {
      res.parPrise = schema.maxPrise;
      res.totalJour = res.parPrise * prises;
      res.plafonne = true;
      res.plafondApplique = schema.maxPrise;
      res.plafondMotif = 'dose maximale de ' + nombre(schema.maxPrise) + ' ' + res.unite + ' par prise';
    }

    /* --- 3. Conversion vers la présentation ----------------------- */

    if (forme) {
      if (forme.type === 'liquide' && forme.parMl) {
        var mlBrut = res.parPrise / forme.parMl;
        res.volumeParPrise = arrondiVolume(mlBrut);
        res.volumeParPriseBrut = mlBrut;
        res.volumeJour = arrondi(res.volumeParPrise * prises);
        if (poids > 0) {
          res.doseReelleParKg = (res.volumeParPrise * forme.parMl * prises) / poids;
        }
        if (res.volumeParPrise > 0 && Math.abs(mlBrut - res.volumeParPrise) / mlBrut > 0.05) {
          res.avertissements.push(
            'Le volume a été arrondi de ' + nombre(mlBrut, 2) + ' ml à ' + nombre(res.volumeParPrise, 2) +
            ' ml (écart > 5 %). Vérifiez la graduation de la seringue doseuse.'
          );
        }
        if (res.volumeParPrise > 0 && res.volumeParPrise < 0.2) {
          res.avertissements.push('Volume par prise très faible (< 0,2 ml) : présentation probablement inadaptée.');
        }
        if (res.volumeParPrise > 20) {
          res.avertissements.push('Volume par prise élevé (> 20 ml) : envisagez une présentation plus concentrée.');
        }
      } else if (forme.parUnite) {
        // On ne peut pas administrer 0,9 suppositoire : on arrondit au
        // fractionnement réellement praticable pour cette présentation.
        var pas = forme.pasUnite !== undefined
          ? forme.pasUnite
          : (forme.type === 'solide' ? 0.5 : 1);
        var theorique = res.parPrise / forme.parUnite;
        var pratique = Math.round(theorique / pas) * pas;

        if (pratique < pas) {
          res.avertissements.push(
            'La dose calculée (' + nombre(res.parPrise) + ' ' + res.unite + ' par prise) est inférieure à ' +
            'la plus petite fraction administrable de cette présentation : elle est trop dosée pour ce patient.'
          );
          res.unitesParPrise = theorique;
          res.unitesJour = theorique * prises;
        } else {
          res.unitesParPrise = pratique;
          res.unitesJour = pratique * prises;
          res.parPrise = pratique * forme.parUnite;
          res.totalJour = res.parPrise * prises;
          if (Math.abs(pratique - theorique) / theorique > 0.1) {
            res.avertissements.push(
              'Ajustement à la présentation : ' + nombre(theorique, 2) + ' → ' + nombre(pratique, 2) + ' ' +
              (forme.uniteNom || 'unité') + ' par prise (écart > 10 % par rapport à la dose théorique).'
            );
          }
        }
        if (poids > 0) res.doseReelleParKg = res.totalJour / poids;
      }
    } else if (poids > 0) {
      res.doseReelleParKg = res.totalJour / poids;
    }

    /* --- 4. Avertissements liés au patient ------------------------ */

    if (schema.ageMinMois && patient.ageMois !== null && patient.ageMois !== undefined &&
        !isNaN(patient.ageMois) && patient.ageMois < schema.ageMinMois) {
      res.avertissements.push(
        'Âge inférieur au minimum de ce schéma (' + formaterAgeMois(schema.ageMinMois) + ').'
      );
    }
    if (schema.poidsMinKg && poids > 0 && poids < schema.poidsMinKg) {
      res.avertissements.push('Poids inférieur au minimum de ce schéma (' + nombre(schema.poidsMinKg) + ' kg).');
    }
    if (poids > 40 && schema.mode !== 'paliers') {
      res.avertissements.push('Au-delà de 40 kg, la posologie adulte s’applique généralement : vérifiez le plafond.');
    }

    res.ok = true;
    return res;
  }

  /**
   * Choisit la présentation la plus praticable pour ce patient : un volume
   * de 2 à 10 ml chez le petit enfant, des unités entières chez le grand.
   * Évite de proposer 13 ml de sirop faiblement dosé quand une suspension
   * plus concentrée existe.
   */
  function meilleureForme(params) {
    var med = params.med;
    var formes = med.formes || [];
    if (!formes.length) return null;

    var base = calculer({
      med: med, schema: params.schema, forme: null,
      patient: params.patient, dosePerKg: params.dosePerKg, prises: params.prises
    });
    if (!base.ok || !base.parPrise) return formes[0];

    var brut = base.parPrise;
    var poids = params.patient.poids || 0;
    var meilleur = formes[0];
    var meilleurScore = Infinity;

    formes.forEach(function (f) {
      var score;
      if (f.type === 'liquide' && f.parMl) {
        var v = brut / f.parMl;
        score = v < 1 ? (1 - v) * 40
          : (v > 10 ? (v - 10) * 3 : Math.abs(v - 5) * 0.2);
        if (poids >= 30) score += 5;           // l'ado avale plus volontiers un comprimé
      } else if (f.parUnite) {
        var pas = f.pasUnite !== undefined ? f.pasUnite : (f.type === 'solide' ? 0.5 : 1);
        var n = brut / f.parUnite;
        if (n < pas) {
          score = 100 + (pas - n) * 40;        // présentation trop dosée
        } else {
          var pratique = Math.round(n / pas) * pas;
          score = Math.abs(pratique - n) / n * 60 + Math.abs(n - 1) * 0.5;
          if (poids && poids < 20) score += 12; // avaler un comprimé : peu réaliste
        }
      } else {
        score = 200;
      }
      if (score < meilleurScore) { meilleurScore = score; meilleur = f; }
    });

    return meilleur;
  }

  /** 18 -> « 1 an et 6 mois » ; 3 -> « 3 mois ». */
  function formaterAgeMois(mois) {
    if (mois === null || mois === undefined || isNaN(mois)) return '—';
    if (mois < 24) return nombre(mois) + (mois > 1 ? ' mois' : ' mois');
    var ans = Math.floor(mois / 12);
    var reste = Math.round(mois % 12);
    if (reste === 0) return ans + ' ans';
    return ans + ' ans et ' + reste + ' mois';
  }

  /** Libellé de l'intervalle posologique d'un schéma. */
  function libelleIntervalle(schema) {
    var suffixe = schema.mode === 'jour' ? '/kg/j'
      : schema.mode === 'prise' ? '/kg par prise'
      : schema.mode === 'unique' ? '/kg en dose unique'
      : '';
    if (schema.mode === 'paliers') return 'dose fixe par tranche';
    var u = ' ' + (schema.unite || 'mg');
    if (schema.doseMin === schema.doseMax) return nombre(schema.doseMin) + u + suffixe;
    return nombre(schema.doseMin) + ' à ' + nombre(schema.doseMax) + u + suffixe;
  }

  global.PosocalcCalc = {
    calculer: calculer,
    meilleureForme: meilleureForme,
    arrondi: arrondi,
    arrondiVolume: arrondiVolume,
    nombre: nombre,
    fractionUnites: fractionUnites,
    formaterAgeMois: formaterAgeMois,
    libelleIntervalle: libelleIntervalle,
    trouverPalier: trouverPalier
  };
})(window);
