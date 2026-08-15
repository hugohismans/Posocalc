/*
 * Posocalc — internationalisation (français / néerlandais)
 *
 * Deux mécanismes :
 *   t(cle, params)  chaînes de l'interface, définies ci-dessous
 *   tr(valeur)      champs du fichier de données, qui peuvent être soit une
 *                   chaîne simple (identique dans les deux langues, ex. un nom
 *                   de marque), soit un objet { fr: '…', nl: '…' }
 */
(function (global) {
  'use strict';

  var CLE_LANGUE = 'posocalc.langue.v1';
  var LANGUES = ['fr', 'nl'];
  var langue = 'fr';

  var STRINGS = {
    /* ---- Général ------------------------------------------------- */
    'app.sous': { fr: 'Posologie pédiatrique · Belgique', nl: 'Pediatrische dosering · België' },
    'app.dev': { fr: 'version de développement', nl: 'ontwikkelversie' },
    'app.bandeau': {
      fr: 'Version de développement — données non validées. <strong>Vérifiez chaque dose dans votre propre littérature.</strong>',
      nl: 'Ontwikkelversie — niet-gevalideerde gegevens. <strong>Controleer elke dosis in uw eigen literatuur.</strong>'
    },
    'app.avertissement': { fr: 'Avertissement', nl: 'Waarschuwing' },
    'app.langue': { fr: 'Taal: Nederlands', nl: 'Langue : français' },

    /* ---- Modale d'avertissement ---------------------------------- */
    'modal.titre': { fr: 'Avant d’utiliser Posocalc', nl: 'Voor u Posocalc gebruikt' },
    'modal.intro': {
      fr: '<strong>Posocalc est une calculatrice, pas une référence médicale.</strong> Cette version est une version de développement.',
      nl: '<strong>Posocalc is een rekenmachine, geen medische referentie.</strong> Dit is een ontwikkelversie.'
    },
    'modal.p1': {
      fr: 'L’outil applique une règle de trois à partir de données saisies dans un fichier local. Il ne remplace ni la notice, ni le CBIP, ni le guide BAPCOC, ni votre jugement clinique.',
      nl: 'Het instrument past een regel van drie toe op gegevens uit een lokaal bestand. Het vervangt de bijsluiter, het BCFI, de BAPCOC-gids of uw klinisch oordeel niet.'
    },
    'modal.p2': {
      fr: 'Aucune fiche n’a été relue par un professionnel. Chaque fiche affiche sa source et un badge <span class="badge badge--warn">non vérifiée</span> tant que ce contrôle n’a pas eu lieu. <strong>Vérifiez systématiquement la dose dans votre propre littérature</strong>, ainsi que la concentration de la présentation réellement délivrée.',
      nl: 'Geen enkele fiche werd door een professional nagelezen. Elke fiche toont haar bron en een label <span class="badge badge--warn">niet geverifieerd</span> zolang die controle niet gebeurde. <strong>Controleer elke dosis systematisch in uw eigen literatuur</strong>, evenals de concentratie van de werkelijk afgeleverde vorm.'
    },
    'modal.p3': {
      fr: 'Le calcul dépend entièrement du poids saisi et de la présentation choisie. Une erreur de saisie donne un résultat faux mais crédible. Le bouton « Détail du calcul » permet de contrôler chaque étape.',
      nl: 'De berekening hangt volledig af van het ingevoerde gewicht en de gekozen vorm. Een invoerfout geeft een fout maar geloofwaardig resultaat. Met de knop « Detail van de berekening » controleert u elke stap.'
    },
    'modal.p4': {
      fr: 'La responsabilité de la prescription reste entièrement celle du prescripteur.',
      nl: 'De verantwoordelijkheid voor het voorschrift blijft volledig bij de voorschrijver.'
    },
    'modal.ok': { fr: 'J’ai lu et je comprends', nl: 'Ik heb dit gelezen en begrepen' },

    /* ---- Patient -------------------------------------------------- */
    'patient.titre': { fr: 'Le patient', nl: 'De patiënt' },
    'patient.poids': { fr: 'Poids', nl: 'Gewicht' },
    'patient.age': { fr: 'Âge', nl: 'Leeftijd' },
    'patient.prenom': { fr: 'Prénom', nl: 'Voornaam' },
    'patient.facultatif': { fr: '(facultatif)', nl: '(optioneel)' },
    'patient.ans': { fr: 'ans', nl: 'jaar' },
    'patient.mois': { fr: 'mois', nl: 'maanden' },
    'age.mois': { fr: '{n} mois', nl: '{n} maanden' },
    'age.ans': { fr: '{n} ans', nl: '{n} jaar' },
    'age.ansMois': { fr: '{a} ans et {m} mois', nl: '{a} jaar en {m} maanden' },
    'patient.effacer': { fr: 'Effacer', nl: 'Wissen' },
    'patient.efface': { fr: 'Données patient effacées', nl: 'Patiëntgegevens gewist' },
    'patient.aide': {
      fr: 'L’âge sert aux médicaments dosés par tranche d’âge (cétirizine, montélukast, vitamine D…) et aux alertes de contre-indication. Le prénom n’apparaît que sur la feuille imprimée.',
      nl: 'De leeftijd wordt gebruikt voor geneesmiddelen met vaste dosis per leeftijdsgroep (cetirizine, montelukast, vitamine D…) en voor contra-indicatiewaarschuwingen. De voornaam verschijnt enkel op het afgedrukte blad.'
    },
    'patient.local': {
      fr: 'Les données du patient restent dans cette page : elles ne sont ni enregistrées ni transmises.',
      nl: 'De patiëntgegevens blijven op deze pagina: ze worden niet opgeslagen of doorgestuurd.'
    },

    /* ---- Médicament ----------------------------------------------- */
    'med.titre': { fr: 'Le médicament', nl: 'Het geneesmiddel' },
    'med.recherche': {
      fr: 'Rechercher : amoxicilline, Augmentin, otite…',
      nl: 'Zoeken: amoxicilline, Augmentin, oorontsteking…'
    },
    'med.vider': { fr: 'Vider la recherche', nl: 'Zoekopdracht wissen' },
    'med.tout': { fr: 'Tout', nl: 'Alles' },
    'med.frequents': { fr: 'Les plus prescrits', nl: 'Meest voorgeschreven' },
    'med.tous': { fr: 'Tous les médicaments ({n})', nl: 'Alle geneesmiddelen ({n})' },
    'med.resultat': { fr: '{n} résultat', nl: '{n} resultaat' },
    'med.resultats': { fr: '{n} résultats', nl: '{n} resultaten' },
    'med.aucun': {
      fr: 'Aucun médicament ne correspond à cette recherche.',
      nl: 'Geen enkel geneesmiddel komt overeen met deze zoekopdracht.'
    },
    'med.frequent': { fr: 'Fréquemment prescrit', nl: 'Vaak voorgeschreven' },
    'med.fermer': { fr: 'Fermer la fiche', nl: 'Fiche sluiten' },
    'med.verifiee': { fr: 'fiche vérifiée', nl: 'fiche geverifieerd' },
    'med.nonVerifiee': { fr: 'fiche non vérifiée', nl: 'fiche niet geverifieerd' },

    /* ---- Réglages posologiques ------------------------------------ */
    'reg.indication': { fr: 'Indication', nl: 'Indicatie' },
    'reg.reference': { fr: 'Posologie de référence', nl: 'Referentiedosering' },
    'reg.dose': { fr: 'Dose retenue', nl: 'Gekozen dosis' },
    'reg.presentation': { fr: 'Présentation délivrée', nl: 'Afgeleverde vorm' },
    'reg.prises': { fr: 'Nombre de prises par jour', nl: 'Aantal innames per dag' },
    'reg.parJour': { fr: '{n} ×/jour', nl: '{n} ×/dag' },

    /* ---- Résultat -------------------------------------------------- */
    'res.parPrise': { fr: 'Par prise', nl: 'Per inname' },
    'res.parJour': { fr: 'Par jour', nl: 'Per dag' },
    'res.doseUnique': { fr: 'Dose unique', nl: 'Eenmalige dosis' },
    'res.total': { fr: 'Total', nl: 'Totaal' },
    'res.parAdmin': { fr: 'Par administration', nl: 'Per toediening' },
    'res.totalAdmin': { fr: 'Total administré', nl: 'Toegediend totaal' },
    'res.total24': { fr: 'Total sur 24 h', nl: 'Totaal over 24 u' },
    'res.rythme': { fr: '{n} prises par jour, soit toutes les {h} h', nl: '{n} innames per dag, dus om de {h} u' },
    'res.rythme1': { fr: 'Une seule prise par jour', nl: 'Eén inname per dag' },
    'res.sufJour': { fr: '/j', nl: '/dag' },
    'res.repeter': { fr: 'À répéter selon la réponse clinique', nl: 'Te herhalen volgens klinische respons' },
    'res.verif': { fr: 'Vérification : dose réellement administrée ≈ <strong>{d}</strong>', nl: 'Controle: werkelijk toegediende dosis ≈ <strong>{d}</strong>' },
    'res.horsIntervalle': { fr: 'hors de l’intervalle de référence', nl: 'buiten het referentie-interval' },
    'res.poidsSaisi': { fr: 'poids saisi : {p} kg', nl: 'ingevoerd gewicht: {p} kg' },
    'res.tranche': { fr: 'Tranche appliquée', nl: 'Toegepaste groep' },
    'res.copier': { fr: 'Copier', nl: 'Kopiëren' },
    'res.copie': { fr: 'Posologie copiée', nl: 'Dosering gekopieerd' },
    'res.copieKo': { fr: 'Copie impossible', nl: 'Kopiëren onmogelijk' },
    'res.imprimer': { fr: 'Feuille pour le patient', nl: 'Blad voor de patiënt' },
    'res.detail': { fr: 'Détail du calcul', nl: 'Detail van de berekening' },
    'res.foisParJour': { fr: '{n} fois par jour', nl: '{n} keer per dag' },
    'res.enDoseUnique': { fr: 'en dose unique', nl: 'als eenmalige dosis' },
    'res.prnPhrase': {
      fr: 'par administration, à répéter selon la réponse clinique',
      nl: 'per toediening, te herhalen volgens klinische respons'
    },
    'res.pendant': { fr: 'pendant', nl: 'gedurende' },
    'res.enfantDe': { fr: 'enfant de {p} kg', nl: 'kind van {p} kg' },

    /* ---- Détail du calcul ------------------------------------------ */
    'calc.titre': { fr: 'Comment ce chiffre est obtenu', nl: 'Hoe dit getal bekomen wordt' },
    'calc.intro': {
      fr: 'Chaque étape est reproductible à la main. Contrôlez-la avant de prescrire.',
      nl: 'Elke stap is met de hand na te rekenen. Controleer ze voor u voorschrijft.'
    },
    'calc.etape.doseJour': { fr: 'Dose journalière : dose par kilo × poids', nl: 'Dagdosis: dosis per kilo × gewicht' },
    'calc.etape.dosePrise': { fr: 'Dose par prise : dose par kilo × poids', nl: 'Dosis per inname: dosis per kilo × gewicht' },
    'calc.etape.doseUnique': { fr: 'Dose unique : dose par kilo × poids', nl: 'Eenmalige dosis: dosis per kilo × gewicht' },
    'calc.etape.totalDepuisPrise': { fr: 'Total journalier : dose par prise × nombre de prises', nl: 'Dagtotaal: dosis per inname × aantal innames' },
    'calc.etape.palier': { fr: 'Dose fixe pour cette tranche (indépendante du poids)', nl: 'Vaste dosis voor deze groep (onafhankelijk van het gewicht)' },
    'calc.etape.plafondKg': { fr: 'Plafond par kilo appliqué', nl: 'Plafond per kilo toegepast' },
    'calc.etape.plafondJour': { fr: 'Plafond journalier absolu appliqué (dose adulte)', nl: 'Absoluut dagplafond toegepast (volwassen dosis)' },
    'calc.etape.plafondPrise': { fr: 'Plafond par prise appliqué', nl: 'Plafond per inname toegepast' },
    'calc.etape.division': { fr: 'Répartition : total journalier ÷ nombre de prises', nl: 'Verdeling: dagtotaal ÷ aantal innames' },
    'calc.etape.volume': { fr: 'Conversion en volume : dose ÷ concentration', nl: 'Omzetting naar volume: dosis ÷ concentratie' },
    'calc.etape.arrondiVolume': { fr: 'Arrondi au pas de la seringue doseuse ({pas} ml)', nl: 'Afgerond op de stap van de doseerspuit ({pas} ml)' },
    'calc.etape.unites': { fr: 'Conversion en unités : dose ÷ dosage unitaire', nl: 'Omzetting naar eenheden: dosis ÷ eenheidsdosis' },
    'calc.etape.arrondiUnites': { fr: 'Arrondi à la fraction administrable ({pas})', nl: 'Afgerond op de toedienbare fractie ({pas})' },
    'calc.etape.volumeJour': { fr: 'Volume journalier : volume par prise × nombre de prises', nl: 'Dagvolume: volume per inname × aantal innames' },
    'calc.etape.controle': { fr: 'Contrôle inverse : ce qui est réellement administré', nl: 'Omgekeerde controle: wat werkelijk toegediend wordt' },
    'calc.sansArrondi': { fr: 'sans arrondi', nl: 'zonder afronding' },

    /* ---- Sources ---------------------------------------------------- */
    'src.titre': { fr: 'Sur quoi se base ce chiffre ?', nl: 'Waarop is dit getal gebaseerd?' },
    'src.doseTiree': { fr: 'Posologie tirée de :', nl: 'Dosering ontleend aan:' },
    'src.verifier': { fr: 'À vérifier dans', nl: 'Te controleren in' },
    'src.cbip': { fr: 'la fiche CBIP de la substance', nl: 'de BCFI-fiche van de stof' },
    'src.notice': { fr: 'la notice (banque de données AFMPS)', nl: 'de bijsluiter (FAGG-databank)' },
    'src.avert': {
      fr: 'Ces valeurs n’ont pas été relues par un professionnel et peuvent contenir des erreurs de transcription. Confrontez-les à votre propre littérature avant de prescrire.',
      nl: 'Deze waarden werden niet door een professional nagelezen en kunnen overschrijffouten bevatten. Toets ze aan uw eigen literatuur voor u voorschrijft.'
    },
    'infos.ci': { fr: 'Contre-indications', nl: 'Contra-indicaties' },
    'infos.prec': { fr: 'Précautions', nl: 'Voorzorgen' },
    'infos.sources': { fr: 'Sources', nl: 'Bronnen' },

    /* ---- Alertes ----------------------------------------------------- */
    'al.plafond': { fr: 'Dose plafonnée', nl: 'Dosis afgetopt' },
    'al.plafondTexte': {
      fr: 'Le calcul au poids dépassait {motif}. La dose affichée a été ramenée à ce plafond.',
      nl: 'De berekening op gewicht overschreed {motif}. De getoonde dosis werd tot dat plafond herleid.'
    },
    'plafond.parKg': {
      fr: 'la dose maximale de {valeur} {unite}/kg/j',
      nl: 'de maximale dosis van {valeur} {unite}/kg/dag'
    },
    'plafond.jour': {
      fr: 'la dose maximale adulte de {valeur} {unite}/j',
      nl: 'de maximale volwassen dosis van {valeur} {unite}/dag'
    },
    'plafond.prise': {
      fr: 'la dose maximale de {valeur} {unite} par prise',
      nl: 'de maximale dosis van {valeur} {unite} per inname'
    },
    'al.verifier': { fr: 'À vérifier', nl: 'Te controleren' },
    'al.nonVerifiee': { fr: 'Fiche non vérifiée', nl: 'Fiche niet geverifieerd' },
    'al.nonVerifieeTexte': {
      fr: 'Les valeurs de cette fiche n’ont pas encore été relues par un professionnel. Confrontez-les à la notice, au CBIP ou au guide BAPCOC avant de prescrire.',
      nl: 'De waarden van deze fiche werden nog niet door een professional nagelezen. Toets ze aan de bijsluiter, het BCFI of de BAPCOC-gids voor u voorschrijft.'
    },

    /* ---- Messages du moteur de calcul --------------------------------- */
    'w.poidsManquant': {
      fr: 'Indiquez le poids de l’enfant pour lancer le calcul.',
      nl: 'Geef het gewicht van het kind in om de berekening te starten.'
    },
    'w.agePourTranche': {
      fr: 'Indiquez l’âge pour sélectionner la tranche.',
      nl: 'Geef de leeftijd in om de juiste groep te selecteren.'
    },
    'w.poidsPourTranche': {
      fr: 'Indiquez le poids pour sélectionner la tranche.',
      nl: 'Geef het gewicht in om de juiste groep te selecteren.'
    },
    'w.aucuneTrancheAge': {
      fr: 'Aucune tranche d’âge ne correspond à ce patient.',
      nl: 'Geen enkele leeftijdsgroep komt overeen met deze patiënt.'
    },
    'w.aucuneTranchePoids': {
      fr: 'Aucune tranche de poids ne correspond à ce patient.',
      nl: 'Geen enkele gewichtsgroep komt overeen met deze patiënt.'
    },
    'w.arrondiVolume': {
      fr: 'Le volume a été arrondi de {brut} ml à {net} ml (écart > 5 %). Vérifiez la graduation de la seringue doseuse.',
      nl: 'Het volume werd afgerond van {brut} ml naar {net} ml (afwijking > 5 %). Controleer de schaalverdeling van de doseerspuit.'
    },
    'w.volumeFaible': {
      fr: 'Volume par prise très faible (< 0,2 ml) : présentation probablement inadaptée.',
      nl: 'Zeer klein volume per inname (< 0,2 ml): vorm waarschijnlijk ongeschikt.'
    },
    'w.volumeEleve': {
      fr: 'Volume par prise élevé (> 20 ml) : envisagez une présentation plus concentrée.',
      nl: 'Groot volume per inname (> 20 ml): overweeg een meer geconcentreerde vorm.'
    },
    'w.tropDose': {
      fr: 'La dose calculée ({dose} par prise) est inférieure à la plus petite fraction administrable de cette présentation : elle est trop dosée pour ce patient.',
      nl: 'De berekende dosis ({dose} per inname) ligt onder de kleinste toedienbare fractie van deze vorm: ze is te sterk gedoseerd voor deze patiënt.'
    },
    'w.ajustement': {
      fr: 'Ajustement à la présentation : {theorique} → {pratique} {unite} par prise (écart > 10 % par rapport à la dose théorique).',
      nl: 'Aanpassing aan de vorm: {theorique} → {pratique} {unite} per inname (afwijking > 10 % t.o.v. de theoretische dosis).'
    },
    'w.plafondForme': {
      fr: 'Avec cette présentation, la dose arrondie atteint {total} par jour et dépasse le maximum recommandé. Réduisez le nombre de prises ou choisissez une présentation moins dosée.',
      nl: 'Met deze vorm bereikt de afgeronde dosis {total} per dag en overschrijdt ze het aanbevolen maximum. Verminder het aantal innames of kies een lager gedoseerde vorm.'
    },
    'w.ageMin': {
      fr: 'Âge inférieur au minimum de ce schéma ({min}).',
      nl: 'Leeftijd lager dan het minimum van dit schema ({min}).'
    },
    'w.poidsMin': {
      fr: 'Poids inférieur au minimum de ce schéma ({min} kg).',
      nl: 'Gewicht lager dan het minimum van dit schema ({min} kg).'
    },
    'w.adulte': {
      fr: 'Au-delà de 40 kg, la posologie adulte s’applique généralement : vérifiez le plafond.',
      nl: 'Boven 40 kg geldt doorgaans de volwassen dosering: controleer het plafond.'
    },

    /* ---- Coordonnées du prescripteur ----------------------------------- */
    'md.titre': { fr: 'Mes coordonnées (feuille imprimée)', nl: 'Mijn gegevens (afgedrukt blad)' },
    'md.aide': {
      fr: 'Ces informations vous concernent, vous, et sont conservées uniquement dans ce navigateur pour remplir l’en-tête de la feuille remise au patient.',
      nl: 'Deze gegevens gaan over uzelf en worden enkel in deze browser bewaard om de hoofding van het blad voor de patiënt in te vullen.'
    },
    'md.nom': { fr: 'Nom', nl: 'Naam' },
    'md.qualif': { fr: 'Qualification', nl: 'Kwalificatie' },
    'md.inami': { fr: 'Numéro INAMI', nl: 'RIZIV-nummer' },
    'md.adresse': { fr: 'Adresse', nl: 'Adres' },
    'md.tel': { fr: 'Téléphone', nl: 'Telefoon' },
    'md.enregistrer': { fr: 'Enregistrer', nl: 'Opslaan' },
    'md.enregistre': { fr: 'Coordonnées enregistrées', nl: 'Gegevens opgeslagen' },
    'md.exemple.qualif': { fr: 'Médecin généraliste', nl: 'Huisarts' },

    /* ---- Feuille imprimée ------------------------------------------------ */
    'f.titre': { fr: 'Schéma de traitement', nl: 'Behandelingsschema' },
    'f.pour': { fr: 'Pour', nl: 'Voor' },
    'f.date': { fr: 'Date', nl: 'Datum' },
    'f.poids': { fr: 'Poids', nl: 'Gewicht' },
    'f.age': { fr: 'Âge', nl: 'Leeftijd' },
    'f.medicament': { fr: 'Médicament', nl: 'Geneesmiddel' },
    'f.presentation': { fr: 'Présentation', nl: 'Vorm' },
    'f.indication': { fr: 'Indication', nl: 'Indicatie' },
    'f.aDonner': { fr: 'À donner', nl: 'Toe te dienen' },
    'f.parPrise': { fr: 'par prise', nl: 'per inname' },
    'f.quandTitre': { fr: 'Quand', nl: 'Wanneer' },
    'f.horaires': { fr: 'Par exemple à', nl: 'Bijvoorbeeld om' },
    'f.duree': { fr: 'Durée du traitement', nl: 'Duur van de behandeling' },
    'f.dureeNP': { fr: 'selon l’avis du médecin', nl: 'volgens het advies van de arts' },
    'f.pourquoi': { fr: 'Pourquoi cette dose', nl: 'Waarom deze dosis' },
    'f.pourquoiTexte': {
      fr: 'La dose dépend du poids de l’enfant : {dose} pour {poids} kg, soit {total} par jour, réparti en {prises} prises.',
      nl: 'De dosis hangt af van het gewicht van het kind: {dose} voor {poids} kg, dus {total} per dag, verdeeld over {prises} innames.'
    },
    'f.pourquoiTexte1': {
      fr: 'La dose dépend du poids de l’enfant : {dose} pour {poids} kg, soit {total} par jour, en une seule prise.',
      nl: 'De dosis hangt af van het gewicht van het kind: {dose} voor {poids} kg, dus {total} per dag, in één inname.'
    },
    'f.pourquoiPalier': {
      fr: 'La dose de ce médicament est fixe pour la tranche « {tranche} » et ne dépend pas du poids.',
      nl: 'De dosis van dit geneesmiddel is vast voor de groep « {tranche} » en hangt niet af van het gewicht.'
    },
    'f.conseils': { fr: 'À savoir', nl: 'Goed om weten' },
    'f.conseilFievre': {
      fr: 'Respectez l’intervalle entre deux prises, même si la fièvre revient plus tôt.',
      nl: 'Respecteer het interval tussen twee innames, ook als de koorts vroeger terugkomt.'
    },
    'f.conseilAtb': {
      fr: 'Allez jusqu’au bout du traitement, même si l’enfant va mieux avant la fin.',
      nl: 'Maak de kuur volledig af, ook als het kind zich eerder beter voelt.'
    },
    'f.conseilSeringue': {
      fr: 'Utilisez la seringue ou le doseur fourni avec le flacon : une cuillère de cuisine n’est pas fiable.',
      nl: 'Gebruik de spuit of doseerdop die bij de fles zit: een keukenlepel is niet betrouwbaar.'
    },
    'f.conseilContact': {
      fr: 'En cas de doute, d’oubli ou d’effet inattendu, contactez votre médecin.',
      nl: 'Neem bij twijfel, een vergeten inname of een onverwacht effect contact op met uw arts.'
    },
    'f.pied': {
      fr: 'Document remis à titre informatif, établi le {date}. Ne pas modifier les doses sans avis médical.',
      nl: 'Document ter informatie overhandigd, opgesteld op {date}. Wijzig de doses niet zonder medisch advies.'
    },
    'f.imprimer': { fr: 'Imprimer la feuille', nl: 'Blad afdrukken' },
    'f.apercu': { fr: 'Aperçu de la feuille patient', nl: 'Voorbeeld van het patiëntenblad' },
    'f.fermer': { fr: 'Fermer l’aperçu', nl: 'Voorbeeld sluiten' },
    'f.sansCoord': {
      fr: 'Renseignez vos coordonnées ci-dessus pour qu’elles apparaissent en en-tête.',
      nl: 'Vul hierboven uw gegevens in zodat ze in de hoofding verschijnen.'
    },

    /* ---- Pied de page -------------------------------------------------- */
    'pied.projet': {
      fr: '<strong>Posocalc</strong> — projet libre, sans collecte de données. Aucune information patient n’est enregistrée ni transmise.',
      nl: '<strong>Posocalc</strong> — vrij project, zonder gegevensverzameling. Er wordt geen enkel patiëntgegeven opgeslagen of doorgestuurd.'
    },
    'pied.sources': { fr: 'Sources de référence', nl: 'Referentiebronnen' },
    'pied.legal': {
      fr: 'Version de développement. Les données posologiques fournies avec l’outil sont indicatives, n’ont pas été validées et doivent être contrôlées dans votre propre littérature avant tout usage clinique.',
      nl: 'Ontwikkelversie. De meegeleverde doseringsgegevens zijn indicatief, werden niet gevalideerd en moeten voor elk klinisch gebruik in uw eigen literatuur gecontroleerd worden.'
    }
  };

  function detecter() {
    var stocke = null;
    try { stocke = global.localStorage.getItem(CLE_LANGUE); } catch (e) { /* mode privé */ }
    if (stocke && LANGUES.indexOf(stocke) !== -1) return stocke;
    var nav = (global.navigator.language || 'fr').slice(0, 2).toLowerCase();
    return nav === 'nl' ? 'nl' : 'fr';
  }

  /** Interpolation simple : t('x', { n: 3 }) remplace {n}. */
  function t(cle, params) {
    var entree = STRINGS[cle];
    var texte = entree ? (entree[langue] || entree.fr) : cle;
    if (params) {
      Object.keys(params).forEach(function (k) {
        texte = texte.split('{' + k + '}').join(params[k]);
      });
    }
    return texte;
  }

  /* Seule « UI » change de nom en néerlandais (internationale eenheden). */
  var UNITES = { UI: { fr: 'UI', nl: 'IE' } };

  function unite(code) {
    var u = UNITES[code];
    return u ? (u[langue] || u.fr) : code;
  }

  /** Champ du fichier de données : chaîne simple ou { fr, nl }. */
  function tr(valeur) {
    if (valeur === null || valeur === undefined) return '';
    if (typeof valeur === 'string') return valeur;
    return valeur[langue] || valeur.fr || '';
  }

  global.PosocalcI18n = {
    langues: LANGUES,
    langue: function () { return langue; },
    autre: function () { return langue === 'fr' ? 'nl' : 'fr'; },
    definir: function (l) {
      if (LANGUES.indexOf(l) === -1) return;
      langue = l;
      try { global.localStorage.setItem(CLE_LANGUE, l); } catch (e) { /* ignore */ }
      document.documentElement.lang = l;
    },
    initialiser: function () {
      langue = detecter();
      document.documentElement.lang = langue;
    },
    t: t,
    tr: tr,
    unite: unite
  };
})(window);
