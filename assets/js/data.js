/*
 * Posocalc — base de données des médicaments
 * ------------------------------------------------------------------
 * IMPORTANT : ces données sont une PROPOSITION de départ. Chaque fiche
 * porte un champ `verifie`. Tant qu'il vaut false, l'interface affiche
 * un badge « non vérifié ». Le prescripteur (ou le pharmacien) doit
 * contrôler la fiche contre le RCP / le CBIP / le guide BAPCOC, puis
 * passer `verifie` à true.
 *
 * BILINGUE : tout champ affiché à l'écran est soit une chaîne simple
 * (identique dans les deux langues, ex. un nom de marque), soit un objet
 * { fr: '…', nl: '…' }.
 *
 * Structure d'une fiche :
 *   id            identifiant unique (slug, utilisé dans l'URL)
 *   dci           dénomination commune internationale { fr, nl }
 *   marques       noms commerciaux courants en Belgique
 *   cbip          mot-clé de la fiche CBIP/BCFI { fr, nl }, pour le lien
 *                 « à vérifier dans »
 *   categorie     clé de catégorie (voir CATEGORIES ci-dessous)
 *   frequent      true => remonte dans « Les plus prescrits »
 *   synonymes     termes de recherche supplémentaires, FR et NL mélangés
 *   verifie       false tant que la fiche n'a pas été relue
 *   formes[]      présentations disponibles
 *       id, nom { fr, nl }
 *       type      'liquide' | 'solide' | 'sachet' | 'suppo' | 'autre'
 *       parMl     quantité de principe actif par ml (formes liquides)
 *       parUnite  quantité par comprimé / sachet / suppositoire
 *       uniteNom  { un: { fr, nl }, pl: { fr, nl } } — singulier et pluriel
 *                 (le pluriel néerlandais n'est pas un simple « +s »)
 *       pasUnite  plus petite fraction administrable (défaut : 0,5 pour
 *                 un comprimé, 1 sinon). Mettre 1 pour une gélule.
 *       note      { fr, nl } précision affichée sous le sélecteur
 *   schemas[]     schémas posologiques, un par indication
 *       mode      'jour'    doses exprimées en <unite>/kg/JOUR
 *                 'prise'   doses exprimées en <unite>/kg/PRISE
 *                 'unique'  dose unique en <unite>/kg
 *                 'paliers' dose fixe par tranche d'âge ou de poids
 *       doseMin / doseUsuelle / doseMax
 *       unite     'mg' | 'UI' | 'µg' | 'g' | 'ml'
 *       prises    nombre de prises par jour proposées (1re = défaut)
 *       maxJour   plafond absolu par jour (dose adulte)
 *       maxPrise  plafond absolu par prise
 *       maxParKgJour  plafond exprimé en <unite>/kg/jour
 *       ageMinMois / poidsMinKg  seuils déclenchant un avertissement
 *       prn       true = médicament « à la demande » : aucun total sur
 *                 24 h n'est affiché (salbutamol…)
 *       sources[] D'OÙ VIENT CE CHIFFRE. Obligatoire : l'interface
 *                 affiche ces références juste sous la posologie.
 *       paliers[] pour mode 'paliers' : { label, min, max, dose, prises, libelle }
 *                 critere (sur le schéma) = 'age' (en mois) ou 'poids' (en kg)
 *                 ATTENTION : `dose` est le TOTAL PAR JOUR, réparti sur
 *                 `prises`. Pour « 2,5 mg 2×/j », écrire dose: 5, prises: 2.
 */

(function (global) {
  'use strict';

  var CATEGORIES = [
    { id: 'antibiotique', nom: { fr: 'Antibiotique', nl: 'Antibioticum' } },
    { id: 'antalgique', nom: { fr: 'Antalgique / antipyrétique', nl: 'Pijnstiller / koortswerend' } },
    { id: 'corticoide', nom: { fr: 'Corticoïde', nl: 'Corticosteroïd' } },
    { id: 'allergie', nom: { fr: 'Allergie', nl: 'Allergie' } },
    { id: 'respiratoire', nom: { fr: 'Respiratoire', nl: 'Ademhaling' } },
    { id: 'digestif', nom: { fr: 'Digestif', nl: 'Spijsvertering' } },
    { id: 'antifongique', nom: { fr: 'Antifongique', nl: 'Antimycoticum' } },
    { id: 'antiviral', nom: { fr: 'Antiviral', nl: 'Antiviraal' } },
    { id: 'antiparasitaire', nom: { fr: 'Antiparasitaire', nl: 'Antiparasitair' } },
    { id: 'supplement', nom: { fr: 'Vitamine / supplément', nl: 'Vitamine / supplement' } }
  ];

  /* ---------------------------------------------------------------- */
  /* Sources                                                          */
  /* ---------------------------------------------------------------- */

  var SRC_BAPCOC = {
    label: {
      fr: 'Guide BAPCOC — traitements anti-infectieux en pratique ambulatoire',
      nl: 'BAPCOC-gids — anti-infectieuze behandeling in de ambulante praktijk'
    },
    url: {
      fr: 'https://organesdeconcertation.sante.belgique.be/sites/default/files/content/bapcoc_guide_traitement_antiinfectieux_2022.pdf',
      nl: 'https://overlegorganen.gezondheid.belgie.be/sites/default/files/documents/gids_2024_updated_20_dec.pdf'
    }
  };
  var SRC_CBIP = {
    label: {
      fr: 'CBIP — Répertoire commenté des médicaments',
      nl: 'BCFI — Gecommentarieerd Geneesmiddelenrepertorium'
    },
    url: { fr: 'https://www.cbip.be/fr/start', nl: 'https://www.bcfi.be/nl/start' }
  };
  var SRC_RCP = {
    label: {
      fr: 'RCP de la spécialité (notice / résumé des caractéristiques du produit)',
      nl: 'SKP van de specialiteit (bijsluiter / samenvatting van de productkenmerken)'
    },
    url: { fr: 'https://www.afmps.be/fr', nl: 'https://www.fagg.be/nl' }
  };

  /* ---------------------------------------------------------------- */
  /* Libellés réutilisés                                              */
  /* ---------------------------------------------------------------- */

  var U_CP = { un: { fr: 'comprimé', nl: 'tablet' }, pl: { fr: 'comprimés', nl: 'tabletten' } };
  var U_GEL = { un: { fr: 'gélule', nl: 'capsule' }, pl: { fr: 'gélules', nl: 'capsules' } };
  var U_SACHET = { un: { fr: 'sachet', nl: 'zakje' }, pl: { fr: 'sachets', nl: 'zakjes' } };
  var U_SUPPO = { un: { fr: 'suppositoire', nl: 'zetpil' }, pl: { fr: 'suppositoires', nl: 'zetpillen' } };
  var U_LYOC = { un: { fr: 'lyophilisat', nl: 'lyofilisaat' }, pl: { fr: 'lyophilisats', nl: 'lyofilisaten' } };
  var U_BOUFFEE = { un: { fr: 'bouffée', nl: 'pufje' }, pl: { fr: 'bouffées', nl: 'pufjes' } };
  var U_GOUTTE = { un: { fr: 'goutte', nl: 'druppel' }, pl: { fr: 'gouttes', nl: 'druppels' } };
  var U_AMP = { un: { fr: 'ampoule', nl: 'ampul' }, pl: { fr: 'ampoules', nl: 'ampullen' } };

  var ALLERGIE_PENI = {
    fr: 'Allergie aux pénicillines.',
    nl: 'Allergie voor penicillines.'
  };
  var ALLERGIE_BETA = {
    fr: 'Allergie IgE-médiée aux bêta-lactames.',
    nl: 'IgE-gemedieerde allergie voor bèta-lactams.'
  };
  var ALLERGIE_MACRO = {
    fr: 'Allergie aux macrolides.',
    nl: 'Allergie voor macroliden.'
  };
  var QT_LONG = {
    fr: 'Allongement du QT : prudence en cas d’association à d’autres médicaments allongeant le QT.',
    nl: 'QT-verlenging: voorzichtig bij combinatie met andere QT-verlengende geneesmiddelen.'
  };

  /* Suspension orale « X mg / 5 ml » dans les deux langues. */
  function suspOrale(mg) {
    return { fr: 'Suspension orale ' + mg + ' mg / 5 ml', nl: 'Orale suspensie ' + mg + ' mg / 5 ml' };
  }
  function comprime(dose) {
    return { fr: 'Comprimé ' + dose, nl: 'Tablet ' + dose };
  }
  function gelule(dose) {
    return { fr: 'Gélule ' + dose, nl: 'Capsule ' + dose };
  }

  var MEDICAMENTS = [

    /* ============================================================== */
    /* ANTIBIOTIQUES                                                  */
    /* ============================================================== */
    {
      id: 'amoxicilline',
      dci: { fr: 'Amoxicilline', nl: 'Amoxicilline' },
      marques: ['Clamoxyl', 'Amoxypen', 'Docamoxici', 'Amoxicilline EG / Sandoz / Teva'],
      cbip: { fr: 'amoxicilline', nl: 'amoxicilline' },
      categorie: 'antibiotique',
      frequent: true,
      verifie: false,
      synonymes: ['penicilline A', 'otite', 'angine', 'pneumonie',
                  'oorontsteking', 'keelontsteking', 'longontsteking'],
      formes: [
        { id: 'susp125', nom: suspOrale(125), type: 'liquide', parMl: 25 },
        { id: 'susp250', nom: suspOrale(250), type: 'liquide', parMl: 50 },
        { id: 'susp500', nom: suspOrale(500), type: 'liquide', parMl: 100 },
        { id: 'cp500', nom: { fr: 'Comprimé / gélule 500 mg', nl: 'Tablet / capsule 500 mg' },
          type: 'solide', parUnite: 500, uniteNom: U_CP },
        { id: 'cp1000', nom: comprime('1 g'), type: 'solide', parUnite: 1000, uniteNom: U_CP }
      ],
      schemas: [
        {
          id: 'oma',
          indication: {
            fr: 'Otite moyenne aiguë, sinusite, pneumonie communautaire',
            nl: 'Acute middenoorontsteking, sinusitis, buiten het ziekenhuis opgelopen longontsteking'
          },
          mode: 'jour', unite: 'mg',
          doseMin: 75, doseUsuelle: 80, doseMax: 100,
          prises: [3], maxJour: 3000,
          duree: { fr: '5 à 7 jours', nl: '5 tot 7 dagen' },
          note: {
            fr: 'Doses élevées recommandées en Belgique vu la sensibilité diminuée du pneumocoque.',
            nl: 'Hoge doses aanbevolen in België wegens de verminderde gevoeligheid van de pneumokok.'
          },
          sources: [SRC_BAPCOC]
        },
        {
          id: 'angine',
          indication: {
            fr: 'Pharyngite / angine à streptocoque du groupe A',
            nl: 'Faryngitis / keelontsteking door groep A-streptokokken'
          },
          mode: 'jour', unite: 'mg',
          doseMin: 50, doseUsuelle: 50, doseMax: 50,
          prises: [3, 2], maxJour: 3000,
          duree: { fr: '7 jours', nl: '7 dagen' },
          note: {
            fr: 'La pénicilline V reste le premier choix ; l’amoxicilline est une alternative.',
            nl: 'Penicilline V blijft de eerste keuze; amoxicilline is een alternatief.'
          },
          sources: [SRC_BAPCOC]
        },
        {
          id: 'cutane',
          indication: {
            fr: 'Infection cutanée (impétigo, érysipèle)',
            nl: 'Huidinfectie (impetigo, erysipelas)'
          },
          mode: 'jour', unite: 'mg',
          doseMin: 25, doseUsuelle: 50, doseMax: 50,
          prises: [3, 4], maxJour: 3000,
          duree: { fr: '7 jours (impétigo) à 10 jours (érysipèle)', nl: '7 dagen (impetigo) tot 10 dagen (erysipelas)' },
          sources: [SRC_BAPCOC]
        }
      ],
      precautions: [
        { fr: 'Éruption cutanée quasi constante en cas de mononucléose infectieuse (n’équivaut pas à une allergie).',
          nl: 'Vrijwel steeds huiduitslag bij mononucleosis infectiosa (dit is geen allergie).' },
        { fr: 'Adapter en cas d’insuffisance rénale.', nl: 'Aanpassen bij nierinsufficiëntie.' }
      ],
      contreIndications: [
        { fr: 'Allergie IgE-médiée aux pénicillines.', nl: 'IgE-gemedieerde allergie voor penicillines.' }
      ],
      sources: [SRC_BAPCOC, SRC_CBIP]
    },

    {
      id: 'amoxicilline-clavulanate',
      dci: { fr: 'Amoxicilline + acide clavulanique', nl: 'Amoxicilline + clavulaanzuur' },
      marques: ['Augmentin', 'Amoxiclav EG / Sandoz / Teva', 'Docamoclan'],
      cbip: { fr: 'amoxicilline', nl: 'amoxicilline' },
      categorie: 'antibiotique',
      frequent: true,
      verifie: false,
      synonymes: ['co-amoxiclav', 'augmentin', 'clavulaanzuur'],
      doseExprimee: {
        fr: 'Les doses sont exprimées en amoxicilline.',
        nl: 'De doses zijn uitgedrukt in amoxicilline.'
      },
      formes: [
        { id: 'susp4_1_125', nom: { fr: 'Suspension 125 mg / 31,25 mg par 5 ml (4:1)', nl: 'Suspensie 125 mg / 31,25 mg per 5 ml (4:1)' }, type: 'liquide', parMl: 25 },
        { id: 'susp4_1_250', nom: { fr: 'Suspension 250 mg / 62,5 mg par 5 ml (4:1)', nl: 'Suspensie 250 mg / 62,5 mg per 5 ml (4:1)' }, type: 'liquide', parMl: 50 },
        { id: 'susp8_1', nom: { fr: 'Suspension 100 mg / 12,5 mg par ml (8:1)', nl: 'Suspensie 100 mg / 12,5 mg per ml (8:1)' },
          type: 'liquide', parMl: 100,
          note: { fr: 'Rapport 8:1 : permet des doses élevées d’amoxicilline sans excès de clavulanate.',
                  nl: 'Verhouding 8:1: laat hoge amoxicillinedoses toe zonder overmaat clavulaanzuur.' } },
        { id: 'cp500', nom: comprime('500 mg / 125 mg'), type: 'solide', parUnite: 500, uniteNom: U_CP },
        { id: 'cp875', nom: comprime('875 mg / 125 mg'), type: 'solide', parUnite: 875, uniteNom: U_CP }
      ],
      schemas: [
        {
          id: 'standard',
          indication: {
            fr: 'Indication courante (OMA compliquée, sinusite, morsure, pneumonie d’inhalation)',
            nl: 'Gangbare indicatie (gecompliceerde middenoorontsteking, sinusitis, beet, aspiratiepneumonie)'
          },
          mode: 'jour', unite: 'mg',
          doseMin: 75, doseUsuelle: 80, doseMax: 100,
          prises: [3], maxJour: 3000,
          duree: { fr: 'selon l’indication', nl: 'afhankelijk van de indicatie' },
          note: {
            fr: 'Ne pas dépasser 12,5 mg/kg/j d’acide clavulanique : privilégier le rapport 8:1 pour les doses élevées.',
            nl: 'Niet meer dan 12,5 mg/kg/dag clavulaanzuur: verkies de verhouding 8:1 voor hoge doses.'
          },
          sources: [SRC_BAPCOC, SRC_CBIP]
        },
        {
          id: 'faible',
          indication: { fr: 'Dose standard basse (rapport 4:1)', nl: 'Lage standaarddosis (verhouding 4:1)' },
          mode: 'jour', unite: 'mg',
          doseMin: 45, doseUsuelle: 45, doseMax: 50,
          prises: [3, 2], maxJour: 1500,
          sources: [SRC_CBIP]
        }
      ],
      precautions: [
        { fr: 'Diarrhée fréquente, plus marquée qu’avec l’amoxicilline seule.',
          nl: 'Vaak diarree, meer uitgesproken dan met amoxicilline alleen.' }
      ],
      contreIndications: [
        ALLERGIE_PENI,
        { fr: 'Antécédent d’atteinte hépatique liée à l’association.',
          nl: 'Voorgeschiedenis van leverlijden door deze associatie.' }
      ],
      sources: [SRC_BAPCOC, SRC_CBIP]
    },

    {
      id: 'penicilline-v',
      dci: { fr: 'Phénoxyméthylpénicilline (pénicilline V)', nl: 'Fenoxymethylpenicilline (penicilline V)' },
      marques: ['Peni-Oral', 'Phénoxyméthylpénicilline (disponibilité à vérifier)'],
      cbip: { fr: 'phénoxyméthylpénicilline', nl: 'fenoxymethylpenicilline' },
      categorie: 'antibiotique',
      frequent: true,
      verifie: false,
      synonymes: ['penicilline V', 'angine', 'streptocoque', 'keelontsteking', 'streptokok'],
      formes: [
        { id: 'susp', nom: suspOrale(250), type: 'liquide', parMl: 50 },
        { id: 'cp1m', nom: { fr: 'Comprimé 1 000 000 UI (≈ 600 mg)', nl: 'Tablet 1 000 000 IE (≈ 600 mg)' },
          type: 'solide', parUnite: 600, uniteNom: U_CP }
      ],
      schemas: [
        {
          id: 'angine',
          indication: {
            fr: 'Pharyngite / angine à streptocoque du groupe A',
            nl: 'Faryngitis / keelontsteking door groep A-streptokokken'
          },
          mode: 'jour', unite: 'mg',
          doseMin: 50, doseUsuelle: 50, doseMax: 50,
          prises: [3, 2], maxJour: 2000,
          duree: { fr: '7 jours', nl: '7 dagen' },
          note: {
            fr: 'Premier choix BAPCOC quand un antibiotique est indiqué dans l’angine à streptocoque A.',
            nl: 'Eerste keuze volgens BAPCOC wanneer een antibioticum aangewezen is bij groep A-streptokokkenkeelontsteking.'
          },
          sources: [SRC_BAPCOC]
        }
      ],
      precautions: [
        { fr: 'À prendre à jeun (1 h avant ou 2 h après le repas).',
          nl: 'Op een lege maag innemen (1 u voor of 2 u na de maaltijd).' }
      ],
      contreIndications: [ALLERGIE_PENI],
      sources: [SRC_BAPCOC]
    },

    {
      id: 'azithromycine',
      dci: { fr: 'Azithromycine', nl: 'Azitromycine' },
      marques: ['Zitromax', 'Azitromycine EG / Sandoz / Teva'],
      cbip: { fr: 'azithromycine', nl: 'azitromycine' },
      categorie: 'antibiotique',
      frequent: true,
      verifie: false,
      synonymes: ['macrolide', 'coqueluche', 'kinkhoest'],
      formes: [
        { id: 'susp200', nom: suspOrale(200), type: 'liquide', parMl: 40 },
        { id: 'cp250', nom: comprime('250 mg'), type: 'solide', parUnite: 250, uniteNom: U_CP },
        { id: 'cp500', nom: comprime('500 mg'), type: 'solide', parUnite: 500, uniteNom: U_CP }
      ],
      schemas: [
        {
          id: 'court3j',
          indication: { fr: 'Schéma court (3 jours)', nl: 'Kort schema (3 dagen)' },
          mode: 'jour', unite: 'mg',
          doseMin: 10, doseUsuelle: 10, doseMax: 10,
          prises: [1], maxJour: 500,
          duree: { fr: '3 jours', nl: '3 dagen' },
          sources: [SRC_CBIP]
        },
        {
          id: 'coqueluche',
          indication: { fr: 'Coqueluche', nl: 'Kinkhoest' },
          mode: 'jour', unite: 'mg',
          doseMin: 10, doseUsuelle: 10, doseMax: 10,
          prises: [1], maxJour: 500,
          duree: { fr: '5 jours', nl: '5 dagen' },
          note: {
            fr: 'Chez le nourrisson de moins de 6 mois : 10 mg/kg/j pendant 5 jours.',
            nl: 'Bij zuigelingen jonger dan 6 maanden: 10 mg/kg/dag gedurende 5 dagen.'
          },
          sources: [SRC_BAPCOC]
        }
      ],
      precautions: [QT_LONG],
      contreIndications: [ALLERGIE_MACRO],
      sources: [SRC_BAPCOC, SRC_CBIP]
    },

    {
      id: 'clarithromycine',
      dci: { fr: 'Clarithromycine', nl: 'Claritromycine' },
      marques: ['Biclar', 'Clarithromycine EG / Sandoz / Teva'],
      cbip: { fr: 'clarithromycine', nl: 'claritromycine' },
      categorie: 'antibiotique',
      frequent: true,
      verifie: false,
      synonymes: ['macrolide', 'coqueluche', 'kinkhoest'],
      formes: [
        { id: 'susp125', nom: suspOrale(125), type: 'liquide', parMl: 25 },
        { id: 'susp250', nom: suspOrale(250), type: 'liquide', parMl: 50 },
        { id: 'cp250', nom: comprime('250 mg'), type: 'solide', parUnite: 250, uniteNom: U_CP },
        { id: 'cp500', nom: comprime('500 mg'), type: 'solide', parUnite: 500, uniteNom: U_CP }
      ],
      schemas: [
        {
          id: 'standard',
          indication: {
            fr: 'Infection respiratoire, coqueluche (alternative)',
            nl: 'Luchtweginfectie, kinkhoest (alternatief)'
          },
          mode: 'jour', unite: 'mg',
          doseMin: 15, doseUsuelle: 15, doseMax: 15,
          prises: [2], maxJour: 1000,
          duree: { fr: '7 jours (5 à 7 jours pour la coqueluche)', nl: '7 dagen (5 tot 7 dagen bij kinkhoest)' },
          sources: [SRC_CBIP, SRC_BAPCOC]
        }
      ],
      precautions: [
        { fr: 'Inhibiteur enzymatique puissant (CYP3A4) : vérifier les interactions.',
          nl: 'Krachtige enzymremmer (CYP3A4): controleer de interacties.' },
        QT_LONG
      ],
      contreIndications: [ALLERGIE_MACRO],
      sources: [SRC_BAPCOC, SRC_CBIP]
    },

    {
      id: 'cefuroxime-axetil',
      dci: { fr: 'Céfuroxime axétil', nl: 'Cefuroxim axetil' },
      marques: ['Zinnat', 'Céfuroxime EG / Sandoz'],
      cbip: { fr: 'céfuroxime', nl: 'cefuroxim' },
      categorie: 'antibiotique',
      frequent: false,
      verifie: false,
      synonymes: ['cephalosporine', 'C2G', 'cefalosporine'],
      formes: [
        { id: 'susp125', nom: suspOrale(125), type: 'liquide', parMl: 25 },
        { id: 'cp250', nom: comprime('250 mg'), type: 'solide', parUnite: 250, uniteNom: U_CP },
        { id: 'cp500', nom: comprime('500 mg'), type: 'solide', parUnite: 500, uniteNom: U_CP }
      ],
      schemas: [
        {
          id: 'standard',
          indication: { fr: 'Infection ORL / respiratoire (2e choix)', nl: 'KNO- / luchtweginfectie (tweede keuze)' },
          mode: 'jour', unite: 'mg',
          doseMin: 20, doseUsuelle: 30, doseMax: 30,
          prises: [2], maxJour: 1000,
          duree: { fr: 'selon l’indication', nl: 'afhankelijk van de indicatie' },
          sources: [SRC_CBIP]
        }
      ],
      precautions: [
        { fr: 'Goût très amer de la suspension : observance souvent médiocre chez le jeune enfant.',
          nl: 'Zeer bittere smaak van de suspensie: therapietrouw vaak moeilijk bij jonge kinderen.' },
        { fr: 'À prendre pendant le repas (absorption).', nl: 'Innemen tijdens de maaltijd (absorptie).' }
      ],
      contreIndications: [ALLERGIE_BETA],
      sources: [SRC_CBIP]
    },

    {
      id: 'cefadroxil',
      dci: { fr: 'Céfadroxil', nl: 'Cefadroxil' },
      marques: ['Duracef'],
      cbip: { fr: 'céfadroxil', nl: 'cefadroxil' },
      categorie: 'antibiotique',
      frequent: false,
      verifie: false,
      synonymes: ['cephalosporine', 'C1G', 'cefalosporine'],
      formes: [
        { id: 'susp250', nom: suspOrale(250), type: 'liquide', parMl: 50 },
        { id: 'susp500', nom: suspOrale(500), type: 'liquide', parMl: 100 },
        { id: 'cp500', nom: gelule('500 mg'), type: 'solide', parUnite: 500, uniteNom: U_GEL, pasUnite: 1 }
      ],
      schemas: [
        {
          id: 'standard',
          indication: {
            fr: 'Infection cutanée, angine (alternative en cas d’allergie non IgE)',
            nl: 'Huidinfectie, keelontsteking (alternatief bij niet-IgE-allergie)'
          },
          mode: 'jour', unite: 'mg',
          doseMin: 30, doseUsuelle: 30, doseMax: 50,
          prises: [2], maxJour: 2000,
          duree: { fr: 'selon l’indication', nl: 'afhankelijk van de indicatie' },
          sources: [SRC_CBIP]
        }
      ],
      precautions: [],
      contreIndications: [ALLERGIE_BETA],
      sources: [SRC_CBIP]
    },

    {
      id: 'flucloxacilline',
      dci: { fr: 'Flucloxacilline', nl: 'Flucloxacilline' },
      marques: ['Floxapen', 'Staphycid'],
      cbip: { fr: 'flucloxacilline', nl: 'flucloxacilline' },
      categorie: 'antibiotique',
      frequent: false,
      verifie: false,
      synonymes: ['staphylocoque', 'impetigo', 'stafylokok'],
      formes: [
        { id: 'sirop125', nom: { fr: 'Sirop 125 mg / 5 ml', nl: 'Siroop 125 mg / 5 ml' }, type: 'liquide', parMl: 25 },
        { id: 'sirop250', nom: { fr: 'Sirop 250 mg / 5 ml', nl: 'Siroop 250 mg / 5 ml' }, type: 'liquide', parMl: 50 },
        { id: 'cp500', nom: gelule('500 mg'), type: 'solide', parUnite: 500, uniteNom: U_GEL, pasUnite: 1 }
      ],
      schemas: [
        {
          id: 'standard',
          indication: { fr: 'Infection cutanée à staphylocoque', nl: 'Huidinfectie door stafylokokken' },
          mode: 'jour', unite: 'mg',
          doseMin: 50, doseUsuelle: 50, doseMax: 100,
          prises: [3, 4], maxJour: 4000,
          duree: { fr: '7 à 10 jours', nl: '7 tot 10 dagen' },
          sources: [SRC_BAPCOC, SRC_CBIP]
        }
      ],
      precautions: [
        { fr: 'À prendre à jeun (1 h avant le repas).', nl: 'Op een lege maag innemen (1 u voor de maaltijd).' },
        { fr: 'Hépatotoxicité rare mais décrite.', nl: 'Zeldzame maar beschreven levertoxiciteit.' }
      ],
      contreIndications: [ALLERGIE_PENI],
      sources: [SRC_BAPCOC, SRC_CBIP]
    },

    {
      id: 'cotrimoxazole',
      dci: {
        fr: 'Sulfaméthoxazole + triméthoprime (cotrimoxazole)',
        nl: 'Sulfamethoxazol + trimethoprim (cotrimoxazol)'
      },
      marques: ['Bactrim', 'Eusaprim', 'Docotrim'],
      cbip: { fr: 'cotrimoxazole', nl: 'cotrimoxazol' },
      categorie: 'antibiotique',
      frequent: false,
      verifie: false,
      synonymes: ['bactrim', 'infection urinaire', 'cystite', 'urineweginfectie', 'blaasontsteking'],
      doseExprimee: {
        fr: 'Les doses sont exprimées en sulfaméthoxazole (SMX).',
        nl: 'De doses zijn uitgedrukt in sulfamethoxazol (SMX).'
      },
      formes: [
        { id: 'sirop', nom: { fr: 'Suspension 200 mg SMX / 40 mg TMP par 5 ml', nl: 'Suspensie 200 mg SMX / 40 mg TMP per 5 ml' }, type: 'liquide', parMl: 40 },
        { id: 'cpforte', nom: comprime('800 mg / 160 mg (forte)'), type: 'solide', parUnite: 800, uniteNom: U_CP }
      ],
      schemas: [
        {
          id: 'urinaire',
          indication: { fr: 'Infection urinaire', nl: 'Urineweginfectie' },
          mode: 'jour', unite: 'mg',
          doseMin: 30, doseUsuelle: 30, doseMax: 30,
          prises: [2], maxJour: 1600,
          ageMinMois: 1.5,
          duree: { fr: '3 à 7 jours', nl: '3 tot 7 dagen' },
          note: {
            fr: 'Équivaut à 6 mg/kg/j de triméthoprime.',
            nl: 'Komt overeen met 6 mg/kg/dag trimethoprim.'
          },
          sources: [SRC_BAPCOC, SRC_CBIP]
        }
      ],
      precautions: [
        { fr: 'Photosensibilité.', nl: 'Fotosensibilisatie.' },
        { fr: 'Contrôle de la fonction rénale si traitement prolongé.',
          nl: 'Controle van de nierfunctie bij langdurige behandeling.' }
      ],
      contreIndications: [
        { fr: 'Nourrisson de moins de 6 semaines.', nl: 'Zuigeling jonger dan 6 weken.' },
        { fr: 'Déficit en G6PD.', nl: 'G6PD-deficiëntie.' },
        { fr: 'Allergie aux sulfamides.', nl: 'Allergie voor sulfamiden.' }
      ],
      sources: [SRC_BAPCOC, SRC_CBIP]
    },

    {
      id: 'nitrofurantoine',
      dci: { fr: 'Nitrofurantoïne', nl: 'Nitrofurantoïne' },
      marques: ['Furadantine MC'],
      cbip: { fr: 'nitrofurantoïne', nl: 'nitrofurantoïne' },
      categorie: 'antibiotique',
      frequent: false,
      verifie: false,
      synonymes: ['cystite', 'infection urinaire', 'blaasontsteking', 'urineweginfectie'],
      formes: [
        { id: 'gel50', nom: gelule('50 mg'), type: 'solide', parUnite: 50, uniteNom: U_GEL, pasUnite: 1 },
        { id: 'gel100', nom: gelule('100 mg'), type: 'solide', parUnite: 100, uniteNom: U_GEL, pasUnite: 1 }
      ],
      schemas: [
        {
          id: 'cystite',
          indication: { fr: 'Cystite non compliquée', nl: 'Ongecompliceerde blaasontsteking' },
          mode: 'jour', unite: 'mg',
          doseMin: 5, doseUsuelle: 5, doseMax: 7,
          prises: [3, 4], maxJour: 400,
          ageMinMois: 1,
          duree: { fr: '5 à 7 jours', nl: '5 tot 7 dagen' },
          note: {
            fr: 'Pas de forme liquide en Belgique : peu praticable chez le jeune enfant.',
            nl: 'Geen vloeibare vorm in België: weinig bruikbaar bij jonge kinderen.'
          },
          sources: [SRC_BAPCOC, SRC_CBIP]
        }
      ],
      precautions: [
        { fr: 'À prendre pendant le repas.', nl: 'Innemen tijdens de maaltijd.' },
        { fr: 'Colore les urines en brun.', nl: 'Kleurt de urine bruin.' }
      ],
      contreIndications: [
        { fr: 'Nourrisson de moins de 1 mois.', nl: 'Zuigeling jonger dan 1 maand.' },
        { fr: 'Insuffisance rénale.', nl: 'Nierinsufficiëntie.' },
        { fr: 'Déficit en G6PD.', nl: 'G6PD-deficiëntie.' }
      ],
      sources: [SRC_BAPCOC, SRC_CBIP]
    },

    {
      id: 'metronidazole',
      dci: { fr: 'Métronidazole', nl: 'Metronidazol' },
      marques: ['Flagyl', 'Docmetro'],
      cbip: { fr: 'métronidazole', nl: 'metronidazol' },
      categorie: 'antibiotique',
      frequent: false,
      verifie: false,
      synonymes: ['anaerobie', 'giardia', 'lambliase', 'anaeroob', 'giardiasis'],
      formes: [
        { id: 'susp', nom: suspOrale(200), type: 'liquide', parMl: 40 },
        { id: 'cp250', nom: comprime('250 mg'), type: 'solide', parUnite: 250, uniteNom: U_CP },
        { id: 'cp500', nom: comprime('500 mg'), type: 'solide', parUnite: 500, uniteNom: U_CP }
      ],
      schemas: [
        {
          id: 'anaerobie',
          indication: { fr: 'Infection à germes anaérobies', nl: 'Infectie door anaerobe kiemen' },
          mode: 'jour', unite: 'mg',
          doseMin: 20, doseUsuelle: 25, doseMax: 30,
          prises: [3], maxJour: 1500,
          duree: { fr: '7 jours', nl: '7 dagen' },
          sources: [SRC_CBIP]
        },
        {
          id: 'giardia',
          indication: { fr: 'Giardiase (lambliase)', nl: 'Giardiasis (lambliasis)' },
          mode: 'jour', unite: 'mg',
          doseMin: 15, doseUsuelle: 15, doseMax: 20,
          prises: [3], maxJour: 750,
          duree: { fr: '5 à 7 jours', nl: '5 tot 7 dagen' },
          sources: [SRC_CBIP]
        }
      ],
      precautions: [
        { fr: 'Effet antabuse : pas d’alcool (formes destinées aux adolescents).',
          nl: 'Antabuseffect: geen alcohol (vormen voor adolescenten).' },
        { fr: 'Goût métallique.', nl: 'Metaalsmaak.' }
      ],
      contreIndications: [],
      sources: [SRC_CBIP]
    },

    {
      id: 'clindamycine',
      dci: { fr: 'Clindamycine', nl: 'Clindamycine' },
      marques: ['Dalacin C', 'Clindamycine EG / Sandoz'],
      cbip: { fr: 'clindamycine', nl: 'clindamycine' },
      categorie: 'antibiotique',
      frequent: false,
      verifie: false,
      synonymes: ['lincosamide'],
      formes: [
        { id: 'gel150', nom: gelule('150 mg'), type: 'solide', parUnite: 150, uniteNom: U_GEL, pasUnite: 1 },
        { id: 'gel300', nom: gelule('300 mg'), type: 'solide', parUnite: 300, uniteNom: U_GEL, pasUnite: 1 }
      ],
      schemas: [
        {
          id: 'standard',
          indication: {
            fr: 'Infection cutanée / osseuse (alternative en cas d’allergie)',
            nl: 'Huid- / botinfectie (alternatief bij allergie)'
          },
          mode: 'jour', unite: 'mg',
          doseMin: 20, doseUsuelle: 25, doseMax: 30,
          prises: [3, 4], maxJour: 1800,
          duree: { fr: 'selon l’indication', nl: 'afhankelijk van de indicatie' },
          note: {
            fr: 'Pas de forme liquide commercialisée en Belgique.',
            nl: 'Geen vloeibare vorm op de markt in België.'
          },
          sources: [SRC_CBIP]
        }
      ],
      precautions: [
        { fr: 'Risque de colite à Clostridioides difficile.', nl: 'Risico op Clostridioides difficile-colitis.' }
      ],
      contreIndications: [],
      sources: [SRC_CBIP]
    },

    {
      id: 'doxycycline',
      dci: { fr: 'Doxycycline', nl: 'Doxycycline' },
      marques: ['Vibratab', 'Doxytab', 'Doxycycline EG'],
      cbip: { fr: 'doxycycline', nl: 'doxycycline' },
      categorie: 'antibiotique',
      frequent: false,
      verifie: false,
      synonymes: ['tetracycline', 'lyme', 'borreliose', 'ziekte van lyme'],
      formes: [
        { id: 'cp100', nom: comprime('100 mg'), type: 'solide', parUnite: 100, uniteNom: U_CP }
      ],
      schemas: [
        {
          id: 'standard',
          indication: {
            fr: 'Borréliose de Lyme, pneumonie atypique (à partir de 8 ans)',
            nl: 'Ziekte van Lyme, atypische pneumonie (vanaf 8 jaar)'
          },
          mode: 'jour', unite: 'mg',
          doseMin: 4, doseUsuelle: 4, doseMax: 4,
          prises: [2, 1], maxJour: 200,
          ageMinMois: 96,
          duree: { fr: '10 à 21 jours selon l’indication', nl: '10 tot 21 dagen afhankelijk van de indicatie' },
          note: {
            fr: 'Dose de charge possible le 1er jour selon l’indication.',
            nl: 'Oplaaddosis mogelijk op dag 1 afhankelijk van de indicatie.'
          },
          sources: [SRC_BAPCOC, SRC_CBIP]
        }
      ],
      precautions: [
        { fr: 'Photosensibilité.', nl: 'Fotosensibilisatie.' },
        { fr: 'À prendre debout avec un grand verre d’eau.', nl: 'Rechtstaand innemen met een groot glas water.' }
      ],
      contreIndications: [
        { fr: 'Enfant de moins de 8 ans (coloration dentaire), sauf indication vitale.',
          nl: 'Kind jonger dan 8 jaar (tandverkleuring), behalve bij vitale indicatie.' }
      ],
      sources: [SRC_BAPCOC, SRC_CBIP]
    },

    /* ============================================================== */
    /* ANTALGIQUES / ANTIPYRÉTIQUES                                   */
    /* ============================================================== */
    {
      id: 'paracetamol',
      dci: { fr: 'Paracétamol', nl: 'Paracetamol' },
      marques: ['Perdolan', 'Dafalgan', 'Panadol', 'Paracetamol EG / Sandoz / Teva'],
      cbip: { fr: 'paracétamol', nl: 'paracetamol' },
      categorie: 'antalgique',
      frequent: true,
      verifie: false,
      synonymes: ['fievre', 'acetaminophene', 'douleur', 'koorts', 'pijn'],
      formes: [
        { id: 'sirop30', nom: { fr: 'Sirop pédiatrique 30 mg / ml', nl: 'Pediatrische siroop 30 mg / ml' }, type: 'liquide', parMl: 30 },
        { id: 'sirop24', nom: { fr: 'Sirop 120 mg / 5 ml (24 mg/ml)', nl: 'Siroop 120 mg / 5 ml (24 mg/ml)' }, type: 'liquide', parMl: 24 },
        { id: 'suppo100', nom: { fr: 'Suppositoire 100 mg', nl: 'Zetpil 100 mg' }, type: 'suppo', parUnite: 100, uniteNom: U_SUPPO },
        { id: 'suppo200', nom: { fr: 'Suppositoire 200 mg', nl: 'Zetpil 200 mg' }, type: 'suppo', parUnite: 200, uniteNom: U_SUPPO },
        { id: 'suppo300', nom: { fr: 'Suppositoire 300 mg', nl: 'Zetpil 300 mg' }, type: 'suppo', parUnite: 300, uniteNom: U_SUPPO },
        { id: 'cp500', nom: comprime('500 mg'), type: 'solide', parUnite: 500, uniteNom: U_CP }
      ],
      schemas: [
        {
          id: 'standard',
          indication: { fr: 'Fièvre / douleur', nl: 'Koorts / pijn' },
          mode: 'prise', unite: 'mg',
          doseMin: 10, doseUsuelle: 15, doseMax: 15,
          prises: [4, 3], maxJour: 4000, maxPrise: 1000,
          maxParKgJour: 60,
          duree: { fr: 'selon les symptômes', nl: 'afhankelijk van de symptomen' },
          note: {
            fr: '15 mg/kg toutes les 6 h ou 10 mg/kg toutes les 4 h. Maximum 60 mg/kg/j.',
            nl: '15 mg/kg om de 6 u of 10 mg/kg om de 4 u. Maximum 60 mg/kg/dag.'
          },
          sources: [SRC_CBIP]
        }
      ],
      precautions: [
        { fr: 'Premier choix contre la fièvre chez l’enfant (CBIP).', nl: 'Eerste keuze bij koorts bij kinderen (BCFI).' },
        { fr: 'Attention au cumul avec les spécialités combinées contenant du paracétamol.',
          nl: 'Let op cumulatie met combinatiepreparaten die paracetamol bevatten.' }
      ],
      contreIndications: [
        { fr: 'Insuffisance hépatique sévère.', nl: 'Ernstige leverinsufficiëntie.' }
      ],
      sources: [SRC_CBIP]
    },

    {
      id: 'ibuprofene',
      dci: { fr: 'Ibuprofène', nl: 'Ibuprofen' },
      marques: ['Nurofen', 'Junifen', 'Brufen', 'Ibuprofen EG / Sandoz / Teva'],
      cbip: { fr: 'ibuprofène', nl: 'ibuprofen' },
      categorie: 'antalgique',
      frequent: true,
      verifie: false,
      synonymes: ['AINS', 'fievre', 'douleur', 'NSAID', 'koorts', 'pijn'],
      formes: [
        { id: 'sirop20', nom: { fr: 'Suspension 100 mg / 5 ml (20 mg/ml)', nl: 'Suspensie 100 mg / 5 ml (20 mg/ml)' }, type: 'liquide', parMl: 20 },
        { id: 'sirop40', nom: { fr: 'Suspension 200 mg / 5 ml (40 mg/ml)', nl: 'Suspensie 200 mg / 5 ml (40 mg/ml)' }, type: 'liquide', parMl: 40 },
        { id: 'cp200', nom: comprime('200 mg'), type: 'solide', parUnite: 200, uniteNom: U_CP },
        { id: 'cp400', nom: comprime('400 mg'), type: 'solide', parUnite: 400, uniteNom: U_CP }
      ],
      schemas: [
        {
          id: 'standard',
          indication: { fr: 'Fièvre / douleur', nl: 'Koorts / pijn' },
          mode: 'prise', unite: 'mg',
          doseMin: 5, doseUsuelle: 10, doseMax: 10,
          prises: [3, 4], maxJour: 1200, maxPrise: 400,
          maxParKgJour: 30,
          ageMinMois: 3, poidsMinKg: 5,
          duree: { fr: 'le plus court possible', nl: 'zo kort mogelijk' },
          note: {
            fr: 'Maximum 10 mg/kg par prise et 30 mg/kg/j.',
            nl: 'Maximum 10 mg/kg per inname en 30 mg/kg/dag.'
          },
          sources: [SRC_CBIP]
        }
      ],
      precautions: [
        { fr: 'Risque rénal accru en cas de déshydratation (gastro-entérite, fièvre prolongée, faible apport hydrique).',
          nl: 'Verhoogd nierrisico bij dehydratatie (gastro-enteritis, langdurige koorts, geringe vochtinname).' },
        { fr: 'À éviter en cas de varicelle (risque d’infection cutanée invasive à streptocoque A).',
          nl: 'Te vermijden bij waterpokken (risico op invasieve groep A-streptokokkenhuidinfectie).' },
        { fr: 'À prendre pendant le repas.', nl: 'Innemen tijdens de maaltijd.' }
      ],
      contreIndications: [
        { fr: 'Enfant de moins de 3 mois ou de moins de 5 kg.', nl: 'Kind jonger dan 3 maanden of lichter dan 5 kg.' },
        { fr: 'Ulcère gastro-duodénal évolutif.', nl: 'Actief maag-darmulcus.' },
        { fr: 'Déshydratation, insuffisance rénale.', nl: 'Dehydratatie, nierinsufficiëntie.' }
      ],
      sources: [SRC_CBIP]
    },

    /* ============================================================== */
    /* CORTICOÏDES                                                    */
    /* ============================================================== */
    {
      id: 'prednisolone',
      dci: { fr: 'Prednisolone', nl: 'Prednisolon' },
      marques: ['Prednisolone EG', 'Solupred (disponibilité à vérifier)'],
      cbip: { fr: 'prednisolone', nl: 'prednisolon' },
      categorie: 'corticoide',
      frequent: true,
      verifie: false,
      synonymes: ['corticoide', 'asthme', 'crise', 'astma', 'corticosteroid'],
      formes: [
        { id: 'cp5', nom: comprime('5 mg'), type: 'solide', parUnite: 5, uniteNom: U_CP },
        { id: 'cp20', nom: comprime('20 mg'), type: 'solide', parUnite: 20, uniteNom: U_CP }
      ],
      schemas: [
        {
          id: 'asthme',
          indication: { fr: 'Exacerbation d’asthme', nl: 'Astma-exacerbatie' },
          mode: 'jour', unite: 'mg',
          doseMin: 1, doseUsuelle: 1, doseMax: 2,
          prises: [1], maxJour: 40,
          duree: { fr: '3 à 5 jours', nl: '3 tot 5 dagen' },
          note: {
            fr: 'Pas de décroissance nécessaire pour une cure courte.',
            nl: 'Geen afbouw nodig bij een korte kuur.'
          },
          sources: [SRC_CBIP]
        }
      ],
      precautions: [{ fr: 'À prendre le matin.', nl: '’s Ochtends innemen.' }],
      contreIndications: [{ fr: 'Infection non contrôlée.', nl: 'Niet-gecontroleerde infectie.' }],
      sources: [SRC_CBIP]
    },

    {
      id: 'methylprednisolone',
      dci: { fr: 'Méthylprednisolone', nl: 'Methylprednisolon' },
      marques: ['Medrol'],
      cbip: { fr: 'méthylprednisolone', nl: 'methylprednisolon' },
      categorie: 'corticoide',
      frequent: true,
      verifie: false,
      synonymes: ['medrol', 'corticoide', 'corticosteroid'],
      formes: [
        { id: 'cp4', nom: comprime('4 mg'), type: 'solide', parUnite: 4, uniteNom: U_CP },
        { id: 'cp16', nom: comprime('16 mg'), type: 'solide', parUnite: 16, uniteNom: U_CP },
        { id: 'cp32', nom: comprime('32 mg'), type: 'solide', parUnite: 32, uniteNom: U_CP }
      ],
      schemas: [
        {
          id: 'asthme',
          indication: { fr: 'Exacerbation d’asthme / inflammation', nl: 'Astma-exacerbatie / ontsteking' },
          mode: 'jour', unite: 'mg',
          doseMin: 0.8, doseUsuelle: 1, doseMax: 1.6,
          prises: [1], maxJour: 32,
          duree: { fr: '3 à 5 jours', nl: '3 tot 5 dagen' },
          note: {
            fr: '4 mg de méthylprednisolone ≈ 5 mg de prednisolone.',
            nl: '4 mg methylprednisolon ≈ 5 mg prednisolon.'
          },
          sources: [SRC_CBIP]
        }
      ],
      precautions: [{ fr: 'À prendre le matin.', nl: '’s Ochtends innemen.' }],
      contreIndications: [{ fr: 'Infection non contrôlée.', nl: 'Niet-gecontroleerde infectie.' }],
      sources: [SRC_CBIP]
    },

    {
      id: 'dexamethasone',
      dci: { fr: 'Dexaméthasone', nl: 'Dexamethason' },
      marques: ['Dexamethasone (forme orale : vérifier la disponibilité)', 'Aacidexam'],
      cbip: { fr: 'dexaméthasone', nl: 'dexamethason' },
      categorie: 'corticoide',
      frequent: false,
      verifie: false,
      synonymes: ['laryngite', 'croup', 'pseudo-croup', 'valse kroep', 'laryngitis'],
      formes: [
        { id: 'cp05', nom: comprime('0,5 mg'), type: 'solide', parUnite: 0.5, uniteNom: U_CP },
        { id: 'sol4', nom: { fr: 'Solution 4 mg / ml (ampoule, per os)', nl: 'Oplossing 4 mg / ml (ampul, per os)' }, type: 'liquide', parMl: 4 }
      ],
      schemas: [
        {
          id: 'laryngite',
          indication: {
            fr: 'Laryngite sous-glottique (pseudo-croup) — dose unique',
            nl: 'Subglottische laryngitis (valse kroep) — eenmalige dosis'
          },
          mode: 'unique', unite: 'mg',
          doseMin: 0.15, doseUsuelle: 0.15, doseMax: 0.6,
          prises: [1], maxJour: 16,
          duree: {
            fr: 'dose unique, à répéter éventuellement après 24 h',
            nl: 'eenmalige dosis, eventueel te herhalen na 24 u'
          },
          note: {
            fr: '0,15 mg/kg semble aussi efficace que 0,6 mg/kg (revue Cochrane).',
            nl: '0,15 mg/kg lijkt even doeltreffend als 0,6 mg/kg (Cochrane-review).'
          },
          sources: [SRC_CBIP, {
            label: { fr: 'Cochrane — Glucocorticoïdes pour la laryngite chez l’enfant',
                     nl: 'Cochrane — Glucocorticoïden bij kroep bij kinderen' },
            url: 'https://www.cochrane.org/evidence/CD001955_glucocorticoids-croup-children'
          }]
        }
      ],
      precautions: [],
      contreIndications: [],
      sources: [SRC_CBIP]
    },

    /* ============================================================== */
    /* ALLERGIE                                                       */
    /* ============================================================== */
    {
      id: 'cetirizine',
      dci: { fr: 'Cétirizine', nl: 'Cetirizine' },
      marques: ['Zyrtec', 'Cetirizine EG / Sandoz / Teva'],
      cbip: { fr: 'cétirizine', nl: 'cetirizine' },
      categorie: 'allergie',
      frequent: true,
      verifie: false,
      synonymes: ['antihistaminique', 'urticaire', 'rhinite', 'antihistaminicum', 'netelroos', 'hooikoorts'],
      formes: [
        { id: 'gouttes', nom: { fr: 'Gouttes 10 mg / ml', nl: 'Druppels 10 mg / ml' }, type: 'liquide', parMl: 10,
          note: { fr: '1 ml = 20 gouttes, soit environ 0,5 mg par goutte.',
                  nl: '1 ml = 20 druppels, dus ongeveer 0,5 mg per druppel.' } },
        { id: 'sirop', nom: { fr: 'Sirop 1 mg / ml', nl: 'Siroop 1 mg / ml' }, type: 'liquide', parMl: 1 },
        { id: 'cp10', nom: comprime('10 mg'), type: 'solide', parUnite: 10, uniteNom: U_CP }
      ],
      schemas: [
        {
          id: 'paliers',
          indication: {
            fr: 'Rhinite allergique, urticaire — dose fixe par âge',
            nl: 'Allergische rinitis, urticaria — vaste dosis per leeftijd'
          },
          mode: 'paliers', unite: 'mg', critere: 'age',
          paliers: [
            { label: { fr: '2 à 5 ans', nl: '2 tot 5 jaar' }, min: 24, max: 71, dose: 5, prises: 2,
              libelle: { fr: '2,5 mg 2×/j', nl: '2,5 mg 2×/dag' } },
            { label: { fr: '6 à 11 ans', nl: '6 tot 11 jaar' }, min: 72, max: 143, dose: 10, prises: 2,
              libelle: { fr: '5 mg 2×/j', nl: '5 mg 2×/dag' } },
            { label: { fr: '12 ans et plus', nl: '12 jaar en ouder' }, min: 144, max: null, dose: 10, prises: 1,
              libelle: { fr: '10 mg 1×/j', nl: '10 mg 1×/dag' } }
          ],
          duree: { fr: 'selon les symptômes', nl: 'afhankelijk van de symptomen' },
          note: {
            fr: 'Dose fixe par tranche d’âge : elle ne dépend pas du poids.',
            nl: 'Vaste dosis per leeftijdsgroep: ze hangt niet af van het gewicht.'
          },
          sources: [SRC_CBIP, SRC_RCP]
        }
      ],
      precautions: [
        { fr: 'Somnolence possible malgré le caractère « peu sédatif ».',
          nl: 'Slaperigheid mogelijk ondanks het « weinig sederend » karakter.' }
      ],
      contreIndications: [
        { fr: 'Enfant de moins de 2 ans (selon la forme).', nl: 'Kind jonger dan 2 jaar (afhankelijk van de vorm).' }
      ],
      sources: [SRC_CBIP]
    },

    {
      id: 'desloratadine',
      dci: { fr: 'Desloratadine', nl: 'Desloratadine' },
      marques: ['Aerius', 'Desloratadine EG / Sandoz'],
      cbip: { fr: 'desloratadine', nl: 'desloratadine' },
      categorie: 'allergie',
      frequent: false,
      verifie: false,
      synonymes: ['antihistaminique', 'rhinite', 'antihistaminicum', 'hooikoorts'],
      formes: [
        { id: 'sirop', nom: { fr: 'Sirop 0,5 mg / ml', nl: 'Siroop 0,5 mg / ml' }, type: 'liquide', parMl: 0.5 },
        { id: 'cp5', nom: comprime('5 mg'), type: 'solide', parUnite: 5, uniteNom: U_CP }
      ],
      schemas: [
        {
          id: 'paliers',
          indication: {
            fr: 'Rhinite allergique, urticaire — dose fixe par âge',
            nl: 'Allergische rinitis, urticaria — vaste dosis per leeftijd'
          },
          mode: 'paliers', unite: 'mg', critere: 'age',
          paliers: [
            { label: { fr: '1 à 5 ans', nl: '1 tot 5 jaar' }, min: 12, max: 71, dose: 1.25, prises: 1 },
            { label: { fr: '6 à 11 ans', nl: '6 tot 11 jaar' }, min: 72, max: 143, dose: 2.5, prises: 1 },
            { label: { fr: '12 ans et plus', nl: '12 jaar en ouder' }, min: 144, max: null, dose: 5, prises: 1 }
          ],
          duree: { fr: 'selon les symptômes', nl: 'afhankelijk van de symptomen' },
          sources: [SRC_CBIP, SRC_RCP]
        }
      ],
      precautions: [],
      contreIndications: [],
      sources: [SRC_CBIP]
    },

    {
      id: 'hydroxyzine',
      dci: { fr: 'Hydroxyzine', nl: 'Hydroxyzine' },
      marques: ['Atarax'],
      cbip: { fr: 'hydroxyzine', nl: 'hydroxyzine' },
      categorie: 'allergie',
      frequent: false,
      verifie: false,
      synonymes: ['prurit', 'sedatif', 'antihistaminique', 'jeuk', 'kalmerend'],
      formes: [
        { id: 'sirop', nom: { fr: 'Sirop 2 mg / ml', nl: 'Siroop 2 mg / ml' }, type: 'liquide', parMl: 2 },
        { id: 'cp25', nom: comprime('25 mg'), type: 'solide', parUnite: 25, uniteNom: U_CP }
      ],
      schemas: [
        {
          id: 'prurit',
          indication: { fr: 'Prurit', nl: 'Jeuk' },
          mode: 'jour', unite: 'mg',
          doseMin: 1, doseUsuelle: 1, doseMax: 2,
          prises: [3, 2], maxJour: 100,
          ageMinMois: 12,
          duree: { fr: 'de courte durée', nl: 'van korte duur' },
          sources: [SRC_CBIP]
        }
      ],
      precautions: [
        { fr: 'Allongement du QT : dose la plus faible et la plus courte possible.',
          nl: 'QT-verlenging: laagste dosis en kortst mogelijke duur.' },
        { fr: 'Sédation.', nl: 'Sedatie.' }
      ],
      contreIndications: [
        { fr: 'Allongement du QT connu.', nl: 'Gekende QT-verlenging.' },
        { fr: 'Enfant de moins de 1 an.', nl: 'Kind jonger dan 1 jaar.' }
      ],
      sources: [SRC_CBIP]
    },

    /* ============================================================== */
    /* RESPIRATOIRE                                                   */
    /* ============================================================== */
    {
      id: 'salbutamol',
      dci: { fr: 'Salbutamol', nl: 'Salbutamol' },
      marques: ['Ventolin', 'Airomir', 'Docsalbuta'],
      cbip: { fr: 'salbutamol', nl: 'salbutamol' },
      categorie: 'respiratoire',
      frequent: true,
      verifie: false,
      synonymes: ['asthme', 'bronchodilatateur', 'aerosol', 'ventoline', 'astma', 'puffer'],
      formes: [
        { id: 'mdi', nom: { fr: 'Aérosol-doseur 100 µg / bouffée (+ chambre d’inhalation)',
                            nl: 'Dosisaerosol 100 µg / pufje (+ voorzetkamer)' },
          type: 'autre', parUnite: 100, uniteNom: U_BOUFFEE },
        { id: 'neb25', nom: { fr: 'Solution pour nébulisation 2,5 mg / 2,5 ml',
                              nl: 'Verneveloplossing 2,5 mg / 2,5 ml' }, type: 'liquide', parMl: 1 }
      ],
      schemas: [
        {
          id: 'crise-mdi',
          indication: {
            fr: 'Crise d’asthme — aérosol-doseur avec chambre d’inhalation',
            nl: 'Astma-aanval — dosisaerosol met voorzetkamer'
          },
          mode: 'paliers', unite: 'µg', critere: 'age', prn: true,
          paliers: [
            { label: { fr: 'Moins de 6 ans', nl: 'Jonger dan 6 jaar' }, min: 0, max: 71, dose: 200, prises: 1,
              libelle: { fr: '2 bouffées', nl: '2 pufjes' } },
            { label: { fr: '6 ans et plus', nl: '6 jaar en ouder' }, min: 72, max: null, dose: 400, prises: 1,
              libelle: { fr: '4 bouffées', nl: '4 pufjes' } }
          ],
          duree: { fr: 'à répéter selon la réponse clinique', nl: 'te herhalen volgens klinische respons' },
          note: {
            fr: 'En crise : 2 à 10 bouffées, à répéter toutes les 20 min pendant la 1re heure selon la sévérité. Toujours utiliser une chambre d’inhalation.',
            nl: 'Bij een aanval: 2 tot 10 pufjes, te herhalen om de 20 min tijdens het eerste uur naargelang de ernst. Gebruik steeds een voorzetkamer.'
          },
          sources: [SRC_CBIP]
        },
        {
          id: 'neb',
          indication: { fr: 'Nébulisation', nl: 'Vernevelen' },
          mode: 'paliers', unite: 'mg', critere: 'poids', prn: true,
          paliers: [
            { label: { fr: 'Moins de 20 kg', nl: 'Minder dan 20 kg' }, min: 0, max: 19.99, dose: 2.5, prises: 1,
              libelle: { fr: '2,5 mg par nébulisation', nl: '2,5 mg per verneveling' } },
            { label: { fr: '20 kg et plus', nl: '20 kg en meer' }, min: 20, max: null, dose: 5, prises: 1,
              libelle: { fr: '5 mg par nébulisation', nl: '5 mg per verneveling' } }
          ],
          duree: { fr: 'à répéter selon la réponse clinique', nl: 'te herhalen volgens klinische respons' },
          sources: [SRC_CBIP]
        }
      ],
      precautions: [
        { fr: 'Tremblements, tachycardie.', nl: 'Tremor, tachycardie.' },
        { fr: 'Vérifier la technique d’inhalation.', nl: 'Controleer de inhalatietechniek.' }
      ],
      contreIndications: [],
      sources: [SRC_CBIP]
    },

    {
      id: 'montelukast',
      dci: { fr: 'Montélukast', nl: 'Montelukast' },
      marques: ['Singulair', 'Montelukast EG / Sandoz / Teva'],
      cbip: { fr: 'montélukast', nl: 'montelukast' },
      categorie: 'respiratoire',
      frequent: false,
      verifie: false,
      synonymes: ['asthme', 'antileucotriene', 'astma'],
      formes: [
        { id: 'gran4', nom: { fr: 'Granulés 4 mg', nl: 'Granulaat 4 mg' }, type: 'sachet', parUnite: 4, uniteNom: U_SACHET },
        { id: 'cp4', nom: { fr: 'Comprimé à croquer 4 mg', nl: 'Kauwtablet 4 mg' }, type: 'solide', parUnite: 4, uniteNom: U_CP },
        { id: 'cp5', nom: { fr: 'Comprimé à croquer 5 mg', nl: 'Kauwtablet 5 mg' }, type: 'solide', parUnite: 5, uniteNom: U_CP },
        { id: 'cp10', nom: comprime('10 mg'), type: 'solide', parUnite: 10, uniteNom: U_CP }
      ],
      schemas: [
        {
          id: 'paliers',
          indication: { fr: 'Asthme — dose fixe par âge', nl: 'Astma — vaste dosis per leeftijd' },
          mode: 'paliers', unite: 'mg', critere: 'age',
          paliers: [
            { label: { fr: '6 mois à 5 ans', nl: '6 maanden tot 5 jaar' }, min: 6, max: 71, dose: 4, prises: 1 },
            { label: { fr: '6 à 14 ans', nl: '6 tot 14 jaar' }, min: 72, max: 179, dose: 5, prises: 1 },
            { label: { fr: '15 ans et plus', nl: '15 jaar en ouder' }, min: 180, max: null, dose: 10, prises: 1 }
          ],
          duree: { fr: 'traitement de fond, le soir', nl: 'onderhoudsbehandeling, ’s avonds' },
          sources: [SRC_CBIP, SRC_RCP]
        }
      ],
      precautions: [
        { fr: 'Effets neuropsychiatriques rapportés (cauchemars, agitation, troubles de l’humeur) : en informer les parents.',
          nl: 'Neuropsychiatrische effecten gemeld (nachtmerries, agitatie, stemmingsstoornissen): informeer de ouders.' }
      ],
      contreIndications: [],
      sources: [SRC_CBIP]
    },

    /* ============================================================== */
    /* DIGESTIF                                                       */
    /* ============================================================== */
    {
      id: 'ondansetron',
      dci: { fr: 'Ondansétron', nl: 'Ondansetron' },
      marques: ['Zofran', 'Ondansetron EG / Sandoz'],
      cbip: { fr: 'ondansétron', nl: 'ondansetron' },
      categorie: 'digestif',
      frequent: false,
      verifie: false,
      synonymes: ['vomissement', 'gastro', 'antiemetique', 'braken', 'buikgriep'],
      formes: [
        { id: 'sirop', nom: { fr: 'Sirop 4 mg / 5 ml', nl: 'Siroop 4 mg / 5 ml' }, type: 'liquide', parMl: 0.8 },
        { id: 'lyoc4', nom: { fr: 'Lyophilisat oral 4 mg', nl: 'Oraal lyofilisaat 4 mg' }, type: 'solide', parUnite: 4, uniteNom: U_LYOC, pasUnite: 1 },
        { id: 'lyoc8', nom: { fr: 'Lyophilisat oral 8 mg', nl: 'Oraal lyofilisaat 8 mg' }, type: 'solide', parUnite: 8, uniteNom: U_LYOC, pasUnite: 1 }
      ],
      schemas: [
        {
          id: 'gastro',
          indication: {
            fr: 'Vomissements de la gastro-entérite — dose unique',
            nl: 'Braken bij gastro-enteritis — eenmalige dosis'
          },
          mode: 'unique', unite: 'mg',
          doseMin: 0.15, doseUsuelle: 0.15, doseMax: 0.2,
          prises: [1], maxJour: 8, maxPrise: 4,
          ageMinMois: 6,
          duree: { fr: 'dose unique', nl: 'eenmalige dosis' },
          note: {
            fr: 'Usage hors RCP fréquent en pédiatrie pour faciliter la réhydratation orale.',
            nl: 'Frequent off-labelgebruik in de pediatrie om orale rehydratatie mogelijk te maken.'
          },
          sources: [SRC_CBIP]
        }
      ],
      precautions: [QT_LONG, { fr: 'Constipation.', nl: 'Constipatie.' }],
      contreIndications: [
        { fr: 'Allongement congénital du QT.', nl: 'Aangeboren QT-verlenging.' }
      ],
      sources: [SRC_CBIP]
    },

    {
      id: 'domperidone',
      dci: { fr: 'Dompéridone', nl: 'Domperidon' },
      marques: ['Motilium', 'Domperidone EG / Sandoz'],
      cbip: { fr: 'dompéridone', nl: 'domperidon' },
      categorie: 'digestif',
      frequent: false,
      verifie: false,
      synonymes: ['vomissement', 'antiemetique', 'motilium', 'braken'],
      formes: [
        { id: 'susp', nom: { fr: 'Suspension 1 mg / ml', nl: 'Suspensie 1 mg / ml' }, type: 'liquide', parMl: 1 },
        { id: 'cp10', nom: comprime('10 mg'), type: 'solide', parUnite: 10, uniteNom: U_CP }
      ],
      schemas: [
        {
          id: 'standard',
          indication: { fr: 'Nausées et vomissements', nl: 'Misselijkheid en braken' },
          mode: 'prise', unite: 'mg',
          doseMin: 0.25, doseUsuelle: 0.25, doseMax: 0.25,
          prises: [3], maxJour: 30, maxPrise: 10,
          maxParKgJour: 0.75,
          duree: { fr: 'maximum 7 jours', nl: 'maximaal 7 dagen' },
          note: {
            fr: 'L’EMA a restreint l’usage : durée la plus courte, dose la plus faible.',
            nl: 'Het EMA heeft het gebruik beperkt: kortste duur, laagste dosis.'
          },
          sources: [SRC_CBIP]
        }
      ],
      precautions: [
        { fr: 'Allongement du QT et arythmies : indication à peser, durée limitée à 7 jours.',
          nl: 'QT-verlenging en aritmieën: indicatie afwegen, duur beperkt tot 7 dagen.' }
      ],
      contreIndications: [
        { fr: 'Allongement du QT.', nl: 'QT-verlenging.' },
        { fr: 'Insuffisance hépatique modérée à sévère.', nl: 'Matige tot ernstige leverinsufficiëntie.' },
        { fr: 'Association aux inhibiteurs puissants du CYP3A4.', nl: 'Combinatie met krachtige CYP3A4-remmers.' }
      ],
      sources: [SRC_CBIP]
    },

    {
      id: 'macrogol',
      dci: { fr: 'Macrogol (polyéthylèneglycol)', nl: 'Macrogol (polyethyleenglycol)' },
      marques: ['Movicol Junior', 'Forlax Junior', 'Transipeg'],
      cbip: { fr: 'macrogol', nl: 'macrogol' },
      categorie: 'digestif',
      frequent: true,
      verifie: false,
      synonymes: ['constipation', 'laxatif', 'PEG', 'obstipatie', 'laxeermiddel'],
      formes: [
        { id: 'sachet4', nom: { fr: 'Sachet pédiatrique 4 g', nl: 'Pediatrisch zakje 4 g' }, type: 'sachet', parUnite: 4, uniteNom: U_SACHET },
        { id: 'sachet10', nom: { fr: 'Sachet adulte 10 g', nl: 'Zakje voor volwassenen 10 g' }, type: 'sachet', parUnite: 10, uniteNom: U_SACHET }
      ],
      schemas: [
        {
          id: 'entretien',
          indication: {
            fr: 'Constipation — traitement d’entretien',
            nl: 'Obstipatie — onderhoudsbehandeling'
          },
          mode: 'paliers', unite: 'g', critere: 'age',
          paliers: [
            { label: { fr: '6 mois à 1 an', nl: '6 maanden tot 1 jaar' }, min: 6, max: 23, dose: 4, prises: 1,
              libelle: { fr: '1 sachet de 4 g', nl: '1 zakje van 4 g' } },
            { label: { fr: '1 à 4 ans', nl: '1 tot 4 jaar' }, min: 24, max: 47, dose: 8, prises: 1,
              libelle: { fr: '1 à 2 sachets de 4 g', nl: '1 tot 2 zakjes van 4 g' } },
            { label: { fr: '4 à 8 ans', nl: '4 tot 8 jaar' }, min: 48, max: 95, dose: 8, prises: 1,
              libelle: { fr: '2 sachets de 4 g', nl: '2 zakjes van 4 g' } },
            { label: { fr: '8 ans et plus', nl: '8 jaar en ouder' }, min: 96, max: null, dose: 10, prises: 1,
              libelle: { fr: '1 sachet adulte', nl: '1 zakje voor volwassenen' } }
          ],
          duree: { fr: 'plusieurs semaines à plusieurs mois', nl: 'enkele weken tot enkele maanden' },
          note: {
            fr: 'Titrer selon la consistance des selles. La désimpaction fécale utilise des doses nettement plus élevées.',
            nl: 'Titreren volgens de consistentie van de stoelgang. Fecale desimpactie vereist duidelijk hogere doses.'
          },
          sources: [SRC_CBIP, SRC_RCP]
        }
      ],
      precautions: [
        { fr: 'Bien diluer et assurer un apport hydrique suffisant.',
          nl: 'Goed verdunnen en voldoende vochtinname verzekeren.' }
      ],
      contreIndications: [{ fr: 'Occlusion intestinale.', nl: 'Darmobstructie.' }],
      sources: [SRC_CBIP]
    },

    {
      id: 'racecadotril',
      dci: { fr: 'Racécadotril', nl: 'Racecadotril' },
      marques: ['Tiorfix'],
      cbip: { fr: 'racécadotril', nl: 'racecadotril' },
      categorie: 'digestif',
      frequent: false,
      verifie: false,
      synonymes: ['diarrhee', 'gastro', 'diarree', 'buikgriep'],
      formes: [
        { id: 'sachet10', nom: { fr: 'Sachet 10 mg (nourrisson)', nl: 'Zakje 10 mg (zuigeling)' }, type: 'sachet', parUnite: 10, uniteNom: U_SACHET },
        { id: 'sachet30', nom: { fr: 'Sachet 30 mg (enfant)', nl: 'Zakje 30 mg (kind)' }, type: 'sachet', parUnite: 30, uniteNom: U_SACHET }
      ],
      schemas: [
        {
          id: 'diarrhee',
          indication: {
            fr: 'Diarrhée aiguë — appoint à la réhydratation',
            nl: 'Acute diarree — aanvulling op de rehydratatie'
          },
          mode: 'prise', unite: 'mg',
          doseMin: 1.5, doseUsuelle: 1.5, doseMax: 1.5,
          prises: [3], maxJour: 300,
          ageMinMois: 3,
          duree: { fr: 'maximum 7 jours', nl: 'maximaal 7 dagen' },
          note: {
            fr: 'Ne remplace jamais la réhydratation orale, qui reste le traitement essentiel.',
            nl: 'Vervangt nooit de orale rehydratatie, die de essentiële behandeling blijft.'
          },
          sources: [SRC_CBIP, SRC_RCP]
        }
      ],
      precautions: [],
      contreIndications: [
        { fr: 'Nourrisson de moins de 3 mois.', nl: 'Zuigeling jonger dan 3 maanden.' }
      ],
      sources: [SRC_CBIP]
    },

    {
      id: 'omeprazole',
      dci: { fr: 'Oméprazole', nl: 'Omeprazol' },
      marques: ['Losec', 'Omeprazole EG / Sandoz / Teva'],
      cbip: { fr: 'oméprazole', nl: 'omeprazol' },
      categorie: 'digestif',
      frequent: false,
      verifie: false,
      synonymes: ['reflux', 'RGO', 'IPP', 'PPI', 'maagzuur'],
      formes: [
        { id: 'gel10', nom: { fr: 'Gélule / comprimé 10 mg', nl: 'Capsule / tablet 10 mg' }, type: 'solide', parUnite: 10, uniteNom: U_GEL, pasUnite: 1 },
        { id: 'gel20', nom: { fr: 'Gélule / comprimé 20 mg', nl: 'Capsule / tablet 20 mg' }, type: 'solide', parUnite: 20, uniteNom: U_GEL, pasUnite: 1 },
        { id: 'gel40', nom: { fr: 'Gélule / comprimé 40 mg', nl: 'Capsule / tablet 40 mg' }, type: 'solide', parUnite: 40, uniteNom: U_GEL, pasUnite: 1 }
      ],
      schemas: [
        {
          id: 'rgo',
          indication: {
            fr: 'Reflux gastro-œsophagien symptomatique',
            nl: 'Symptomatische gastro-oesofageale reflux'
          },
          mode: 'jour', unite: 'mg',
          doseMin: 0.7, doseUsuelle: 1, doseMax: 1.4,
          prises: [1], maxJour: 40,
          ageMinMois: 12,
          duree: { fr: '4 à 8 semaines, puis réévaluer', nl: '4 tot 8 weken, daarna herevalueren' },
          note: {
            fr: 'À prendre 30 min avant le repas. Réévaluer systématiquement : usage souvent excessif chez le nourrisson.',
            nl: '30 min voor de maaltijd innemen. Systematisch herevalueren: vaak overmatig gebruik bij zuigelingen.'
          },
          sources: [SRC_CBIP]
        }
      ],
      precautions: [
        { fr: 'Ne pas prolonger sans réévaluation.', nl: 'Niet verlengen zonder herevaluatie.' }
      ],
      contreIndications: [],
      sources: [SRC_CBIP]
    },

    /* ============================================================== */
    /* ANTIFONGIQUES                                                  */
    /* ============================================================== */
    {
      id: 'nystatine',
      dci: { fr: 'Nystatine', nl: 'Nystatine' },
      marques: ['Nystatine', 'Mycostatine (disponibilité à vérifier)'],
      cbip: { fr: 'nystatine', nl: 'nystatine' },
      categorie: 'antifongique',
      frequent: false,
      verifie: false,
      synonymes: ['muguet', 'candidose', 'spruw', 'candidiasis'],
      formes: [
        { id: 'susp', nom: { fr: 'Suspension orale 100 000 UI / ml', nl: 'Orale suspensie 100 000 IE / ml' }, type: 'liquide', parMl: 100000 }
      ],
      schemas: [
        {
          id: 'muguet',
          indication: { fr: 'Muguet buccal — dose fixe', nl: 'Orale spruw — vaste dosis' },
          mode: 'paliers', unite: 'UI', critere: 'age',
          paliers: [
            { label: { fr: 'Nourrisson', nl: 'Zuigeling' }, min: 0, max: 23, dose: 400000, prises: 4,
              libelle: { fr: '100 000 UI (1 ml) 4×/j', nl: '100 000 IE (1 ml) 4×/dag' } },
            { label: { fr: 'Enfant', nl: 'Kind' }, min: 24, max: null, dose: 800000, prises: 4,
              libelle: { fr: '200 000 UI (2 ml) 4×/j', nl: '200 000 IE (2 ml) 4×/dag' } }
          ],
          duree: {
            fr: '7 à 14 jours, à poursuivre 48 h après la guérison',
            nl: '7 tot 14 dagen, 48 u na genezing voort te zetten'
          },
          note: {
            fr: 'Badigeonner la muqueuse ; garder en bouche le plus longtemps possible avant d’avaler.',
            nl: 'Het slijmvlies bestrijken; zo lang mogelijk in de mond houden voor het inslikken.'
          },
          sources: [SRC_CBIP, SRC_RCP]
        }
      ],
      precautions: [
        { fr: 'Traiter simultanément les tétines et le mamelon en cas d’allaitement.',
          nl: 'Behandel tegelijk de spenen en de tepel bij borstvoeding.' }
      ],
      contreIndications: [],
      sources: [SRC_CBIP]
    },

    {
      id: 'miconazole-gel',
      dci: { fr: 'Miconazole (gel buccal)', nl: 'Miconazol (mondgel)' },
      marques: ['Daktarin gel oral'],
      cbip: { fr: 'miconazole', nl: 'miconazol' },
      categorie: 'antifongique',
      frequent: false,
      verifie: false,
      synonymes: ['muguet', 'candidose', 'daktarin', 'spruw'],
      formes: [
        { id: 'gel', nom: { fr: 'Gel buccal 20 mg / g', nl: 'Mondgel 20 mg / g' }, type: 'liquide', parMl: 1,
          note: { fr: 'Doses exprimées en ml de gel : la mesurette fournie contient 5 ml.',
                  nl: 'Doses uitgedrukt in ml gel: het bijgeleverde maatlepeltje bevat 5 ml.' } }
      ],
      schemas: [
        {
          id: 'muguet',
          indication: { fr: 'Muguet buccal — dose fixe par âge', nl: 'Orale spruw — vaste dosis per leeftijd' },
          mode: 'paliers', unite: 'ml', critere: 'age',
          paliers: [
            { label: { fr: '4 mois à 2 ans', nl: '4 maanden tot 2 jaar' }, min: 4, max: 23, dose: 5, prises: 4,
              libelle: { fr: '1,25 ml (¼ de mesurette) 4×/j', nl: '1,25 ml (¼ maatlepeltje) 4×/dag' } },
            { label: { fr: '2 ans et plus', nl: '2 jaar en ouder' }, min: 24, max: null, dose: 10, prises: 4,
              libelle: { fr: '2,5 ml (½ mesurette) 4×/j', nl: '2,5 ml (½ maatlepeltje) 4×/dag' } }
          ],
          duree: { fr: '7 à 14 jours', nl: '7 tot 14 dagen' },
          note: {
            fr: 'Appliquer sur la muqueuse après les repas, ne pas avaler d’emblée.',
            nl: 'Na de maaltijd op het slijmvlies aanbrengen, niet meteen inslikken.'
          },
          sources: [SRC_CBIP, SRC_RCP]
        }
      ],
      precautions: [
        { fr: 'Interaction majeure avec les anticoagulants oraux.',
          nl: 'Belangrijke interactie met orale anticoagulantia.' }
      ],
      contreIndications: [
        { fr: 'Nourrisson de moins de 4 mois (risque de fausse route).',
          nl: 'Zuigeling jonger dan 4 maanden (verslikkingsrisico).' }
      ],
      sources: [SRC_CBIP]
    },

    {
      id: 'fluconazole',
      dci: { fr: 'Fluconazole', nl: 'Fluconazol' },
      marques: ['Diflucan', 'Fluconazole EG / Sandoz / Teva'],
      cbip: { fr: 'fluconazole', nl: 'fluconazol' },
      categorie: 'antifongique',
      frequent: false,
      verifie: false,
      synonymes: ['candidose', 'mycose', 'schimmel'],
      formes: [
        { id: 'susp', nom: suspOrale(50), type: 'liquide', parMl: 10 },
        { id: 'gel50', nom: gelule('50 mg'), type: 'solide', parUnite: 50, uniteNom: U_GEL, pasUnite: 1 },
        { id: 'gel150', nom: gelule('150 mg'), type: 'solide', parUnite: 150, uniteNom: U_GEL, pasUnite: 1 }
      ],
      schemas: [
        {
          id: 'muqueuse',
          indication: { fr: 'Candidose muqueuse', nl: 'Slijmvliescandidiasis' },
          mode: 'jour', unite: 'mg',
          doseMin: 3, doseUsuelle: 3, doseMax: 6,
          prises: [1], maxJour: 400,
          duree: { fr: '7 à 14 jours', nl: '7 tot 14 dagen' },
          note: {
            fr: 'Une dose de charge (double dose au 1er jour) est possible.',
            nl: 'Een oplaaddosis (dubbele dosis op dag 1) is mogelijk.'
          },
          sources: [SRC_CBIP]
        }
      ],
      precautions: [
        { fr: 'Nombreuses interactions (inhibiteur du CYP).', nl: 'Talrijke interacties (CYP-remmer).' },
        QT_LONG
      ],
      contreIndications: [],
      sources: [SRC_CBIP]
    },

    /* ============================================================== */
    /* ANTIVIRAUX                                                     */
    /* ============================================================== */
    {
      id: 'aciclovir',
      dci: { fr: 'Aciclovir', nl: 'Aciclovir' },
      marques: ['Zovirax', 'Aciclovir EG / Sandoz / Teva'],
      cbip: { fr: 'aciclovir', nl: 'aciclovir' },
      categorie: 'antiviral',
      frequent: false,
      verifie: false,
      synonymes: ['herpes', 'varicelle', 'zona', 'waterpokken', 'gordelroos'],
      formes: [
        { id: 'susp', nom: suspOrale(200), type: 'liquide', parMl: 40 },
        { id: 'cp200', nom: comprime('200 mg'), type: 'solide', parUnite: 200, uniteNom: U_CP },
        { id: 'cp800', nom: comprime('800 mg'), type: 'solide', parUnite: 800, uniteNom: U_CP }
      ],
      schemas: [
        {
          id: 'varicelle',
          indication: {
            fr: 'Varicelle (enfant à risque, dans les 24 h)',
            nl: 'Waterpokken (risicokind, binnen de 24 u)'
          },
          mode: 'prise', unite: 'mg',
          doseMin: 20, doseUsuelle: 20, doseMax: 20,
          prises: [4], maxJour: 3200, maxPrise: 800,
          duree: { fr: '5 jours', nl: '5 dagen' },
          sources: [SRC_CBIP]
        },
        {
          id: 'gingivostomatite',
          indication: { fr: 'Gingivostomatite herpétique', nl: 'Herpetische gingivostomatitis' },
          mode: 'jour', unite: 'mg',
          doseMin: 40, doseUsuelle: 60, doseMax: 80,
          prises: [4, 5], maxJour: 2000,
          duree: { fr: '5 à 7 jours', nl: '5 tot 7 dagen' },
          sources: [SRC_CBIP]
        }
      ],
      precautions: [
        { fr: 'Assurer une hydratation suffisante.', nl: 'Zorg voor voldoende hydratatie.' }
      ],
      contreIndications: [],
      sources: [SRC_CBIP]
    },

    {
      id: 'oseltamivir',
      dci: { fr: 'Oseltamivir', nl: 'Oseltamivir' },
      marques: ['Tamiflu', 'Oseltamivir EG'],
      cbip: { fr: 'oseltamivir', nl: 'oseltamivir' },
      categorie: 'antiviral',
      frequent: false,
      verifie: false,
      synonymes: ['grippe', 'influenza', 'griep'],
      formes: [
        { id: 'susp', nom: { fr: 'Suspension orale 6 mg / ml', nl: 'Orale suspensie 6 mg / ml' }, type: 'liquide', parMl: 6 },
        { id: 'gel30', nom: gelule('30 mg'), type: 'solide', parUnite: 30, uniteNom: U_GEL, pasUnite: 1 },
        { id: 'gel45', nom: gelule('45 mg'), type: 'solide', parUnite: 45, uniteNom: U_GEL, pasUnite: 1 },
        { id: 'gel75', nom: gelule('75 mg'), type: 'solide', parUnite: 75, uniteNom: U_GEL, pasUnite: 1 }
      ],
      schemas: [
        {
          id: 'grippe',
          indication: {
            fr: 'Grippe — traitement (à partir de 1 an), dose fixe par poids',
            nl: 'Griep — behandeling (vanaf 1 jaar), vaste dosis per gewicht'
          },
          mode: 'paliers', unite: 'mg', critere: 'poids',
          paliers: [
            { label: { fr: '15 kg ou moins', nl: '15 kg of minder' }, min: 0, max: 15, dose: 60, prises: 2,
              libelle: { fr: '30 mg 2×/j', nl: '30 mg 2×/dag' } },
            { label: { fr: 'plus de 15 à 23 kg', nl: 'meer dan 15 tot 23 kg' }, min: 15.01, max: 23, dose: 90, prises: 2,
              libelle: { fr: '45 mg 2×/j', nl: '45 mg 2×/dag' } },
            { label: { fr: 'plus de 23 à 40 kg', nl: 'meer dan 23 tot 40 kg' }, min: 23.01, max: 40, dose: 120, prises: 2,
              libelle: { fr: '60 mg 2×/j', nl: '60 mg 2×/dag' } },
            { label: { fr: 'plus de 40 kg', nl: 'meer dan 40 kg' }, min: 40.01, max: null, dose: 150, prises: 2,
              libelle: { fr: '75 mg 2×/j', nl: '75 mg 2×/dag' } }
          ],
          duree: { fr: '5 jours', nl: '5 dagen' },
          note: {
            fr: 'À débuter dans les 48 h suivant le début des symptômes.',
            nl: 'Te starten binnen 48 u na het begin van de symptomen.'
          },
          sources: [SRC_CBIP, SRC_RCP]
        }
      ],
      precautions: [
        { fr: 'Nausées et vomissements fréquents.', nl: 'Vaak misselijkheid en braken.' }
      ],
      contreIndications: [],
      sources: [SRC_CBIP]
    },

    /* ============================================================== */
    /* ANTIPARASITAIRES                                               */
    /* ============================================================== */
    {
      id: 'mebendazole',
      dci: { fr: 'Mébendazole', nl: 'Mebendazol' },
      marques: ['Vermox', 'Docmebenda'],
      cbip: { fr: 'mébendazole', nl: 'mebendazol' },
      categorie: 'antiparasitaire',
      frequent: true,
      verifie: false,
      synonymes: ['oxyure', 'vers', 'vermifuge', 'aarsmaden', 'wormen'],
      formes: [
        { id: 'susp', nom: suspOrale(100), type: 'liquide', parMl: 20 },
        { id: 'cp100', nom: comprime('100 mg'), type: 'solide', parUnite: 100, uniteNom: U_CP }
      ],
      schemas: [
        {
          id: 'oxyurose',
          indication: { fr: 'Oxyurose — dose unique fixe', nl: 'Aarsmadeninfectie — vaste eenmalige dosis' },
          mode: 'paliers', unite: 'mg', critere: 'age',
          paliers: [
            { label: { fr: '1 an et plus', nl: '1 jaar en ouder' }, min: 12, max: null, dose: 100, prises: 1,
              libelle: { fr: '100 mg en dose unique', nl: '100 mg als eenmalige dosis' } }
          ],
          duree: {
            fr: 'dose unique, à répéter après 2 semaines',
            nl: 'eenmalige dosis, te herhalen na 2 weken'
          },
          note: {
            fr: 'Traiter simultanément toute la famille. Dose indépendante du poids.',
            nl: 'Behandel het hele gezin tegelijk. Dosis onafhankelijk van het gewicht.'
          },
          sources: [SRC_CBIP, SRC_RCP]
        },
        {
          id: 'ascaris',
          indication: {
            fr: 'Ascaridiose, trichocéphalose, ankylostomose',
            nl: 'Ascariasis, trichuriasis, ankylostomiasis'
          },
          mode: 'paliers', unite: 'mg', critere: 'age',
          paliers: [
            { label: { fr: '1 an et plus', nl: '1 jaar en ouder' }, min: 12, max: null, dose: 200, prises: 2,
              libelle: { fr: '100 mg 2×/j pendant 3 jours', nl: '100 mg 2×/dag gedurende 3 dagen' } }
          ],
          duree: { fr: '3 jours', nl: '3 dagen' },
          sources: [SRC_CBIP, SRC_RCP]
        }
      ],
      precautions: [
        { fr: 'Mesures d’hygiène indispensables (ongles, literie, linge).',
          nl: 'Hygiënemaatregelen zijn onmisbaar (nagels, beddengoed, linnen).' }
      ],
      contreIndications: [
        { fr: 'Enfant de moins de 1 an (expérience limitée).', nl: 'Kind jonger dan 1 jaar (beperkte ervaring).' }
      ],
      sources: [SRC_CBIP]
    },

    /* ============================================================== */
    /* VITAMINES / SUPPLÉMENTS                                        */
    /* ============================================================== */
    {
      id: 'vitamine-d',
      dci: { fr: 'Cholécalciférol (vitamine D3)', nl: 'Colecalciferol (vitamine D3)' },
      marques: ['D-Cure', 'Devaron', 'Sterogyl'],
      cbip: { fr: 'cholécalciférol', nl: 'colecalciferol' },
      categorie: 'supplement',
      frequent: true,
      verifie: false,
      synonymes: ['vitamine D', 'rachitisme', 'prevention', 'rachitis', 'preventie'],
      formes: [
        { id: 'gouttes', nom: { fr: 'Gouttes 400 UI / goutte (à vérifier selon la spécialité)',
                                nl: 'Druppels 400 IE / druppel (te controleren per specialiteit)' },
          type: 'autre', parUnite: 400, uniteNom: U_GOUTTE },
        { id: 'amp', nom: { fr: 'Ampoule 25 000 UI', nl: 'Ampul 25 000 IE' }, type: 'autre', parUnite: 25000, uniteNom: U_AMP }
      ],
      schemas: [
        {
          id: 'prevention',
          indication: {
            fr: 'Prévention de la carence — dose fixe',
            nl: 'Preventie van tekort — vaste dosis'
          },
          mode: 'paliers', unite: 'UI', critere: 'age',
          paliers: [
            { label: { fr: '0 à 6 ans', nl: '0 tot 6 jaar' }, min: 0, max: 71, dose: 400, prises: 1,
              libelle: { fr: '400 UI par jour', nl: '400 IE per dag' } },
            { label: { fr: '6 ans et plus (à risque)', nl: '6 jaar en ouder (risicogroep)' }, min: 72, max: null, dose: 400, prises: 1,
              libelle: { fr: '400 à 600 UI par jour', nl: '400 tot 600 IE per dag' } }
          ],
          duree: { fr: 'quotidien, toute l’année', nl: 'dagelijks, het hele jaar door' },
          note: {
            fr: 'Recommandation belge : 400 UI/j de la naissance à 6 ans. Dose indépendante du poids.',
            nl: 'Belgische aanbeveling: 400 IE/dag van de geboorte tot 6 jaar. Dosis onafhankelijk van het gewicht.'
          },
          sources: [SRC_CBIP]
        }
      ],
      precautions: [
        { fr: 'Vérifier la concentration exacte de la spécialité : elle varie fortement d’une marque à l’autre.',
          nl: 'Controleer de exacte concentratie van de specialiteit: die verschilt sterk per merk.' }
      ],
      contreIndications: [{ fr: 'Hypercalcémie.', nl: 'Hypercalciëmie.' }],
      sources: [SRC_CBIP]
    },

    {
      id: 'fer',
      dci: {
        fr: 'Fer (sels ferreux) — exprimé en fer élément',
        nl: 'IJzer (ferrozouten) — uitgedrukt in elementair ijzer'
      },
      marques: ['Losferron', 'Ferricure', 'Fer-In-Sol (disponibilité à vérifier)'],
      cbip: { fr: 'fer', nl: 'ijzer' },
      categorie: 'supplement',
      frequent: false,
      verifie: false,
      synonymes: ['anemie', 'ferriprive', 'martial', 'bloedarmoede', 'ijzertekort'],
      formes: [
        { id: 'gouttes', nom: { fr: 'Gouttes (concentration variable — à vérifier)',
                                nl: 'Druppels (wisselende concentratie — te controleren)' }, type: 'liquide', parMl: 25 }
      ],
      schemas: [
        {
          id: 'carence',
          indication: { fr: 'Anémie ferriprive (traitement)', nl: 'IJzergebreksanemie (behandeling)' },
          mode: 'jour', unite: 'mg',
          doseMin: 3, doseUsuelle: 4, doseMax: 6,
          prises: [1, 2], maxJour: 200,
          duree: {
            fr: '3 mois, à poursuivre 2 à 3 mois après normalisation',
            nl: '3 maanden, 2 tot 3 maanden voort te zetten na normalisatie'
          },
          note: {
            fr: 'Doses exprimées en FER ÉLÉMENT. Vérifier impérativement la teneur en fer élément de la spécialité.',
            nl: 'Doses uitgedrukt in ELEMENTAIR IJZER. Controleer absoluut het gehalte aan elementair ijzer van de specialiteit.'
          },
          sources: [SRC_CBIP]
        }
      ],
      precautions: [
        { fr: 'À distance des produits laitiers et du thé.', nl: 'Niet samen met zuivelproducten of thee.' },
        { fr: 'Selles noires, constipation.', nl: 'Zwarte stoelgang, constipatie.' }
      ],
      contreIndications: [{ fr: 'Surcharge en fer.', nl: 'IJzerstapeling.' }],
      sources: [SRC_CBIP]
    }
  ];

  global.PosocalcData = {
    CATEGORIES: CATEGORIES,
    MEDICAMENTS: MEDICAMENTS
  };
})(window);
