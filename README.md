# Posocalc

Calculateur de posologie pédiatrique au poids, pour les médicaments couramment
prescrits en Belgique. Interface **française et néerlandaise**.

On entre le poids de l’enfant, on choisit le médicament et la présentation
réellement délivrée, et l’outil affiche directement **le nombre de millilitres
par prise** — plus de règle de trois à faire de tête au milieu d’une consultation.

## ⚠️ Version de développement

**Posocalc est une calculatrice, pas une référence médicale.**

- L’outil se contente d’appliquer une règle de trois à partir des valeurs
  saisies dans `assets/js/data.js`.
- **Aucune fiche n’a été validée par un professionnel.** Toutes portent le
  drapeau `verifie: false`, ce qui déclenche un bandeau rouge dans l’interface.
- Chaque posologie affiche **d’où vient le chiffre** (guide BAPCOC, CBIP, RCP…)
  et un lien direct vers la fiche CBIP/BCFI de la substance.
- Avant tout usage clinique, chaque fiche doit être confrontée à la notice du
  produit, au [CBIP](https://www.cbip.be/fr/start) /
  [BCFI](https://www.bcfi.be/nl/start) et au
  [guide BAPCOC](https://organesdeconcertation.sante.belgique.be/sites/default/files/content/bapcoc_guide_traitement_antiinfectieux_2022.pdf),
  puis passée à `verifie: true`.
- La responsabilité de la prescription reste entièrement celle du prescripteur.

## Ce que fait l’outil

**Bilingue.** Français et néerlandais, y compris les indications, les
présentations, les précautions et la feuille remise au patient. La langue est
détectée depuis le navigateur et se change d’un bouton. La recherche est
indifférente à la langue : `oorontsteking` trouve la fiche affichée en français.

**Recherche.** Insensible aux accents et tolérante aux fautes de frappe, sur la
DCI, les noms commerciaux belges et les indications dans les deux langues
(`amoxi`, `augmentin`, `otite`, `koorts`, `zyrtec`… fonctionnent tous). Les plus
prescrits sont en tête de liste, le reste est filtrable par catégorie.

**Posologie préremplie** par indication, avec l’intervalle recommandé et un
curseur pour choisir la dose retenue à l’intérieur de cet intervalle.

**Choix automatique de la présentation la plus praticable.** Pour un enfant de
12 kg, l’outil propose la suspension à 250 mg/5 ml (6,4 ml) plutôt que celle à
125 mg/5 ml (12,8 ml). Le choix reste modifiable.

**Détail du calcul.** Un bouton déplie la règle de trois étape par étape, avec
la formule et le résultat intermédiaire de chacune — de quoi refaire le calcul
à la main et vérifier que l’outil ne raconte pas n’importe quoi :

```
1  Dose journalière : dose par kilo × poids     80 mg/kg × 12 kg      960 mg/j
2  Répartition : total journalier ÷ prises      960 mg/j ÷ 3          320 mg
3  Conversion en volume : dose ÷ concentration  320 mg ÷ 50 mg/ml     6,4 ml
4  Volume journalier : volume × prises          6,4 ml × 3            19,2 ml/j
5  Contrôle inverse : réellement administré     960 mg/j ÷ 12 kg      80 mg/kg/j
```

**Feuille imprimable pour le patient.** En-tête avec vos coordonnées (nom,
qualification, numéro INAMI/RIZIV, adresse, téléphone), prénom de l’enfant,
poids, médicament, dose en gros caractères, horaires suggérés, durée,
explication de la dose et conseils pratiques adaptés au médicament. Vos
coordonnées sont mémorisées dans le navigateur ; les données du patient, non.

**Sécurités.**
- Plafonnement automatique à la dose adulte maximale, signalé explicitement.
- Arrondi au pas réel d’une seringue doseuse, avec alerte si l’écart dépasse 5 %.
- Arrondi aux fractions réellement administrables (un suppositoire ne se coupe
  pas en 0,9 ; une gélule ne se coupe pas du tout).
- Un arrondi vers le haut ne peut jamais faire franchir un plafond absolu : si
  la seule unité administrable dépasse le maximum, c’est signalé comme un
  problème de **fréquence**, pas de dose.
- Vérification inverse : la dose réellement délivrée après arrondi est
  réaffichée en mg/kg/j.
- Alertes d’âge et de poids minimum, contre-indications, précautions.

**Doses non pondérales** gérées aussi : tranches d’âge (cétirizine,
montélukast, vitamine D) ou de poids (oseltamivir), dose unique (dexaméthasone,
ondansétron), médicaments « à la demande » (salbutamol, pour lesquels aucun
total sur 24 h n’est affiché).

Aucune donnée patient n’est enregistrée ni transmise. Tout le calcul est local.

## Utilisation

Le site est entièrement statique — pas de dépendance, pas d’étape de build.

```bash
npm start          # puis ouvrir http://localhost:8080
```

### Publier sur GitHub Pages

Le dépôt est déjà prêt (fichier `.nojekyll` présent, tout est à la racine) :

1. `Settings` → `Pages` ;
2. sous *Build and deployment*, source **Deploy from a branch** ;
3. choisir la branche, dossier **`/ (root)`**, puis `Save`.

L’adresse `https://<compte>.github.io/Posocalc/` est active après une minute.

### Version en un seul fichier

```bash
npm run build      # produit dist/posocalc.html
```

Ce fichier contient la feuille de style et tous les scripts. Il fonctionne sans
serveur : on peut l’enregistrer sur un téléphone et s’en servir **hors
connexion**, en salle d’attente ou en visite. `npm run build` génère aussi
`dist/posocalc.fragment.html`, sans squelette de page, pour les hébergeurs qui
fournissent eux-mêmes `<head>` et `<body>`.

## Modifier ou ajouter un médicament

Tout se passe dans **`assets/js/data.js`**, dont l’en-tête documente le format
complet. Tout champ affiché à l’écran est soit une chaîne simple (identique dans
les deux langues, comme un nom de marque), soit un objet `{ fr, nl }`.

```js
{
  id: 'amoxicilline',
  dci: { fr: 'Amoxicilline', nl: 'Amoxicilline' },
  marques: ['Clamoxyl', 'Amoxypen'],
  cbip: { fr: 'amoxicilline', nl: 'amoxicilline' },   // lien fiche CBIP/BCFI
  categorie: 'antibiotique',
  frequent: true,          // remonte dans « Les plus prescrits »
  verifie: false,          // passer à true une fois la fiche relue
  formes: [
    { id: 'susp250', nom: { fr: 'Suspension orale 250 mg / 5 ml',
                            nl: 'Orale suspensie 250 mg / 5 ml' },
      type: 'liquide', parMl: 50 },                   // 250 / 5 = 50 mg par ml
    { id: 'cp500', nom: { fr: 'Comprimé 500 mg', nl: 'Tablet 500 mg' },
      type: 'solide', parUnite: 500, uniteNom: U_CP }
  ],
  schemas: [
    { id: 'oma',
      indication: { fr: 'Otite moyenne aiguë', nl: 'Acute middenoorontsteking' },
      mode: 'jour',                                   // mg/kg/JOUR
      unite: 'mg',
      doseMin: 75, doseUsuelle: 80, doseMax: 100,
      prises: [3],                                    // 1re valeur = défaut
      maxJour: 3000,                                  // plafond dose adulte
      duree: { fr: '5 à 7 jours', nl: '5 tot 7 dagen' },
      sources: [SRC_BAPCOC] }                         // OBLIGATOIRE
  ],
  sources: [SRC_BAPCOC, SRC_CBIP]
}
```

`sources` est obligatoire sur chaque schéma : c’est ce que l’interface affiche
sous le bloc « Sur quoi se base ce chiffre ? ». Les tests refusent un schéma
sans source.

Les quatre modes posologiques :

| `mode`    | Signification                        | Exemple                    |
|-----------|--------------------------------------|----------------------------|
| `jour`    | dose exprimée par **kg et par jour** | amoxicilline 80 mg/kg/j    |
| `prise`   | dose exprimée par **kg et par prise**| paracétamol 15 mg/kg/prise |
| `unique`  | dose unique par kg                   | dexaméthasone 0,15 mg/kg   |
| `paliers` | dose fixe par tranche d’âge ou de poids | cétirizine, oseltamivir |

> Deux pièges à connaître :
> - en mode `paliers`, le champ `dose` d’un palier est le **total par jour**,
>   réparti sur `prises`. Pour « 2,5 mg deux fois par jour », il faut écrire
>   `dose: 5, prises: 2` ;
> - `uniteNom` porte le singulier **et** le pluriel (`{ un, pl }`) : le pluriel
>   néerlandais n’est pas un simple « + s » (`tablet` → `tabletten`).

### Après chaque modification

```bash
npm test
```

Les tests contrôlent le moteur de calcul, la trace « détail du calcul », la
complétude des traductions (aucun champ ne peut être renseigné dans une seule
langue), la présence des sources, et l’intégrité du fichier de données
(identifiants uniques, `doseMin ≤ doseUsuelle ≤ doseMax`, paliers ordonnés sans
trou ni chevauchement, absence de valeur aberrante et de plafond franchi en
silence sur les 700+ combinaisons médicament × indication × présentation ×
poids).

## Structure

```
index.html              interface (squelette ; les textes viennent de i18n.js)
assets/css/styles.css   styles (clair + sombre, feuille patient, impression)
assets/js/data.js       ← les données médicales, c'est ici qu'on édite
assets/js/i18n.js       textes de l'interface, FR et NL
assets/js/calc.js       moteur de calcul (fonctions pures, indépendant de la langue)
assets/js/search.js     recherche bilingue, accent-insensible, tolérante aux fautes
assets/js/app.js        interface
tests/posocalc.test.js  tests
```

Le moteur de calcul ne produit aucun texte : il émet des clés de message et une
trace structurée, que l’interface traduit. C’est ce qui permet de basculer de
langue sans recalculer, et de tester le calcul indépendamment de l’affichage.

## Licence

MIT pour le code. Les données posologiques sont indicatives, non validées, et
doivent être contrôlées avant tout usage clinique.
