# Posocalc

Calculateur de posologie pédiatrique au poids, pour les médicaments couramment
prescrits en Belgique.

On entre le poids de l’enfant, on choisit le médicament et la présentation
réellement délivrée, et l’outil affiche directement **le nombre de millilitres
par prise** — plus de règle de trois à faire de tête au milieu d’une consultation.

## ⚠️ Avertissement

**Posocalc est une calculatrice, pas une référence médicale.**

- L’outil se contente d’appliquer une règle de trois à partir des valeurs
  saisies dans `assets/js/data.js`.
- Les fiches livrées avec le projet portent toutes le drapeau
  `verifie: false` : **elles n’ont pas été validées par un professionnel**.
  L’interface affiche un bandeau rouge tant que c’est le cas.
- Avant tout usage clinique, chaque fiche doit être confrontée à la notice du
  produit, au [CBIP](https://www.cbip.be/fr/start) et au
  [guide BAPCOC](https://www.health.belgium.be/fr/guide-belge-des-traitements-anti-infectieux-en-pratique-ambulatoire),
  puis passée à `verifie: true`.
- La responsabilité de la prescription reste entièrement celle du prescripteur.

## Ce que fait l’outil

- **Recherche** insensible aux accents et tolérante aux fautes de frappe, sur la
  DCI, les noms commerciaux belges et les indications
  (`amoxi`, `augmentin`, `otite`, `zyrtec`… fonctionnent tous).
- **Les plus prescrits** en tête de liste, puis le répertoire complet, filtrable
  par catégorie.
- **Posologie préremplie** par indication, avec l’intervalle recommandé et un
  curseur pour choisir la dose retenue à l’intérieur de cet intervalle.
- **Choix automatique de la présentation la plus praticable** : pour un enfant de
  12 kg, l’outil propose la suspension à 250 mg/5 ml (6,4 ml) plutôt que celle à
  125 mg/5 ml (12,8 ml). Le choix reste modifiable.
- **Résultat en mg et en ml**, par prise et par jour, avec le nombre de prises
  et l’intervalle entre les prises.
- **Sécurités** :
  - plafonnement automatique à la dose adulte maximale, signalé explicitement ;
  - arrondi au pas réel d’une seringue doseuse, avec alerte si l’écart dépasse 5 % ;
  - arrondi aux fractions réellement administrables (un suppositoire ne se coupe
    pas en 0,9) ;
  - **vérification inverse** : la dose réellement délivrée après arrondi est
    réaffichée en mg/kg/j ;
  - alertes d’âge et de poids minimum, contre-indications, précautions.
- **Doses non pondérales** gérées aussi : tranches d’âge (cétirizine,
  montélukast, vitamine D) ou de poids (oseltamivir), dose unique
  (dexaméthasone, ondansétron), médicaments « à la demande » (salbutamol).
- **Copier / imprimer** la ligne de posologie.
- Aucune donnée patient n’est enregistrée ni transmise. Tout le calcul est local.

## Utilisation

Le site est entièrement statique — pas de dépendance, pas d’étape de build.

```bash
# servir localement
npm start          # puis ouvrir http://localhost:8080
```

Publication : n’importe quel hébergeur statique convient. Pour GitHub Pages,
activer Pages sur la branche voulue, dossier racine (le fichier `.nojekyll` est
déjà présent).

## Modifier ou ajouter un médicament

Tout se passe dans **`assets/js/data.js`**, dont l’en-tête documente le format
complet. Le schéma d’une fiche en bref :

```js
{
  id: 'amoxicilline',
  dci: 'Amoxicilline',
  marques: ['Clamoxyl', 'Amoxypen'],
  categorie: 'antibiotique',
  frequent: true,          // remonte dans « Les plus prescrits »
  verifie: false,          // passer à true une fois la fiche relue
  formes: [
    { id: 'susp250', nom: 'Suspension orale 250 mg / 5 ml',
      type: 'liquide', parMl: 50 },              // 250 / 5 = 50 mg par ml
    { id: 'cp500', nom: 'Comprimé 500 mg',
      type: 'solide', parUnite: 500, uniteNom: 'comprimé' }
  ],
  schemas: [
    { id: 'oma',
      indication: 'Otite moyenne aiguë',
      mode: 'jour',                              // mg/kg/JOUR
      unite: 'mg',
      doseMin: 75, doseUsuelle: 80, doseMax: 100,
      prises: [3],                               // 1re valeur = défaut
      maxJour: 3000,                             // plafond dose adulte
      duree: '5 à 7 jours' }
  ],
  sources: [{ label: 'Guide BAPCOC', url: '…' }]
}
```

Les quatre modes posologiques :

| `mode`    | Signification                        | Exemple                    |
|-----------|--------------------------------------|----------------------------|
| `jour`    | dose exprimée par **kg et par jour** | amoxicilline 80 mg/kg/j    |
| `prise`   | dose exprimée par **kg et par prise**| paracétamol 15 mg/kg/prise |
| `unique`  | dose unique par kg                   | dexaméthasone 0,15 mg/kg   |
| `paliers` | dose fixe par tranche d’âge ou de poids | cétirizine, oseltamivir |

> Piège à connaître : en mode `paliers`, le champ `dose` d’un palier est le
> **total par jour**, réparti sur `prises`. Pour « 2,5 mg deux fois par jour »,
> il faut écrire `dose: 5, prises: 2`.

### Après chaque modification

```bash
npm test
```

Les tests contrôlent le moteur de calcul et l’intégrité du fichier de données
(identifiants uniques, `doseMin ≤ doseUsuelle ≤ doseMax`, présentations
correctement dosées, absence de valeur aberrante sur les 660+ combinaisons
médicament × indication × présentation × poids).

## Structure

```
index.html              interface
assets/css/styles.css   styles (clair + sombre, impression)
assets/js/data.js       ← les données médicales, c'est ici qu'on édite
assets/js/calc.js       moteur de calcul (fonctions pures)
assets/js/search.js     recherche accent-insensible et tolérante aux fautes
assets/js/app.js        interface
tests/posocalc.test.js  tests
```

## Licence

MIT pour le code. Les données posologiques sont indicatives et doivent être
validées avant tout usage clinique.
