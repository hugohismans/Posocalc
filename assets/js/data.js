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

  /*
   * Toutes les valeurs de ce fichier ont été relues en août 2026 contre ces
   * deux sources primaires, réellement consultées (voir
   * docs/verification-posologies.md pour le détail schéma par schéma).
   */
  var SRC_BAPCOC = {
    label: {
      fr: 'Guide belge de traitement anti-infectieux en pratique ambulatoire — BAPCOC, édition mai 2026',
      nl: 'Belgische gids voor anti-infectieuze behandeling in de ambulante praktijk — BAPCOC, editie mei 2026'
    },
    url: {
      fr: 'https://organesdeconcertation.sante.belgique.be/sites/default/files/documents/guide_belge_de_traitement_anti-infectieux_en_pratique_ambulatoire_-_mai_2026.pdf',
      nl: 'https://overlegorganen.gezondheid.belgie.be/sites/default/files/documents/belgische_gids_voor_anti-infectieuze_behandeling_in_de_ambulante_praktijk_-_mei_2026_0.pdf'
    }
  };
  var SRC_CBIP = {
    label: {
      fr: 'CBIP — Répertoire commenté des médicaments, édition 2026',
      nl: 'BCFI — Gecommentarieerd Geneesmiddelenrepertorium, editie 2026'
    },
    url: { fr: 'https://www.cbip.be/fr/start', nl: 'https://www.bcfi.be/nl/start' }
  };
  var SRC_COCHRANE_CROUP = {
    label: {
      fr: 'Cochrane — Glucocorticoïdes dans la laryngite striduleuse de l’enfant (CD001955, mise à jour 2023)',
      nl: 'Cochrane — Glucocorticoïden bij pseudokroep bij kinderen (CD001955, update 2023)'
    },
    url: 'https://www.cochrane.org/evidence/CD001955_glucocorticoids-croup-children'
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
      marques: ['Clamoxyl', 'Amoxicilline EG', 'Amoxicilline Sandoz', 'Amoxicillin AB'],
      cbip: { fr: 'amoxicilline', nl: 'amoxicilline' },
      categorie: 'antibiotique',
      frequent: true,
      verifie: true,
      synonymes: ['penicilline A', 'otite', 'angine', 'pneumonie', 'lyme',
                  'oorontsteking', 'keelontsteking', 'longontsteking'],
      formes: [
        { id: 'susp125', nom: suspOrale(125), type: 'liquide', parMl: 25 },
        { id: 'susp250', nom: suspOrale(250), type: 'liquide', parMl: 50 },
        { id: 'susp500', nom: suspOrale(500), type: 'liquide', parMl: 100 },
        { id: 'cp500', nom: { fr: 'Comprimé / gélule 500 mg', nl: 'Tablet / capsule 500 mg' },
          type: 'solide', parUnite: 500, uniteNom: U_CP },
        { id: 'cp750', nom: comprime('750 mg'), type: 'solide', parUnite: 750, uniteNom: U_CP },
        { id: 'cp1000', nom: comprime('1 g'), type: 'solide', parUnite: 1000, uniteNom: U_CP }
      ],
      schemas: [
        {
          id: 'oma',
          indication: {
            fr: 'Otite moyenne aiguë, rhinosinusite aiguë, pneumonie communautaire',
            nl: 'Acute middenoorontsteking, acute rinosinusitis, buiten het ziekenhuis opgelopen longontsteking'
          },
          mode: 'jour', unite: 'mg',
          doseMin: 80, doseUsuelle: 80, doseMax: 90,
          prises: [3], maxJour: 3000,
          duree: { fr: '5 jours', nl: '5 dagen' },
          note: {
            fr: 'BAPCOC 2026 : 80-90 mg/kg/j en 3 prises pendant 5 jours ; adulte 3 × 1 g/j. En l’absence d’amélioration après 48 h, remplacer la moitié de la dose par de l’amoxicilline + acide clavulanique.',
            nl: 'BAPCOC 2026: 80-90 mg/kg/dag in 3 giften gedurende 5 dagen; volwassene 3 × 1 g/dag. Bij onvoldoende verbetering na 48 u wordt de helft van de dosis vervangen door amoxicilline + clavulaanzuur.'
          },
          sources: [SRC_BAPCOC]
        },
        {
          id: 'angine',
          indication: {
            fr: 'Pharyngite aiguë (amygdalienne) — 2e choix',
            nl: 'Acute (tonsillaire) faryngitis — tweede keuze'
          },
          mode: 'jour', unite: 'mg',
          doseMin: 50, doseUsuelle: 50, doseMax: 50,
          prises: [3], maxJour: 1500,
          duree: { fr: '7 jours', nl: '7 dagen' },
          note: {
            fr: 'La phénéticilline est le 1er choix du BAPCOC 2026 ; l’amoxicilline s’utilise si elle n’est pas disponible ou trop coûteuse. Enfant < 10 ans : 50 mg/kg/j en 3 prises ; à partir de 10 ans et adulte : 500 mg 3×/j.',
            nl: 'Feneticilline is de eerste keuze van BAPCOC 2026; amoxicilline wordt gebruikt als die niet beschikbaar of te duur is. Kind < 10 jaar: 50 mg/kg/dag in 3 giften; vanaf 10 jaar en volwassene: 500 mg 3×/dag.'
          },
          sources: [SRC_BAPCOC]
        },
        {
          id: 'lyme',
          indication: {
            fr: 'Érythème migrant (maladie de Lyme) — enfant de moins de 8 ans',
            nl: 'Erythema migrans (ziekte van Lyme) — kind jonger dan 8 jaar'
          },
          mode: 'jour', unite: 'mg',
          doseMin: 50, doseUsuelle: 50, doseMax: 50,
          prises: [3], maxJour: 1500, maxPrise: 500,
          duree: { fr: '14 jours', nl: '14 dagen' },
          note: {
            fr: 'Alternative à la doxycycline chez l’enfant de moins de 8 ans et pendant la grossesse ou l’allaitement. Maximum 500 mg par prise.',
            nl: 'Alternatief voor doxycycline bij kinderen jonger dan 8 jaar en tijdens zwangerschap of borstvoeding. Maximaal 500 mg per gift.'
          },
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
      marques: ['Augmentin', 'Amoclane / AmoclaneEG', 'Amoxiclav Sandoz', 'Amoxicillin / Clavulanic Acid AB'],
      cbip: { fr: 'amoxicilline', nl: 'amoxicilline' },
      categorie: 'antibiotique',
      frequent: true,
      verifie: true,
      synonymes: ['co-amoxiclav', 'augmentin', 'clavulaanzuur', 'morsure', 'beet'],
      doseExprimee: {
        fr: 'Les doses sont exprimées en amoxicilline.',
        nl: 'De doses zijn uitgedrukt in amoxicilline.'
      },
      formes: [
        { id: 'susp4_1_125', nom: { fr: 'Suspension 125 mg / 31,25 mg par 5 ml (4:1)', nl: 'Suspensie 125 mg / 31,25 mg per 5 ml (4:1)' }, type: 'liquide', parMl: 25 },
        { id: 'susp4_1_250', nom: { fr: 'Suspension 250 mg / 62,5 mg par 5 ml (4:1)', nl: 'Suspensie 250 mg / 62,5 mg per 5 ml (4:1)' }, type: 'liquide', parMl: 50 },
        { id: 'cp500', nom: comprime('500 mg / 125 mg'), type: 'solide', parUnite: 500, uniteNom: U_CP },
        { id: 'cp875', nom: comprime('875 mg / 125 mg'), type: 'solide', parUnite: 875, uniteNom: U_CP }
      ],
      schemas: [
        {
          id: 'stepup',
          indication: {
            fr: 'Otite moyenne aiguë / rhinosinusite sans amélioration après 48 h (traitement « step up »)',
            nl: 'Acute middenoorontsteking / rinosinusitis zonder verbetering na 48 u (step-upbehandeling)'
          },
          mode: 'jour', unite: 'mg',
          doseMin: 40, doseUsuelle: 40, doseMax: 40,
          prises: [3], maxJour: 2625,
          duree: { fr: '5 jours', nl: '5 dagen' },
          note: {
            fr: 'BAPCOC 2026 : la moitié de la dose journalière seulement passe à l’association. À donner AVEC 40 mg/kg/j d’amoxicilline seule (soit 80 mg/kg/j d’amoxicilline au total, dont 10 mg/kg/j d’acide clavulanique). Adulte : 875 mg/125 mg 3×/j.',
            nl: 'BAPCOC 2026: slechts de helft van de dagdosis wordt vervangen door de associatie. Toe te dienen SAMEN met 40 mg/kg/dag amoxicilline alleen (in totaal dus 80 mg/kg/dag amoxicilline, waarvan 10 mg/kg/dag clavulaanzuur). Volwassene: 875 mg/125 mg 3×/dag.'
          },
          sources: [SRC_BAPCOC]
        },
        {
          id: 'morsure',
          indication: {
            fr: 'Morsure de chat, de chien ou d’humain (prophylaxie ou infection)',
            nl: 'Kat-, hond- of mensenbeet (profylaxe of infectie)'
          },
          mode: 'jour', unite: 'mg',
          doseMin: 30, doseUsuelle: 35, doseMax: 40,
          prises: [3], maxJour: 1500,
          duree: { fr: '5 jours (prophylaxie) ou 7 jours (infection)', nl: '5 dagen (profylaxe) of 7 dagen (infectie)' },
          note: {
            fr: 'Vérifier systématiquement le statut vaccinal antitétanique et évaluer le risque de rage.',
            nl: 'Controleer steeds de tetanusvaccinatiestatus en evalueer het rabiësrisico.'
          },
          sources: [SRC_BAPCOC]
        }
      ],
      precautions: [
        { fr: 'Diarrhée fréquente, plus marquée qu’avec l’amoxicilline seule.',
          nl: 'Vaak diarree, meer uitgesproken dan met amoxicilline alleen.' },
        { fr: 'Aucune suspension au rapport 8:1 n’est commercialisée en Belgique : les doses élevées d’amoxicilline s’obtiennent en associant de l’amoxicilline seule.',
          nl: 'In België is geen suspensie met verhouding 8:1 op de markt: hoge amoxicillinedoses worden bereikt door amoxicilline alleen bij te geven.' }
      ],
      contreIndications: [
        ALLERGIE_PENI,
        { fr: 'Antécédent d’atteinte hépatique liée à l’association.',
          nl: 'Voorgeschiedenis van leverlijden door deze associatie.' }
      ],
      sources: [SRC_BAPCOC, SRC_CBIP]
    },

    {
      id: 'pheneticilline',
      dci: { fr: 'Phénéticilline', nl: 'Feneticilline' },
      marques: ['Broxil'],
      cbip: { fr: 'phénéticilline', nl: 'feneticilline' },
      categorie: 'antibiotique',
      frequent: true,
      verifie: true,
      synonymes: ['penicilline V', 'phenoxymethylpenicilline', 'penicilline a spectre etroit',
                  'angine', 'streptocoque', 'keelontsteking', 'streptokok', 'smalspectrumpenicilline'],
      formes: [
        { id: 'susp125', nom: suspOrale(125), type: 'liquide', parMl: 25 },
        { id: 'gel250', nom: gelule('250 mg'), type: 'solide', parUnite: 250, uniteNom: U_GEL, pasUnite: 1 },
        { id: 'gel500', nom: gelule('500 mg'), type: 'solide', parUnite: 500, uniteNom: U_GEL, pasUnite: 1 }
      ],
      schemas: [
        {
          id: 'pharyngite',
          indication: {
            fr: 'Pharyngite aiguë (amygdalienne) — 1er choix, dose fixe par âge',
            nl: 'Acute (tonsillaire) faryngitis — eerste keuze, vaste dosis per leeftijd'
          },
          mode: 'paliers', unite: 'mg', critere: 'age',
          paliers: [
            { label: { fr: 'Moins de 2 ans', nl: 'Jonger dan 2 jaar' }, min: 0, max: 23, dose: 375, prises: 3,
              libelle: { fr: '125 mg 3×/j', nl: '125 mg 3×/dag' } },
            { label: { fr: '2 à 10 ans', nl: '2 tot 10 jaar' }, min: 24, max: 131, dose: 750, prises: 3,
              libelle: { fr: '250 mg 3×/j', nl: '250 mg 3×/dag' } },
            { label: { fr: 'Plus de 10 ans et adulte', nl: 'Ouder dan 10 jaar en volwassene' }, min: 132, max: null, dose: 1500, prises: 3,
              libelle: { fr: '500 mg 3×/j', nl: '500 mg 3×/dag' } }
          ],
          duree: { fr: '7 jours', nl: '7 dagen' },
          note: {
            fr: 'La pénicilline V (phénoxyméthylpénicilline) n’est plus commercialisée en Belgique depuis mai 2019 : la phénéticilline est la seule pénicilline orale à spectre étroit disponible. Dose fixe, indépendante du poids.',
            nl: 'Penicilline V (fenoxymethylpenicilline) is sinds mei 2019 niet meer op de markt in België: feneticilline is de enige beschikbare orale smalspectrumpenicilline. Vaste dosis, onafhankelijk van het gewicht.'
          },
          sources: [SRC_BAPCOC, SRC_CBIP]
        }
      ],
      precautions: [
        { fr: 'La suspension orale pédiatrique n’est pas remboursée.',
          nl: 'De pediatrische orale suspensie wordt niet terugbetaald.' },
        { fr: 'Ne convient pas aux infections à pneumocoques (résistance trop fréquente).',
          nl: 'Niet geschikt voor pneumokokkeninfecties (te frequente resistentie).' }
      ],
      contreIndications: [ALLERGIE_PENI],
      sources: [SRC_BAPCOC, SRC_CBIP]
    },

    {
      id: 'azithromycine',
      dci: { fr: 'Azithromycine', nl: 'Azitromycine' },
      marques: ['Zitromax', 'Azithromycine EG', 'Azithromycine Sandoz'],
      cbip: { fr: 'azithromycine', nl: 'azitromycine' },
      categorie: 'antibiotique',
      frequent: true,
      verifie: true,
      synonymes: ['macrolide', 'coqueluche', 'kinkhoest', 'allergie penicilline'],
      formes: [
        { id: 'susp200', nom: suspOrale(200), type: 'liquide', parMl: 40 },
        { id: 'cp250', nom: comprime('250 mg'), type: 'solide', parUnite: 250, uniteNom: U_CP },
        { id: 'cp500', nom: comprime('500 mg'), type: 'solide', parUnite: 500, uniteNom: U_CP }
      ],
      schemas: [
        {
          id: 'court3j',
          indication: {
            fr: 'Alternative en cas d’allergie IgE aux pénicillines (pharyngite, otite, pneumonie atypique, impétigo, cellulite)',
            nl: 'Alternatief bij IgE-allergie voor penicillines (faryngitis, otitis, atypische pneumonie, impetigo, cellulitis)'
          },
          mode: 'jour', unite: 'mg',
          doseMin: 10, doseUsuelle: 10, doseMax: 10,
          prises: [1], maxJour: 500,
          duree: { fr: '3 jours', nl: '3 dagen' },
          sources: [SRC_BAPCOC, SRC_CBIP]
        },
        {
          id: 'coqueluche',
          indication: { fr: 'Coqueluche', nl: 'Kinkhoest' },
          mode: 'jour', unite: 'mg',
          doseMin: 10, doseUsuelle: 10, doseMax: 10,
          prises: [1], maxJour: 500,
          ageMinMois: 1,
          duree: { fr: '3 jours', nl: '3 dagen' },
          note: {
            fr: 'BAPCOC 2026 : 10 mg/kg en 1 prise (max. 500 mg) pendant 3 jours, à partir de 1 mois ; hors AMM avant 1 an. Pas de traitement antimicrobien chez l’enfant de plus de 1 an ni chez l’adulte, sauf pour protéger l’entourage à risque.',
            nl: 'BAPCOC 2026: 10 mg/kg in 1 gift (max. 500 mg) gedurende 3 dagen, vanaf 1 maand; off-label onder 1 jaar. Geen antimicrobiële behandeling bij kinderen ouder dan 1 jaar of bij volwassenen, tenzij om risicopersonen in de omgeving te beschermen.'
          },
          sources: [SRC_BAPCOC]
        },
        {
          id: 'lyme',
          indication: {
            fr: 'Érythème migrant en cas d’allergie aux pénicillines — dose de charge le 1er jour',
            nl: 'Erythema migrans bij penicillineallergie — oplaaddosis op dag 1'
          },
          mode: 'jour', unite: 'mg',
          doseMin: 10, doseUsuelle: 10, doseMax: 10,
          prises: [1], maxJour: 500,
          duree: { fr: '20 mg/kg le 1er jour, puis 10 mg/kg/j pendant 4 jours', nl: '20 mg/kg op dag 1, daarna 10 mg/kg/dag gedurende 4 dagen' },
          note: {
            fr: 'La dose affichée est celle des jours 2 à 5 ; le 1er jour, donner le double (max. 1 g).',
            nl: 'De weergegeven dosis geldt voor dag 2 tot 5; geef op dag 1 het dubbele (max. 1 g).'
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
      marques: ['Biclar', 'Clarithromycine EG', 'Clarithromycine Sandoz', 'Clarithromycin KRKA'],
      cbip: { fr: 'clarithromycine', nl: 'claritromycine' },
      categorie: 'antibiotique',
      frequent: true,
      verifie: true,
      synonymes: ['macrolide', 'kinkhoest'],
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
            fr: 'Posologie pédiatrique générale (CBIP)',
            nl: 'Algemene pediatrische posologie (BCFI)'
          },
          mode: 'jour', unite: 'mg',
          doseMin: 15, doseUsuelle: 15, doseMax: 15,
          prises: [2], maxJour: 1000,
          duree: { fr: 'selon l’indication', nl: 'afhankelijk van de indicatie' },
          note: {
            fr: 'Le guide BAPCOC 2026 ne retient pas la clarithromycine chez l’enfant : l’azithromycine est le macrolide de premier choix en cas d’allergie aux pénicillines.',
            nl: 'De BAPCOC-gids 2026 weerhoudt claritromycine niet bij kinderen: azitromycine is het macrolide van eerste keuze bij penicillineallergie.'
          },
          sources: [SRC_CBIP]
        }
      ],
      precautions: [
        { fr: 'Inhibiteur enzymatique puissant (CYP3A4) : vérifier les interactions.',
          nl: 'Krachtige enzymremmer (CYP3A4): controleer de interacties.' },
        QT_LONG
      ],
      contreIndications: [ALLERGIE_MACRO],
      sources: [SRC_CBIP]
    },

    {
      id: 'cefuroxime-axetil',
      dci: { fr: 'Céfuroxime axétil', nl: 'Cefuroxim axetil' },
      marques: ['Zinnat', 'Cefuroxime EG', 'Cefuroxim Sandoz'],
      cbip: { fr: 'céfuroxime', nl: 'cefuroxim' },
      categorie: 'antibiotique',
      frequent: false,
      verifie: true,
      synonymes: ['cephalosporine', 'C2G', 'cefalosporine', 'cystite', 'blaasontsteking'],
      formes: [
        { id: 'susp250', nom: suspOrale(250), type: 'liquide', parMl: 50 },
        { id: 'cp250', nom: comprime('250 mg'), type: 'solide', parUnite: 250, uniteNom: U_CP },
        { id: 'cp500', nom: comprime('500 mg'), type: 'solide', parUnite: 500, uniteNom: U_CP }
      ],
      schemas: [
        {
          id: 'cystite',
          indication: {
            fr: 'Cystite de l’enfant — 2e choix (pas en cas d’allergie IgE aux pénicillines)',
            nl: 'Blaasontsteking bij het kind — tweede keuze (niet bij IgE-allergie voor penicillines)'
          },
          mode: 'jour', unite: 'mg',
          doseMin: 30, doseUsuelle: 30, doseMax: 30,
          prises: [3], maxJour: 1500, maxPrise: 500,
          duree: { fr: '5 jours', nl: '5 dagen' },
          note: {
            fr: '10 mg/kg 3×/j, maximum 3 × 500 mg/j. En raison de la faible biodisponibilité et de la demi-vie courte, cette posologie diffère de celle du RCP.',
            nl: '10 mg/kg 3×/dag, maximaal 3 × 500 mg/dag. Wegens de lage biologische beschikbaarheid en de korte halfwaardetijd wijkt deze posologie af van die in de SKP.'
          },
          sources: [SRC_BAPCOC, SRC_CBIP]
        }
      ],
      precautions: [
        { fr: 'Goût très amer de la suspension : observance souvent médiocre chez le jeune enfant.',
          nl: 'Zeer bittere smaak van de suspensie: therapietrouw vaak moeilijk bij jonge kinderen.' },
        { fr: 'À prendre pendant le repas (absorption).', nl: 'Innemen tijdens de maaltijd (absorptie).' },
        { fr: 'Le céfuroxime axétil n’est plus recommandé par le BAPCOC 2026 dans l’otite ni la sinusite.',
          nl: 'Cefuroxim axetil wordt door BAPCOC 2026 niet meer aanbevolen bij otitis of sinusitis.' }
      ],
      contreIndications: [ALLERGIE_BETA],
      sources: [SRC_BAPCOC, SRC_CBIP]
    },

    {
      id: 'cefadroxil',
      dci: { fr: 'Céfadroxil', nl: 'Cefadroxil' },
      marques: ['Duracef', 'Cefadroxil Sandoz'],
      cbip: { fr: 'céfadroxil', nl: 'cefadroxil' },
      categorie: 'antibiotique',
      frequent: false,
      verifie: true,
      synonymes: ['cephalosporine', 'C1G', 'cefalosporine', 'impetigo'],
      formes: [
        { id: 'susp250', nom: suspOrale(250), type: 'liquide', parMl: 50 },
        { id: 'susp500', nom: suspOrale(500), type: 'liquide', parMl: 100 },
        { id: 'cp500', nom: gelule('500 mg'), type: 'solide', parUnite: 500, uniteNom: U_GEL, pasUnite: 1 }
      ],
      schemas: [
        {
          id: 'pharyngite',
          indication: {
            fr: 'Pharyngite aiguë (amygdalienne) — alternative à la phénéticilline',
            nl: 'Acute (tonsillaire) faryngitis — alternatief voor feneticilline'
          },
          mode: 'jour', unite: 'mg',
          doseMin: 30, doseUsuelle: 30, doseMax: 30,
          prises: [2], maxJour: 1000,
          duree: { fr: '5 jours', nl: '5 dagen' },
          note: {
            fr: '15 mg/kg 2×/j ; adulte 500 mg 2×/j.',
            nl: '15 mg/kg 2×/dag; volwassene 500 mg 2×/dag.'
          },
          sources: [SRC_BAPCOC, SRC_CBIP]
        },
        {
          id: 'impetigo',
          indication: { fr: 'Impétigo — alternative à la flucloxacilline', nl: 'Impetigo — alternatief voor flucloxacilline' },
          mode: 'jour', unite: 'mg',
          doseMin: 30, doseUsuelle: 30, doseMax: 30,
          prises: [2, 3], maxJour: 2000,
          duree: { fr: '7 jours', nl: '7 dagen' },
          note: {
            fr: 'Adulte : 1 g 2×/j.',
            nl: 'Volwassene: 1 g 2×/dag.'
          },
          sources: [SRC_BAPCOC, SRC_CBIP]
        }
      ],
      precautions: [],
      contreIndications: [ALLERGIE_BETA],
      sources: [SRC_BAPCOC, SRC_CBIP]
    },

    {
      id: 'flucloxacilline',
      dci: { fr: 'Flucloxacilline', nl: 'Flucloxacilline' },
      marques: ['Floxapen', 'Staphycid'],
      cbip: { fr: 'flucloxacilline', nl: 'flucloxacilline' },
      categorie: 'antibiotique',
      frequent: false,
      verifie: true,
      synonymes: ['staphylocoque', 'impetigo', 'stafylokok', 'cellulite', 'erysipele', 'wondroos'],
      formes: [
        { id: 'sirop250', nom: { fr: 'Sirop 250 mg / 5 ml', nl: 'Siroop 250 mg / 5 ml' }, type: 'liquide', parMl: 50 },
        { id: 'cp500', nom: gelule('500 mg'), type: 'solide', parUnite: 500, uniteNom: U_GEL, pasUnite: 1 }
      ],
      schemas: [
        {
          id: 'standard',
          indication: {
            fr: 'Impétigo étendu, cellulite et érysipèle — 1er choix',
            nl: 'Uitgebreide impetigo, cellulitis en erysipelas — eerste keuze'
          },
          mode: 'jour', unite: 'mg',
          doseMin: 25, doseUsuelle: 50, doseMax: 50,
          prises: [3, 4], maxJour: 2000,
          duree: { fr: '7 jours (impétigo) ou 10 jours (cellulite et érysipèle)', nl: '7 dagen (impetigo) of 10 dagen (cellulitis en erysipelas)' },
          note: {
            fr: 'Adulte : 1 à 2 g/j en 3 ou 4 prises (impétigo), 2 g/j en 4 prises (cellulite et érysipèle).',
            nl: 'Volwassene: 1 tot 2 g/dag in 3 of 4 giften (impetigo), 2 g/dag in 4 giften (cellulitis en erysipelas).'
          },
          sources: [SRC_BAPCOC, SRC_CBIP]
        }
      ],
      precautions: [
        { fr: 'À prendre à jeun (1 h avant le repas).', nl: 'Op een lege maag innemen (1 u voor de maaltijd).' },
        { fr: 'Hépatotoxicité rare mais décrite.', nl: 'Zeldzame maar beschreven levertoxiciteit.' },
        { fr: 'Hospitaliser l’enfant de moins de 3 ans atteint de cellulite ou d’érysipèle.',
          nl: 'Hospitaliseer kinderen jonger dan 3 jaar met cellulitis of erysipelas.' }
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
      marques: ['Bactrim Forte', 'Eusaprim'],
      cbip: { fr: 'cotrimoxazole', nl: 'cotrimoxazol' },
      categorie: 'antibiotique',
      frequent: false,
      verifie: true,
      synonymes: ['bactrim', 'eusaprim', 'otite', 'sinusite', 'morsure', 'kinkhoest', 'beet'],
      doseExprimee: {
        fr: 'Les doses sont exprimées en sulfaméthoxazole (SMX) ; 30 mg/kg/j de SMX = 6 mg/kg/j de triméthoprime.',
        nl: 'De doses zijn uitgedrukt in sulfamethoxazol (SMX); 30 mg/kg/dag SMX = 6 mg/kg/dag trimethoprim.'
      },
      formes: [
        { id: 'sirop', nom: { fr: 'Suspension 200 mg SMX / 40 mg TMP par 5 ml', nl: 'Suspensie 200 mg SMX / 40 mg TMP per 5 ml' }, type: 'liquide', parMl: 40 },
        { id: 'cpforte', nom: comprime('800 mg / 160 mg (forte)'), type: 'solide', parUnite: 800, uniteNom: U_CP }
      ],
      schemas: [
        {
          id: 'orl',
          indication: {
            fr: 'Otite moyenne aiguë ou rhinosinusite avec allergie IgE aux pénicillines',
            nl: 'Acute middenoorontsteking of rinosinusitis bij IgE-allergie voor penicillines'
          },
          mode: 'jour', unite: 'mg',
          doseMin: 30, doseUsuelle: 30, doseMax: 30,
          prises: [2], maxJour: 1600,
          ageMinMois: 1,
          duree: { fr: '5 jours', nl: '5 dagen' },
          note: {
            fr: 'Orienter vers un traitement intraveineux l’enfant gravement malade allergique aux pénicillines (résistance croissante).',
            nl: 'Verwijs een ernstig ziek kind met penicillineallergie door voor intraveneuze behandeling (toenemende resistentie).'
          },
          sources: [SRC_BAPCOC]
        },
        {
          id: 'morsure',
          indication: {
            fr: 'Morsure avec allergie IgE aux pénicillines (à associer à la clindamycine)',
            nl: 'Beet bij IgE-allergie voor penicillines (te combineren met clindamycine)'
          },
          mode: 'jour', unite: 'mg',
          doseMin: 30, doseUsuelle: 30, doseMax: 30,
          prises: [2], maxJour: 1600,
          ageMinMois: 1,
          duree: { fr: '5 jours (prophylaxie) ou 7 jours (infection)', nl: '5 dagen (profylaxe) of 7 dagen (infectie)' },
          sources: [SRC_BAPCOC]
        },
        {
          id: 'coqueluche',
          indication: {
            fr: 'Coqueluche en cas d’hypersensibilité à l’azithromycine',
            nl: 'Kinkhoest bij overgevoeligheid voor azitromycine'
          },
          mode: 'jour', unite: 'mg',
          doseMin: 30, doseUsuelle: 30, doseMax: 30,
          prises: [2], maxJour: 1600,
          ageMinMois: 1,
          duree: { fr: '14 jours', nl: '14 dagen' },
          sources: [SRC_BAPCOC]
        }
      ],
      precautions: [
        { fr: 'Photosensibilité.', nl: 'Fotosensibilisatie.' },
        { fr: 'Contrôle de la fonction rénale si traitement prolongé.',
          nl: 'Controle van de nierfunctie bij langdurige behandeling.' }
      ],
      contreIndications: [
        { fr: 'Nourrisson de moins de 1 mois.', nl: 'Zuigeling jonger dan 1 maand.' },
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
      verifie: true,
      synonymes: ['cystite', 'infection urinaire', 'blaasontsteking', 'urineweginfectie'],
      formes: [
        { id: 'gel50', nom: gelule('50 mg'), type: 'solide', parUnite: 50, uniteNom: U_GEL, pasUnite: 1 },
        { id: 'gel100', nom: gelule('100 mg'), type: 'solide', parUnite: 100, uniteNom: U_GEL, pasUnite: 1 }
      ],
      schemas: [
        {
          id: 'cystite',
          indication: { fr: 'Cystite de l’enfant de moins de 12 ans — 1er choix', nl: 'Blaasontsteking bij het kind jonger dan 12 jaar — eerste keuze' },
          mode: 'jour', unite: 'mg',
          doseMin: 5, doseUsuelle: 5, doseMax: 6,
          prises: [4], maxJour: 300,
          ageMinMois: 1,
          duree: { fr: '5 jours', nl: '5 dagen' },
          note: {
            fr: 'Chez l’enfant, la dose s’obtient par préparation magistrale (suspension pédiatrique 30 mg/5 ml FTM, ou gélules de 10 à 50 mg) : les gélules commercialisées de 50 et 100 mg sont trop dosées pour la plupart des enfants. Adulte : 100 mg 3×/j.',
            nl: 'Bij kinderen wordt de dosis bereid als magistrale bereiding (pediatrische suspensie 30 mg/5 ml FTM, of capsules van 10 tot 50 mg): de in de handel verkrijgbare capsules van 50 en 100 mg zijn voor de meeste kinderen te hoog gedoseerd. Volwassene: 100 mg 3×/dag.'
          },
          sources: [SRC_BAPCOC, SRC_CBIP]
        }
      ],
      precautions: [
        { fr: 'À prendre pendant le repas.', nl: 'Innemen tijdens de maaltijd.' },
        { fr: 'Colore les urines en brun.', nl: 'Kleurt de urine bruin.' },
        { fr: 'Sauf première cystite chez une fille de plus de 5 ans, tout enfant avec une infection urinaire doit être adressé pour exclure une anomalie des voies urinaires.',
          nl: 'Behalve bij een eerste blaasontsteking bij een meisje ouder dan 5 jaar moet elk kind met een urineweginfectie worden doorverwezen om een afwijking van de urinewegen uit te sluiten.' }
      ],
      contreIndications: [
        { fr: 'Nourrisson de moins de 1 mois.', nl: 'Zuigeling jonger dan 1 maand.' },
        { fr: 'Insuffisance rénale sévère.', nl: 'Ernstige nierinsufficiëntie.' },
        { fr: 'Déficit en G6PD.', nl: 'G6PD-deficiëntie.' }
      ],
      sources: [SRC_BAPCOC, SRC_CBIP]
    },

    {
      id: 'metronidazole',
      dci: { fr: 'Métronidazole', nl: 'Metronidazol' },
      marques: ['Flagyl'],
      cbip: { fr: 'métronidazole', nl: 'metronidazol' },
      categorie: 'antibiotique',
      frequent: false,
      verifie: false,
      synonymes: ['anaerobie', 'giardia', 'lambliase', 'anaeroob', 'giardiasis'],
      formes: [
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
          note: {
            fr: 'Dose adulte confirmée (500 mg 3×/j pendant 7 jours). La dose pédiatrique en mg/kg n’est PAS reprise par le CBIP ni par le BAPCOC : à contrôler dans le RCP avant prescription.',
            nl: 'Volwassendosis bevestigd (500 mg 3×/dag gedurende 7 dagen). De pediatrische dosis in mg/kg staat NIET in het BCFI noch in de BAPCOC-gids: te controleren in de SKP vóór voorschrijven.'
          },
          sources: [SRC_CBIP]
        },
        {
          id: 'giardia',
          indication: { fr: 'Giardiase (lambliase)', nl: 'Giardiasis (lambliasis)' },
          mode: 'jour', unite: 'mg',
          doseMin: 15, doseUsuelle: 15, doseMax: 20,
          prises: [3, 2], maxJour: 1000,
          duree: { fr: '7 à 10 jours', nl: '7 tot 10 dagen' },
          note: {
            fr: 'Dose adulte confirmée (500 mg 2×/j pendant 7 à 10 jours, ou 2 g 1×/j pendant 3 jours). La dose pédiatrique en mg/kg n’est PAS reprise par le CBIP : à contrôler dans le RCP.',
            nl: 'Volwassendosis bevestigd (500 mg 2×/dag gedurende 7 tot 10 dagen, of 2 g 1×/dag gedurende 3 dagen). De pediatrische dosis in mg/kg staat NIET in het BCFI: te controleren in de SKP.'
          },
          sources: [SRC_CBIP]
        }
      ],
      precautions: [
        { fr: 'Effet antabuse : pas d’alcool (formes destinées aux adolescents).',
          nl: 'Antabuseffect: geen alcohol (vormen voor adolescenten).' },
        { fr: 'Goût métallique.', nl: 'Metaalsmaak.' },
        { fr: 'Aucune suspension orale ni comprimé de 250 mg n’est commercialisé en Belgique : seul le comprimé de 500 mg existe, d’où la nécessité d’une préparation magistrale chez le jeune enfant.',
          nl: 'In België is geen orale suspensie noch tablet van 250 mg op de markt: enkel de tablet van 500 mg bestaat, vandaar de noodzaak van een magistrale bereiding bij jonge kinderen.' }
      ],
      contreIndications: [],
      sources: [SRC_CBIP]
    },

    {
      id: 'clindamycine',
      dci: { fr: 'Clindamycine', nl: 'Clindamycine' },
      marques: ['Dalacin C'],
      cbip: { fr: 'clindamycine', nl: 'clindamycine' },
      categorie: 'antibiotique',
      frequent: false,
      verifie: true,
      synonymes: ['lincosamide', 'morsure', 'impetigo', 'beet'],
      formes: [
        { id: 'gel150', nom: gelule('150 mg'), type: 'solide', parUnite: 150, uniteNom: U_GEL, pasUnite: 1 },
        { id: 'gel300', nom: gelule('300 mg'), type: 'solide', parUnite: 300, uniteNom: U_GEL, pasUnite: 1 }
      ],
      schemas: [
        {
          id: 'peau',
          indication: {
            fr: 'Impétigo, cellulite ou érysipèle avec allergie IgE aux pénicillines',
            nl: 'Impetigo, cellulitis of erysipelas bij IgE-allergie voor penicillines'
          },
          mode: 'jour', unite: 'mg',
          doseMin: 20, doseUsuelle: 20, doseMax: 20,
          prises: [3, 4], maxJour: 1800,
          duree: { fr: '7 jours (impétigo) ou 10 jours (cellulite et érysipèle)', nl: '7 dagen (impetigo) of 10 dagen (cellulitis en erysipelas)' },
          sources: [SRC_BAPCOC]
        },
        {
          id: 'morsure',
          indication: {
            fr: 'Morsure avec allergie IgE aux pénicillines (à associer au cotrimoxazole)',
            nl: 'Beet bij IgE-allergie voor penicillines (te combineren met cotrimoxazol)'
          },
          mode: 'jour', unite: 'mg',
          doseMin: 25, doseUsuelle: 25, doseMax: 25,
          prises: [3, 4], maxJour: 1800,
          duree: { fr: '5 jours (prophylaxie) ou 7 jours (infection)', nl: '5 dagen (profylaxe) of 7 dagen (infectie)' },
          sources: [SRC_BAPCOC]
        }
      ],
      precautions: [
        { fr: 'Risque de colite à Clostridioides difficile.', nl: 'Risico op Clostridioides difficile-colitis.' },
        { fr: 'Pas de forme liquide commercialisée en Belgique : la plus petite gélule contient 150 mg.',
          nl: 'Geen vloeibare vorm op de markt in België: de kleinste capsule bevat 150 mg.' }
      ],
      contreIndications: [],
      sources: [SRC_BAPCOC, SRC_CBIP]
    },

    {
      id: 'doxycycline',
      dci: { fr: 'Doxycycline', nl: 'Doxycycline' },
      marques: ['Vibratab', 'Doxycycline EG', 'Doxycycline Sandoz'],
      cbip: { fr: 'doxycycline', nl: 'doxycycline' },
      categorie: 'antibiotique',
      frequent: false,
      verifie: true,
      synonymes: ['tetracycline', 'lyme', 'borreliose', 'ziekte van lyme', 'teek'],
      formes: [
        { id: 'cp100', nom: comprime('100 mg'), type: 'solide', parUnite: 100, uniteNom: U_CP },
        { id: 'cp200', nom: comprime('200 mg'), type: 'solide', parUnite: 200, uniteNom: U_CP }
      ],
      schemas: [
        {
          id: 'lyme',
          indication: {
            fr: 'Érythème migrant (maladie de Lyme) — 1er choix à partir de 8 ans',
            nl: 'Erythema migrans (ziekte van Lyme) — eerste keuze vanaf 8 jaar'
          },
          mode: 'jour', unite: 'mg',
          doseMin: 4, doseUsuelle: 4, doseMax: 4,
          prises: [2], maxJour: 200, maxPrise: 100,
          ageMinMois: 96,
          duree: { fr: '10 jours', nl: '10 dagen' },
          note: {
            fr: 'Maximum 100 mg par prise. Pas d’antibioprophylaxie après une morsure de tique : ne traiter qu’à l’apparition de l’érythème migrant.',
            nl: 'Maximaal 100 mg per gift. Geen antibioticaprofylaxe na een tekenbeet: pas behandelen bij het verschijnen van erythema migrans.'
          },
          sources: [SRC_BAPCOC]
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
      marques: ['Perdolan', 'Dafalgan', 'Panadol', 'Algostase Mono', 'Paracetamol EG', 'Paracetamol AB'],
      cbip: { fr: 'paracétamol', nl: 'paracetamol' },
      categorie: 'antalgique',
      frequent: true,
      verifie: true,
      synonymes: ['fievre', 'acetaminophene', 'douleur', 'koorts', 'pijn'],
      formes: [
        { id: 'sirop30', nom: { fr: 'Sirop pédiatrique 30 mg / ml (Dafalgan)', nl: 'Pediatrische siroop 30 mg / ml (Dafalgan)' }, type: 'liquide', parMl: 30 },
        { id: 'sirop32', nom: { fr: 'Sirop enfants 32 mg / ml (Perdolan)', nl: 'Siroop voor kinderen 32 mg / ml (Perdolan)' }, type: 'liquide', parMl: 32 },
        { id: 'suppo80', nom: { fr: 'Suppositoire 80 mg', nl: 'Zetpil 80 mg' }, type: 'suppo', parUnite: 80, uniteNom: U_SUPPO },
        { id: 'suppo100', nom: { fr: 'Suppositoire 100 mg', nl: 'Zetpil 100 mg' }, type: 'suppo', parUnite: 100, uniteNom: U_SUPPO },
        { id: 'suppo150', nom: { fr: 'Suppositoire 150 mg', nl: 'Zetpil 150 mg' }, type: 'suppo', parUnite: 150, uniteNom: U_SUPPO },
        { id: 'suppo200', nom: { fr: 'Suppositoire 200 mg', nl: 'Zetpil 200 mg' }, type: 'suppo', parUnite: 200, uniteNom: U_SUPPO },
        { id: 'suppo300', nom: { fr: 'Suppositoire 300 mg', nl: 'Zetpil 300 mg' }, type: 'suppo', parUnite: 300, uniteNom: U_SUPPO },
        { id: 'suppo350', nom: { fr: 'Suppositoire 350 mg', nl: 'Zetpil 350 mg' }, type: 'suppo', parUnite: 350, uniteNom: U_SUPPO },
        { id: 'sachet250', nom: { fr: 'Granulés 250 mg (sachet)', nl: 'Granulaat 250 mg (zakje)' }, type: 'sachet', parUnite: 250, uniteNom: U_SACHET },
        { id: 'cp500', nom: comprime('500 mg'), type: 'solide', parUnite: 500, uniteNom: U_CP }
      ],
      schemas: [
        {
          id: 'standard',
          indication: { fr: 'Fièvre / douleur', nl: 'Koorts / pijn' },
          mode: 'prise', unite: 'mg',
          doseMin: 15, doseUsuelle: 15, doseMax: 15,
          prises: [4, 3], maxJour: 4000, maxPrise: 1000,
          maxParKgJour: 60,
          duree: { fr: 'selon les symptômes', nl: 'afhankelijk van de symptomen' },
          note: {
            fr: 'CBIP : enfant et adulte de moins de 50 kg : 15 mg/kg jusqu’à 4×/jour, maximum 60 mg/kg/jour. Adulte d’au moins 50 kg : 500 mg à 1 g jusqu’à 4×/jour (max. 4 g/jour), ramené à 3 g/jour en présence de facteurs de risque.',
            nl: 'BCFI: kind en volwassene onder 50 kg: 15 mg/kg tot 4×/dag, maximaal 60 mg/kg/dag. Volwassene van minstens 50 kg: 500 mg tot 1 g tot 4×/dag (max. 4 g/dag), teruggebracht tot 3 g/dag bij risicofactoren.'
          },
          sources: [SRC_CBIP]
        }
      ],
      precautions: [
        { fr: 'Premier choix contre la fièvre et la douleur chez l’enfant (CBIP).', nl: 'Eerste keuze bij koorts en pijn bij kinderen (BCFI).' },
        { fr: 'L’absorption par voie rectale est inconstante : la voie orale est à préférer, y compris chez le nourrisson.',
          nl: 'De rectale absorptie is wisselvallig: de orale weg verdient de voorkeur, ook bij zuigelingen.' },
        { fr: 'Attention au cumul avec les spécialités combinées contenant du paracétamol.',
          nl: 'Let op cumulatie met combinatiepreparaten die paracetamol bevatten.' },
        { fr: 'Seuil de toxicité hépatique abaissé chez l’enfant : une toxicité apparaît dès 150 mg/kg.',
          nl: 'Verlaagde drempel voor levertoxiciteit bij kinderen: toxiciteit treedt al op vanaf 150 mg/kg.' }
      ],
      contreIndications: [
        { fr: 'Insuffisance hépatique sévère, insuffisance rénale sévère.', nl: 'Ernstige leverinsufficiëntie, ernstige nierinsufficiëntie.' }
      ],
      sources: [SRC_CBIP]
    },

    {
      id: 'ibuprofene',
      dci: { fr: 'Ibuprofène', nl: 'Ibuprofen' },
      marques: ['Nurofen', 'Brufen', 'Algidrin', 'Ibuprofen EG', 'Ibuprofen Sandoz', 'Ibuprofen AB'],
      cbip: { fr: 'ibuprofène', nl: 'ibuprofen' },
      categorie: 'antalgique',
      frequent: true,
      verifie: true,
      synonymes: ['AINS', 'fievre', 'douleur', 'NSAID', 'koorts', 'pijn'],
      formes: [
        { id: 'sirop20', nom: { fr: 'Suspension 100 mg / 5 ml (20 mg/ml, 2 %)', nl: 'Suspensie 100 mg / 5 ml (20 mg/ml, 2 %)' }, type: 'liquide', parMl: 20 },
        { id: 'sirop40', nom: { fr: 'Suspension 200 mg / 5 ml (40 mg/ml, 4 %)', nl: 'Suspensie 200 mg / 5 ml (40 mg/ml, 4 %)' }, type: 'liquide', parMl: 40 },
        { id: 'suppo60', nom: { fr: 'Suppositoire 60 mg', nl: 'Zetpil 60 mg' }, type: 'suppo', parUnite: 60, uniteNom: U_SUPPO },
        { id: 'suppo125', nom: { fr: 'Suppositoire 125 mg', nl: 'Zetpil 125 mg' }, type: 'suppo', parUnite: 125, uniteNom: U_SUPPO },
        { id: 'cp200', nom: comprime('200 mg'), type: 'solide', parUnite: 200, uniteNom: U_CP },
        { id: 'cp400', nom: comprime('400 mg'), type: 'solide', parUnite: 400, uniteNom: U_CP }
      ],
      schemas: [
        {
          id: 'standard',
          indication: { fr: 'Fièvre / douleur / inflammation', nl: 'Koorts / pijn / ontsteking' },
          mode: 'prise', unite: 'mg',
          doseMin: 7, doseUsuelle: 10, doseMax: 10,
          prises: [3, 4], maxJour: 1200, maxPrise: 400,
          maxParKgJour: 30,
          ageMinMois: 3, poidsMinKg: 5,
          duree: { fr: 'le plus court possible', nl: 'zo kort mogelijk' },
          note: {
            fr: 'CBIP : enfant de plus de 3 mois : 7 à 10 mg/kg 3 à 4×/jour (max. 30 mg/kg/jour, max. 400 mg 4×/jour). Adulte d’au moins 40 kg, douleur et fièvre : 200 à 400 mg 3×/jour, maximum 1,2 g/jour.',
            nl: 'BCFI: kind ouder dan 3 maanden: 7 tot 10 mg/kg 3 tot 4×/dag (max. 30 mg/kg/dag, max. 400 mg 4×/dag). Volwassene van minstens 40 kg, pijn en koorts: 200 tot 400 mg 3×/dag, maximaal 1,2 g/dag.'
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
      id: 'methylprednisolone',
      dci: { fr: 'Méthylprednisolone', nl: 'Methylprednisolon' },
      marques: ['Medrol'],
      cbip: { fr: 'méthylprednisolone', nl: 'methylprednisolon' },
      categorie: 'corticoide',
      frequent: true,
      verifie: false,
      synonymes: ['medrol', 'corticoide', 'corticosteroid', 'asthme', 'astma'],
      formes: [
        { id: 'cp4', nom: comprime('4 mg'), type: 'solide', parUnite: 4, uniteNom: U_CP, pasUnite: 0.25 },
        { id: 'cp16', nom: comprime('16 mg'), type: 'solide', parUnite: 16, uniteNom: U_CP, pasUnite: 0.25 },
        { id: 'cp32', nom: comprime('32 mg'), type: 'solide', parUnite: 32, uniteNom: U_CP, pasUnite: 0.25 }
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
            fr: 'ATTENTION : le CBIP ne donne PAS de dose pédiatrique en mg/kg pour les corticoïdes systémiques ; la dose affichée n’a pas pu être confirmée contre une source primaire belge. Dose adulte confirmée : 30 à 40 mg de (méthyl)prednisolone par jour pendant environ 7 jours en cas d’exacerbation sévère. Équivalence confirmée : 4 mg de méthylprednisolone ≈ 5 mg de prednisolone ≈ 20 mg d’hydrocortisone.',
            nl: 'OPGELET: het BCFI geeft GEEN pediatrische dosis in mg/kg voor systemische corticosteroïden; de weergegeven dosis kon niet tegen een Belgische primaire bron worden bevestigd. Bevestigde volwassendosis: 30 tot 40 mg (methyl)prednisolon per dag gedurende ongeveer 7 dagen bij een ernstige exacerbatie. Bevestigde equivalentie: 4 mg methylprednisolon ≈ 5 mg prednisolon ≈ 20 mg hydrocortison.'
          },
          sources: [SRC_CBIP]
        }
      ],
      precautions: [
        { fr: 'À prendre le matin, ce qui respecte mieux le rythme circadien de la cortisolémie.', nl: '’s Ochtends innemen, wat het circadiane ritme van het cortisol beter respecteert.' },
        { fr: 'Le comprimé est quadrisécable (sécabilité non quantitative).', nl: 'De tablet is in vier deelbaar (niet-kwantitatieve deelbaarheid).' },
        { fr: 'La méthylprednisolone remplace en pratique la prednisolone, qui n’a plus de spécialité en Belgique.',
          nl: 'Methylprednisolon vervangt in de praktijk prednisolon, waarvoor in België geen specialiteit meer bestaat.' }
      ],
      contreIndications: [
        { fr: 'Infection systémique non traitée.', nl: 'Onbehandelde systemische infectie.' }
      ],
      sources: [SRC_CBIP]
    },

    {
      id: 'prednisolone',
      dci: { fr: 'Prednisolone', nl: 'Prednisolon' },
      marques: ['Aucune spécialité en Belgique — préparation magistrale uniquement'],
      cbip: { fr: 'prednisolone', nl: 'prednisolon' },
      categorie: 'corticoide',
      frequent: false,
      verifie: false,
      synonymes: ['corticoide', 'asthme', 'crise', 'astma', 'corticosteroid', 'prednisone'],
      formes: [],
      schemas: [
        {
          id: 'asthme',
          indication: { fr: 'Exacerbation d’asthme', nl: 'Astma-exacerbatie' },
          mode: 'jour', unite: 'mg',
          doseMin: 1, doseUsuelle: 1, doseMax: 2,
          prises: [1], maxJour: 40,
          duree: { fr: '3 à 5 jours', nl: '3 tot 5 dagen' },
          note: {
            fr: 'ATTENTION : il n’existe plus de spécialité à base de prednisone ou de prednisolone en Belgique (CBIP 2026) ; seule une préparation magistrale est possible, et il n’existe pas de formulation FTM. En pratique, utiliser la méthylprednisolone (Medrol) : 4 mg ≈ 5 mg de prednisolone. La dose pédiatrique en mg/kg n’est pas reprise par le CBIP.',
            nl: 'OPGELET: er bestaat in België geen specialiteit meer op basis van prednison of prednisolon (BCFI 2026); enkel een magistrale bereiding is mogelijk, en er is geen TMF-formulering. Gebruik in de praktijk methylprednisolon (Medrol): 4 mg ≈ 5 mg prednisolon. De pediatrische dosis in mg/kg staat niet in het BCFI.'
          },
          sources: [SRC_CBIP]
        }
      ],
      precautions: [
        { fr: 'À prendre le matin.', nl: '’s Ochtends innemen.' },
        { fr: 'Pas de décroissance nécessaire pour une cure courte.', nl: 'Geen afbouw nodig bij een korte kuur.' }
      ],
      contreIndications: [
        { fr: 'Infection systémique non traitée.', nl: 'Onbehandelde systemische infectie.' }
      ],
      sources: [SRC_CBIP]
    },

    {
      id: 'dexamethasone',
      dci: { fr: 'Dexaméthasone', nl: 'Dexamethason' },
      marques: ['Aacidexam (solution injectable)', 'Forme orale : préparation magistrale uniquement'],
      cbip: { fr: 'dexaméthasone', nl: 'dexamethason' },
      categorie: 'corticoide',
      frequent: false,
      verifie: false,
      synonymes: ['laryngite', 'croup', 'pseudo-croup', 'valse kroep', 'laryngitis', 'pseudokroep'],
      formes: [
        { id: 'sol5', nom: { fr: 'Solution injectable 5 mg / ml (ampoule, utilisée per os)', nl: 'Oplossing voor injectie 5 mg / ml (ampul, per os gebruikt)' },
          type: 'liquide', parMl: 5,
          note: { fr: 'Seule présentation commercialisée en Belgique (Aacidexam). L’administration per os de la solution injectable est un usage hors RCP.',
                  nl: 'Enige in België op de markt zijnde presentatie (Aacidexam). Orale toediening van de injectieoplossing is off-labelgebruik.' } }
      ],
      schemas: [
        {
          id: 'laryngite',
          indication: {
            fr: 'Laryngite striduleuse (pseudo-croup) — dose unique',
            nl: 'Laryngitis stridulosa (pseudokroep) — eenmalige dosis'
          },
          mode: 'unique', unite: 'mg',
          doseMin: 0.15, doseUsuelle: 0.15, doseMax: 0.6,
          prises: [1], maxJour: 16,
          duree: {
            fr: 'dose unique, à répéter éventuellement après 24 h',
            nl: 'eenmalige dosis, eventueel te herhalen na 24 u'
          },
          note: {
            fr: 'La revue Cochrane (mise à jour 2023) conclut que 0,15 mg/kg POURRAIT être aussi efficace que la dose standard de 0,6 mg/kg, mais que la dose de 0,6 mg/kg réduit probablement davantage la sévérité à 24 h ; d’autres études sont nécessaires. Le CBIP ne donne pas de dose chiffrée : il indique seulement que les corticoïdes par voie orale sont proposés dans les formes légères et la nébulisation dans les formes sévères. La dose en mg/kg n’a donc pas pu être confirmée contre une source primaire belge.',
            nl: 'De Cochrane-review (update 2023) besluit dat 0,15 mg/kg MOGELIJK even doeltreffend is als de standaarddosis van 0,6 mg/kg, maar dat 0,6 mg/kg de ernst na 24 u waarschijnlijk sterker vermindert; verder onderzoek is nodig. Het BCFI vermeldt geen cijfermatige dosis: het geeft enkel aan dat orale corticosteroïden worden voorgesteld bij lichte vormen en verneveling bij ernstige vormen. De dosis in mg/kg kon dus niet tegen een Belgische primaire bron worden bevestigd.'
          },
          sources: [SRC_CBIP, SRC_COCHRANE_CROUP]
        }
      ],
      precautions: [
        { fr: 'La dexaméthasone à usage oral n’est plus disponible comme spécialité en Belgique (CBIP 2026) : elle doit être prescrite en préparation magistrale.',
          nl: 'Dexamethason voor oraal gebruik is in België niet meer beschikbaar als specialiteit (BCFI 2026): ze moet als magistrale bereiding worden voorgeschreven.' },
        { fr: 'La laryngite striduleuse n’est pas une indication d’antibiotique (BAPCOC).',
          nl: 'Laryngitis stridulosa is geen indicatie voor een antibioticum (BAPCOC).' }
      ],
      contreIndications: [
        { fr: 'Infection systémique non traitée.', nl: 'Onbehandelde systemische infectie.' }
      ],
      sources: [SRC_CBIP]
    },

    /* ============================================================== */
    /* ALLERGIE                                                       */
    /* ============================================================== */
    {
      id: 'cetirizine',
      dci: { fr: 'Cétirizine', nl: 'Cetirizine' },
      marques: ['Zyrtec', 'Cetirizine EG', 'Cetirizine Sandoz', 'Cetirizin AB'],
      cbip: { fr: 'cétirizine', nl: 'cetirizine' },
      categorie: 'allergie',
      frequent: true,
      verifie: true,
      synonymes: ['antihistaminique', 'urticaire', 'rhinite', 'antihistaminicum', 'netelroos', 'hooikoorts', 'zyrtec'],
      formes: [
        { id: 'cp10', nom: { fr: 'Comprimé sécable 10 mg', nl: 'Deelbare tablet 10 mg' }, type: 'solide', parUnite: 10, uniteNom: U_CP }
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
            { label: { fr: '6 à 11 ans', nl: '6 tot 11 jaar' }, min: 72, max: 143, dose: 10, prises: 2,
              libelle: { fr: '5 mg (½ comprimé) 2×/j', nl: '5 mg (½ tablet) 2×/dag' } },
            { label: { fr: '12 ans et plus', nl: '12 jaar en ouder' }, min: 144, max: null, dose: 10, prises: 1,
              libelle: { fr: '10 mg 1×/j', nl: '10 mg 1×/dag' } }
          ],
          duree: { fr: 'selon les symptômes', nl: 'afhankelijk van de symptomen' },
          note: {
            fr: 'Dose fixe par tranche d’âge : elle ne dépend pas du poids. Le CBIP ne donne pas de dose en dessous de 6 ans et la solution buvable de 1 mg/ml n’est plus disponible depuis avril 2024 : chez l’enfant de moins de 6 ans, envisager la desloratadine, qui existe encore en sirop.',
            nl: 'Vaste dosis per leeftijdsgroep: ze hangt niet af van het gewicht. Het BCFI geeft geen dosis onder 6 jaar en de drank van 1 mg/ml is sinds april 2024 niet meer beschikbaar: overweeg bij kinderen jonger dan 6 jaar desloratadine, dat nog als siroop bestaat.'
          },
          sources: [SRC_CBIP]
        }
      ],
      precautions: [
        { fr: 'Somnolence possible malgré le caractère « peu sédatif ».',
          nl: 'Slaperigheid mogelijk ondanks het « weinig sederend » karakter.' },
        { fr: 'Plus aucune forme liquide n’est commercialisée en Belgique : seul le comprimé sécable de 10 mg existe.',
          nl: 'Er is in België geen vloeibare vorm meer op de markt: enkel de deelbare tablet van 10 mg bestaat.' }
      ],
      contreIndications: [
        { fr: 'Enfant de moins de 6 ans : pas de posologie ni de forme adaptée en Belgique.', nl: 'Kind jonger dan 6 jaar: geen posologie noch aangepaste vorm in België.' }
      ],
      sources: [SRC_CBIP]
    },

    {
      id: 'desloratadine',
      dci: { fr: 'Desloratadine', nl: 'Desloratadine' },
      marques: ['Aerius (comprimés)', 'Desloratadine EG (solution buvable)', 'Desloratadine Teva (orodispersible 2,5 mg)'],
      cbip: { fr: 'desloratadine', nl: 'desloratadine' },
      categorie: 'allergie',
      frequent: false,
      verifie: true,
      synonymes: ['antihistaminique', 'rhinite', 'antihistaminicum', 'hooikoorts', 'aerius'],
      formes: [
        { id: 'sirop', nom: { fr: 'Solution buvable 0,5 mg / ml', nl: 'Drank 0,5 mg / ml' }, type: 'liquide', parMl: 0.5 },
        { id: 'cp2_5', nom: { fr: 'Comprimé orodispersible 2,5 mg', nl: 'Orodispergeerbare tablet 2,5 mg' }, type: 'solide', parUnite: 2.5, uniteNom: U_CP, pasUnite: 1 },
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
            { label: { fr: '1 à 5 ans', nl: '1 tot 5 jaar' }, min: 12, max: 71, dose: 1.25, prises: 1,
              libelle: { fr: '1,25 mg (2,5 ml de solution) 1×/j', nl: '1,25 mg (2,5 ml drank) 1×/dag' } },
            { label: { fr: '6 à 11 ans', nl: '6 tot 11 jaar' }, min: 72, max: 143, dose: 2.5, prises: 1,
              libelle: { fr: '2,5 mg (5 ml de solution) 1×/j', nl: '2,5 mg (5 ml drank) 1×/dag' } },
            { label: { fr: '12 ans et plus', nl: '12 jaar en ouder' }, min: 144, max: null, dose: 5, prises: 1,
              libelle: { fr: '5 mg (10 ml de solution) 1×/j', nl: '5 mg (10 ml drank) 1×/dag' } }
          ],
          duree: { fr: 'selon les symptômes', nl: 'afhankelijk van de symptomen' },
          sources: [SRC_CBIP]
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
      synonymes: ['prurit', 'sedatif', 'antihistaminique', 'jeuk', 'kalmerend', 'atarax'],
      formes: [
        { id: 'cp25', nom: { fr: 'Comprimé sécable 25 mg', nl: 'Deelbare tablet 25 mg' }, type: 'solide', parUnite: 25, uniteNom: U_CP }
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
          note: {
            fr: 'ATTENTION : le CBIP ne donne qu’une dose adulte (25 mg jusqu’à 4×/jour, maximum 100 mg/jour) ; la dose pédiatrique en mg/kg n’a pas pu être confirmée contre une source primaire belge. Aucun sirop n’est commercialisé en Belgique : seul le comprimé sécable de 25 mg existe.',
            nl: 'OPGELET: het BCFI geeft enkel een volwassendosis (25 mg tot 4×/dag, maximaal 100 mg/dag); de pediatrische dosis in mg/kg kon niet tegen een Belgische primaire bron worden bevestigd. Er is in België geen siroop op de markt: enkel de deelbare tablet van 25 mg bestaat.'
          },
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
      marques: ['Ventolin', 'Airomir', 'Novolizer Salbutamol'],
      cbip: { fr: 'salbutamol', nl: 'salbutamol' },
      categorie: 'respiratoire',
      frequent: true,
      verifie: true,
      synonymes: ['asthme', 'bronchodilatateur', 'aerosol', 'ventoline', 'astma', 'puffer', 'kortwerkend'],
      formes: [
        { id: 'mdi', nom: { fr: 'Aérosol-doseur 100 µg / bouffée (+ chambre d’inhalation)',
                            nl: 'Dosisaerosol 100 µg / pufje (+ voorzetkamer)' },
          type: 'autre', parUnite: 100, uniteNom: U_BOUFFEE,
          note: { fr: '0 à 3 ans : chambre d’inhalation + masque ; 4 à 6 ans : chambre d’inhalation. La poudre à inhaler ne convient qu’à partir de 6 ans.',
                  nl: '0 tot 3 jaar: voorzetkamer + masker; 4 tot 6 jaar: voorzetkamer. Inhalatiepoeder is pas geschikt vanaf 6 jaar.' } },
        { id: 'neb5', nom: { fr: 'Solution pour nébulisation 5 mg / ml (flacon de 10 ml)',
                             nl: 'Verneveloplossing 5 mg / ml (flacon van 10 ml)' }, type: 'liquide', parMl: 5,
          note: { fr: '2,5 mg correspondent à 0,5 ml et 5 mg à 1 ml de solution, à diluer dans du sérum physiologique.',
                  nl: '2,5 mg komt overeen met 0,5 ml en 5 mg met 1 ml oplossing, te verdunnen in fysiologisch serum.' } }
      ],
      schemas: [
        {
          id: 'mdi',
          indication: {
            fr: 'Asthme à la demande / prévention de l’asthme d’effort — aérosol-doseur avec chambre d’inhalation',
            nl: 'Astma zo nodig / preventie van inspanningsastma — dosisaerosol met voorzetkamer'
          },
          mode: 'paliers', unite: 'µg', critere: 'age', prn: true,
          paliers: [
            { label: { fr: 'Tout âge', nl: 'Alle leeftijden' }, min: 0, max: null, dose: 200, prises: 1,
              libelle: { fr: '100 à 200 µg (1 à 2 bouffées), jusqu’à 4×/j', nl: '100 tot 200 µg (1 tot 2 pufjes), tot 4×/dag' } }
          ],
          duree: { fr: 'à la demande, jusqu’à 4×/jour', nl: 'zo nodig, tot 4×/dag' },
          note: {
            fr: 'Posologie CBIP d’entretien / à la demande : 100 à 200 µg jusqu’à 4×/jour, à tout âge. En crise aiguë, des doses nettement plus élevées et rapprochées sont utilisées (jusqu’à 10 bouffées répétées toutes les 20 min pendant la 1re heure) : ce schéma d’urgence n’est pas chiffré par le CBIP et n’est pas calculé ici. Toujours utiliser une chambre d’inhalation. En prévention de l’asthme d’effort : 1 à 15 minutes avant l’effort.',
            nl: 'BCFI-posologie voor onderhoud / zo nodig: 100 tot 200 µg tot 4×/dag, op elke leeftijd. Bij een acute aanval worden duidelijk hogere en frequentere doses gebruikt (tot 10 pufjes, om de 20 min herhaald tijdens het eerste uur): dat spoedschema wordt door het BCFI niet becijferd en wordt hier niet berekend. Gebruik steeds een voorzetkamer. Ter preventie van inspanningsastma: 1 tot 15 minuten voor de inspanning.'
          },
          sources: [SRC_CBIP]
        },
        {
          id: 'neb',
          indication: { fr: 'Nébulisation', nl: 'Vernevelen' },
          mode: 'paliers', unite: 'mg', critere: 'age', prn: true,
          paliers: [
            { label: { fr: 'Tout âge', nl: 'Alle leeftijden' }, min: 0, max: null, dose: 2.5, prises: 1,
              libelle: { fr: '2,5 à 5 mg (0,5 à 1 ml), jusqu’à 4×/j', nl: '2,5 tot 5 mg (0,5 tot 1 ml), tot 4×/dag' } }
          ],
          duree: { fr: 'à la demande, jusqu’à 4×/jour', nl: 'zo nodig, tot 4×/dag' },
          note: {
            fr: 'CBIP : 2,5 à 5 mg (0,5 à 1 ml de la solution à 5 mg/ml) jusqu’à 4×/jour, chez l’enfant comme chez l’adulte. La dose n’est pas graduée selon le poids par le CBIP.',
            nl: 'BCFI: 2,5 tot 5 mg (0,5 tot 1 ml van de oplossing aan 5 mg/ml) tot 4×/dag, zowel bij kinderen als bij volwassenen. Het BCFI schaalt de dosis niet volgens het gewicht.'
          },
          sources: [SRC_CBIP]
        }
      ],
      precautions: [
        { fr: 'Tremblements, tachycardie, risque d’hypokaliémie.', nl: 'Tremor, tachycardie, risico op hypokaliëmie.' },
        { fr: 'Vérifier la technique d’inhalation.', nl: 'Controleer de inhalatietechniek.' },
        { fr: 'Éviter tout contact de la solution pour nébulisation avec les yeux.', nl: 'Vermijd elk contact van de verneveloplossing met de ogen.' }
      ],
      contreIndications: [],
      sources: [SRC_CBIP]
    },

    {
      id: 'montelukast',
      dci: { fr: 'Montélukast', nl: 'Montelukast' },
      marques: ['Singulair', 'Montelukast EG', 'Montelukast AB'],
      cbip: { fr: 'montélukast', nl: 'montelukast' },
      categorie: 'respiratoire',
      frequent: false,
      verifie: true,
      synonymes: ['asthme', 'antileucotriene', 'astma', 'singulair'],
      formes: [
        { id: 'cp4', nom: { fr: 'Comprimé à croquer 4 mg', nl: 'Kauwtablet 4 mg' }, type: 'solide', parUnite: 4, uniteNom: U_CP, pasUnite: 1 },
        { id: 'cp5', nom: { fr: 'Comprimé à croquer 5 mg', nl: 'Kauwtablet 5 mg' }, type: 'solide', parUnite: 5, uniteNom: U_CP, pasUnite: 1 },
        { id: 'cp10', nom: comprime('10 mg'), type: 'solide', parUnite: 10, uniteNom: U_CP, pasUnite: 1 }
      ],
      schemas: [
        {
          id: 'paliers',
          indication: { fr: 'Asthme — traitement d’entretien, dose fixe par âge', nl: 'Astma — onderhoudsbehandeling, vaste dosis per leeftijd' },
          mode: 'paliers', unite: 'mg', critere: 'age',
          paliers: [
            { label: { fr: '6 mois à 5 ans', nl: '6 maanden tot 5 jaar' }, min: 6, max: 71, dose: 4, prises: 1,
              libelle: { fr: '4 mg 1×/j', nl: '4 mg 1×/dag' } },
            { label: { fr: '6 à 14 ans', nl: '6 tot 14 jaar' }, min: 72, max: 179, dose: 5, prises: 1,
              libelle: { fr: '5 mg 1×/j', nl: '5 mg 1×/dag' } },
            { label: { fr: '15 ans et plus', nl: '15 jaar en ouder' }, min: 180, max: null, dose: 10, prises: 1,
              libelle: { fr: '10 mg 1×/j', nl: '10 mg 1×/dag' } }
          ],
          duree: { fr: 'traitement de fond, le soir', nl: 'onderhoudsbehandeling, ’s avonds' },
          note: {
            fr: 'Les granulés en sachet ne sont plus commercialisés en Belgique : le comprimé à croquer de 4 mg est la plus petite présentation disponible.',
            nl: 'Het granulaat in zakjes is in België niet meer op de markt: de kauwtablet van 4 mg is de kleinste beschikbare presentatie.'
          },
          sources: [SRC_CBIP]
        }
      ],
      precautions: [
        { fr: 'Effets neuropsychiatriques rapportés (cauchemars, agitation, troubles de l’humeur) : en informer les parents.',
          nl: 'Neuropsychiatrische effecten gemeld (nachtmerries, agitatie, stemmingsstoornissen): informeer de ouders.' },
        { fr: 'Ne doit pas être utilisé pour traiter une exacerbation aiguë d’asthme.',
          nl: 'Mag niet worden gebruikt om een acute astma-exacerbatie te behandelen.' }
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
      marques: ['Zofran', 'Ondansetron EG', 'Ondansetron Accord'],
      cbip: { fr: 'ondansétron', nl: 'ondansetron' },
      categorie: 'digestif',
      frequent: false,
      verifie: false,
      synonymes: ['vomissement', 'gastro', 'antiemetique', 'braken', 'buikgriep'],
      formes: [
        { id: 'lyoc8', nom: { fr: 'Lyophilisat oral 8 mg (usage hospitalier)', nl: 'Oraal lyofilisaat 8 mg (ziekenhuisgebruik)' }, type: 'solide', parUnite: 8, uniteNom: U_LYOC, pasUnite: 1 }
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
            fr: 'ATTENTION : toutes les présentations d’ondansétron commercialisées en Belgique sont réservées à l’usage hospitalier (CBIP 2026) ; il n’existe ni sirop ni lyophilisat de 4 mg en officine. Le CBIP ne donne pas de posologie (usage spécialisé) : la dose en mg/kg n’a pas pu être confirmée contre une source primaire belge.',
            nl: 'OPGELET: alle in België op de markt zijnde presentaties van ondansetron zijn voorbehouden voor ziekenhuisgebruik (BCFI 2026); er bestaat geen siroop of lyofilisaat van 4 mg in de officina. Het BCFI vermeldt geen posologie (gespecialiseerd gebruik): de dosis in mg/kg kon niet tegen een Belgische primaire bron worden bevestigd.'
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
      marques: ['Motilium', 'Domperidone EG', 'Domperidone Teva', 'Zilium'],
      cbip: { fr: 'dompéridone', nl: 'domperidon' },
      categorie: 'digestif',
      frequent: false,
      verifie: true,
      synonymes: ['vomissement', 'antiemetique', 'motilium', 'braken'],
      formes: [
        { id: 'cp10', nom: comprime('10 mg'), type: 'solide', parUnite: 10, uniteNom: U_CP, pasUnite: 1 },
        { id: 'orodisp10', nom: { fr: 'Comprimé orodispersible 10 mg', nl: 'Orodispergeerbare tablet 10 mg' }, type: 'solide', parUnite: 10, uniteNom: U_CP, pasUnite: 1 }
      ],
      schemas: [
        {
          id: 'paliers',
          indication: { fr: 'Nausées et vomissements — à partir de 35 kg', nl: 'Misselijkheid en braken — vanaf 35 kg' },
          mode: 'paliers', unite: 'mg', critere: 'poids',
          paliers: [
            { label: { fr: '35 kg et plus', nl: '35 kg en meer' }, min: 35, max: null, dose: 30, prises: 3,
              libelle: { fr: '10 mg 3×/j au maximum', nl: 'maximaal 10 mg 3×/dag' } }
          ],
          duree: { fr: 'maximum 7 jours', nl: 'maximaal 7 dagen' },
          note: {
            fr: 'Le CBIP ne donne de posologie qu’à partir de 35 kg (adulte et adolescent) et aucune suspension buvable n’est commercialisée en Belgique : la dompéridone n’est pas utilisable chez le jeune enfant. L’EMA a restreint l’usage : durée la plus courte, dose la plus faible.',
            nl: 'Het BCFI geeft enkel een posologie vanaf 35 kg (volwassene en adolescent) en er is in België geen drank op de markt: domperidon is niet bruikbaar bij het jonge kind. Het EMA heeft het gebruik beperkt: kortste duur, laagste dosis.'
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
        { fr: 'Poids inférieur à 35 kg (pas de posologie ni de forme adaptée).', nl: 'Gewicht onder 35 kg (geen posologie noch aangepaste vorm).' },
        { fr: 'Insuffisance hépatique modérée à sévère.', nl: 'Matige tot ernstige leverinsufficiëntie.' },
        { fr: 'Association aux inhibiteurs puissants du CYP3A4.', nl: 'Combinatie met krachtige CYP3A4-remmers.' }
      ],
      sources: [SRC_CBIP]
    },

    {
      id: 'macrogol',
      dci: { fr: 'Macrogol (polyéthylèneglycol)', nl: 'Macrogol (polyethyleenglycol)' },
      marques: ['Forlax Junior 4 g', 'Forlax 10 g', 'Movicol Junior', 'Movicol', 'Molaxole'],
      cbip: { fr: 'macrogol', nl: 'macrogol' },
      categorie: 'digestif',
      frequent: true,
      verifie: true,
      synonymes: ['constipation', 'laxatif', 'PEG', 'obstipatie', 'laxeermiddel', 'forlax'],
      formes: [
        { id: 'sachet4', nom: { fr: 'Sachet pédiatrique 4 g (Forlax Junior)', nl: 'Pediatrisch zakje 4 g (Forlax Junior)' }, type: 'sachet', parUnite: 4, uniteNom: U_SACHET },
        { id: 'sachet10', nom: { fr: 'Sachet adulte 10 g (Forlax)', nl: 'Zakje voor volwassenen 10 g (Forlax)' }, type: 'sachet', parUnite: 10, uniteNom: U_SACHET }
      ],
      schemas: [
        {
          id: 'entretien',
          indication: {
            fr: 'Constipation — macrogol sans électrolytes',
            nl: 'Obstipatie — macrogol zonder elektrolyten'
          },
          mode: 'paliers', unite: 'g', critere: 'age',
          paliers: [
            { label: { fr: '6 mois à 1 an', nl: '6 maanden tot 1 jaar' }, min: 6, max: 11, dose: 4, prises: 1,
              libelle: { fr: '1 sachet de 4 g par jour', nl: '1 zakje van 4 g per dag' } },
            { label: { fr: '1 à 4 ans', nl: '1 tot 4 jaar' }, min: 12, max: 47, dose: 4, prises: 1,
              libelle: { fr: '1 à 2 sachets de 4 g par jour', nl: '1 tot 2 zakjes van 4 g per dag' } },
            { label: { fr: '4 à 8 ans', nl: '4 tot 8 jaar' }, min: 48, max: 95, dose: 8, prises: 1,
              libelle: { fr: '2 à 4 sachets de 4 g par jour', nl: '2 tot 4 zakjes van 4 g per dag' } },
            { label: { fr: '8 ans et plus', nl: '8 jaar en ouder' }, min: 96, max: null, dose: 10, prises: 1,
              libelle: { fr: '1 à 2 sachets adulte de 10 g par jour', nl: '1 tot 2 zakjes voor volwassenen van 10 g per dag' } }
          ],
          duree: { fr: 'plusieurs semaines à plusieurs mois', nl: 'enkele weken tot enkele maanden' },
          note: {
            fr: 'La valeur calculée est la dose de départ ; titrer ensuite selon la consistance des selles, dans les fourchettes indiquées par le CBIP. La désimpaction fécale utilise des doses nettement plus élevées, non couvertes ici. Le CBIP ne donne pas de posologie de macrogol sans électrolytes avant 6 mois.',
            nl: 'De berekende waarde is de startdosis; titreer daarna volgens de consistentie van de stoelgang, binnen de door het BCFI vermelde marges. Fecale desimpactie vereist duidelijk hogere doses, die hier niet aan bod komen. Het BCFI geeft geen posologie voor macrogol zonder elektrolyten vóór 6 maanden.'
          },
          sources: [SRC_CBIP]
        }
      ],
      precautions: [
        { fr: 'Bien diluer et assurer un apport hydrique suffisant.',
          nl: 'Goed verdunnen en voldoende vochtinname verzekeren.' },
        { fr: 'Les sachets Movicol et Molaxole contiennent des électrolytes et un dosage différent (13,125 g pour l’adulte, 6,563 g pour Movicol Junior) : ils ne sont pas interchangeables avec les sachets Forlax utilisés pour ce calcul.',
          nl: 'De zakjes Movicol en Molaxole bevatten elektrolyten en een andere dosering (13,125 g voor volwassenen, 6,563 g voor Movicol Junior): ze zijn niet uitwisselbaar met de Forlax-zakjes die voor deze berekening worden gebruikt.' }
      ],
      contreIndications: [
        { fr: 'Obstruction ou perforation intestinale, mégacôlon toxique.', nl: 'Darmobstructie of -perforatie, toxisch megacolon.' }
      ],
      sources: [SRC_CBIP]
    },

    {
      id: 'racecadotril',
      dci: { fr: 'Racécadotril', nl: 'Racecadotril' },
      marques: ['Tiorfix'],
      cbip: { fr: 'racécadotril', nl: 'racecadotril' },
      categorie: 'digestif',
      frequent: false,
      verifie: true,
      synonymes: ['diarrhee', 'gastro', 'diarree', 'buikgriep', 'tiorfix'],
      formes: [
        { id: 'susp4', nom: { fr: 'Suspension buvable 4 mg / ml (nourrissons et enfants)', nl: 'Drank 4 mg / ml (zuigelingen en kinderen)' }, type: 'liquide', parMl: 4 },
        { id: 'sachet10', nom: { fr: 'Sachet 10 mg (Baby)', nl: 'Zakje 10 mg (Baby)' }, type: 'sachet', parUnite: 10, uniteNom: U_SACHET },
        { id: 'sachet30', nom: { fr: 'Sachet 30 mg (Junior)', nl: 'Zakje 30 mg (Junior)' }, type: 'sachet', parUnite: 30, uniteNom: U_SACHET },
        { id: 'gel100', nom: gelule('100 mg'), type: 'solide', parUnite: 100, uniteNom: U_GEL, pasUnite: 1 }
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
          prises: [3], maxJour: 300, maxPrise: 100,
          ageMinMois: 3,
          duree: { fr: 'maximum 7 jours', nl: 'maximaal 7 dagen' },
          note: {
            fr: 'CBIP : enfant 1,5 mg/kg 3×/jour au maximum ; adulte et adolescent 100 mg 3×/jour au maximum. Ne remplace jamais la réhydratation orale, qui reste le traitement essentiel.',
            nl: 'BCFI: kind maximaal 1,5 mg/kg 3×/dag; volwassene en adolescent maximaal 100 mg 3×/dag. Vervangt nooit de orale rehydratatie, die de essentiële behandeling blijft.'
          },
          sources: [SRC_CBIP]
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
      marques: ['Losec', 'Omeprazole EG', 'Omeprazol AB', 'Acidcare'],
      cbip: { fr: 'oméprazole', nl: 'omeprazol' },
      categorie: 'digestif',
      frequent: false,
      verifie: false,
      synonymes: ['reflux', 'RGO', 'IPP', 'PPI', 'maagzuur'],
      formes: [
        { id: 'gel10', nom: { fr: 'Gélule / comprimé gastro-résistant 10 mg', nl: 'Maagsapresistente capsule / tablet 10 mg' }, type: 'solide', parUnite: 10, uniteNom: U_GEL, pasUnite: 1 },
        { id: 'gel20', nom: { fr: 'Gélule / comprimé gastro-résistant 20 mg', nl: 'Maagsapresistente capsule / tablet 20 mg' }, type: 'solide', parUnite: 20, uniteNom: U_GEL, pasUnite: 1 },
        { id: 'gel40', nom: { fr: 'Gélule / comprimé gastro-résistant 40 mg', nl: 'Maagsapresistente capsule / tablet 40 mg' }, type: 'solide', parUnite: 40, uniteNom: U_GEL, pasUnite: 1 }
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
            fr: 'ATTENTION : le CBIP ne donne que des doses adultes pour l’oméprazole ; la dose pédiatrique en mg/kg n’a pas pu être confirmée contre une source primaire belge. Doses adultes confirmées : symptômes de reflux 10 à 20 mg 1×/j pendant 2 à 4 semaines ; œsophagite de reflux 20 (voire 40) mg 1×/j pendant 4 (voire 8) semaines. À prendre 30 min avant le repas ; réévaluer systématiquement.',
            nl: 'OPGELET: het BCFI geeft enkel volwassendoses voor omeprazol; de pediatrische dosis in mg/kg kon niet tegen een Belgische primaire bron worden bevestigd. Bevestigde volwassendoses: refluxsymptomen 10 tot 20 mg 1×/dag gedurende 2 tot 4 weken; refluxoesofagitis 20 (eventueel 40) mg 1×/dag gedurende 4 (eventueel 8) weken. In te nemen 30 min voor de maaltijd; systematisch herevalueren.'
          },
          sources: [SRC_CBIP]
        }
      ],
      precautions: [
        { fr: 'Ne pas prolonger sans réévaluation ; usage souvent excessif chez le nourrisson.', nl: 'Niet verlengen zonder herevaluatie; vaak overmatig gebruik bij zuigelingen.' }
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
      marques: ['Nilstat'],
      cbip: { fr: 'nystatine', nl: 'nystatine' },
      categorie: 'antifongique',
      frequent: false,
      verifie: true,
      synonymes: ['muguet', 'candidose', 'spruw', 'candidiasis', 'nilstat'],
      formes: [
        { id: 'susp', nom: { fr: 'Suspension orale 100 000 UI / ml (flacon de 30 ml)', nl: 'Orale suspensie 100 000 IE / ml (flacon van 30 ml)' }, type: 'liquide', parMl: 100000 }
      ],
      schemas: [
        {
          id: 'muguet',
          indication: { fr: 'Muguet buccal — dose fixe par âge', nl: 'Orale spruw — vaste dosis per leeftijd' },
          mode: 'paliers', unite: 'UI', critere: 'age',
          paliers: [
            { label: { fr: 'Moins de 6 mois', nl: 'Jonger dan 6 maanden' }, min: 0, max: 5, dose: 400000, prises: 4,
              libelle: { fr: '100 000 UI (1 ml) 4×/j', nl: '100 000 IE (1 ml) 4×/dag' } },
            { label: { fr: '6 mois et plus', nl: '6 maanden en ouder' }, min: 6, max: null, dose: 600000, prises: 4,
              libelle: { fr: '150 000 UI (1,5 ml) 4×/j', nl: '150 000 IE (1,5 ml) 4×/dag' } }
          ],
          duree: {
            fr: 'jusqu’à 48 h après la disparition des lésions',
            nl: 'tot 48 u na het verdwijnen van de letsels'
          },
          note: {
            fr: 'Répartir chaque dose sur les deux côtés de la cavité buccale et garder la suspension le plus longtemps possible en bouche avant d’avaler. Cette posologie, proposée par le BAPCOC et reprise par le CBIP, est très différente de celle du RCP de Nilstat. À partir de 6 mois, le gel buccal de miconazole est plus efficace que la nystatine.',
            nl: 'Verdeel elke dosis over beide zijden van de mondholte en houd de suspensie zo lang mogelijk in de mond voor het inslikken. Deze posologie, voorgesteld door BAPCOC en overgenomen door het BCFI, verschilt sterk van die in de SKP van Nilstat. Vanaf 6 maanden is miconazol-mondgel doeltreffender dan nystatine.'
          },
          sources: [SRC_BAPCOC, SRC_CBIP]
        }
      ],
      precautions: [
        { fr: 'Traiter simultanément les tétines et le mamelon en cas d’allaitement ; stériliser soigneusement tétines et sucettes.',
          nl: 'Behandel tegelijk de spenen en de tepel bij borstvoeding; steriliseer spenen en fopspenen zorgvuldig.' },
        { fr: 'Chez le nourrisson, le muguet guérit généralement spontanément en 3 à 8 semaines ; le traitement raccourcit la durée des symptômes.',
          nl: 'Bij zuigelingen geneest spruw meestal spontaan in 3 tot 8 weken; de behandeling verkort de duur van de symptomen.' }
      ],
      contreIndications: [],
      sources: [SRC_BAPCOC, SRC_CBIP]
    },

    {
      id: 'miconazole-gel',
      dci: { fr: 'Miconazole (gel buccal)', nl: 'Miconazol (mondgel)' },
      marques: ['Daktarin gel oromuqueux'],
      cbip: { fr: 'miconazole', nl: 'miconazol' },
      categorie: 'antifongique',
      frequent: false,
      verifie: true,
      synonymes: ['muguet', 'candidose', 'daktarin', 'spruw'],
      formes: [
        { id: 'gel', nom: { fr: 'Gel oromuqueux 20 mg / g (tube de 40 g)', nl: 'Mondgel 20 mg / g (tube van 40 g)' }, type: 'liquide', parMl: 1,
          note: { fr: 'Doses exprimées en ml de gel.',
                  nl: 'Doses uitgedrukt in ml gel.' } }
      ],
      schemas: [
        {
          id: 'muguet',
          indication: { fr: 'Muguet buccal — dose fixe par âge', nl: 'Orale spruw — vaste dosis per leeftijd' },
          mode: 'paliers', unite: 'ml', critere: 'age',
          paliers: [
            { label: { fr: '6 mois à 11 ans', nl: '6 maanden tot 11 jaar' }, min: 6, max: 143, dose: 5, prises: 4,
              libelle: { fr: '1,25 ml 4×/j', nl: '1,25 ml 4×/dag' } },
            { label: { fr: '12 ans et plus', nl: '12 jaar en ouder' }, min: 144, max: null, dose: 10, prises: 4,
              libelle: { fr: '2,5 ml 4×/j', nl: '2,5 ml 4×/dag' } }
          ],
          duree: { fr: 'jusqu’à 1 semaine après la disparition des lésions', nl: 'tot 1 week na het verdwijnen van de letsels' },
          note: {
            fr: 'Bien répartir le gel du bout du doigt sur les muqueuses, après les repas, sans aller jusqu’au voile du palais, et ne pas avaler d’emblée. Plus efficace que la suspension de nystatine, mais contre-indiqué avant 6 mois.',
            nl: 'Verdeel de gel met de vingertop goed over de slijmvliezen, na de maaltijd, zonder tot het zachte gehemelte te gaan, en slik niet meteen door. Doeltreffender dan nystatinesuspensie, maar gecontra-indiceerd onder 6 maanden.'
          },
          sources: [SRC_BAPCOC, SRC_CBIP]
        }
      ],
      precautions: [
        { fr: 'Interaction majeure avec les anticoagulants oraux.',
          nl: 'Belangrijke interactie met orale anticoagulantia.' }
      ],
      contreIndications: [
        { fr: 'Nourrisson de moins de 6 mois (risque de suffocation).',
          nl: 'Zuigeling jonger dan 6 maanden (verstikkingsrisico).' }
      ],
      sources: [SRC_BAPCOC, SRC_CBIP]
    },

    {
      id: 'fluconazole',
      dci: { fr: 'Fluconazole', nl: 'Fluconazol' },
      marques: ['Diflucan', 'Fluconazole EG', 'Fluconazole Viatris'],
      cbip: { fr: 'fluconazole', nl: 'fluconazol' },
      categorie: 'antifongique',
      frequent: false,
      verifie: true,
      synonymes: ['candidose', 'mycose', 'schimmel', 'muguet', 'spruw'],
      formes: [
        { id: 'susp10', nom: { fr: 'Suspension orale 10 mg / ml (50 mg / 5 ml)', nl: 'Orale suspensie 10 mg / ml (50 mg / 5 ml)' }, type: 'liquide', parMl: 10 },
        { id: 'susp40', nom: { fr: 'Suspension orale 40 mg / ml (200 mg / 5 ml)', nl: 'Orale suspensie 40 mg / ml (200 mg / 5 ml)' }, type: 'liquide', parMl: 40 },
        { id: 'gel50', nom: gelule('50 mg'), type: 'solide', parUnite: 50, uniteNom: U_GEL, pasUnite: 1 },
        { id: 'gel150', nom: gelule('150 mg'), type: 'solide', parUnite: 150, uniteNom: U_GEL, pasUnite: 1 },
        { id: 'gel200', nom: gelule('200 mg'), type: 'solide', parUnite: 200, uniteNom: U_GEL, pasUnite: 1 }
      ],
      schemas: [
        {
          id: 'muguet',
          indication: {
            fr: 'Candidose oropharyngée — traitement systémique après échec du traitement local',
            nl: 'Orofaryngeale candidose — systemische behandeling na falen van de lokale behandeling'
          },
          mode: 'jour', unite: 'mg',
          doseMin: 3, doseUsuelle: 3, doseMax: 3,
          prises: [1], maxJour: 100,
          ageMinMois: 1,
          duree: { fr: '7 jours', nl: '7 dagen' },
          note: {
            fr: 'BAPCOC 2026 : 3 mg/kg/jour pendant 7 jours chez le nourrisson à partir de 1 mois. Le nourrisson de moins de 1 mois est adressé au pédiatre. Adulte : 200 mg le 1er jour, puis 100 mg/jour pendant 7 à 21 jours.',
            nl: 'BAPCOC 2026: 3 mg/kg/dag gedurende 7 dagen bij zuigelingen vanaf 1 maand. Zuigelingen jonger dan 1 maand worden naar de kinderarts verwezen. Volwassene: 200 mg op dag 1, daarna 100 mg/dag gedurende 7 tot 21 dagen.'
          },
          sources: [SRC_BAPCOC, SRC_CBIP]
        }
      ],
      precautions: [
        { fr: 'Nombreuses interactions (inhibiteur du CYP).', nl: 'Talrijke interacties (CYP-remmer).' },
        QT_LONG
      ],
      contreIndications: [],
      sources: [SRC_BAPCOC, SRC_CBIP]
    },

    /* ============================================================== */
    /* ANTIVIRAUX                                                     */
    /* ============================================================== */
    {
      id: 'aciclovir',
      dci: { fr: 'Aciclovir', nl: 'Aciclovir' },
      marques: ['Aciclovir GSK', 'Aciclovir EG', 'Aciclovir AB'],
      cbip: { fr: 'aciclovir', nl: 'aciclovir' },
      categorie: 'antiviral',
      frequent: false,
      verifie: false,
      synonymes: ['herpes', 'varicelle', 'zona', 'waterpokken', 'gordelroos'],
      formes: [
        { id: 'susp80', nom: { fr: 'Suspension orale 400 mg / 5 ml (80 mg/ml)', nl: 'Orale suspensie 400 mg / 5 ml (80 mg/ml)' }, type: 'liquide', parMl: 80 },
        { id: 'cp200', nom: comprime('200 mg'), type: 'solide', parUnite: 200, uniteNom: U_CP },
        { id: 'cp800', nom: comprime('800 mg'), type: 'solide', parUnite: 800, uniteNom: U_CP }
      ],
      schemas: [
        {
          id: 'varicelle',
          indication: {
            fr: 'Varicelle (à envisager à partir de 12 ans, dans les 24 h suivant l’éruption)',
            nl: 'Waterpokken (te overwegen vanaf 12 jaar, binnen 24 u na de uitslag)'
          },
          mode: 'prise', unite: 'mg',
          doseMin: 20, doseUsuelle: 20, doseMax: 20,
          prises: [4, 5], maxJour: 4000, maxPrise: 800,
          duree: { fr: '5 à 7 jours', nl: '5 tot 7 dagen' },
          note: {
            fr: 'ATTENTION : le CBIP ne donne pas de dose pédiatrique en mg/kg pour l’aciclovir ; la dose affichée n’a pas pu être confirmée contre une source primaire belge. Dose adulte confirmée par le BAPCOC 2026 : 4 g/jour en 5 prises pendant 7 jours. Le traitement antiviral n’est PAS recommandé chez l’enfant en bonne santé (évolution favorable) ; il peut être envisagé à partir de 12 ans. En cas d’aggravation, chez l’immunodéprimé ou le nouveau-né : traitement intraveineux.',
            nl: 'OPGELET: het BCFI geeft geen pediatrische dosis in mg/kg voor aciclovir; de weergegeven dosis kon niet tegen een Belgische primaire bron worden bevestigd. Door BAPCOC 2026 bevestigde volwassendosis: 4 g/dag in 5 giften gedurende 7 dagen. Antivirale behandeling wordt NIET aanbevolen bij gezonde kinderen (gunstig verloop); ze kan worden overwogen vanaf 12 jaar. Bij verergering, bij immuungedeprimeerden of bij pasgeborenen: intraveneuze behandeling.'
          },
          sources: [SRC_BAPCOC, SRC_CBIP]
        },
        {
          id: 'gingivostomatite',
          indication: { fr: 'Gingivostomatite herpétique', nl: 'Herpetische gingivostomatitis' },
          mode: 'jour', unite: 'mg',
          doseMin: 40, doseUsuelle: 60, doseMax: 80,
          prises: [4, 5], maxJour: 2000,
          duree: { fr: '5 à 7 jours', nl: '5 tot 7 dagen' },
          note: {
            fr: 'ATTENTION : indication et dose pédiatrique non reprises par le CBIP ni par le BAPCOC 2026 ; valeurs non confirmées contre une source primaire belge, à contrôler avant prescription.',
            nl: 'OPGELET: indicatie en pediatrische dosis staan niet in het BCFI noch in de BAPCOC-gids 2026; niet-bevestigde waarden, te controleren vóór voorschrijven.'
          },
          sources: [SRC_CBIP]
        }
      ],
      precautions: [
        { fr: 'Assurer une hydratation suffisante.', nl: 'Zorg voor voldoende hydratatie.' },
        { fr: 'Zovirax n’existe plus en Belgique que sous forme de crème pour l’herpès labial ; les formes orales sont génériques.',
          nl: 'Zovirax bestaat in België enkel nog als crème voor herpes labialis; de orale vormen zijn generiek.' }
      ],
      contreIndications: [],
      sources: [SRC_BAPCOC, SRC_CBIP]
    },

    {
      id: 'oseltamivir',
      dci: { fr: 'Oseltamivir', nl: 'Oseltamivir' },
      marques: ['Tamiflu'],
      cbip: { fr: 'oseltamivir', nl: 'oseltamivir' },
      categorie: 'antiviral',
      frequent: false,
      verifie: true,
      synonymes: ['grippe', 'influenza', 'griep', 'tamiflu'],
      formes: [
        { id: 'gel30', nom: gelule('30 mg'), type: 'solide', parUnite: 30, uniteNom: U_GEL, pasUnite: 1 },
        { id: 'gel45', nom: gelule('45 mg'), type: 'solide', parUnite: 45, uniteNom: U_GEL, pasUnite: 1 },
        { id: 'gel75', nom: gelule('75 mg'), type: 'solide', parUnite: 75, uniteNom: U_GEL, pasUnite: 1 }
      ],
      schemas: [
        {
          id: 'grippe',
          indication: {
            fr: 'Grippe — traitement à partir de 1 an, dose fixe par poids',
            nl: 'Griep — behandeling vanaf 1 jaar, vaste dosis per gewicht'
          },
          mode: 'paliers', unite: 'mg', critere: 'poids',
          paliers: [
            { label: { fr: '10 à 15 kg', nl: '10 tot 15 kg' }, min: 10, max: 15, dose: 60, prises: 2,
              libelle: { fr: '30 mg 2×/j', nl: '30 mg 2×/dag' } },
            { label: { fr: 'plus de 15 à 24 kg', nl: 'meer dan 15 tot 24 kg' }, min: 15.01, max: 24, dose: 90, prises: 2,
              libelle: { fr: '45 mg 2×/j', nl: '45 mg 2×/dag' } },
            { label: { fr: 'plus de 24 à 40 kg', nl: 'meer dan 24 tot 40 kg' }, min: 24.01, max: 40, dose: 120, prises: 2,
              libelle: { fr: '60 mg 2×/j', nl: '60 mg 2×/dag' } },
            { label: { fr: 'plus de 40 kg', nl: 'meer dan 40 kg' }, min: 40.01, max: null, dose: 150, prises: 2,
              libelle: { fr: '75 mg 2×/j', nl: '75 mg 2×/dag' } }
          ],
          duree: { fr: '5 jours', nl: '5 dagen' },
          note: {
            fr: 'Le BAPCOC 2026 comme le CBIP jugent la place de l’oseltamivir très limitée : il réduit la durée des symptômes d’un jour tout au plus et n’a pas d’effet prouvé sur les complications graves. À débuter moins de 8 h (CBIP) à 48 h après le début des symptômes. Chez l’enfant de moins de 1 an ou de moins de 10 kg : 3 mg/kg 2×/jour (max. 60 mg/jour), non couvert par ce tableau. Aucune suspension buvable n’est commercialisée en Belgique.',
            nl: 'Zowel BAPCOC 2026 als het BCFI beschouwen de plaats van oseltamivir als zeer beperkt: het verkort de symptoomduur hooguit met één dag en heeft geen bewezen effect op ernstige complicaties. Te starten minder dan 8 u (BCFI) tot 48 u na het begin van de symptomen. Bij kinderen jonger dan 1 jaar of lichter dan 10 kg: 3 mg/kg 2×/dag (max. 60 mg/dag), niet in deze tabel opgenomen. Er is in België geen drank op de markt.'
          },
          sources: [SRC_CBIP, SRC_BAPCOC]
        }
      ],
      precautions: [
        { fr: 'Nausées et vomissements fréquents ; effets neuropsychiatriques rapportés chez les jeunes.',
          nl: 'Vaak misselijkheid en braken; neuropsychiatrische effecten gemeld bij jongeren.' },
        { fr: 'La vaccination annuelle des groupes à risque reste la mesure essentielle.',
          nl: 'De jaarlijkse vaccinatie van risicogroepen blijft de essentiële maatregel.' }
      ],
      contreIndications: [],
      sources: [SRC_CBIP, SRC_BAPCOC]
    },

    /* ============================================================== */
    /* ANTIPARASITAIRES                                               */
    /* ============================================================== */
    {
      id: 'mebendazole',
      dci: { fr: 'Mébendazole', nl: 'Mebendazol' },
      marques: ['Vermox'],
      cbip: { fr: 'mébendazole', nl: 'mebendazol' },
      categorie: 'antiparasitaire',
      frequent: true,
      verifie: true,
      synonymes: ['oxyure', 'vers', 'vermifuge', 'aarsmaden', 'wormen', 'vermox'],
      formes: [
        { id: 'susp', nom: suspOrale(100), type: 'liquide', parMl: 20 },
        { id: 'cp100', nom: comprime('100 mg'), type: 'solide', parUnite: 100, uniteNom: U_CP }
      ],
      schemas: [
        {
          id: 'oxyurose',
          indication: { fr: 'Oxyurose (Enterobius vermicularis) — dose unique fixe', nl: 'Aarsmadeninfectie (Enterobius vermicularis) — vaste eenmalige dosis' },
          mode: 'paliers', unite: 'mg', critere: 'age',
          paliers: [
            { label: { fr: '2 ans et plus', nl: '2 jaar en ouder' }, min: 24, max: null, dose: 100, prises: 1,
              libelle: { fr: '100 mg en dose unique', nl: '100 mg als eenmalige dosis' } }
          ],
          duree: {
            fr: 'dose unique, à répéter après 14 jours',
            nl: 'eenmalige dosis, te herhalen na 14 dagen'
          },
          note: {
            fr: 'CBIP : adulte et enfant à partir de 2 ans, 100 mg en 1 prise, puis à nouveau 100 mg après 14 jours ; si nécessaire, répéter le traitement complet après 14 jours. Traiter simultanément toute la famille. Dose indépendante du poids.',
            nl: 'BCFI: volwassene en kind vanaf 2 jaar, 100 mg in 1 gift, daarna opnieuw 100 mg na 14 dagen; herhaal indien nodig de volledige behandeling na 14 dagen. Behandel het hele gezin tegelijk. Dosis onafhankelijk van het gewicht.'
          },
          sources: [SRC_CBIP]
        },
        {
          id: 'ascaris',
          indication: {
            fr: 'Ascaridiose, trichocéphalose, ankylostomose',
            nl: 'Ascariasis, trichuriasis, ankylostomiasis'
          },
          mode: 'paliers', unite: 'mg', critere: 'age',
          paliers: [
            { label: { fr: '2 ans et plus', nl: '2 jaar en ouder' }, min: 24, max: null, dose: 200, prises: 2,
              libelle: { fr: '100 mg 2×/j pendant 3 jours', nl: '100 mg 2×/dag gedurende 3 dagen' } }
          ],
          duree: { fr: '3 jours', nl: '3 dagen' },
          note: {
            fr: 'En présence de signes d’infestation après 3 semaines, répéter le traitement.',
            nl: 'Bij tekenen van besmetting na 3 weken de behandeling herhalen.'
          },
          sources: [SRC_CBIP]
        }
      ],
      precautions: [
        { fr: 'Mesures d’hygiène indispensables (ongles, literie, linge).',
          nl: 'Hygiënemaatregelen zijn onmisbaar (nagels, beddengoed, linnen).' }
      ],
      contreIndications: [
        { fr: 'Enfant de moins de 2 ans (le CBIP ne donne de posologie qu’à partir de 2 ans).', nl: 'Kind jonger dan 2 jaar (het BCFI geeft pas een posologie vanaf 2 jaar).' }
      ],
      sources: [SRC_CBIP]
    },

    /* ============================================================== */
    /* VITAMINES / SUPPLÉMENTS                                        */
    /* ============================================================== */
    {
      id: 'vitamine-d',
      dci: { fr: 'Colécalciférol (vitamine D3)', nl: 'Colecalciferol (vitamine D3)' },
      marques: ['D-Cure', 'Vitamine D3 EG', 'Vitamine D Sandoz', 'Vibosun-D3', 'Fultivit-D3'],
      cbip: { fr: 'cholécalciférol', nl: 'colecalciferol' },
      categorie: 'supplement',
      frequent: true,
      verifie: true,
      synonymes: ['vitamine D', 'rachitisme', 'prevention', 'rachitis', 'preventie', 'd-cure'],
      formes: [
        { id: 'gouttes', nom: { fr: 'Gouttes D-Cure — 2 400 UI / ml, soit 36 gouttes par ml',
                                nl: 'D-Cure druppels — 2 400 IE / ml, dus 36 druppels per ml' },
          type: 'autre', parUnite: 2400 / 36, uniteNom: U_GOUTTE, pasUnite: 1,
          note: { fr: '1 ml = 36 gouttes = 2 400 UI, soit environ 67 UI par goutte : 400 UI correspondent à 6 gouttes. Vérifier la concentration de la spécialité, elle varie fortement d’une marque à l’autre.',
                  nl: '1 ml = 36 druppels = 2 400 IE, dus ongeveer 67 IE per druppel: 400 IE komt overeen met 6 druppels. Controleer de concentratie van de specialiteit, die verschilt sterk per merk.' } },
        { id: 'gouttesMl', nom: { fr: 'Gouttes D-Cure — dose exprimée en ml (2 400 UI / ml)',
                                  nl: 'D-Cure druppels — dosis uitgedrukt in ml (2 400 IE / ml)' },
          type: 'liquide', parMl: 2400 },
        { id: 'unidose', nom: { fr: 'Unidose / capsule 25 000 UI', nl: 'Unidosis / capsule 25 000 IE' }, type: 'autre', parUnite: 25000, uniteNom: U_AMP }
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
            { label: { fr: 'Jusqu’à 1 an', nl: 'Tot 1 jaar' }, min: 0, max: 11, dose: 400, prises: 1,
              libelle: { fr: '400 UI par jour', nl: '400 IE per dag' } },
            { label: { fr: 'Plus de 1 an (à risque)', nl: 'Ouder dan 1 jaar (risicogroep)' }, min: 12, max: null, dose: 400, prises: 1,
              libelle: { fr: '400 UI par jour', nl: '400 IE per dag' } }
          ],
          duree: { fr: 'quotidien, toute l’année', nl: 'dagelijks, het hele jaar door' },
          note: {
            fr: 'CBIP : 400 UI/jour sont conseillées par toutes les sources EBM chez tous les nourrissons et enfants jusqu’à 1 an ; des doses plus élevées peuvent être nécessaires chez le prématuré. Au-delà de 1 an, certaines sources EBM conseillent 400 UI/jour uniquement en présence de facteurs de risque (peau foncée, faible exposition au soleil, antiépileptiques inducteurs), d’autres jusqu’à 4 ou 6 ans et pendant les mois d’hiver. Traitement du rachitisme avéré : 3 000 à 5 000 UI/jour. Dose indépendante du poids.',
            nl: 'BCFI: 400 IE/dag wordt door alle EBM-bronnen aanbevolen bij alle zuigelingen en kinderen tot 1 jaar; hogere doses kunnen nodig zijn bij prematuren. Boven 1 jaar bevelen sommige EBM-bronnen 400 IE/dag enkel aan bij risicofactoren (donkere huid, weinig blootstelling aan de zon, enzyminducerende anti-epileptica), andere tot 4 of 6 jaar en tijdens de wintermaanden. Behandeling van bewezen rachitis: 3 000 tot 5 000 IE/dag. Dosis onafhankelijk van het gewicht.'
          },
          sources: [SRC_CBIP]
        }
      ],
      precautions: [
        { fr: 'Vérifier la concentration exacte de la spécialité : elle varie fortement d’une marque à l’autre (D-Cure : 2 400 UI/ml en 36 gouttes, soit environ 67 UI par goutte).',
          nl: 'Controleer de exacte concentratie van de specialiteit: die verschilt sterk per merk (D-Cure: 2 400 IE/ml in 36 druppels, dus ongeveer 67 IE per druppel).' },
        { fr: 'Tenir compte des autres apports en vitamine D ; prudence avec les solutions fortement dosées (risque d’erreur de dosage et d’hypercalcémie).',
          nl: 'Houd rekening met andere inname van vitamine D; wees voorzichtig met hoog gedoseerde oplossingen (risico op doseerfouten en hypercalciëmie).' }
      ],
      contreIndications: [
        { fr: 'Hypercalcémie, calcification métastatique.', nl: 'Hypercalciëmie, metastatische verkalking.' }
      ],
      sources: [SRC_CBIP]
    },

    {
      id: 'fer',
      dci: {
        fr: 'Fer — exprimé en fer élément',
        nl: 'IJzer — uitgedrukt in elementair ijzer'
      },
      marques: ['Ferricure', 'Losferron'],
      cbip: { fr: 'fer', nl: 'ijzer' },
      categorie: 'supplement',
      frequent: false,
      verifie: true,
      synonymes: ['anemie', 'ferriprive', 'martial', 'bloedarmoede', 'ijzertekort'],
      doseExprimee: {
        fr: 'Les doses sont exprimées en FER ÉLÉMENT.',
        nl: 'De doses zijn uitgedrukt in ELEMENTAIR IJZER.'
      },
      formes: [
        { id: 'sol20', nom: { fr: 'Solution Ferricure 100 mg de fer(III) / 5 ml (20 mg/ml)',
                              nl: 'Ferricure oplossing 100 mg ijzer(III) / 5 ml (20 mg/ml)' }, type: 'liquide', parMl: 20 },
        { id: 'gel150', nom: { fr: 'Gélule Ferricure 150 mg de fer(III)', nl: 'Ferricure capsule 150 mg ijzer(III)' }, type: 'solide', parUnite: 150, uniteNom: U_GEL, pasUnite: 1 },
        { id: 'cp80', nom: { fr: 'Comprimé effervescent Losferron 80 mg de fer(II)', nl: 'Losferron bruistablet 80 mg ijzer(II)' }, type: 'solide', parUnite: 80, uniteNom: U_CP }
      ],
      schemas: [
        {
          id: 'carence',
          indication: { fr: 'Carence en fer / anémie ferriprive', nl: 'IJzertekort / ijzergebreksanemie' },
          mode: 'jour', unite: 'mg',
          doseMin: 1, doseUsuelle: 4, doseMax: 6,
          prises: [1, 2], maxJour: 200,
          duree: {
            fr: 'plusieurs mois, à poursuivre après normalisation',
            nl: 'meerdere maanden, voort te zetten na normalisatie'
          },
          note: {
            fr: 'CBIP : enfants 1 à 6 mg de fer élément/kg/jour ; adulte 60 à 200 mg de fer élément par jour. Le CBIP précise que les sources ne sont pas univoques. Rechercher la cause de la carence avant de supplémenter. Vérifier impérativement la teneur en fer élément de la spécialité choisie.',
            nl: 'BCFI: kinderen 1 tot 6 mg elementair ijzer/kg/dag; volwassene 60 tot 200 mg elementair ijzer per dag. Het BCFI vermeldt dat de bronnen niet eenduidig zijn. Zoek de oorzaak van het tekort op vóór suppletie. Controleer absoluut het gehalte aan elementair ijzer van de gekozen specialiteit.'
          },
          sources: [SRC_CBIP]
        }
      ],
      precautions: [
        { fr: 'Absorption optimale 1 h avant ou 2 h après le repas ; la prise pendant le repas réduit les troubles digestifs mais diminue l’absorption.',
          nl: 'Optimale absorptie 1 u voor of 2 u na de maaltijd; inname tijdens de maaltijd vermindert de maag-darmklachten maar ook de absorptie.' },
        { fr: 'Boire les formes liquides et les comprimés effervescents à la paille pour éviter une coloration des dents.',
          nl: 'Drink de vloeibare vormen en bruistabletten met een rietje om tandverkleuring te vermijden.' },
        { fr: 'Selles noires, constipation.', nl: 'Zwarte stoelgang, constipatie.' }
      ],
      contreIndications: [
        { fr: 'Surcharge en fer.', nl: 'IJzerstapeling.' }
      ],
      sources: [SRC_CBIP]
    }
  ];

  global.PosocalcData = {
    CATEGORIES: CATEGORIES,
    MEDICAMENTS: MEDICAMENTS
  };
})(window);
