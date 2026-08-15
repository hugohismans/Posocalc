/*
 * Posocalc — moteur de calcul
 *
 * Fonctions pures : aucune dépendance au DOM ni à la langue. Les messages
 * ne sont pas produits sous forme de texte mais sous forme de
 * { cle, params } ; c'est l'interface qui les traduit. Le calcul émet
 * également `etapes`, la trace complète de la règle de trois, affichée
 * par le bouton « Détail du calcul ».
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

  /** Nombre formaté à la belge : virgule décimale (identique en fr-BE et nl-BE). */
  function nombre(valeur, decimales) {
    if (valeur === null || valeur === undefined || !isFinite(valeur)) return '—';
    var v = decimales === undefined
      ? arrondi(valeur)
      : Math.round(valeur * Math.pow(10, decimales)) / Math.pow(10, decimales);
    var opts = decimales === undefined
      ? { maximumFractionDigits: 3 }
      : { minimumFractionDigits: decimales, maximumFractionDigits: decimales };
    return v.toLocaleString('fr-BE', opts);
  }

  /** Pas de graduation réaliste d'une seringue doseuse. */
  function pasVolume(ml) {
    return ml < 1 ? 0.05 : (ml < 10 ? 0.1 : 0.5);
  }

  function arrondiVolume(ml) {
    if (!isFinite(ml) || ml <= 0) return 0;
    var pas = pasVolume(ml);
    // Le produit réintroduit du bruit flottant (11 * 0,05 = 0,55000000000000004).
    return Math.round(Math.round(ml / pas) * pas * 1000) / 1000;
  }

  /**
   * Nombre d'unités sous une forme lisible à voix haute.
   *
   * Une fraction seule reste une fraction (« ½ »), mais un nombre mixte est
   * explicitement additionné (« 1 + ½ ») : accolés, le nombre et la fraction
   * se lisent mal — « 1 ½ » peut se comprendre comme un onzième et demi ou
   * comme une coquille.
   */
  function fractionUnites(n) {
    var entier = Math.floor(n + 1e-9);
    var reste = n - entier;
    var frac = '';
    if (Math.abs(reste - 0.25) < 0.02) frac = '¼';
    else if (Math.abs(reste - 0.5) < 0.02) frac = '½';
    else if (Math.abs(reste - 0.75) < 0.02) frac = '¾';
    // Aucune fraction simple : on retombe sur la décimale, sans zéro inutile.
    else if (reste > 0.02) return nombre(n);
    if (entier === 0) return frac || '0';
    return frac ? entier + ' + ' + frac : String(entier);
  }

  /* ---------------------------------------------------------------- */
  /* Sélection du palier (mode 'paliers')                             */
  /* ---------------------------------------------------------------- */

  function trouverPalier(schema, patient) {
    var critere = schema.critere === 'poids' ? 'poids' : 'age';
    var valeur = critere === 'poids' ? patient.poids : patient.ageMois;
    if (valeur === null || valeur === undefined || isNaN(valeur)) {
      return {
        palier: null,
        raison: { cle: critere === 'poids' ? 'w.poidsPourTranche' : 'w.agePourTranche' }
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
      raison: { cle: critere === 'poids' ? 'w.aucuneTranchePoids' : 'w.aucuneTrancheAge' }
    };
  }

  /* ---------------------------------------------------------------- */
  /* Calcul principal                                                 */
  /* ---------------------------------------------------------------- */

  /**
   * @param {object} params { med, schema, forme, patient:{poids,ageMois}, dosePerKg, prises }
   * @returns {object} résultat, avec la trace `etapes`
   */
  function calculer(params) {
    var schema = params.schema;
    var forme = params.forme || null;
    var patient = params.patient || {};
    var poids = patient.poids;
    var prises = params.prises || (schema.prises && schema.prises[0]) || 1;
    var u = schema.unite || 'mg';
    // « /j » en français, « /dag » en néerlandais : fourni par l'interface.
    var pj = params.sufJour || '/j';

    var res = {
      ok: false,
      unite: u,
      mode: schema.mode,
      prises: prises,
      dosePerKg: null,
      totalJour: null,
      parPrise: null,
      volumeParPrise: null,
      volumeParPriseBrut: null,
      volumeJour: null,
      unitesParPrise: null,
      unitesJour: null,
      plafonne: false,
      plafondMotif: null,
      doseReelleParKg: null,
      palier: null,
      avertissements: [],
      blocages: [],
      etapes: []
    };

    /** Ajoute une ligne à la trace du calcul. */
    function etape(cle, formule, resultat, cleParams) {
      res.etapes.push({
        cle: cle,
        cleParams: cleParams || null,
        formule: formule,
        resultat: resultat
      });
    }

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
      etape('calc.etape.palier', null, nombre(res.totalJour) + ' ' + u + pj);
    } else {
      if (poids === null || poids === undefined || isNaN(poids) || poids <= 0) {
        res.blocages.push({ cle: 'w.poidsManquant' });
        return res;
      }
      var dose = params.dosePerKg;
      if (dose === null || dose === undefined || isNaN(dose)) dose = schema.doseUsuelle;
      res.dosePerKg = dose;

      var produit = nombre(dose) + ' ' + u + '/kg × ' + nombre(poids) + ' kg';
      if (schema.mode === 'jour') {
        res.totalJour = dose * poids;
        etape('calc.etape.doseJour', produit, nombre(res.totalJour) + ' ' + u + pj);
      } else if (schema.mode === 'prise') {
        res.parPrise = dose * poids;
        etape('calc.etape.dosePrise', produit, nombre(res.parPrise) + ' ' + u);
        res.totalJour = res.parPrise * prises;
        etape('calc.etape.totalDepuisPrise',
          nombre(res.parPrise) + ' ' + u + ' × ' + prises,
          nombre(res.totalJour) + ' ' + u + pj);
      } else if (schema.mode === 'unique') {
        res.prises = 1;
        prises = 1;
        res.totalJour = dose * poids;
        etape('calc.etape.doseUnique', produit, nombre(res.totalJour) + ' ' + u);
      }
    }

    /* --- 2. Plafonds absolus -------------------------------------- */

    // Plafond exprimé en <unite>/kg/jour (ex. paracétamol 60 mg/kg/j).
    if (schema.maxParKgJour && poids > 0) {
      var plafondKg = schema.maxParKgJour * poids;
      if (res.totalJour > plafondKg + 1e-9) {
        res.totalJour = plafondKg;
        res.plafonne = true;
        res.plafondMotif = {
          cle: 'plafond.parKg',
          params: { valeur: nombre(schema.maxParKgJour), unite: u }
        };
        etape('calc.etape.plafondKg',
          nombre(schema.maxParKgJour) + ' ' + u + '/kg' + pj + ' × ' + nombre(poids) + ' kg',
          nombre(res.totalJour) + ' ' + u + pj);
      }
    }

    // Plafond absolu journalier (dose adulte).
    if (schema.maxJour && res.totalJour > schema.maxJour + 1e-9) {
      res.totalJour = schema.maxJour;
      res.plafonne = true;
      res.plafondMotif = {
        cle: 'plafond.jour',
        params: { valeur: nombre(schema.maxJour), unite: u }
      };
      etape('calc.etape.plafondJour', null, nombre(res.totalJour) + ' ' + u + pj);
    }

    res.parPrise = res.totalJour / prises;
    if (schema.mode !== 'unique') {
      etape('calc.etape.division',
        nombre(res.totalJour) + ' ' + u + pj + ' ÷ ' + prises,
        nombre(res.parPrise) + ' ' + u);
    }

    // Plafond absolu par prise.
    if (schema.maxPrise && res.parPrise > schema.maxPrise + 1e-9) {
      res.parPrise = schema.maxPrise;
      res.totalJour = res.parPrise * prises;
      res.plafonne = true;
      res.plafondMotif = {
        cle: 'plafond.prise',
        params: { valeur: nombre(schema.maxPrise), unite: u }
      };
      etape('calc.etape.plafondPrise', null, nombre(res.parPrise) + ' ' + u);
    }

    /* --- 3. Conversion vers la présentation ----------------------- */

    if (forme) {
      if (forme.type === 'liquide' && forme.parMl) {
        var mlBrut = res.parPrise / forme.parMl;
        res.volumeParPriseBrut = mlBrut;
        res.volumeParPrise = arrondiVolume(mlBrut);
        res.volumeJour = arrondi(res.volumeParPrise * prises);

        etape('calc.etape.volume',
          nombre(res.parPrise) + ' ' + u + ' ÷ ' + nombre(forme.parMl) + ' ' + u + '/ml',
          nombre(mlBrut) + ' ml');
        if (Math.abs(mlBrut - res.volumeParPrise) > 1e-9) {
          etape('calc.etape.arrondiVolume', null, nombre(res.volumeParPrise, 2) + ' ml',
            { pas: nombre(pasVolume(mlBrut), 2) });
        }
        if (prises > 1) {
          etape('calc.etape.volumeJour',
            nombre(res.volumeParPrise) + ' ml × ' + prises,
            nombre(res.volumeJour) + ' ml' + pj);
        }

        if (poids > 0) {
          res.doseReelleParKg = (res.volumeParPrise * forme.parMl * prises) / poids;
        }
        if (res.volumeParPrise > 0 && Math.abs(mlBrut - res.volumeParPrise) / mlBrut > 0.05) {
          res.avertissements.push({
            cle: 'w.arrondiVolume',
            params: { brut: nombre(mlBrut, 2), net: nombre(res.volumeParPrise, 2) }
          });
        }
        if (res.volumeParPrise > 0 && res.volumeParPrise < 0.2) {
          res.avertissements.push({ cle: 'w.volumeFaible' });
        }
        if (res.volumeParPrise > 20) {
          res.avertissements.push({ cle: 'w.volumeEleve' });
        }

      } else if (forme.parUnite) {
        // On ne peut pas administrer 0,9 suppositoire : on arrondit au
        // fractionnement réellement praticable pour cette présentation.
        var pas = forme.pasUnite !== undefined
          ? forme.pasUnite
          : (forme.type === 'solide' ? 0.5 : 1);
        var theorique = res.parPrise / forme.parUnite;
        var pratique = Math.round(theorique / pas) * pas;

        // Arrondir vers le haut peut faire franchir un plafond absolu : un
        // demi-comprimé de plus suffit à dépasser la dose adulte.
        var depassePlafond = false;
        if (pratique > theorique) {
          var siHautPrise = pratique * forme.parUnite;
          var siHautJour = siHautPrise * prises;
          depassePlafond =
            (schema.maxJour && siHautJour > schema.maxJour + 1e-9) ||
            (schema.maxPrise && siHautPrise > schema.maxPrise + 1e-9) ||
            (schema.maxParKgJour && poids > 0 && siHautJour > schema.maxParKgJour * poids + 1e-9);
          if (depassePlafond) {
            var bas = Math.floor(theorique / pas) * pas;
            // On n'arrondit vers le bas que si la fraction obtenue reste
            // administrable ; sinon (1 suppositoire ou rien) on garde l'unité
            // entière et on signale que c'est la FRÉQUENCE qui doit baisser.
            if (bas >= pas - 1e-9) { pratique = bas; depassePlafond = false; }
          }
        }
        pratique = Math.round(pratique * 1000) / 1000;

        etape('calc.etape.unites',
          nombre(res.parPrise) + ' ' + u + ' ÷ ' + nombre(forme.parUnite) + ' ' + u,
          nombre(theorique, 2));

        if (pratique < pas) {
          res.avertissements.push({
            cle: 'w.tropDose',
            params: { dose: nombre(res.parPrise) + ' ' + u }
          });
          res.unitesParPrise = theorique;
          res.unitesJour = theorique * prises;
        } else {
          res.unitesParPrise = pratique;
          res.unitesJour = pratique * prises;
          res.parPrise = pratique * forme.parUnite;
          res.totalJour = res.parPrise * prises;
          if (Math.abs(pratique - theorique) > 1e-9) {
            etape('calc.etape.arrondiUnites', null,
              fractionUnites(pratique) + ' × ' + nombre(forme.parUnite) + ' ' + u +
              ' = ' + nombre(res.parPrise) + ' ' + u,
              { pas: nombre(pas, 2) });
          }
          if (depassePlafond) {
            res.avertissements.push({
              cle: 'w.plafondForme',
              params: { total: nombre(res.totalJour) + ' ' + u }
            });
          }
          if (Math.abs(pratique - theorique) / theorique > 0.1) {
            res.avertissements.push({
              cle: 'w.ajustement',
              params: {
                theorique: nombre(theorique, 2),
                pratique: nombre(pratique, 2),
                unite: (forme.uniteNom && forme.uniteNom.un) || null
              }
            });
          }
        }
        if (poids > 0) res.doseReelleParKg = res.totalJour / poids;
      }
    } else if (poids > 0) {
      res.doseReelleParKg = res.totalJour / poids;
    }

    if (res.doseReelleParKg !== null && schema.mode !== 'paliers') {
      etape('calc.etape.controle',
        nombre(res.totalJour) + ' ' + u + pj + ' ÷ ' + nombre(poids) + ' kg',
        nombre(res.doseReelleParKg) + ' ' + u + '/kg' + pj);
    }

    /* --- 4. Avertissements liés au patient ------------------------ */

    if (schema.ageMinMois && patient.ageMois !== null && patient.ageMois !== undefined &&
        !isNaN(patient.ageMois) && patient.ageMois < schema.ageMinMois) {
      res.avertissements.push({ cle: 'w.ageMin', params: { min: schema.ageMinMois } });
    }
    if (schema.poidsMinKg && poids > 0 && poids < schema.poidsMinKg) {
      res.avertissements.push({ cle: 'w.poidsMin', params: { min: nombre(schema.poidsMinKg) } });
    }
    if (poids > 40 && schema.mode !== 'paliers') {
      res.avertissements.push({ cle: 'w.adulte' });
    }

    res.ok = true;
    return res;
  }

  /* ---------------------------------------------------------------- */
  /* Choix automatique de la présentation                             */
  /* ---------------------------------------------------------------- */

  /**
   * Présentations utilisables avec ce schéma.
   *
   * Une même fiche peut mélanger les unités : le salbutamol se dose en µg par
   * bouffée et en mg par nébulisation. Croiser un schéma avec la présentation
   * de l'autre diviserait des µg par des mg/ml et produirait un volume absurde
   * mais crédible. Une présentation dont l'unité diffère de celle du schéma
   * est donc écartée.
   */
  function formesCompatibles(med, schema) {
    var u = schema.unite || 'mg';
    return (med.formes || []).filter(function (f) {
      return (f.unite || u) === u;
    });
  }

  /**
   * Choisit la présentation la plus praticable : un volume de 2 à 10 ml chez
   * le petit enfant, des unités entières chez le grand. Évite de proposer
   * 13 ml de sirop faiblement dosé quand une suspension plus concentrée existe.
   */
  function meilleureForme(params) {
    var med = params.med;
    var formes = formesCompatibles(med, params.schema);
    if (!formes.length) return null;

    var base = calculer({
      med: med, schema: params.schema, forme: null,
      patient: params.patient, dosePerKg: params.dosePerKg, prises: params.prises,
      sufJour: params.sufJour
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
        if (poids >= 30) score += 5;            // l'ado avale plus volontiers un comprimé
      } else if (f.parUnite) {
        var pas = f.pasUnite !== undefined ? f.pasUnite : (f.type === 'solide' ? 0.5 : 1);
        var n = brut / f.parUnite;
        if (n < pas) {
          score = 100 + (pas - n) * 40;         // présentation trop dosée
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

  /* ---------------------------------------------------------------- */
  /* Divers                                                           */
  /* ---------------------------------------------------------------- */

  /** Horaires suggérés pour n prises par jour, pour la feuille patient. */
  function horaires(prises) {
    var table = {
      1: ['8:00'],
      2: ['8:00', '20:00'],
      3: ['7:00', '15:00', '23:00'],
      4: ['6:00', '12:00', '18:00', '24:00'],
      6: ['4:00', '8:00', '12:00', '16:00', '20:00', '24:00']
    };
    if (table[prises]) return table[prises];
    var pas = 24 / prises;
    var liste = [];
    for (var i = 0; i < prises; i++) {
      var h = Math.round(7 + i * pas) % 24;
      liste.push(h + ':00');
    }
    return liste;
  }

  global.PosocalcCalc = {
    calculer: calculer,
    meilleureForme: meilleureForme,
    formesCompatibles: formesCompatibles,
    trouverPalier: trouverPalier,
    arrondi: arrondi,
    arrondiVolume: arrondiVolume,
    pasVolume: pasVolume,
    nombre: nombre,
    fractionUnites: fractionUnites,
    horaires: horaires
  };
})(window);
