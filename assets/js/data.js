/*
 * Posocalc — base de données des médicaments
 * ------------------------------------------------------------------
 * IMPORTANT : ces données sont une PROPOSITION de départ. Chaque fiche
 * porte un champ `verifie`. Tant qu'il vaut false, l'interface affiche
 * un badge « non vérifié ». Le prescripteur (ou le pharmacien) doit
 * contrôler la fiche contre le RCP / le CBIP / le guide BAPCOC, puis
 * passer `verifie` à true.
 *
 * Structure d'une fiche :
 *   id            identifiant unique (slug, utilisé dans l'URL)
 *   dci           dénomination commune internationale
 *   marques       noms commerciaux courants en Belgique
 *   categorie     clé de catégorie (voir CATEGORIES ci-dessous)
 *   frequent      true => remonte dans « Les plus prescrits »
 *   synonymes     termes supplémentaires pour la recherche
 *   verifie       false tant que la fiche n'a pas été relue
 *   formes[]      présentations disponibles
 *       id, nom, type ('liquide'|'solide'|'sachet'|'suppo'|'autre')
 *       parMl       quantité de principe actif par ml (formes liquides)
 *       parUnite    quantité par comprimé / sachet / suppositoire
 *       uniteNom    « comprimé », « sachet », « suppositoire »…
 *       pasUnite    plus petite fraction administrable (défaut : 0,5 pour
 *                   un comprimé, 1 sinon). Mettre 1 pour une gélule.
 *       note        précision affichée sous le sélecteur de présentation
 *   schemas[]     schémas posologiques, un par indication
 *       mode      'jour'    doses exprimées en <unite>/kg/JOUR
 *                 'prise'   doses exprimées en <unite>/kg/PRISE
 *                 'unique'  dose unique en <unite>/kg
 *                 'paliers' dose fixe par tranche d'âge ou de poids
 *       doseMin / doseUsuelle / doseMax
 *       unite     'mg' | 'UI' | 'µg'
 *       prises    nombre de prises par jour proposées (1re = défaut)
 *       maxJour   plafond absolu par jour (dose adulte)
 *       maxPrise  plafond absolu par prise
 *       maxParKgJour  plafond exprimé en <unite>/kg/jour
 *       ageMinMois / poidsMinKg  seuils déclenchant un avertissement
 *       prn       true = médicament « à la demande » : aucun total sur 24 h
 *                 n'est affiché (salbutamol…)
 *       paliers[] pour mode 'paliers' : { label, min, max, dose, prises, libelle }
 *                 critere (sur le schéma) = 'age' (en mois) ou 'poids' (en kg)
 *                 ATTENTION : `dose` est le TOTAL PAR JOUR, réparti sur
 *                 `prises`. Pour « 2,5 mg 2×/j », écrire dose: 5, prises: 2.
 */

(function (global) {
  'use strict';

  var CATEGORIES = [
    { id: 'antibiotique', nom: 'Antibiotique' },
    { id: 'antalgique', nom: 'Antalgique / antipyrétique' },
    { id: 'corticoide', nom: 'Corticoïde' },
    { id: 'allergie', nom: 'Allergie' },
    { id: 'respiratoire', nom: 'Respiratoire' },
    { id: 'digestif', nom: 'Digestif' },
    { id: 'antifongique', nom: 'Antifongique' },
    { id: 'antiviral', nom: 'Antiviral' },
    { id: 'antiparasitaire', nom: 'Antiparasitaire' },
    { id: 'supplement', nom: 'Vitamine / supplément' }
  ];

  var SRC_BAPCOC = {
    label: 'Guide BAPCOC — traitements anti-infectieux en pratique ambulatoire',
    url: 'https://www.health.belgium.be/fr/guide-belge-des-traitements-anti-infectieux-en-pratique-ambulatoire'
  };
  var SRC_CBIP = {
    label: 'CBIP — Répertoire commenté des médicaments',
    url: 'https://www.cbip.be/fr/start'
  };

  var MEDICAMENTS = [

    /* ---------------------------------------------------------- */
    /* ANTIBIOTIQUES                                              */
    /* ---------------------------------------------------------- */
    {
      id: 'amoxicilline',
      dci: 'Amoxicilline',
      marques: ['Clamoxyl', 'Amoxypen', 'Docamoxici', 'Amoxicilline EG / Sandoz / Teva'],
      categorie: 'antibiotique',
      frequent: true,
      verifie: false,
      synonymes: ['penicilline A', 'otite', 'angine', 'pneumonie'],
      formes: [
        { id: 'susp125', nom: 'Suspension orale 125 mg / 5 ml', type: 'liquide', parMl: 25 },
        { id: 'susp250', nom: 'Suspension orale 250 mg / 5 ml', type: 'liquide', parMl: 50 },
        { id: 'susp500', nom: 'Suspension orale 500 mg / 5 ml', type: 'liquide', parMl: 100 },
        { id: 'cp500', nom: 'Comprimé / gélule 500 mg', type: 'solide', parUnite: 500, uniteNom: 'comprimé' },
        { id: 'cp1000', nom: 'Comprimé 1 g', type: 'solide', parUnite: 1000, uniteNom: 'comprimé' }
      ],
      schemas: [
        {
          id: 'oma',
          indication: 'Otite moyenne aiguë, sinusite, pneumonie communautaire',
          mode: 'jour', unite: 'mg',
          doseMin: 75, doseUsuelle: 80, doseMax: 100,
          prises: [3], maxJour: 3000,
          duree: '5 à 7 jours',
          note: 'Doses élevées recommandées en Belgique vu la sensibilité diminuée du pneumocoque.'
        },
        {
          id: 'angine',
          indication: 'Pharyngite / angine à streptocoque A',
          mode: 'jour', unite: 'mg',
          doseMin: 50, doseUsuelle: 50, doseMax: 50,
          prises: [3, 2], maxJour: 3000,
          duree: '7 jours',
          note: 'La pénicilline V reste le premier choix ; l’amoxicilline est une alternative.'
        },
        {
          id: 'cutane',
          indication: 'Infection cutanée (impétigo, érysipèle)',
          mode: 'jour', unite: 'mg',
          doseMin: 25, doseUsuelle: 50, doseMax: 50,
          prises: [3, 4], maxJour: 3000,
          duree: '7 jours (impétigo) à 10 jours (érysipèle)'
        }
      ],
      precautions: [
        'Éruption cutanée quasi constante en cas de mononucléose infectieuse (n’équivaut pas à une allergie).',
        'Adapter en cas d’insuffisance rénale.'
      ],
      contreIndications: ['Allergie IgE-médiée aux pénicillines.'],
      sources: [SRC_BAPCOC, SRC_CBIP]
    },

    {
      id: 'amoxicilline-clavulanate',
      dci: 'Amoxicilline + acide clavulanique',
      marques: ['Augmentin', 'Amoxiclav EG / Sandoz / Teva', 'Docamoclan'],
      categorie: 'antibiotique',
      frequent: true,
      verifie: false,
      synonymes: ['co-amoxiclav', 'augmentin'],
      doseExprimee: 'Les doses sont exprimées en amoxicilline.',
      formes: [
        { id: 'susp4_1_125', nom: 'Suspension 125 mg / 31,25 mg par 5 ml (4:1)', type: 'liquide', parMl: 25 },
        { id: 'susp4_1_250', nom: 'Suspension 250 mg / 62,5 mg par 5 ml (4:1)', type: 'liquide', parMl: 50 },
        { id: 'susp8_1', nom: 'Suspension 100 mg / 12,5 mg par ml (8:1)', type: 'liquide', parMl: 100, note: 'Rapport 8:1 : permet des doses élevées d’amoxicilline sans excès de clavulanate.' },
        { id: 'cp500', nom: 'Comprimé 500 mg / 125 mg', type: 'solide', parUnite: 500, uniteNom: 'comprimé' },
        { id: 'cp875', nom: 'Comprimé 875 mg / 125 mg', type: 'solide', parUnite: 875, uniteNom: 'comprimé' }
      ],
      schemas: [
        {
          id: 'standard',
          indication: 'Indication courante (OMA compliquée, sinusite, morsure, pneumonie d’inhalation)',
          mode: 'jour', unite: 'mg',
          doseMin: 75, doseUsuelle: 80, doseMax: 100,
          prises: [3], maxJour: 3000,
          duree: 'selon l’indication',
          note: 'Ne pas dépasser 12,5 mg/kg/j d’acide clavulanique : privilégier le rapport 8:1 pour les doses élevées.'
        },
        {
          id: 'faible',
          indication: 'Dose standard basse (rapport 4:1)',
          mode: 'jour', unite: 'mg',
          doseMin: 45, doseUsuelle: 45, doseMax: 50,
          prises: [3, 2], maxJour: 1500
        }
      ],
      precautions: ['Diarrhée fréquente, plus marquée qu’avec l’amoxicilline seule.'],
      contreIndications: ['Allergie aux pénicillines.', 'Antécédent d’atteinte hépatique liée à l’association.'],
      sources: [SRC_BAPCOC, SRC_CBIP]
    },

    {
      id: 'penicilline-v',
      dci: 'Phénoxyméthylpénicilline (pénicilline V)',
      marques: ['Peni-Oral', 'Phénoxyméthylpénicilline (disponibilité à vérifier)'],
      categorie: 'antibiotique',
      frequent: true,
      verifie: false,
      synonymes: ['penicilline V', 'angine', 'streptocoque'],
      formes: [
        { id: 'susp', nom: 'Suspension orale 250 mg / 5 ml', type: 'liquide', parMl: 50 },
        { id: 'cp1m', nom: 'Comprimé 1 000 000 UI (≈ 600 mg)', type: 'solide', parUnite: 600, uniteNom: 'comprimé' }
      ],
      schemas: [
        {
          id: 'angine',
          indication: 'Pharyngite / angine à streptocoque A',
          mode: 'jour', unite: 'mg',
          doseMin: 50, doseUsuelle: 50, doseMax: 50,
          prises: [3, 2], maxJour: 2000,
          duree: '7 jours',
          note: 'Premier choix BAPCOC quand un antibiotique est indiqué dans l’angine à SGA.'
        }
      ],
      precautions: ['À prendre à jeun (1 h avant ou 2 h après le repas).'],
      contreIndications: ['Allergie aux pénicillines.'],
      sources: [SRC_BAPCOC]
    },

    {
      id: 'azithromycine',
      dci: 'Azithromycine',
      marques: ['Zitromax', 'Azitromycine EG / Sandoz / Teva'],
      categorie: 'antibiotique',
      frequent: true,
      verifie: false,
      synonymes: ['macrolide', 'coqueluche'],
      formes: [
        { id: 'susp200', nom: 'Suspension orale 200 mg / 5 ml', type: 'liquide', parMl: 40 },
        { id: 'cp250', nom: 'Comprimé 250 mg', type: 'solide', parUnite: 250, uniteNom: 'comprimé' },
        { id: 'cp500', nom: 'Comprimé 500 mg', type: 'solide', parUnite: 500, uniteNom: 'comprimé' }
      ],
      schemas: [
        {
          id: 'court3j',
          indication: 'Schéma court (3 jours)',
          mode: 'jour', unite: 'mg',
          doseMin: 10, doseUsuelle: 10, doseMax: 10,
          prises: [1], maxJour: 500,
          duree: '3 jours'
        },
        {
          id: 'coqueluche',
          indication: 'Coqueluche',
          mode: 'jour', unite: 'mg',
          doseMin: 10, doseUsuelle: 10, doseMax: 10,
          prises: [1], maxJour: 500,
          duree: '5 jours',
          note: 'Chez le nourrisson < 6 mois : 10 mg/kg/j pendant 5 jours.'
        }
      ],
      precautions: ['Allongement du QT : prudence en cas d’association à d’autres médicaments allongeant le QT.'],
      contreIndications: ['Allergie aux macrolides.'],
      sources: [SRC_BAPCOC, SRC_CBIP]
    },

    {
      id: 'clarithromycine',
      dci: 'Clarithromycine',
      marques: ['Biclar', 'Clarithromycine EG / Sandoz / Teva'],
      categorie: 'antibiotique',
      frequent: true,
      verifie: false,
      synonymes: ['macrolide'],
      formes: [
        { id: 'susp125', nom: 'Suspension orale 125 mg / 5 ml', type: 'liquide', parMl: 25 },
        { id: 'susp250', nom: 'Suspension orale 250 mg / 5 ml', type: 'liquide', parMl: 50 },
        { id: 'cp250', nom: 'Comprimé 250 mg', type: 'solide', parUnite: 250, uniteNom: 'comprimé' },
        { id: 'cp500', nom: 'Comprimé 500 mg', type: 'solide', parUnite: 500, uniteNom: 'comprimé' }
      ],
      schemas: [
        {
          id: 'standard',
          indication: 'Infection respiratoire, coqueluche (alternative)',
          mode: 'jour', unite: 'mg',
          doseMin: 15, doseUsuelle: 15, doseMax: 15,
          prises: [2], maxJour: 1000,
          duree: '7 jours (5 à 7 jours pour la coqueluche)'
        }
      ],
      precautions: [
        'Inhibiteur enzymatique puissant (CYP3A4) : vérifier les interactions.',
        'Allongement du QT.'
      ],
      contreIndications: ['Allergie aux macrolides.'],
      sources: [SRC_BAPCOC, SRC_CBIP]
    },

    {
      id: 'cefuroxime-axetil',
      dci: 'Céfuroxime axétil',
      marques: ['Zinnat', 'Céfuroxime EG / Sandoz'],
      categorie: 'antibiotique',
      frequent: false,
      verifie: false,
      synonymes: ['cephalosporine', 'C2G'],
      formes: [
        { id: 'susp125', nom: 'Suspension orale 125 mg / 5 ml', type: 'liquide', parMl: 25 },
        { id: 'cp250', nom: 'Comprimé 250 mg', type: 'solide', parUnite: 250, uniteNom: 'comprimé' },
        { id: 'cp500', nom: 'Comprimé 500 mg', type: 'solide', parUnite: 500, uniteNom: 'comprimé' }
      ],
      schemas: [
        {
          id: 'standard',
          indication: 'Infection ORL / respiratoire (2e choix)',
          mode: 'jour', unite: 'mg',
          doseMin: 20, doseUsuelle: 30, doseMax: 30,
          prises: [2], maxJour: 1000,
          duree: 'selon l’indication'
        }
      ],
      precautions: [
        'Goût très amer de la suspension : observance souvent médiocre chez le jeune enfant.',
        'À prendre pendant le repas (absorption).'
      ],
      contreIndications: ['Allergie IgE-médiée aux bêta-lactames.'],
      sources: [SRC_CBIP]
    },

    {
      id: 'cefadroxil',
      dci: 'Céfadroxil',
      marques: ['Duracef'],
      categorie: 'antibiotique',
      frequent: false,
      verifie: false,
      synonymes: ['cephalosporine', 'C1G'],
      formes: [
        { id: 'susp250', nom: 'Suspension orale 250 mg / 5 ml', type: 'liquide', parMl: 50 },
        { id: 'susp500', nom: 'Suspension orale 500 mg / 5 ml', type: 'liquide', parMl: 100 },
        { id: 'cp500', nom: 'Gélule 500 mg', type: 'solide', parUnite: 500, uniteNom: 'gélule', pasUnite: 1 }
      ],
      schemas: [
        {
          id: 'standard',
          indication: 'Infection cutanée, angine (alternative en cas d’allergie non IgE)',
          mode: 'jour', unite: 'mg',
          doseMin: 30, doseUsuelle: 30, doseMax: 50,
          prises: [2], maxJour: 2000,
          duree: 'selon l’indication'
        }
      ],
      precautions: [],
      contreIndications: ['Allergie IgE-médiée aux bêta-lactames.'],
      sources: [SRC_CBIP]
    },

    {
      id: 'flucloxacilline',
      dci: 'Flucloxacilline',
      marques: ['Floxapen', 'Staphycid'],
      categorie: 'antibiotique',
      frequent: false,
      verifie: false,
      synonymes: ['staphylocoque', 'impetigo'],
      formes: [
        { id: 'sirop125', nom: 'Sirop 125 mg / 5 ml', type: 'liquide', parMl: 25 },
        { id: 'sirop250', nom: 'Sirop 250 mg / 5 ml', type: 'liquide', parMl: 50 },
        { id: 'cp500', nom: 'Gélule 500 mg', type: 'solide', parUnite: 500, uniteNom: 'gélule', pasUnite: 1 }
      ],
      schemas: [
        {
          id: 'standard',
          indication: 'Infection cutanée à staphylocoque',
          mode: 'jour', unite: 'mg',
          doseMin: 50, doseUsuelle: 50, doseMax: 100,
          prises: [3, 4], maxJour: 4000,
          duree: '7 à 10 jours'
        }
      ],
      precautions: ['À prendre à jeun (1 h avant le repas).', 'Hépatotoxicité rare mais décrite.'],
      contreIndications: ['Allergie aux pénicillines.'],
      sources: [SRC_BAPCOC, SRC_CBIP]
    },

    {
      id: 'cotrimoxazole',
      dci: 'Sulfaméthoxazole + triméthoprime (cotrimoxazole)',
      marques: ['Bactrim', 'Eusaprim', 'Docotrim'],
      categorie: 'antibiotique',
      frequent: false,
      verifie: false,
      synonymes: ['bactrim', 'infection urinaire', 'cystite'],
      doseExprimee: 'Les doses sont exprimées en sulfaméthoxazole (SMX).',
      formes: [
        { id: 'sirop', nom: 'Suspension 200 mg SMX / 40 mg TMP par 5 ml', type: 'liquide', parMl: 40 },
        { id: 'cpforte', nom: 'Comprimé 800 mg / 160 mg (forte)', type: 'solide', parUnite: 800, uniteNom: 'comprimé' }
      ],
      schemas: [
        {
          id: 'urinaire',
          indication: 'Infection urinaire',
          mode: 'jour', unite: 'mg',
          doseMin: 30, doseUsuelle: 30, doseMax: 30,
          prises: [2], maxJour: 1600,
          ageMinMois: 1.5,
          duree: '3 à 7 jours',
          note: 'Équivaut à 6 mg/kg/j de triméthoprime.'
        }
      ],
      precautions: ['Photosensibilité.', 'Contrôle de la fonction rénale si traitement prolongé.'],
      contreIndications: [
        'Nourrisson < 6 semaines.',
        'Déficit en G6PD.',
        'Allergie aux sulfamides.'
      ],
      sources: [SRC_BAPCOC, SRC_CBIP]
    },

    {
      id: 'nitrofurantoine',
      dci: 'Nitrofurantoïne',
      marques: ['Furadantine MC'],
      categorie: 'antibiotique',
      frequent: false,
      verifie: false,
      synonymes: ['cystite', 'infection urinaire'],
      formes: [
        { id: 'gel50', nom: 'Gélule 50 mg', type: 'solide', parUnite: 50, uniteNom: 'gélule', pasUnite: 1 },
        { id: 'gel100', nom: 'Gélule 100 mg', type: 'solide', parUnite: 100, uniteNom: 'gélule', pasUnite: 1 }
      ],
      schemas: [
        {
          id: 'cystite',
          indication: 'Cystite non compliquée',
          mode: 'jour', unite: 'mg',
          doseMin: 5, doseUsuelle: 5, doseMax: 7,
          prises: [3, 4], maxJour: 400,
          ageMinMois: 1,
          duree: '5 à 7 jours',
          note: 'Pas de forme liquide en Belgique : peu praticable chez le jeune enfant.'
        }
      ],
      precautions: ['À prendre pendant le repas.', 'Colore les urines en brun.'],
      contreIndications: ['Nourrisson < 1 mois.', 'Insuffisance rénale.', 'Déficit en G6PD.'],
      sources: [SRC_BAPCOC, SRC_CBIP]
    },

    {
      id: 'metronidazole',
      dci: 'Métronidazole',
      marques: ['Flagyl', 'Docmetro'],
      categorie: 'antibiotique',
      frequent: false,
      verifie: false,
      synonymes: ['anaerobie', 'giardia', 'lambliase'],
      formes: [
        { id: 'susp', nom: 'Suspension orale 200 mg / 5 ml', type: 'liquide', parMl: 40 },
        { id: 'cp250', nom: 'Comprimé 250 mg', type: 'solide', parUnite: 250, uniteNom: 'comprimé' },
        { id: 'cp500', nom: 'Comprimé 500 mg', type: 'solide', parUnite: 500, uniteNom: 'comprimé' }
      ],
      schemas: [
        {
          id: 'anaerobie',
          indication: 'Infection à germes anaérobies',
          mode: 'jour', unite: 'mg',
          doseMin: 20, doseUsuelle: 25, doseMax: 30,
          prises: [3], maxJour: 1500,
          duree: '7 jours'
        },
        {
          id: 'giardia',
          indication: 'Giardiase (lambliase)',
          mode: 'jour', unite: 'mg',
          doseMin: 15, doseUsuelle: 15, doseMax: 20,
          prises: [3], maxJour: 750,
          duree: '5 à 7 jours'
        }
      ],
      precautions: ['Effet antabuse : pas d’alcool (formes destinées aux adolescents).', 'Goût métallique.'],
      contreIndications: [],
      sources: [SRC_CBIP]
    },

    {
      id: 'clindamycine',
      dci: 'Clindamycine',
      marques: ['Dalacin C', 'Clindamycine EG / Sandoz'],
      categorie: 'antibiotique',
      frequent: false,
      verifie: false,
      synonymes: ['lincosamide'],
      formes: [
        { id: 'gel150', nom: 'Gélule 150 mg', type: 'solide', parUnite: 150, uniteNom: 'gélule', pasUnite: 1 },
        { id: 'gel300', nom: 'Gélule 300 mg', type: 'solide', parUnite: 300, uniteNom: 'gélule', pasUnite: 1 }
      ],
      schemas: [
        {
          id: 'standard',
          indication: 'Infection cutanée / osseuse (alternative en cas d’allergie)',
          mode: 'jour', unite: 'mg',
          doseMin: 20, doseUsuelle: 25, doseMax: 30,
          prises: [3, 4], maxJour: 1800,
          duree: 'selon l’indication',
          note: 'Pas de forme liquide commercialisée en Belgique.'
        }
      ],
      precautions: ['Risque de colite à Clostridioides difficile.'],
      contreIndications: [],
      sources: [SRC_CBIP]
    },

    {
      id: 'doxycycline',
      dci: 'Doxycycline',
      marques: ['Vibratab', 'Doxytab', 'Doxycycline EG'],
      categorie: 'antibiotique',
      frequent: false,
      verifie: false,
      synonymes: ['tetracycline', 'lyme', 'borreliose'],
      formes: [
        { id: 'cp100', nom: 'Comprimé 100 mg', type: 'solide', parUnite: 100, uniteNom: 'comprimé' }
      ],
      schemas: [
        {
          id: 'standard',
          indication: 'Borréliose de Lyme, pneumonie atypique (≥ 8 ans)',
          mode: 'jour', unite: 'mg',
          doseMin: 4, doseUsuelle: 4, doseMax: 4,
          prises: [2, 1], maxJour: 200,
          ageMinMois: 96,
          duree: '10 à 21 jours selon l’indication',
          note: 'Dose de charge possible le 1er jour selon l’indication.'
        }
      ],
      precautions: ['Photosensibilité.', 'À prendre debout avec un grand verre d’eau.'],
      contreIndications: ['Enfant < 8 ans (coloration dentaire) sauf indication vitale.'],
      sources: [SRC_BAPCOC, SRC_CBIP]
    },

    /* ---------------------------------------------------------- */
    /* ANTALGIQUES / ANTIPYRÉTIQUES                               */
    /* ---------------------------------------------------------- */
    {
      id: 'paracetamol',
      dci: 'Paracétamol',
      marques: ['Perdolan', 'Dafalgan', 'Panadol', 'Paracetamol EG / Sandoz / Teva'],
      categorie: 'antalgique',
      frequent: true,
      verifie: false,
      synonymes: ['fievre', 'acetaminophene', 'douleur'],
      formes: [
        { id: 'sirop30', nom: 'Sirop pédiatrique 30 mg / ml', type: 'liquide', parMl: 30 },
        { id: 'sirop24', nom: 'Sirop 120 mg / 5 ml (24 mg/ml)', type: 'liquide', parMl: 24 },
        { id: 'suppo100', nom: 'Suppositoire 100 mg', type: 'suppo', parUnite: 100, uniteNom: 'suppositoire' },
        { id: 'suppo200', nom: 'Suppositoire 200 mg', type: 'suppo', parUnite: 200, uniteNom: 'suppositoire' },
        { id: 'suppo300', nom: 'Suppositoire 300 mg', type: 'suppo', parUnite: 300, uniteNom: 'suppositoire' },
        { id: 'cp500', nom: 'Comprimé 500 mg', type: 'solide', parUnite: 500, uniteNom: 'comprimé' }
      ],
      schemas: [
        {
          id: 'standard',
          indication: 'Fièvre / douleur',
          mode: 'prise', unite: 'mg',
          doseMin: 10, doseUsuelle: 15, doseMax: 15,
          prises: [4, 3], maxJour: 4000, maxPrise: 1000,
          maxParKgJour: 60,
          duree: 'selon les symptômes',
          note: '15 mg/kg toutes les 6 h ou 10 mg/kg toutes les 4 h. Maximum 60 mg/kg/j.'
        }
      ],
      precautions: [
        'Premier choix contre la fièvre chez l’enfant (CBIP).',
        'Attention au cumul avec les spécialités combinées contenant du paracétamol.'
      ],
      contreIndications: ['Insuffisance hépatique sévère.'],
      sources: [SRC_CBIP]
    },

    {
      id: 'ibuprofene',
      dci: 'Ibuprofène',
      marques: ['Nurofen', 'Junifen', 'Brufen', 'Ibuprofen EG / Sandoz / Teva'],
      categorie: 'antalgique',
      frequent: true,
      verifie: false,
      synonymes: ['AINS', 'fievre', 'douleur'],
      formes: [
        { id: 'sirop20', nom: 'Suspension 100 mg / 5 ml (20 mg/ml)', type: 'liquide', parMl: 20 },
        { id: 'sirop40', nom: 'Suspension 200 mg / 5 ml (40 mg/ml)', type: 'liquide', parMl: 40 },
        { id: 'cp200', nom: 'Comprimé 200 mg', type: 'solide', parUnite: 200, uniteNom: 'comprimé' },
        { id: 'cp400', nom: 'Comprimé 400 mg', type: 'solide', parUnite: 400, uniteNom: 'comprimé' }
      ],
      schemas: [
        {
          id: 'standard',
          indication: 'Fièvre / douleur',
          mode: 'prise', unite: 'mg',
          doseMin: 5, doseUsuelle: 10, doseMax: 10,
          prises: [3, 4], maxJour: 1200, maxPrise: 400,
          maxParKgJour: 30,
          ageMinMois: 3, poidsMinKg: 5,
          duree: 'le plus court possible',
          note: 'Maximum 10 mg/kg par prise et 30 mg/kg/j.'
        }
      ],
      precautions: [
        'Risque rénal accru en cas de déshydratation (gastro-entérite, fièvre prolongée, faible apport hydrique).',
        'À éviter en cas de varicelle (risque d’infection cutanée invasive à streptocoque A).',
        'À prendre pendant le repas.'
      ],
      contreIndications: ['Enfant < 3 mois ou < 5 kg.', 'Ulcère gastro-duodénal évolutif.', 'Déshydratation, insuffisance rénale.'],
      sources: [SRC_CBIP]
    },

    /* ---------------------------------------------------------- */
    /* CORTICOÏDES                                                */
    /* ---------------------------------------------------------- */
    {
      id: 'prednisolone',
      dci: 'Prednisolone',
      marques: ['Prednisolone EG', 'Solupred (disponibilité à vérifier)'],
      categorie: 'corticoide',
      frequent: true,
      verifie: false,
      synonymes: ['corticoide', 'asthme', 'crise'],
      formes: [
        { id: 'cp5', nom: 'Comprimé 5 mg', type: 'solide', parUnite: 5, uniteNom: 'comprimé' },
        { id: 'cp20', nom: 'Comprimé 20 mg', type: 'solide', parUnite: 20, uniteNom: 'comprimé' }
      ],
      schemas: [
        {
          id: 'asthme',
          indication: 'Exacerbation d’asthme',
          mode: 'jour', unite: 'mg',
          doseMin: 1, doseUsuelle: 1, doseMax: 2,
          prises: [1], maxJour: 40,
          duree: '3 à 5 jours',
          note: 'Pas de décroissance nécessaire pour une cure courte.'
        }
      ],
      precautions: ['À prendre le matin.'],
      contreIndications: ['Infection non contrôlée.'],
      sources: [SRC_CBIP]
    },

    {
      id: 'methylprednisolone',
      dci: 'Méthylprednisolone',
      marques: ['Medrol'],
      categorie: 'corticoide',
      frequent: true,
      verifie: false,
      synonymes: ['medrol', 'corticoide'],
      formes: [
        { id: 'cp4', nom: 'Comprimé 4 mg', type: 'solide', parUnite: 4, uniteNom: 'comprimé' },
        { id: 'cp16', nom: 'Comprimé 16 mg', type: 'solide', parUnite: 16, uniteNom: 'comprimé' },
        { id: 'cp32', nom: 'Comprimé 32 mg', type: 'solide', parUnite: 32, uniteNom: 'comprimé' }
      ],
      schemas: [
        {
          id: 'asthme',
          indication: 'Exacerbation d’asthme / inflammation',
          mode: 'jour', unite: 'mg',
          doseMin: 0.8, doseUsuelle: 1, doseMax: 1.6,
          prises: [1], maxJour: 32,
          duree: '3 à 5 jours',
          note: '4 mg de méthylprednisolone ≈ 5 mg de prednisolone.'
        }
      ],
      precautions: ['À prendre le matin.'],
      contreIndications: ['Infection non contrôlée.'],
      sources: [SRC_CBIP]
    },

    {
      id: 'dexamethasone',
      dci: 'Dexaméthasone',
      marques: ['Dexamethasone (forme orale : vérifier la disponibilité)', 'Aacidexam (injectable, utilisable per os)'],
      categorie: 'corticoide',
      frequent: false,
      verifie: false,
      synonymes: ['laryngite', 'croup', 'pseudo-croup'],
      formes: [
        { id: 'cp05', nom: 'Comprimé 0,5 mg', type: 'solide', parUnite: 0.5, uniteNom: 'comprimé' },
        { id: 'sol4', nom: 'Solution 4 mg / ml (ampoule, per os)', type: 'liquide', parMl: 4 }
      ],
      schemas: [
        {
          id: 'laryngite',
          indication: 'Laryngite sous-glottique (pseudo-croup) — dose unique',
          mode: 'unique', unite: 'mg',
          doseMin: 0.15, doseUsuelle: 0.15, doseMax: 0.6,
          prises: [1], maxJour: 16,
          duree: 'dose unique, à répéter éventuellement après 24 h',
          note: '0,15 mg/kg semble aussi efficace que 0,6 mg/kg (Cochrane).'
        }
      ],
      precautions: [],
      contreIndications: [],
      sources: [SRC_CBIP]
    },

    /* ---------------------------------------------------------- */
    /* ALLERGIE                                                   */
    /* ---------------------------------------------------------- */
    {
      id: 'cetirizine',
      dci: 'Cétirizine',
      marques: ['Zyrtec', 'Cetirizine EG / Sandoz / Teva'],
      categorie: 'allergie',
      frequent: true,
      verifie: false,
      synonymes: ['antihistaminique', 'urticaire', 'rhinite'],
      formes: [
        { id: 'gouttes', nom: 'Gouttes 10 mg / ml', type: 'liquide', parMl: 10, note: '1 ml = 20 gouttes ≈ 0,5 mg par goutte.' },
        { id: 'sirop', nom: 'Sirop 1 mg / ml', type: 'liquide', parMl: 1 },
        { id: 'cp10', nom: 'Comprimé 10 mg', type: 'solide', parUnite: 10, uniteNom: 'comprimé' }
      ],
      schemas: [
        {
          id: 'paliers',
          indication: 'Rhinite allergique, urticaire — dose fixe par âge',
          mode: 'paliers', unite: 'mg', critere: 'age',
          paliers: [
            { label: '2 à 5 ans', min: 24, max: 71, dose: 5, prises: 2, libelle: '2,5 mg 2×/j' },
            { label: '6 à 11 ans', min: 72, max: 143, dose: 10, prises: 2, libelle: '5 mg 2×/j' },
            { label: '12 ans et plus', min: 144, max: null, dose: 10, prises: 1, libelle: '10 mg 1×/j' }
          ],
          duree: 'selon les symptômes',
          note: 'Dose fixe par tranche d’âge : elle ne dépend pas du poids.'
        }
      ],
      precautions: ['Somnolence possible malgré le caractère « peu sédatif ».'],
      contreIndications: ['Enfant < 2 ans (selon la forme).'],
      sources: [SRC_CBIP]
    },

    {
      id: 'desloratadine',
      dci: 'Desloratadine',
      marques: ['Aerius', 'Desloratadine EG / Sandoz'],
      categorie: 'allergie',
      frequent: false,
      verifie: false,
      synonymes: ['antihistaminique', 'rhinite'],
      formes: [
        { id: 'sirop', nom: 'Sirop 0,5 mg / ml', type: 'liquide', parMl: 0.5 },
        { id: 'cp5', nom: 'Comprimé 5 mg', type: 'solide', parUnite: 5, uniteNom: 'comprimé' }
      ],
      schemas: [
        {
          id: 'paliers',
          indication: 'Rhinite allergique, urticaire — dose fixe par âge',
          mode: 'paliers', unite: 'mg', critere: 'age',
          paliers: [
            { label: '1 à 5 ans', min: 12, max: 71, dose: 1.25, prises: 1 },
            { label: '6 à 11 ans', min: 72, max: 143, dose: 2.5, prises: 1 },
            { label: '12 ans et plus', min: 144, max: null, dose: 5, prises: 1 }
          ],
          duree: 'selon les symptômes'
        }
      ],
      precautions: [],
      contreIndications: [],
      sources: [SRC_CBIP]
    },

    {
      id: 'hydroxyzine',
      dci: 'Hydroxyzine',
      marques: ['Atarax'],
      categorie: 'allergie',
      frequent: false,
      verifie: false,
      synonymes: ['prurit', 'sedatif', 'antihistaminique'],
      formes: [
        { id: 'sirop', nom: 'Sirop 2 mg / ml', type: 'liquide', parMl: 2 },
        { id: 'cp25', nom: 'Comprimé 25 mg', type: 'solide', parUnite: 25, uniteNom: 'comprimé' }
      ],
      schemas: [
        {
          id: 'prurit',
          indication: 'Prurit',
          mode: 'jour', unite: 'mg',
          doseMin: 1, doseUsuelle: 1, doseMax: 2,
          prises: [3, 2], maxJour: 100,
          ageMinMois: 12,
          duree: 'de courte durée'
        }
      ],
      precautions: ['Allongement du QT : dose la plus faible et la plus courte possible.', 'Sédation.'],
      contreIndications: ['Allongement du QT connu.', 'Enfant < 1 an.'],
      sources: [SRC_CBIP]
    },

    /* ---------------------------------------------------------- */
    /* RESPIRATOIRE                                               */
    /* ---------------------------------------------------------- */
    {
      id: 'salbutamol',
      dci: 'Salbutamol',
      marques: ['Ventolin', 'Airomir', 'Docsalbuta'],
      categorie: 'respiratoire',
      frequent: true,
      verifie: false,
      synonymes: ['asthme', 'bronchodilatateur', 'aerosol', 'ventoline'],
      formes: [
        { id: 'mdi', nom: 'Aérosol-doseur 100 µg / bouffée (+ chambre d’inhalation)', type: 'autre', parUnite: 100, uniteNom: 'bouffée' },
        { id: 'neb25', nom: 'Solution pour nébulisation 2,5 mg / 2,5 ml', type: 'liquide', parMl: 1 }
      ],
      schemas: [
        {
          id: 'crise-mdi',
          indication: 'Crise d’asthme — aérosol-doseur avec chambre d’inhalation',
          mode: 'paliers', unite: 'µg', critere: 'age', prn: true,
          paliers: [
            { label: 'Moins de 6 ans', min: 0, max: 71, dose: 200, prises: 1, libelle: '2 bouffées' },
            { label: '6 ans et plus', min: 72, max: null, dose: 400, prises: 1, libelle: '4 bouffées' }
          ],
          duree: 'à répéter selon la réponse clinique',
          note: 'En crise : 2 à 10 bouffées, à répéter toutes les 20 min pendant la 1re heure selon la sévérité. Toujours utiliser une chambre d’inhalation.'
        },
        {
          id: 'neb',
          indication: 'Nébulisation',
          mode: 'paliers', unite: 'mg', critere: 'poids', prn: true,
          paliers: [
            { label: 'Moins de 20 kg', min: 0, max: 19.99, dose: 2.5, prises: 1, libelle: '2,5 mg par nébulisation' },
            { label: '20 kg et plus', min: 20, max: null, dose: 5, prises: 1, libelle: '5 mg par nébulisation' }
          ],
          duree: 'à répéter selon la réponse clinique'
        }
      ],
      precautions: ['Tremblements, tachycardie.', 'Vérifier la technique d’inhalation.'],
      contreIndications: [],
      sources: [SRC_CBIP]
    },

    {
      id: 'montelukast',
      dci: 'Montélukast',
      marques: ['Singulair', 'Montelukast EG / Sandoz / Teva'],
      categorie: 'respiratoire',
      frequent: false,
      verifie: false,
      synonymes: ['asthme', 'antileucotriene'],
      formes: [
        { id: 'gran4', nom: 'Granulés 4 mg', type: 'sachet', parUnite: 4, uniteNom: 'sachet' },
        { id: 'cp4', nom: 'Comprimé à croquer 4 mg', type: 'solide', parUnite: 4, uniteNom: 'comprimé' },
        { id: 'cp5', nom: 'Comprimé à croquer 5 mg', type: 'solide', parUnite: 5, uniteNom: 'comprimé' },
        { id: 'cp10', nom: 'Comprimé 10 mg', type: 'solide', parUnite: 10, uniteNom: 'comprimé' }
      ],
      schemas: [
        {
          id: 'paliers',
          indication: 'Asthme — dose fixe par âge',
          mode: 'paliers', unite: 'mg', critere: 'age',
          paliers: [
            { label: '6 mois à 5 ans', min: 6, max: 71, dose: 4, prises: 1 },
            { label: '6 à 14 ans', min: 72, max: 179, dose: 5, prises: 1 },
            { label: '15 ans et plus', min: 180, max: null, dose: 10, prises: 1 }
          ],
          duree: 'traitement de fond, le soir'
        }
      ],
      precautions: ['Effets neuropsychiatriques rapportés (cauchemars, agitation, troubles de l’humeur) : en informer les parents.'],
      contreIndications: [],
      sources: [SRC_CBIP]
    },

    /* ---------------------------------------------------------- */
    /* DIGESTIF                                                   */
    /* ---------------------------------------------------------- */
    {
      id: 'ondansetron',
      dci: 'Ondansétron',
      marques: ['Zofran', 'Ondansetron EG / Sandoz'],
      categorie: 'digestif',
      frequent: false,
      verifie: false,
      synonymes: ['vomissement', 'gastro', 'antiemetique'],
      formes: [
        { id: 'sirop', nom: 'Sirop 4 mg / 5 ml', type: 'liquide', parMl: 0.8 },
        { id: 'lyoc4', nom: 'Lyophilisat oral 4 mg', type: 'solide', parUnite: 4, uniteNom: 'lyophilisat', pasUnite: 1 },
        { id: 'lyoc8', nom: 'Lyophilisat oral 8 mg', type: 'solide', parUnite: 8, uniteNom: 'lyophilisat', pasUnite: 1 }
      ],
      schemas: [
        {
          id: 'gastro',
          indication: 'Vomissements de la gastro-entérite — dose unique',
          mode: 'unique', unite: 'mg',
          doseMin: 0.15, doseUsuelle: 0.15, doseMax: 0.2,
          prises: [1], maxJour: 8, maxPrise: 4,
          ageMinMois: 6,
          duree: 'dose unique',
          note: 'Usage hors RCP fréquent en pédiatrie pour faciliter la réhydratation orale.'
        }
      ],
      precautions: ['Allongement du QT.', 'Constipation.'],
      contreIndications: ['Allongement du QT congénital.'],
      sources: [SRC_CBIP]
    },

    {
      id: 'domperidone',
      dci: 'Dompéridone',
      marques: ['Motilium', 'Domperidone EG / Sandoz'],
      categorie: 'digestif',
      frequent: false,
      verifie: false,
      synonymes: ['vomissement', 'antiemetique', 'motilium'],
      formes: [
        { id: 'susp', nom: 'Suspension 1 mg / ml', type: 'liquide', parMl: 1 },
        { id: 'cp10', nom: 'Comprimé 10 mg', type: 'solide', parUnite: 10, uniteNom: 'comprimé' }
      ],
      schemas: [
        {
          id: 'standard',
          indication: 'Nausées et vomissements',
          mode: 'prise', unite: 'mg',
          doseMin: 0.25, doseUsuelle: 0.25, doseMax: 0.25,
          prises: [3], maxJour: 30, maxPrise: 10,
          maxParKgJour: 0.75,
          duree: 'maximum 7 jours',
          note: 'L’EMA a restreint l’usage : durée la plus courte, dose la plus faible.'
        }
      ],
      precautions: ['Allongement du QT et arythmies : indication à peser, durée limitée à 7 jours.'],
      contreIndications: ['Allongement du QT.', 'Insuffisance hépatique modérée à sévère.', 'Association aux inhibiteurs puissants du CYP3A4.'],
      sources: [SRC_CBIP]
    },

    {
      id: 'macrogol',
      dci: 'Macrogol (polyéthylèneglycol)',
      marques: ['Movicol Junior', 'Forlax Junior', 'Transipeg'],
      categorie: 'digestif',
      frequent: true,
      verifie: false,
      synonymes: ['constipation', 'laxatif', 'PEG'],
      formes: [
        { id: 'sachet4', nom: 'Sachet pédiatrique 4 g', type: 'sachet', parUnite: 4, uniteNom: 'sachet' },
        { id: 'sachet10', nom: 'Sachet adulte 10 g', type: 'sachet', parUnite: 10, uniteNom: 'sachet' }
      ],
      schemas: [
        {
          id: 'entretien',
          indication: 'Constipation — traitement d’entretien',
          mode: 'paliers', unite: 'g', critere: 'age',
          paliers: [
            { label: '6 mois à 1 an', min: 6, max: 23, dose: 4, prises: 1, libelle: '1 sachet de 4 g' },
            { label: '1 à 4 ans', min: 24, max: 47, dose: 8, prises: 1, libelle: '1 à 2 sachets de 4 g' },
            { label: '4 à 8 ans', min: 48, max: 95, dose: 8, prises: 1, libelle: '2 sachets de 4 g' },
            { label: '8 ans et plus', min: 96, max: null, dose: 10, prises: 1, libelle: '1 sachet adulte' }
          ],
          duree: 'plusieurs semaines à plusieurs mois',
          note: 'Titrer selon la consistance des selles. Le désimpaction fécale utilise des doses nettement plus élevées.'
        }
      ],
      precautions: ['Bien diluer et assurer un apport hydrique suffisant.'],
      contreIndications: ['Occlusion intestinale.'],
      sources: [SRC_CBIP]
    },

    {
      id: 'racecadotril',
      dci: 'Racécadotril',
      marques: ['Tiorfix'],
      categorie: 'digestif',
      frequent: false,
      verifie: false,
      synonymes: ['diarrhee', 'gastro'],
      formes: [
        { id: 'sachet10', nom: 'Sachet 10 mg (nourrisson)', type: 'sachet', parUnite: 10, uniteNom: 'sachet' },
        { id: 'sachet30', nom: 'Sachet 30 mg (enfant)', type: 'sachet', parUnite: 30, uniteNom: 'sachet' }
      ],
      schemas: [
        {
          id: 'diarrhee',
          indication: 'Diarrhée aiguë — appoint à la réhydratation',
          mode: 'prise', unite: 'mg',
          doseMin: 1.5, doseUsuelle: 1.5, doseMax: 1.5,
          prises: [3], maxJour: 300,
          ageMinMois: 3,
          duree: 'maximum 7 jours',
          note: 'Ne remplace jamais la réhydratation orale, qui reste le traitement essentiel.'
        }
      ],
      precautions: [],
      contreIndications: ['Nourrisson < 3 mois.'],
      sources: [SRC_CBIP]
    },

    {
      id: 'omeprazole',
      dci: 'Oméprazole',
      marques: ['Losec', 'Omeprazole EG / Sandoz / Teva'],
      categorie: 'digestif',
      frequent: false,
      verifie: false,
      synonymes: ['reflux', 'RGO', 'IPP'],
      formes: [
        { id: 'gel10', nom: 'Gélule / comprimé 10 mg', type: 'solide', parUnite: 10, uniteNom: 'gélule', pasUnite: 1 },
        { id: 'gel20', nom: 'Gélule / comprimé 20 mg', type: 'solide', parUnite: 20, uniteNom: 'gélule', pasUnite: 1 },
        { id: 'gel40', nom: 'Gélule / comprimé 40 mg', type: 'solide', parUnite: 40, uniteNom: 'gélule', pasUnite: 1 }
      ],
      schemas: [
        {
          id: 'rgo',
          indication: 'Reflux gastro-œsophagien symptomatique',
          mode: 'jour', unite: 'mg',
          doseMin: 0.7, doseUsuelle: 1, doseMax: 1.4,
          prises: [1], maxJour: 40,
          ageMinMois: 12,
          duree: '4 à 8 semaines, puis réévaluer',
          note: 'À prendre 30 min avant le repas. Réévaluer systématiquement : usage souvent excessif chez le nourrisson.'
        }
      ],
      precautions: ['Ne pas prolonger sans réévaluation.'],
      contreIndications: [],
      sources: [SRC_CBIP]
    },

    /* ---------------------------------------------------------- */
    /* ANTIFONGIQUES                                              */
    /* ---------------------------------------------------------- */
    {
      id: 'nystatine',
      dci: 'Nystatine',
      marques: ['Nystatine', 'Mycostatine (disponibilité à vérifier)'],
      categorie: 'antifongique',
      frequent: false,
      verifie: false,
      synonymes: ['muguet', 'candidose'],
      formes: [
        { id: 'susp', nom: 'Suspension orale 100 000 UI / ml', type: 'liquide', parMl: 100000 }
      ],
      schemas: [
        {
          id: 'muguet',
          indication: 'Muguet buccal — dose fixe',
          mode: 'paliers', unite: 'UI', critere: 'age',
          paliers: [
            { label: 'Nourrisson', min: 0, max: 23, dose: 400000, prises: 4, libelle: '100 000 UI (1 ml) 4×/j' },
            { label: 'Enfant', min: 24, max: null, dose: 800000, prises: 4, libelle: '200 000 UI (2 ml) 4×/j' }
          ],
          duree: '7 à 14 jours, à poursuivre 48 h après la guérison',
          note: 'Badigeonner la muqueuse ; garder en bouche le plus longtemps possible avant d’avaler.'
        }
      ],
      precautions: ['Traiter simultanément les tétines / le mamelon en cas d’allaitement.'],
      contreIndications: [],
      sources: [SRC_CBIP]
    },

    {
      id: 'miconazole-gel',
      dci: 'Miconazole (gel buccal)',
      marques: ['Daktarin gel oral'],
      categorie: 'antifongique',
      frequent: false,
      verifie: false,
      synonymes: ['muguet', 'candidose', 'daktarin'],
      formes: [
        { id: 'gel', nom: 'Gel buccal 20 mg / g', type: 'liquide', parMl: 1, note: 'Doses exprimées en ml de gel : la mesurette fournie contient 5 ml.' }
      ],
      schemas: [
        {
          id: 'muguet',
          indication: 'Muguet buccal — dose fixe par âge',
          mode: 'paliers', unite: 'ml', critere: 'age',
          paliers: [
            { label: '4 mois à 2 ans', min: 4, max: 23, dose: 5, prises: 4, libelle: '1,25 ml (¼ de mesurette) 4×/j' },
            { label: '2 ans et plus', min: 24, max: null, dose: 10, prises: 4, libelle: '2,5 ml (½ mesurette) 4×/j' }
          ],
          duree: '7 à 14 jours',
          note: 'Appliquer sur la muqueuse après les repas, ne pas avaler d’emblée.'
        }
      ],
      precautions: ['Interaction majeure avec les anticoagulants oraux.'],
      contreIndications: ['Nourrisson < 4 mois (risque de fausse route / étouffement).'],
      sources: [SRC_CBIP]
    },

    {
      id: 'fluconazole',
      dci: 'Fluconazole',
      marques: ['Diflucan', 'Fluconazole EG / Sandoz / Teva'],
      categorie: 'antifongique',
      frequent: false,
      verifie: false,
      synonymes: ['candidose', 'mycose'],
      formes: [
        { id: 'susp', nom: 'Suspension orale 50 mg / 5 ml', type: 'liquide', parMl: 10 },
        { id: 'gel50', nom: 'Gélule 50 mg', type: 'solide', parUnite: 50, uniteNom: 'gélule', pasUnite: 1 },
        { id: 'gel150', nom: 'Gélule 150 mg', type: 'solide', parUnite: 150, uniteNom: 'gélule', pasUnite: 1 }
      ],
      schemas: [
        {
          id: 'muqueuse',
          indication: 'Candidose muqueuse',
          mode: 'jour', unite: 'mg',
          doseMin: 3, doseUsuelle: 3, doseMax: 6,
          prises: [1], maxJour: 400,
          duree: '7 à 14 jours',
          note: 'Une dose de charge (double dose au 1er jour) est possible.'
        }
      ],
      precautions: ['Nombreuses interactions (inhibiteur du CYP).', 'Allongement du QT.'],
      contreIndications: [],
      sources: [SRC_CBIP]
    },

    /* ---------------------------------------------------------- */
    /* ANTIVIRAUX                                                 */
    /* ---------------------------------------------------------- */
    {
      id: 'aciclovir',
      dci: 'Aciclovir',
      marques: ['Zovirax', 'Aciclovir EG / Sandoz / Teva'],
      categorie: 'antiviral',
      frequent: false,
      verifie: false,
      synonymes: ['herpes', 'varicelle', 'zona'],
      formes: [
        { id: 'susp', nom: 'Suspension orale 200 mg / 5 ml', type: 'liquide', parMl: 40 },
        { id: 'cp200', nom: 'Comprimé 200 mg', type: 'solide', parUnite: 200, uniteNom: 'comprimé' },
        { id: 'cp800', nom: 'Comprimé 800 mg', type: 'solide', parUnite: 800, uniteNom: 'comprimé' }
      ],
      schemas: [
        {
          id: 'varicelle',
          indication: 'Varicelle (enfant à risque, dans les 24 h)',
          mode: 'prise', unite: 'mg',
          doseMin: 20, doseUsuelle: 20, doseMax: 20,
          prises: [4], maxJour: 3200, maxPrise: 800,
          duree: '5 jours'
        },
        {
          id: 'gingivostomatite',
          indication: 'Gingivostomatite herpétique',
          mode: 'jour', unite: 'mg',
          doseMin: 40, doseUsuelle: 60, doseMax: 80,
          prises: [4, 5], maxJour: 2000,
          duree: '5 à 7 jours'
        }
      ],
      precautions: ['Assurer une hydratation suffisante.'],
      contreIndications: [],
      sources: [SRC_CBIP]
    },

    {
      id: 'oseltamivir',
      dci: 'Oseltamivir',
      marques: ['Tamiflu', 'Oseltamivir EG'],
      categorie: 'antiviral',
      frequent: false,
      verifie: false,
      synonymes: ['grippe', 'influenza'],
      formes: [
        { id: 'susp', nom: 'Suspension orale 6 mg / ml', type: 'liquide', parMl: 6 },
        { id: 'gel30', nom: 'Gélule 30 mg', type: 'solide', parUnite: 30, uniteNom: 'gélule', pasUnite: 1 },
        { id: 'gel45', nom: 'Gélule 45 mg', type: 'solide', parUnite: 45, uniteNom: 'gélule', pasUnite: 1 },
        { id: 'gel75', nom: 'Gélule 75 mg', type: 'solide', parUnite: 75, uniteNom: 'gélule', pasUnite: 1 }
      ],
      schemas: [
        {
          id: 'grippe',
          indication: 'Grippe — traitement (≥ 1 an), dose fixe par poids',
          mode: 'paliers', unite: 'mg', critere: 'poids',
          paliers: [
            { label: '≤ 15 kg', min: 0, max: 15, dose: 60, prises: 2, libelle: '30 mg 2×/j' },
            { label: '> 15 à 23 kg', min: 15.01, max: 23, dose: 90, prises: 2, libelle: '45 mg 2×/j' },
            { label: '> 23 à 40 kg', min: 23.01, max: 40, dose: 120, prises: 2, libelle: '60 mg 2×/j' },
            { label: '> 40 kg', min: 40.01, max: null, dose: 150, prises: 2, libelle: '75 mg 2×/j' }
          ],
          duree: '5 jours',
          note: 'À débuter dans les 48 h suivant le début des symptômes.'
        }
      ],
      precautions: ['Nausées et vomissements fréquents.'],
      contreIndications: [],
      sources: [SRC_CBIP]
    },

    /* ---------------------------------------------------------- */
    /* ANTIPARASITAIRES                                           */
    /* ---------------------------------------------------------- */
    {
      id: 'mebendazole',
      dci: 'Mébendazole',
      marques: ['Vermox', 'Docmebenda'],
      categorie: 'antiparasitaire',
      frequent: true,
      verifie: false,
      synonymes: ['oxyure', 'vers', 'vermifuge'],
      formes: [
        { id: 'susp', nom: 'Suspension orale 100 mg / 5 ml', type: 'liquide', parMl: 20 },
        { id: 'cp100', nom: 'Comprimé 100 mg', type: 'solide', parUnite: 100, uniteNom: 'comprimé' }
      ],
      schemas: [
        {
          id: 'oxyurose',
          indication: 'Oxyurose — dose unique fixe',
          mode: 'paliers', unite: 'mg', critere: 'age',
          paliers: [
            { label: '1 an et plus', min: 12, max: null, dose: 100, prises: 1, libelle: '100 mg en dose unique' }
          ],
          duree: 'dose unique, à répéter après 2 semaines',
          note: 'Traiter simultanément toute la famille. Dose indépendante du poids.'
        },
        {
          id: 'ascaris',
          indication: 'Ascaridiose, trichocéphalose, ankylostomose',
          mode: 'paliers', unite: 'mg', critere: 'age',
          paliers: [
            { label: '1 an et plus', min: 12, max: null, dose: 200, prises: 2, libelle: '100 mg 2×/j pendant 3 jours' }
          ],
          duree: '3 jours'
        }
      ],
      precautions: ['Mesures d’hygiène indispensables (ongles, literie, linge).'],
      contreIndications: ['Enfant < 1 an (expérience limitée).'],
      sources: [SRC_CBIP]
    },

    /* ---------------------------------------------------------- */
    /* VITAMINES / SUPPLÉMENTS                                    */
    /* ---------------------------------------------------------- */
    {
      id: 'vitamine-d',
      dci: 'Cholécalciférol (vitamine D3)',
      marques: ['D-Cure', 'Devaron', 'Sterogyl'],
      categorie: 'supplement',
      frequent: true,
      verifie: false,
      synonymes: ['vitamine D', 'rachitisme', 'prevention'],
      formes: [
        { id: 'gouttes', nom: 'Gouttes 400 UI / goutte (à vérifier selon la spécialité)', type: 'autre', parUnite: 400, uniteNom: 'goutte' },
        { id: 'amp', nom: 'Ampoule 25 000 UI', type: 'autre', parUnite: 25000, uniteNom: 'ampoule' }
      ],
      schemas: [
        {
          id: 'prevention',
          indication: 'Prévention de la carence — dose fixe',
          mode: 'paliers', unite: 'UI', critere: 'age',
          paliers: [
            { label: '0 à 6 ans', min: 0, max: 71, dose: 400, prises: 1, libelle: '400 UI par jour' },
            { label: '6 ans et plus (à risque)', min: 72, max: null, dose: 400, prises: 1, libelle: '400 à 600 UI par jour' }
          ],
          duree: 'quotidien, toute l’année',
          note: 'Recommandation belge : 400 UI/j de la naissance à 6 ans. Dose indépendante du poids.'
        }
      ],
      precautions: ['Vérifier la concentration exacte de la spécialité : elle varie fortement d’une marque à l’autre.'],
      contreIndications: ['Hypercalcémie.'],
      sources: [SRC_CBIP]
    },

    {
      id: 'fer',
      dci: 'Fer (sels ferreux) — exprimé en fer élément',
      marques: ['Losferron', 'Ferricure', 'Fer-In-Sol (disponibilité à vérifier)'],
      categorie: 'supplement',
      frequent: false,
      verifie: false,
      synonymes: ['anemie', 'ferriprive', 'martial'],
      formes: [
        { id: 'gouttes', nom: 'Gouttes (concentration variable — à vérifier)', type: 'liquide', parMl: 25 }
      ],
      schemas: [
        {
          id: 'carence',
          indication: 'Anémie ferriprive (traitement)',
          mode: 'jour', unite: 'mg',
          doseMin: 3, doseUsuelle: 4, doseMax: 6,
          prises: [1, 2], maxJour: 200,
          duree: '3 mois, à poursuivre 2 à 3 mois après normalisation',
          note: 'Doses exprimées en FER ÉLÉMENT. Vérifier impérativement la teneur en fer élément de la spécialité.'
        }
      ],
      precautions: ['À distance des produits laitiers et du thé.', 'Selles noires, constipation.'],
      contreIndications: ['Surcharge en fer.'],
      sources: [SRC_CBIP]
    }
  ];

  global.PosocalcData = {
    CATEGORIES: CATEGORIES,
    MEDICAMENTS: MEDICAMENTS
  };
})(window);
