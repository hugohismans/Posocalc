# Vérification des posologies de Posocalc

**Date de la vérification :** 15 août 2026
**Fichier vérifié :** `assets/js/data.js` (36 fiches)
**Portée :** les 36 fiches ont été traitées. Aucune n'a été laissée de côté.

---

## 1. Sources primaires réellement consultées

| Source | Édition | Comment elle a été lue |
|---|---|---|
| **Guide belge de traitement anti-infectieux en pratique ambulatoire (BAPCOC)** | **mai 2026** (70 pages, FR) — chapitres révisés : pharyngite, otite, rhinosinusite, IVRI enfant et adulte, BPCO, grippe, coqueluche, bronchiolite, cystite, pyélonéphrite/prostatite, orchi-épididymite, infections génitales hautes, vulvo-vaginite, urétrite, IST asymptomatiques, syphilis, herpès génital, conjonctivite | PDF téléchargé et texte extrait intégralement (`pypdf`, mode `layout`) |
| **Guide idem, version néerlandaise** | **mei 2026** (68 pages) | PDF téléchargé, contrôle de concordance sur les chapitres pédiatriques |
| **Répertoire commenté des médicaments (CBIP / BCFI)** | **2026** (1 471 pages, version datée du 11-12/08/2026 selon les chapitres) | PDF complet téléchargé et texte extrait ; consultation également des pages web `cbip.be` par substance |
| **Cochrane, CD001955 — Glucocorticoids for croup in children** | mise à jour **2023** (recherche close au 4 mars 2022) | Page de résumé lue en ligne |

**URL exactes :**

- BAPCOC FR 2026 : `https://organesdeconcertation.sante.belgique.be/sites/default/files/documents/guide_belge_de_traitement_anti-infectieux_en_pratique_ambulatoire_-_mai_2026.pdf`
- BAPCOC NL 2026 : `https://overlegorganen.gezondheid.belgie.be/sites/default/files/documents/belgische_gids_voor_anti-infectieuze_behandeling_in_de_ambulante_praktijk_-_mei_2026_0.pdf`
- CBIP répertoire 2026 (PDF intégral) : `https://www.cbip.be/PDFREP/GGRCM/GGR_FR_2026.pdf` (lien depuis `https://www.cbip.be/fr/telechargements/`)
- Cochrane : `https://www.cochrane.org/evidence/CD001955_glucocorticoids-croup-children`

### Édition utilisée : remarque importante

Le fichier `data.js` citait le **guide BAPCOC 2022** (et sa mise à jour NL de décembre 2024). Ces deux documents existent toujours et ont été lus, mais **une édition de mai 2026 les remplace**. Dix-neuf chapitres y ont été révisés et **plusieurs recommandations pédiatriques ont changé** (doses d'amoxicilline, choix d'antibiotique dans la pharyngite et dans l'otite en cas d'allergie, durée du traitement de la coqueluche). Tout le rapport ci-dessous se réfère à l'**édition 2026**, et les écarts entre 2022 et 2026 sont signalés là où ils existent.

### Ce que le CBIP peut et ne peut pas confirmer

Le CBIP précise dans son introduction (Intro 2.10) que, **sauf mention contraire, les posologies du Répertoire sont des posologies adultes**, et (Intro 6.1.1) que « la posologie pédiatrique n'est mentionnée dans ce Répertoire que pour les médicaments couramment utilisés dans ce groupe d'âge », ses sources étant le RCP, le kinderformularium.nl et le BNF for Children.

**Conséquence directe :** pour plusieurs molécules de `data.js` (corticoïdes systémiques, hydroxyzine, métronidazole, oméprazole, ondansétron, aciclovir), **aucune dose pédiatrique en mg/kg n'existe ni dans le CBIP ni dans le BAPCOC**. Ces valeurs sont marquées `introuvable` ci-dessous, laissées en l'état dans `data.js`, et la fiche conserve `verifie: false` avec un avertissement explicite dans sa note.

En revanche, le CBIP **fait autorité** sur les présentations réellement commercialisées : ses données sont extraites de la **Source Authentique des Médicaments (SAM)**, la banque de données de l'AFMPS/FAGG. C'est donc lui qui a servi à vérifier `parMl`, `parUnite` et les noms de marque.

---

## 2. Synthèse

| | Nombre |
|---|---|
| Fiches traitées | 36 / 36 |
| Fiches passées à `verifie: true` | **28** |
| Fiches restées à `verifie: false` | **8** (metronidazole, methylprednisolone, prednisolone, dexamethasone, hydroxyzine, ondansetron, omeprazole, aciclovir) |
| Erreurs de **concentration** corrigées | **7** |
| Présentations supprimées (non commercialisées en Belgique) | **16** |
| Noms de marque supprimés (spécialité inexistante ou retirée) | **18** |
| Fiches dont au moins une valeur posologique a changé (dose, nombre de prises, plafond, âge, durée) | **27** |
| Fiches dont les valeurs posologiques étaient déjà exactes | **9** (clarithromycine, prednisolone, méthylprednisolone, dexaméthasone, desloratadine, hydroxyzine, montélukast, ondansétron, oméprazole — pour les quatre corticoïdes / hydroxyzine / ondansétron / oméprazole, « déjà exactes » signifie seulement « non modifiées », la valeur restant `introuvable`) |
| Valeurs `introuvable` (aucune source primaire belge) | **9** |

Les 14 médicaments marqués `frequent: true` ont tous été traités en premier. La **prednisolone** a été retirée de cette liste (13 restants) parce qu'elle n'est plus délivrable en officine sans préparation magistrale ; la fiche renvoie désormais vers la méthylprednisolone.

### Les sept erreurs les plus graves

Ce sont des erreurs de **concentration** : elles se traduisent directement par un volume faux à administrer.

| Médicament | Valeur dans `data.js` | Valeur réelle (CBIP 2026 / SAM) | Effet de l'erreur |
|---|---|---|---|
| **Salbutamol, nébulisation** | « 2,5 mg / 2,5 ml », `parMl: 1` | **5 mg/ml** (Ventolin sol. inhal. nébul., flacon 10 ml) | Pour 2,5 mg, l'appli affichait **2,5 ml** au lieu de 0,5 ml → **surdosage × 5** |
| **Vitamine D, gouttes** | « 400 UI / goutte », `parUnite: 400` | **D-Cure 2 400 UI/ml, 1 ml = 36 gouttes**, soit ≈ **67 UI/goutte** | Pour 400 UI, l'appli affichait **1 goutte** au lieu de ≈ 6 → **sous-dosage × 6** |
| **Aciclovir, suspension** | 200 mg / 5 ml (`parMl: 40`) | **400 mg / 5 ml** (`parMl: 80`, Aciclovir GSK) | Volume doublé → **surdosage × 2** |
| **Céfuroxime axétil, suspension** | 125 mg / 5 ml (`parMl: 25`) | **250 mg / 5 ml** (Zinnat susp., seule suspension sur le marché) | Volume doublé → **surdosage × 2** |
| **Paracétamol, sirop 24 mg/ml** | 120 mg / 5 ml | Présentation **inexistante en Belgique** ; le sirop enfants Perdolan est à **32 mg/ml** | Volume surestimé de 33 % → sous-dosage |
| **Dexaméthasone, ampoule** | 4 mg / ml | **5 mg / ml** (Aacidexam, seule présentation) | Volume surestimé de 25 % |
| **Fer, gouttes** | `parMl: 25`, « concentration variable » | **Ferricure solution 100 mg fer(III) / 5 ml = 20 mg/ml** | Volume sous-estimé de 20 % |

---

## 3. Vérification fiche par fiche

Légende des verdicts : **confirmé** = valeur retrouvée à l'identique dans la source primaire ; **corrigé** = valeur modifiée ; **introuvable** = la source primaire ne donne pas cette valeur, la donnée est laissée en l'état et signalée.

---

### 3.1 Antibiotiques

#### amoxicilline — `verifie: true`

| Élément | `data.js` avant | Source primaire | Référence | Verdict |
|---|---|---|---|---|
| Schéma `oma` (OMA, sinusite, pneumonie) | 75-100 mg/kg/j, usuelle 80, 3 prises, max 3000 mg/j, 5-7 j | **80-90 mg/kg/jour en 3 prises pendant 5 jours** ; adulte 3 × 1 g/j | BAPCOC 2026, « Otite moyenne aiguë » p. 16, « Rhinosinusite aiguë » p. 18, « Infections aiguës des voies respiratoires inférieures chez l'enfant » p. 22 (les trois chapitres donnent la même dose) | **corrigé** (fourchette 80-90 ; durée fixée à 5 jours) |
| Schéma `angine` | 50 mg/kg/j, 3 ou 2 prises, max 3000 mg/j, 7 j | **Enfant < 10 ans : 50 mg/kg/jour en 3 prises pendant 7 jours** ; adulte et enfant > 10 ans : 500 mg 3×/j | BAPCOC 2026, « Pharyngite aiguë (amygdalienne) » p. 15 | **corrigé** (2 prises retirées ; plafond adulte ramené de 3000 à **1500 mg/j** = 3 × 500 mg) |
| Schéma `cutane` (impétigo, érysipèle) 25-50 mg/kg/j | — | **Aucune source.** Le BAPCOC 2026 recommande la flucloxacilline dans l'impétigo et la cellulite ; l'amoxicilline n'y figure pas | BAPCOC 2026, « Impétigo » p. 33, « Cellulite et érysipèle » p. 34 | **corrigé** — schéma **remplacé** par l'érythème migrant, qui lui est documenté (voir ligne suivante) |
| Nouveau schéma `lyme` | — | **50 mg/kg/jour en 3 prises (max. 500 mg par prise) pendant 14 jours**, alternative chez l'enfant < 8 ans et pendant grossesse/allaitement | BAPCOC 2026, « Maladie de Lyme — Érythème migrant » p. 38 | **corrigé** (ajout) |
| Présentations 125, 250, 500 mg/5 ml | `parMl` 25 / 50 / 100 | oral 125 mg/5 ml, 250 mg/5 ml, 500 mg/5 ml | CBIP 2026, ch. 11.1.1.1.3 | **confirmé** |
| Comprimés 500 mg, 1 g | | oral 500 mg, **750 mg**, 1 g | CBIP 2026, ch. 11.1.1.1.3 | **confirmé** ; le 750 mg a été ajouté |
| Marques | Clamoxyl, Amoxypen, Docamoxici, Amoxicilline EG/Sandoz/Teva | **Clamoxyl, Amoxicilline EG, Amoxicilline Sandoz, Amoxicillin AB** (+ Delamoxyle, injectable) | CBIP 2026, ch. 11.1.1.1.3 | **corrigé** — *Amoxypen*, *Docamoxici* et *Amoxicilline Teva* ne sont pas commercialisés |

*Remarque clinique reprise dans la fiche :* le BAPCOC 2026 rappelle que, sauf sous-groupes précis, les antibiotiques n'ont pas d'effet cliniquement pertinent dans l'OMA, et que la prescription différée y est déconseillée (GRADE 1B).

#### amoxicilline + acide clavulanique — `verifie: true`

| Élément | `data.js` avant | Source primaire | Référence | Verdict |
|---|---|---|---|---|
| Schéma `standard` 75-100 mg/kg/j en 3 prises, max 3000 | | **Aucune source pour cette dose.** Le BAPCOC prescrit un « step up » : la moitié de la dose journalière d'amoxicilline est remplacée par l'association → **amoxicilline 40 mg/kg/j + amoxicilline-clavulanate 40 mg/10 mg par kg et par jour, en 3 prises, 5 jours** ; adulte 875/125 mg 3×/j | BAPCOC 2026, p. 16 et p. 18 | **corrigé** — schéma remplacé par `stepup`, dose **40 mg/kg/j**, plafond adulte 2625 mg/j (3 × 875 mg) |
| Schéma `faible` 45-50 mg/kg/j (source : CBIP) | | Le CBIP ne donne pas de dose pédiatrique pour l'association | CBIP 2026, ch. 11.1.1.1.4 | **corrigé** — schéma supprimé et remplacé par les morsures |
| Nouveau schéma `morsure` | — | **30-40 mg/kg/jour en 3 prises**, 5 j (prophylaxie) ou 7 j (infection) ; adulte 1500 mg/j en 3 prises | BAPCOC 2026, « Morsures » p. 35 | **corrigé** (ajout) |
| Présentation `susp8_1` « 100 mg / 12,5 mg par ml (8:1) » | `parMl: 100` | **Cette suspension n'existe pas en Belgique.** Les seules suspensions autorisées sont 125/31,25 et 250/62,5 mg par 5 ml (rapport 4:1) | CBIP 2026, ch. 11.1.1.1.4 (liste SAM) ; le BAPCOC le dit explicitement : « l'association amoxicilline/acide clavulanique disponible sur le marché contient une dose d'amoxicilline trop faible pour être efficace contre le pneumocoque » | **corrigé** — présentation **supprimée** |
| Suspensions 4:1 et comprimés 500/125 et 875/125 | | idem | CBIP 2026 | **confirmé** |
| Marques | Augmentin, Amoxiclav EG/Sandoz/Teva, Docamoclan | **Augmentin, Amoclane, AmoclaneEG, Amoxiclav Sandoz, Amoxicillin/Clavulanic Acid AB** | CBIP 2026 | **corrigé** — *Docamoclan* et *Amoxiclav Teva* n'existent pas |
| Plafond de clavulanate 12,5 mg/kg/j | note | Le schéma BAPCOC aboutit à **10 mg/kg/j** de clavulanate | BAPCOC 2026 p. 16 | **corrigé** (note réécrite) |

#### pénicilline V → **phénéticilline** — `verifie: true`

**C'est la correction la plus structurelle du fichier.**

| Élément | `data.js` avant | Source primaire | Référence | Verdict |
|---|---|---|---|---|
| Molécule | Phénoxyméthylpénicilline (pénicilline V), marques « Peni-Oral » et « Phénoxyméthylpénicilline (disponibilité à vérifier) » | « Ce groupe comprend la pénicilline G, **la pénicilline V (phénoxyméthylpénicilline, plus commercialisée depuis mai 2019)** et la phénéticilline » | CBIP 2026, ch. 11.1.1.1.1 | **corrigé** — la fiche a été **entièrement remplacée** par la phénéticilline (`id: 'pheneticilline'`) |
| Nom commercial | Peni-Oral | **Broxil** (Ace Pharmaceuticals) : gélules 250 mg et 500 mg, suspension 125 mg/5 ml (flacon 100 ml) | CBIP 2026, ch. 11.1.1.1.1 | **corrigé** — *Peni-Oral* n'existe pas dans la banque de données |
| Présentations | susp. 250 mg/5 ml ; comprimé 1 000 000 UI (≈ 600 mg) | susp. **125 mg/5 ml** ; **gélules** 250 et 500 mg. Pas de comprimé exprimé en UI | CBIP 2026 | **corrigé** |
| Posologie | 50 mg/kg/j, 3 ou 2 prises, max 2000 mg/j, 7 j | **Dose fixe par âge, pendant 7 jours** : enfant < 2 ans **125 mg 3×/j** ; enfant 2-10 ans **250 mg 3×/j** ; adulte et enfant > 10 ans **500 mg 3×/j** | BAPCOC 2026, « Pharyngite aiguë (amygdalienne) » p. 15 | **corrigé** — le mode passe de `jour` (mg/kg) à `paliers` par âge |
| Remboursement | — | « il n'y a pas de remboursement pour la suspension orale pédiatrique » (guide 2022) ; la suspension apparaît avec le sigle de non-remboursement en 2026 | BAPCOC 2022 p. 9 ; CBIP 2026 | **confirmé** (ajouté en précaution) |
| Limite d'usage | — | Phénéticilline et pénicilline V « ne conviennent pas pour le traitement des infections à pneumocoques en raison d'une trop grande résistance » | CBIP 2026, ch. 11.1.1.1.1 | **confirmé** (ajouté en précaution) |

> **Écart 2022 → 2026 à noter pour le relecteur :** le guide 2022 donnait des doses de phénéticilline nettement plus élevées (375 / 750 / 1500 mg par jour, soit 125 / 250 / 500 mg 3×/j — identiques en réalité, mais exprimées en dose journalière). Les valeurs sont donc stables entre les deux éditions ; c'est la présentation qui change. La durée passe en revanche de **7 jours** dans les deux éditions, sans changement.

#### azithromycine — `verifie: true`

| Élément | `data.js` avant | Source primaire | Référence | Verdict |
|---|---|---|---|---|
| Schéma court 3 j | 10 mg/kg/j, 1 prise, max 500 mg, 3 j | **10 mg/kg/jour en 1 prise pendant 3 jours** (pharyngite, OMA, pneumonie atypique) ; adulte 500 mg 1×/j | BAPCOC 2026 p. 15, 16, 22 ; CBIP 2026, ch. Azithromycine (« enfant : mal de gorge aigu et otite moyenne aiguë, pneumonie atypique : 10 mg/kg/jour en 1 prise pendant 3 jours ») | **confirmé** |
| Schéma coqueluche | 10 mg/kg/j, **5 jours** ; note « nourrisson < 6 mois : 10 mg/kg/j pendant 5 j » | **Enfant > 1 mois : 10 mg/kg en 1 prise (max. 500 mg) pendant 3 jours** ; hors AMM avant 1 an. Adulte 500 mg 1×/j | BAPCOC 2026, « Coqueluche » p. 30 | **corrigé** — durée ramenée à **3 jours**, âge minimal 1 mois, note sur le hors-AMM ; l'ancienne note sur les < 6 mois n'a **aucune source** et a été supprimée |
| Nouveau schéma `lyme` | — | **1er jour 20 mg/kg en 1 prise, puis 10 mg/kg/jour pendant 4 jours** (alternative en cas d'allergie aux pénicillines) | BAPCOC 2026, p. 38 ; CBIP 2026 (adulte : 1 g J1 puis 500 mg × 4 j) | **corrigé** (ajout) |
| Présentations | susp. 200 mg/5 ml, cp 250 et 500 mg | Zitromax : susp. **200 mg/5 ml**, compr. **250 mg** et **500 mg** | CBIP 2026 | **confirmé** |
| Marques | Zitromax, Azitromycine EG/Sandoz/Teva | Zitromax + génériques EG et Sandoz | CBIP 2026 | **corrigé** (Teva retiré) |

> **Écart 2022 → 2026 :** le guide 2022 prescrivait dans la coqueluche « 10 mg/kg le 1er jour, puis 5 mg/kg/jour pendant 4 j ». L'édition 2026 a simplifié en **10 mg/kg/j pendant 3 jours**. C'est l'édition 2026 qui a été retenue.

#### clarithromycine — `verifie: true`

| Élément | `data.js` avant | Source primaire | Référence | Verdict |
|---|---|---|---|---|
| Posologie | 15 mg/kg/j en 2 prises, max 1000 mg/j | **« enfant : 15 mg/kg/jour en 2 prises »** ; adulte 250 à 500 mg 2×/jour | CBIP 2026, ch. Clarithromycine | **confirmé** (dose et plafond) |
| Indication | « Infection respiratoire, coqueluche (alternative) » | La clarithromycine **ne figure pas** dans les recommandations pédiatriques du BAPCOC 2026 ; elle n'y apparaît que chez l'adulte (mastite du post-partum, H. pylori, abcès dentaire) | BAPCOC 2026 (recherche exhaustive du terme dans le PDF) | **corrigé** — l'indication est reformulée en « posologie pédiatrique générale (CBIP) », avec une note précisant que l'azithromycine est le macrolide de 1er choix |
| Présentations 125 et 250 mg/5 ml, cp 250 et 500 mg | | Biclar susp. 125 mg/5 ml ; **Clarithromycin Sandoz susp. 125 mg/5 ml et 250 mg/5 ml** ; compr. 250 mg (EG, Sandoz) et 500 mg | CBIP 2026 | **confirmé** (les 4 présentations existent) |
| Marques | Biclar, Clarithromycine EG/Sandoz/Teva | Biclar, Clarithromycine EG, Clarithromycine Sandoz, Clarithromycin KRKA, Heliclar | CBIP 2026 | **corrigé** (Teva retiré) |

#### céfuroxime axétil — `verifie: true`

| Élément | `data.js` avant | Source primaire | Référence | Verdict |
|---|---|---|---|---|
| Posologie | 20-30 mg/kg/j, usuelle 30, **2 prises**, max 1000 mg/j | **30 mg/kg/jour en 3 prises pendant 5 jours, maximum 3 × 500 mg/jour** | BAPCOC 2026, « Cystite aiguë » p. 44-45 ; CBIP 2026, ch. Céfuroxime (axétil) : « enfant : 10 mg/kg 3x/jour pendant 5 jours (max. 3 x 500 mg/jour) » | **corrigé** — 3 prises, `maxJour` **1500**, `maxPrise` **500** |
| Indication | « Infection ORL / respiratoire (2e choix) » | Le BAPCOC **2026 a retiré** le céfuroxime de l'otite et de la sinusite (remplacé par le cotrimoxazole en cas d'allergie IgE). Il ne subsiste que dans la **cystite de l'enfant, en 2e choix** | BAPCOC 2026 p. 16, 18, 44 (à comparer au guide 2022, p. 10 et 12, où il figurait encore dans l'OMA et la rhinosinusite) | **corrigé** |
| Suspension | 125 mg/5 ml (`parMl: 25`) | **Zinnat susp. 250 mg/5 ml** — c'est la seule suspension commercialisée | CBIP 2026 | **corrigé** → `parMl: 50` |
| Comprimés 250 et 500 mg | | Zinnat 250 et 500 mg ; génériques 500 mg seulement | CBIP 2026 | **confirmé** |
| Marques | Zinnat, Céfuroxime EG/Sandoz | Zinnat, Cefuroxime EG, Cefuroxim Sandoz | CBIP 2026 | **confirmé** |

#### céfadroxil — `verifie: true`

| Élément | `data.js` avant | Source primaire | Référence | Verdict |
|---|---|---|---|---|
| Posologie | 30-50 mg/kg/j, usuelle 30, 2 prises, max 2000 mg/j | Pharyngite : **15 mg/kg 2×/jour pendant 5 jours** (= 30 mg/kg/j), adulte 500 mg 2×/j. Impétigo : **30 mg/kg/jour en 2 ou 3 prises pendant 7 jours**, adulte 1 g 2×/j | BAPCOC 2026 p. 15 et p. 33 ; CBIP 2026, ch. Céfadroxil (les deux indications y sont détaillées séparément) | **corrigé** — `doseMax` ramené de 50 à **30** (aucune source pour 50) ; le schéma unique est scindé en deux (pharyngite, plafond **1000 mg/j** ; impétigo, plafond **2000 mg/j**) |
| Présentations | susp. 250 et 500 mg/5 ml, gélule 500 mg | Duracef susp. **250 mg/5 ml** et **500 mg/5 ml** ; Cefadroxil Sandoz gél. 500 mg | CBIP 2026 | **confirmé** |
| Marques | Duracef | Duracef, Cefadroxil Sandoz | CBIP 2026 | **corrigé** (ajout du générique) |

#### flucloxacilline — `verifie: true`

| Élément | `data.js` avant | Source primaire | Référence | Verdict |
|---|---|---|---|---|
| Posologie | 50-100 mg/kg/j, usuelle 50, 3-4 prises, max **4000** mg/j | **25 à 50 mg/kg/jour en 3 ou 4 prises**, 7 j (impétigo) ou 10 j (cellulite et érysipèle). Adulte : 1-2 g/j en 3-4 prises (impétigo), 2 g/j en 4 prises (cellulite) | BAPCOC 2026, « Impétigo » p. 33 et « Cellulite et érysipèle » p. 34 ; CBIP 2026, ch. Flucloxacilline (« enfant : 25 à 50 mg/kg/jour en 3 à 4 prises ») | **corrigé** — fourchette **25-50** ; `doseMax` 100 sans source, supprimé ; `maxJour` ramené de 4000 à **2000** |
| Sirop 125 mg/5 ml | `parMl: 25` | **N'existe pas.** Seul Staphycid propose un sirop, à **250 mg/5 ml** (80 ml) | CBIP 2026, ch. 11.1.1.1.2 | **corrigé** — présentation supprimée |
| Sirop 250 mg/5 ml, gélule 500 mg | | Staphycid sirop 250 mg/5 ml ; Floxapen et Staphycid gél. 500 mg | CBIP 2026 | **confirmé** |
| Marques Floxapen, Staphycid | | les deux existent (les formes injectables de Floxapen sont d'usage hospitalier) | CBIP 2026 | **confirmé** |
| Hospitalisation < 3 ans | absent | « chez les enfants de moins de 3 ans, l'hospitalisation pour antibiothérapie IV et monitoring est recommandée » (cellulite/érysipèle) | BAPCOC 2026 p. 34 | ajouté en précaution |

#### cotrimoxazole — `verifie: true`

| Élément | `data.js` avant | Source primaire | Référence | Verdict |
|---|---|---|---|---|
| Indication « Infection urinaire » | 30 mg/kg/j SMX en 2 prises | Le BAPCOC 2026 **ne recommande pas** le cotrimoxazole dans la cystite de l'enfant (1er choix nitrofurantoïne, 2e choix céfuroxime) | BAPCOC 2026 p. 44-45 | **corrigé** — indication remplacée |
| Nouveau schéma `orl` | — | **30/6 mg/kg/jour en 2 prises pendant 5 jours** — OMA ou rhinosinusite avec allergie IgE aux pénicillines | BAPCOC 2026 p. 16 et p. 18 (**nouveauté 2026** : ce choix remplace l'azithromycine/le céfuroxime du guide 2022) | **corrigé** (ajout) |
| Nouveau schéma `morsure` | — | **30/6 mg/kg/jour en 2 prises**, 5 j (prophylaxie) ou 7 j (infection), à associer à la clindamycine | BAPCOC 2026 p. 35 | **corrigé** (ajout) |
| Nouveau schéma `coqueluche` | — | **30/6 mg/kg/jour en 2 prises pendant 14 jours** en cas d'hypersensibilité à l'azithromycine ; adulte 800/160 mg 2×/j | BAPCOC 2026 p. 30 | **corrigé** (ajout) |
| Âge minimal | 1,5 mois (6 semaines) | « Le cotrimoxazole ne doit pas être administré aux enfants âgés de **moins d'un mois** » | BAPCOC 2026 p. 16 et 18 | **corrigé** → 1 mois |
| Suspension 200/40 mg par 5 ml | `parMl: 40` | Eusaprim : sulfaméthoxazole **200 mg / 5 ml** + triméthoprime 40 mg / 5 ml | CBIP 2026 | **confirmé** |
| Comprimé forte 800/160 | | Bactrim Forte et Eusaprim Forte 800/160 | CBIP 2026 | **confirmé** |
| Plafond 1600 mg/j SMX | | adulte 800/160 mg 2×/jour = 1600 mg SMX | BAPCOC 2026 p. 30 | **confirmé** |
| Marques Bactrim, Eusaprim, Docotrim | | Bactrim, Eusaprim | CBIP 2026 | **corrigé** — *Docotrim* n'existe pas |

#### nitrofurantoïne — `verifie: true`

| Élément | `data.js` avant | Source primaire | Référence | Verdict |
|---|---|---|---|---|
| Posologie | 5-7 mg/kg/j, **3 ou 4** prises, max **400** mg/j, 5-7 j | **5 à 6 mg/kg/jour en 4 prises pendant 5 jours (préparation magistrale)** ; adulte 100 mg 3×/jour | BAPCOC 2026, « Cystite aiguë » p. 44-45 ; CBIP 2026, ch. Nitrofurantoïne (« Enfant < 12 ans, cystite aiguë : 5 à 6 mg/kg/jour en 4 prises pendant 5 jours ») | **corrigé** — fourchette **5-6**, **4 prises** uniquement, `maxJour` ramené de 400 à **300** (3 × 100 mg), durée 5 jours |
| Forme pédiatrique | note « Pas de forme liquide en Belgique » | Confirmé, et précisé : la dose s'obtient par **préparation magistrale** — « Suspension pédiatrique de nitrofurantoïne à 30 mg/5 ml FTM » ou gélules de 10 à 50 mg | BAPCOC 2026 p. 35 (addendum préparations magistrales) et p. 45 ; CBIP 2026 | **confirmé** et enrichi |
| Gélules 50 et 100 mg | | Furadantine MC gél. 50 mg et 100 mg | CBIP 2026 | **confirmé** |
| Marque Furadantine MC | | Furadantine MC (Mercury) | CBIP 2026 | **confirmé** |
| Âge minimal 1 mois | | Conservé (le CBIP contre-indique la nitrofurantoïne chez le nourrisson) | — | **confirmé** |
| Renvoi au spécialiste | absent | « À l'exception d'une cystite initiale chez une fillette de plus de 5 ans, tout enfant atteint d'une infection des voies urinaires doit être référé » | BAPCOC 2026 p. 44 (déjà dans le guide 2022 p. 34) | ajouté en précaution |

> **Écart 2022 → 2026 :** la fourchette pédiatrique passe de 5-7 à **5-6 mg/kg/j**. C'est l'édition 2026 qui a été retenue.

#### métronidazole — `verifie: false` (dose pédiatrique **introuvable**)

| Élément | `data.js` avant | Source primaire | Référence | Verdict |
|---|---|---|---|---|
| Anaérobies 20-30 mg/kg/j en 3 prises | | **Aucune dose pédiatrique** dans le CBIP ni dans le BAPCOC. Dose adulte : 500 mg 3×/jour pendant 7 jours | CBIP 2026, ch. Métronidazole (rubrique « Posol. » : uniquement « per os » adulte) | **introuvable** — valeur laissée en l'état, avertissement ajouté dans la note |
| Plafond anaérobies 1500 mg/j | | 500 mg × 3 = 1500 mg/j | CBIP 2026 | **confirmé** |
| Giardiase 15-20 mg/kg/j en 3 prises, max **750** mg/j, 5-7 j | | Adulte : **2 g 1×/jour pendant 3 jours ou 500 mg 2×/jour pendant 7 à 10 jours**. Pas de dose pédiatrique | CBIP 2026 | **corrigé** pour le plafond (750 → **1000 mg/j**) et la durée (7-10 jours) ; dose pédiatrique **introuvable** |
| Suspension 200 mg/5 ml | `parMl: 40` | **N'existe pas en Belgique** | CBIP 2026 (seul Flagyl compr. pellic. 500 mg par voie orale, plus un ovule vaginal) | **corrigé** — supprimée |
| Comprimé 250 mg | | **N'existe pas** | CBIP 2026 | **corrigé** — supprimé |
| Comprimé 500 mg | | Flagyl compr. pellic. 500 mg | CBIP 2026 | **confirmé** |
| Marques Flagyl, Docmetro | | Flagyl uniquement (+ Metronidazole B. Braun, perfusion, usage hospitalier) | CBIP 2026 | **corrigé** — *Docmetro* n'existe pas |

#### clindamycine — `verifie: true`

| Élément | `data.js` avant | Source primaire | Référence | Verdict |
|---|---|---|---|---|
| Posologie | 20-30 mg/kg/j, usuelle 25, 3-4 prises, max 1800 mg/j | Impétigo, cellulite, érysipèle : **20 mg/kg/jour en 3 ou 4 prises** (7 j ou 10 j). Morsures : **25 mg/kg/jour en 3 à 4 prises** (5 ou 7 j). Adulte 1800 mg/j | BAPCOC 2026 p. 33, 34 et 35 | **corrigé** — schéma unique scindé en deux (peau : 20 mg/kg/j ; morsure : 25 mg/kg/j). `doseMax` 30 sans source, supprimé |
| Plafond 1800 mg/j | | adulte 1800 mg/j en 3 à 4 prises | BAPCOC 2026 | **confirmé** |
| Gélules 150 et 300 mg | | Dalacin C gél. 150 mg et 300 mg | CBIP 2026 | **confirmé** |
| Note « pas de forme liquide » | | Confirmé (les solutions injectables sont d'usage hospitalier) | CBIP 2026 | **confirmé** |
| Marques Dalacin C, Clindamycine EG/Sandoz | | **Dalacin C** seulement pour la voie orale | CBIP 2026 | **corrigé** |

#### doxycycline — `verifie: true`

| Élément | `data.js` avant | Source primaire | Référence | Verdict |
|---|---|---|---|---|
| Posologie | 4 mg/kg/j, 2 ou 1 prise, max 200 mg/j, pas de `maxPrise`, 10-21 j | **4 mg/kg/jour en 2 prises (max. 100 mg par prise) pendant 10 jours**, à partir de 8 ans ; adulte 200 mg en 2 prises | BAPCOC 2026, « Maladie de Lyme — Érythème migrant » p. 38 | **corrigé** — 1 prise retirée, **`maxPrise: 100` ajouté** (absent auparavant), durée fixée à 10 jours |
| Âge minimal 8 ans | | « Chez les adultes et les enfants à partir de 8 ans » | BAPCOC 2026 p. 38 | **confirmé** |
| Pas de prophylaxie après morsure de tique | absent | « En Europe, il n'existe aucune indication d'antibiothérapie prophylactique (GRADE 1A) en cas de morsure de tique » | BAPCOC 2026 p. 38 | ajouté à la note |
| Comprimé 100 mg | | Vibratab, Doxycycline EG, Doxycycline Sandoz : 100 mg ; **Doxycycline EG également 200 mg** | CBIP 2026, ch. 11.3.2.1.3 | **confirmé**, 200 mg ajouté |
| Marques Vibratab, Doxytab, Doxycycline EG | | Vibratab, Doxycycline EG, Doxycycline Sandoz | CBIP 2026 | **corrigé** — *Doxytab* n'existe pas |
| Note « dose de charge possible » | | Le BAPCOC ne prévoit de dose de charge que chez l'adulte, dans les morsures | BAPCOC 2026 p. 35 | **corrigé** — note supprimée pour l'enfant |

---

### 3.2 Antalgiques / antipyrétiques

#### paracétamol — `verifie: true`

| Élément | `data.js` avant | Source primaire | Référence | Verdict |
|---|---|---|---|---|
| Posologie | 10-15 mg/kg/prise, usuelle 15, 4 ou 3 prises | **« enfant et adulte < 50 kg : per os 15 mg/kg jusqu'à 4×/jour (max. 60 mg/kg/jour) »** | CBIP 2026, ch. 8.2.1, rubrique « Posol. » | **corrigé** — `doseMin` porté de 10 à **15** : le CBIP ne mentionne pas 10 mg/kg. Le schéma « 10 mg/kg toutes les 4 h » est courant en pratique mais n'a **pas de source belge primaire** ; il a été retiré des chiffres et n'est plus affirmé dans la note |
| `maxParKgJour` 60 | | « max. 60 mg/kg/jour » | CBIP 2026 | **confirmé** |
| `maxJour` 4000, `maxPrise` 1000 | | « adulte ≥ 50 kg : 500 mg à 1 g, jusqu'à 4 ×/jour (max. 4 g/jour) » ; **3 g/jour en présence de facteurs de risque** | CBIP 2026 | **confirmé** (le seuil abaissé à 3 g est ajouté à la note) |
| Sirop 30 mg/ml | | Dafalgan solution Pédiatrique **30 mg/1 ml** (150 ml) | CBIP 2026 | **confirmé** |
| Sirop « 120 mg / 5 ml (24 mg/ml) » | `parMl: 24` | **N'existe pas.** Le sirop enfants Perdolan est à **32 mg/1 ml** (200 ml) | CBIP 2026 | **corrigé** → 32 mg/ml |
| Suppositoires 100, 200, 300 mg | | Perdolan Bébés **100 mg**, Jeunes Enfants **200 mg**, Enfants **350 mg**, Adultes 500 mg ; Dafalgan Pédiatrique **80, 150, 300 mg** | CBIP 2026 | **confirmé** ; les dosages **80, 150 et 350 mg** ont été ajoutés |
| Comprimé 500 mg | | oui | CBIP 2026 | **confirmé** ; granulés 250 mg (Dafalgan Instant Junior) ajoutés |
| Voie rectale | absent | « L'absorption du paracétamol administré en suppositoire est inconstante ; la voie orale est à préférer, y compris chez les nourrissons » | CBIP 2026, ch. 8.2.1, « Précautions particulières » | ajouté en précaution |
| Seuil de toxicité | absent | « Chez les enfants, une toxicité hépatique peut apparaître à partir de **150 mg/kg** » | CBIP 2026 | ajouté en précaution |
| Contre-indications | insuffisance hépatique sévère | « Insuffisance **rénale** sévère, insuffisance **hépatique** sévère » | CBIP 2026 | **corrigé** (ajout de l'insuffisance rénale) |
| Marques | Perdolan, Dafalgan, Panadol, Paracetamol EG/Sandoz/Teva | Perdolan, Dafalgan, Panadol, Algostase Mono, Paracetamol EG, Paracetamol AB | CBIP 2026 | **corrigé** (*Paracetamol Sandoz* et *Teva* absents) |

#### ibuprofène — `verifie: true`

| Élément | `data.js` avant | Source primaire | Référence | Verdict |
|---|---|---|---|---|
| Posologie | 5-10 mg/kg/prise, usuelle 10, 3 ou 4 prises | **« enfant (> 3 mois) : fièvre, douleur, inflammation : 7 à 10 mg/kg 3 à 4×/jour (max. 30 mg/kg/jour, max 400 mg 4×/jour) »** | CBIP 2026, ch. 9.1.1.2, rubrique « Posol. » | **corrigé** — `doseMin` porté de 5 à **7** |
| `maxParKgJour` 30, `maxPrise` 400 | | idem ci-dessus | CBIP 2026 | **confirmé** |
| `maxJour` 1200 | | adulte (≥ 40 kg), douleur et fièvre : 200 à 400 mg 3×/jour, **max. 1,2 g/jour** | CBIP 2026 | **confirmé** |
| Âge minimal 3 mois | | « enfant (> 3 mois) » | CBIP 2026 | **confirmé** |
| Poids minimal 5 kg | | **Non mentionné par le CBIP** (seul le seuil d'âge l'est) | — | **introuvable** — le seuil est conservé (il est prudent et figure dans les notices des suspensions), mais il n'a pas de source primaire ; il ne bloque pas le calcul, il déclenche un avertissement |
| Suspensions 20 et 40 mg/ml | | Nurofen Enfants et Algidrin **20 mg/1 ml (2 %)** ; Nurofen, Brufen, Ibuprofen EG **40 mg/1 ml (4 %)** | CBIP 2026 | **confirmé** |
| Comprimés 200 et 400 mg | | oui (Nurofen, Brufen, génériques) | CBIP 2026 | **confirmé** ; **suppositoires Nurofen Enfants 60 et 125 mg** ajoutés |
| Marques | Nurofen, Junifen, Brufen, Ibuprofen EG/Sandoz/Teva | Nurofen, Brufen, Algidrin, Ibuprofen EG, Ibuprofen Sandoz, Ibuprofen AB, Perdofemina, Spidifen | CBIP 2026 | **corrigé** — ***Junifen* n'est plus commercialisé en Belgique** ; *Ibuprofen Teva* non plus |

---

### 3.3 Corticoïdes

#### prednisolone — `verifie: false`

> **Constat majeur :** la prednisolone n'a **plus de spécialité en Belgique**.

| Élément | `data.js` avant | Source primaire | Référence | Verdict |
|---|---|---|---|---|
| Disponibilité | marques « Prednisolone EG » et « Solupred (disponibilité à vérifier) », comprimés 5 et 20 mg | **« Il n'existe actuellement pas de spécialité à base de prednisone ou de prednisolone en Belgique ; la prednisone et la prednisolone peuvent toutefois être prescrites en magistrale (pas de formulation FTM). »** | CBIP 2026, ch. **5.5.7 « Prednisone et prednisolone »** (le chapitre ne contient aucune spécialité) | **corrigé** — les deux marques et les deux présentations sont **supprimées** ; `formes: []`. *Solupred* est une spécialité française, *Prednisolone EG* n'existe pas |
| Dose 1-2 mg/kg/j | | Le CBIP ne donne **aucune dose pédiatrique** pour les corticoïdes systémiques. Dose adulte dans l'exacerbation d'asthme sévère : **30 à 40 mg de (méthyl)prednisolone par jour pendant environ 7 jours** | CBIP 2026, ch. 4.1 (asthme) et ch. 5.5 (« Posologie ») | **introuvable** — valeur laissée en l'état, avertissement explicite dans la note |
| `frequent: true` | | La molécule n'étant pas délivrable en officine sans préparation magistrale, elle a été retirée des « plus prescrits » et renvoie vers la méthylprednisolone | — | **corrigé** |
| « À prendre le matin » | | « La plupart des préparations sont prises le matin, ce qui respecte mieux le rythme circadien de la cortisolémie » | CBIP 2026, ch. 5.5 | **confirmé** |

#### méthylprednisolone — `verifie: false`

| Élément | `data.js` avant | Source primaire | Référence | Verdict |
|---|---|---|---|---|
| Dose 0,8-1,6 mg/kg/j | | **Aucune dose pédiatrique** au CBIP. Adulte : 30 à 40 mg/jour pendant ~7 jours dans l'exacerbation sévère | CBIP 2026, ch. 4.1 et 5.5 | **introuvable** — valeur laissée en l'état, avertissement explicite dans la note |
| Équivalence « 4 mg ≈ 5 mg de prednisolone » | | **« L'activité anti-inflammatoire de 20 mg d'hydrocortisone est à peu près équivalente à celle obtenue avec 5 mg de prednisone ou de prednisolone, 4 mg de méthylprednisolone ou de triamcinolone, 0,75 mg de bétaméthasone ou de dexaméthasone. »** | CBIP 2026, ch. 5.5, rubrique « Posologie » | **confirmé** |
| Comprimés 4, 16, 32 mg | | Medrol compr. **4 mg**, **16 mg**, **32 mg**, tous quadrisécables | CBIP 2026, ch. 5.5.6 | **confirmé** ; `pasUnite: 0.25` ajouté, la sécabilité en quarts étant documentée |
| Marque Medrol | | Medrol (Pfizer) | CBIP 2026 | **confirmé** |
| `maxJour` 32 | | Le CBIP donne 30-40 mg/jour chez l'adulte ; 32 mg est le plus haut comprimé | CBIP 2026 | **confirmé partiellement** — la valeur reste 32, dans la fourchette du CBIP mais choisie plutôt que 40 pour rester sur un multiple de comprimé |

#### dexaméthasone — `verifie: false`

| Élément | `data.js` avant | Source primaire | Référence | Verdict |
|---|---|---|---|---|
| Comprimé 0,5 mg | `parUnite: 0.5` | **« La dexaméthasone à usage oral n'est plus disponible comme spécialité en Belgique, mais elle peut être prescrite en magistrale. »** | CBIP 2026, ch. 5.5 (rubrique « Positionnement ») | **corrigé** — présentation **supprimée** |
| Solution 4 mg/ml (ampoule) | `parMl: 4` | La seule spécialité de dexaméthasone est **Aacidexam, solution injectable 5 mg / 1 ml** | CBIP 2026, ch. **5.5.4 « Dexaméthasone »** | **corrigé** → `parMl: 5` |
| Marques « Dexamethasone (forme orale : vérifier la disponibilité) », Aacidexam | | Aacidexam uniquement | CBIP 2026 | **corrigé** |
| Dose 0,15-0,6 mg/kg en dose unique | | Le CBIP indique seulement : « Laryngite sous-glottique aiguë (faux croup) : la nébulisation de corticostéroïdes a une place établie dans les formes sévères ; pour les formes plus légères, une **administration orale de corticostéroïdes est proposée** » — **sans chiffrer la dose** | CBIP 2026, ch. 4.1 (p. 368) | **introuvable** — valeur laissée en l'état, avertissement explicite dans la note |
| Note « 0,15 mg/kg semble aussi efficace que 0,6 mg/kg » | | Cochrane est plus nuancé : « **A small dose of dexamethasone at 0.15 mg/kg may be as effective** as the standard dose of 0.60 mg/kg. **More studies are needed** » et « the standard dose of 0.60 mg/kg **probably reduced the severity** of croup […] at 24 hours » | Cochrane CD001955, mise à jour 2023, section « Key results » et « Conclusions » | **corrigé** — la note a été reformulée pour ne plus surinterpréter la conclusion |
| Laryngite et antibiotiques | | « Les antibiotiques ne sont pas indiqués en cas de laryngite striduleuse (GRADE 1C) » | BAPCOC 2026, « Laryngite striduleuse » p. 21 | ajouté en précaution |

---

### 3.4 Allergie

#### cétirizine — `verifie: true`

| Élément | `data.js` avant | Source primaire | Référence | Verdict |
|---|---|---|---|---|
| Gouttes 10 mg/ml | `parMl: 10` | **Aucune forme en gouttes n'est commercialisée en Belgique** — seuls des comprimés sécables de 10 mg figurent au répertoire (Zyrtec, Cetirizine EG, Cetirizine Sandoz, Cetirizin AB) | CBIP 2026, ch. Cétirizine (liste complète des spécialités) | **corrigé** — présentation **supprimée** |
| Sirop 1 mg/ml | `parMl: 1` | **« La cétirizine 1 mg/ml solution buvable n'est plus disponible depuis avril 2024. »** | CBIP 2026, ch. Cétirizine, rubrique « Posol. » | **corrigé** — présentation **supprimée** |
| Palier « 2 à 5 ans : 2,5 mg 2×/j » | | Le CBIP **ne donne aucune posologie avant 6 ans** | CBIP 2026 | **corrigé** — palier **supprimé** ; l'enfant de moins de 6 ans déclenche désormais un blocage du calcul, et la note oriente vers la desloratadine, qui existe encore en solution buvable |
| Palier « 6 à 11 ans : 10 mg/j en 2 prises » | | **« enfants de 6 à 12 ans : 10 mg p.j. en 2 prises (un demi-comprimé à chaque prise) »** | CBIP 2026 | **confirmé** |
| Palier « 12 ans et plus : 10 mg 1×/j » | | **« adultes et adolescents (12 ans et plus) : 10 mg p.j. en 1 prise (1 comprimé) »** | CBIP 2026 | **confirmé** |
| Comprimé 10 mg | | comprimé pelliculé **sécable** 10 mg | CBIP 2026 | **confirmé** |
| Marques | Zyrtec, Cetirizine EG/Sandoz/Teva | Zyrtec, Cetirizine EG, Cetirizine Sandoz, Cetirizin AB | CBIP 2026 | **corrigé** (*Teva* absent) |

#### desloratadine — `verifie: true`

| Élément | `data.js` avant | Source primaire | Référence | Verdict |
|---|---|---|---|---|
| Palier 1-5 ans : 1,25 mg 1×/j | | **« enfants de 1 à 6 ans : 1,25 mg (2,5 ml de solution) p.j. en 1 prise »** | CBIP 2026, ch. Desloratadine | **confirmé** |
| Palier 6-11 ans : 2,5 mg 1×/j | | **« enfants de 6 à 12 ans : 2,5 mg p.j. en 1 prise (1 comprimé orodisp. de 2,5 mg ou 5 ml de solution) »** | CBIP 2026 | **confirmé** |
| Palier 12 ans et plus : 5 mg 1×/j | | **« adultes et adolescents (12 ans et plus) : 5 mg p.j. en 1 prise »** | CBIP 2026 | **confirmé** |
| Sirop 0,5 mg/ml | `parMl: 0.5` | Desloratadine EG **sol. 0,5 mg / 1 ml** (150 ml) | CBIP 2026 | **confirmé** |
| Comprimé 5 mg | | Aerius et génériques compr. pellic. 5 mg | CBIP 2026 | **confirmé** ; **comprimé orodispersible 2,5 mg** (Desloratadine Teva) ajouté |
| Marques Aerius, Desloratadine EG/Sandoz | | **Aerius ne propose que le comprimé 5 mg** ; la solution buvable est chez Desloratadine EG, l'orodispersible 2,5 mg chez Desloratadine Teva | CBIP 2026 | **corrigé** (précision par forme) |

**Fiche entièrement confirmée** : c'est la seule dont chaque palier correspondait déjà mot pour mot au CBIP.

#### hydroxyzine — `verifie: false`

| Élément | `data.js` avant | Source primaire | Référence | Verdict |
|---|---|---|---|---|
| Dose 1-2 mg/kg/j en 3 ou 2 prises | | Le CBIP ne donne qu'une dose adulte : **« prurit : 25 mg, jusqu'à max. 4 fois p.j. »** | CBIP 2026, ch. Hydroxyzine | **introuvable** — valeur laissée en l'état, avertissement explicite dans la note |
| `maxJour` 100 | | 25 mg × 4 = 100 mg/j (50 mg/j chez la personne âgée) | CBIP 2026 | **confirmé** |
| Sirop 2 mg/ml | `parMl: 2` | **N'existe pas.** Atarax n'est commercialisé que sous forme de **comprimé pelliculé sécable 25 mg** | CBIP 2026 | **corrigé** — présentation **supprimée** |
| Marque Atarax | | Atarax (UCB) | CBIP 2026 | **confirmé** |
| Allongement du QT, âge minimal 1 an | | Conservés | — | **confirmé** (précautions déjà correctes) |

---

### 3.5 Respiratoire

#### salbutamol — `verifie: true`

| Élément | `data.js` avant | Source primaire | Référence | Verdict |
|---|---|---|---|---|
| **Solution pour nébulisation** | « 2,5 mg / 2,5 ml », `parMl: 1` | **Ventolin sol. inhal. nébul., flacon de 10 ml à 5 mg / 1 ml** | CBIP 2026, ch. 4.1.1.1 | **corrigé** → `parMl: 5`. **C'est l'erreur la plus dangereuse du fichier** : pour 2,5 mg, l'application indiquait 2,5 ml alors qu'il faut 0,5 ml |
| Nébulisation, paliers par poids (< 20 kg : 2,5 mg ; ≥ 20 kg : 5 mg) | | **« sol. inhal. nébul. : jusqu'à 4 ×/jour 2,5 à 5 mg (0,5 à 1 ml) »**, énoncé identique pour l'adulte et pour l'enfant, **sans graduation par le poids** | CBIP 2026, ch. 4.1.1.1, rubrique « Posol. » | **corrigé** — les deux paliers par poids sont remplacés par un palier unique 2,5-5 mg |
| Aérosol-doseur, paliers par âge (< 6 ans : 2 bouffées ; ≥ 6 ans : 4 bouffées) | | **« susp. inhal. (flacon press.) […] : jusqu'à 4 ×/jour 100 à 200 µg »**, sans distinction d'âge. Le dosage de 400 µg / 4 bouffées n'a **aucune source** | CBIP 2026 | **corrigé** — palier unique 100-200 µg (1 à 2 bouffées) |
| Aérosol-doseur 100 µg/bouffée | | 100 µg / 1 dose (Ventolin, Airomir, Novolizer) | CBIP 2026 | **confirmé** |
| Chambre d'inhalation | note générale | Précisé par tranche : **0-3 ans chambre + masque ; 4-6 ans chambre ; poudre à inhaler à partir de 6 ans** | CBIP 2026 | **confirmé** et enrichi |
| Schéma d'urgence (2 à 10 bouffées toutes les 20 min) | dans la note | **Non chiffré par le CBIP.** La note le mentionne désormais comme un schéma d'urgence non couvert par le calcul | — | **corrigé** (mention conservée mais explicitement non sourcée et non calculée) |
| Marques Ventolin, Airomir, Docsalbuta | | Ventolin, Airomir, Novolizer Salbutamol | CBIP 2026 | **corrigé** — ***Docsalbuta* n'existe plus** |

#### montélukast — `verifie: true`

| Élément | `data.js` avant | Source primaire | Référence | Verdict |
|---|---|---|---|---|
| Palier 6 mois-5 ans : 4 mg | | **« enfant : 6 m-5 ans : 4 mg/jour »** | CBIP 2026, ch. Montélukast | **confirmé** |
| Palier 6-14 ans : 5 mg | | **« et 6-14 ans : 5 mg/jour »** | CBIP 2026 | **confirmé** |
| Palier 15 ans et plus : 10 mg | | **« adulte et adolescent ≥ 15 ans : 10 mg/jour en 1 prise »** | CBIP 2026 | **confirmé** |
| Granulés 4 mg (sachet) | `parUnite: 4` | **Ne figure plus au répertoire.** Singulair et les génériques ne proposent que des comprimés à croquer 4 et 5 mg et des comprimés pelliculés 10 mg | CBIP 2026 | **corrigé** — présentation **supprimée** |
| Comprimés à croquer 4 et 5 mg, comprimé 10 mg | | Singulair, Montelukast EG, Montelukast AB | CBIP 2026 | **confirmé** |
| Effets neuropsychiatriques | | Conservé ; ajout de « ne doit pas être utilisé pour traiter les exacerbations aiguës de l'asthme » | CBIP 2026, ch. 4.1 | **confirmé** et enrichi |
| Marques Singulair, Montelukast EG/Sandoz/Teva | | Singulair, Montelukast EG, Montelukast AB | CBIP 2026 | **corrigé** |

---

### 3.6 Digestif

#### ondansétron — `verifie: false`

| Élément | `data.js` avant | Source primaire | Référence | Verdict |
|---|---|---|---|---|
| Sirop 4 mg/5 ml | `parMl: 0.8` | **N'existe pas en Belgique** | CBIP 2026, ch. 3.4 (antiémétiques) | **corrigé** — supprimé |
| Lyophilisat oral 4 mg | | **N'existe pas** ; seul le **Zofran Zydis 8 mg** figure au répertoire, avec la mention **U.H. (usage hospitalier)** | CBIP 2026 | **corrigé** — supprimé |
| Lyophilisat oral 8 mg | | Existe mais **réservé à l'usage hospitalier**, comme toutes les autres présentations (injectables U.H., comprimé 8 mg U.H.) | CBIP 2026 | **conservé avec mention explicite** de l'usage hospitalier |
| Dose 0,15-0,2 mg/kg en dose unique | | Le CBIP ne mentionne pas la posologie des spécialités réservées à l'usage hospitalier (Intro 2.10) : **aucune dose n'y figure** | CBIP 2026 | **introuvable** — valeur laissée en l'état, avertissement explicite dans la note |
| Note « usage hors RCP fréquent en pédiatrie » | | Plausible mais non sourcée par le CBIP ni le BAPCOC | — | **corrigé** — remplacée par l'avertissement sur l'indisponibilité en officine |

> **Conséquence pratique :** cette fiche ne peut pas être utilisée en ambulatoire. Elle est conservée avec un avertissement, plutôt que supprimée, parce que le médicament est bien utilisé en pédiatrie hospitalière.

#### dompéridone — `verifie: true`

| Élément | `data.js` avant | Source primaire | Référence | Verdict |
|---|---|---|---|---|
| Dose 0,25 mg/kg/prise, 3 prises, `maxParKgJour` 0,75, `maxPrise` 10 | | **« adulte et adolescent à partir de 35 kg : 10 mg 3×/jour maximum »** — le CBIP ne donne **aucune posologie en dessous de 35 kg** | CBIP 2026, ch. Dompéridone | **corrigé** — le mode passe de `prise` (mg/kg) à `paliers` par poids, avec un seul palier ≥ 35 kg |
| Suspension 1 mg/ml | `parMl: 1` | **N'existe pas.** Motilium et les génériques ne proposent que des comprimés pelliculés et orodispersibles à 10 mg | CBIP 2026 | **corrigé** — présentation **supprimée** |
| Comprimé 10 mg | | oui | CBIP 2026 | **confirmé** ; forme orodispersible ajoutée |
| Restriction EMA, QT | | Conservées | — | **confirmé** |
| Marques Motilium, Domperidone EG/Sandoz | | Motilium, Domperidone EG, Domperidone Teva, Domperidon AB, Zilium | CBIP 2026 | **corrigé** |

> **Conséquence pratique :** la dompéridone n'est pas utilisable chez le jeune enfant en Belgique, faute de forme liquide et faute de posologie validée sous 35 kg. La contre-indication a été ajoutée.

#### macrogol — `verifie: true`

| Élément | `data.js` avant | Source primaire | Référence | Verdict |
|---|---|---|---|---|
| Palier 6 mois-1 an : 1 sachet de 4 g | | **« enfant (sachets de 4 gr) — 6 mois à 1 an : 1 sachet 1x/jour »** | CBIP 2026, ch. 3.5.3.2, « Macrogol sans électrolytes en cas de constipation » | **confirmé** |
| Palier 1-4 ans : 8 g (2 sachets) | | **« 1 à 4 ans : 1 à 2 sachet 1x/jour »** | CBIP 2026 | **corrigé** — dose de départ ramenée à **4 g (1 sachet)**, libellé « 1 à 2 sachets » |
| Palier 4-8 ans : 8 g (2 sachets) | | **« 4 à 8 ans : 2 à 4 sachets 1x/jour »** | CBIP 2026 | **confirmé** pour la dose de départ ; le libellé devient « 2 à 4 sachets » |
| Palier 8 ans et plus : 1 sachet adulte de 10 g | | **« adulte et adolescent (sachets de 10 gr) : 1 à 2 sachets 1x/jour »** | CBIP 2026 | **confirmé** ; libellé « 1 à 2 sachets » |
| Sachets 4 g et 10 g | | **Forlax Junior 4 g** et **Forlax 10 g** (macrogol 4000) | CBIP 2026 | **confirmé** |
| Marques Movicol Junior, Forlax Junior, Transipeg | | Forlax, Forlax Junior, Movicol, Movicol Junior, Molaxole | CBIP 2026 | **corrigé** — ***Transipeg* n'existe plus.** Surtout : **Movicol Junior contient 6,563 g de macrogol 3350 et Movicol 13,125 g**, ce ne sont donc **pas** les « sachets de 4 g et 10 g » sur lesquels porte la posologie du CBIP. Une précaution a été ajoutée : ces sachets ne sont pas interchangeables |
| Note « macrogol 3350 » | absent | « Le macrogol 3350 n'est plus commercialisé depuis août 2025 » (formes sans électrolytes) | CBIP 2026 | pris en compte : la fiche calcule sur les sachets Forlax (macrogol 4000) |
| Désimpaction fécale | note | Le CBIP ne donne pas de posologie de désimpaction | — | **confirmé** — la note précise que ce schéma n'est pas couvert |

#### racécadotril — `verifie: true`

| Élément | `data.js` avant | Source primaire | Référence | Verdict |
|---|---|---|---|---|
| Dose 1,5 mg/kg/prise, 3 prises | | **« enfant : 1,5 mg/kg 3x/jour maximum »** | CBIP 2026, ch. 3.5 (antidiarrhéiques) | **confirmé** |
| `maxJour` 300 | | **« adulte et adolescent : 100 mg 3x/jour maximum »** = 300 mg/j | CBIP 2026 | **confirmé** ; `maxPrise: 100` ajouté (absent auparavant) |
| Sachets 10 et 30 mg | | Tiorfix susp. gran. sachet **Baby 10 mg** et **Junior 30 mg** | CBIP 2026 | **confirmé** |
| Présentations manquantes | | Tiorfix propose également une **suspension 4 mg/ml** (50 et 180 ml) et des **gélules 100 mg** | CBIP 2026 | **corrigé** (ajoutées) |
| Âge minimal 3 mois | | Non repris par le CBIP (issu du RCP de Tiorfix Baby) | — | conservé, cohérent avec la présentation « Baby » |
| Marque Tiorfix | | Tiorfix (Bioprojet Benelux) | CBIP 2026 | **confirmé** |

#### oméprazole — `verifie: false`

| Élément | `data.js` avant | Source primaire | Référence | Verdict |
|---|---|---|---|---|
| Dose 0,7-1,4 mg/kg/j | | Le CBIP ne donne **que des doses adultes** : symptômes de reflux 10 à 20 mg 1×/j pendant 2 à 4 semaines ; œsophagite de reflux 20 (voire 40) mg 1×/j pendant 4 (voire 8) semaines | CBIP 2026, ch. Oméprazole | **introuvable** — valeur laissée en l'état, avertissement explicite dans la note |
| `maxJour` 40 | | 40 mg/j est la dose haute adulte | CBIP 2026 | **confirmé** |
| Gélules 10, 20, 40 mg | | Losec Mups 10 et 20 mg ; Omeprazole EG gél. gastro-résist. **10, 20 et 40 mg** ; Omeprazol AB, Acidcare | CBIP 2026 | **confirmé** |
| Marques Losec, Omeprazole EG/Sandoz/Teva | | Losec, Omeprazole EG, Omeprazol AB, Acidcare | CBIP 2026 | **corrigé** |
| « À prendre 30 min avant le repas », réévaluation | | Conservés | — | **confirmé** |

---

### 3.7 Antifongiques

#### nystatine — `verifie: true`

| Élément | `data.js` avant | Source primaire | Référence | Verdict |
|---|---|---|---|---|
| Palier « Nourrisson (0-23 mois) : 100 000 UI (1 ml) 4×/j » | | **« Muguet chez l'enfant < 6 mois : 1 ml 4 x/jour »** | CBIP 2026, ch. Nystatine ; BAPCOC 2026, « Candidose oropharyngée » p. 42 (« < 6 mois : nystatine suspension orale 4 ml par jour en 4 prises ») | **corrigé** — la borne passe de 24 mois à **6 mois** |
| Palier « Enfant (≥ 24 mois) : 200 000 UI (2 ml) 4×/j » | | **« Muguet chez l'enfant > 6 mois : 1,5 ml 4 x/jour »** (= 150 000 UI) — et la dose adulte est elle aussi de 1,5 ml 4×/j | CBIP 2026 | **corrigé** — dose ramenée de 2 ml à **1,5 ml**. L'ancienne valeur était **supérieure à la dose adulte** |
| Durée « 7 à 14 jours, à poursuivre 48 h après la guérison » | | **« jusqu'à 48 heures après disparition des lésions »** (pas de durée fixe) | CBIP 2026 ; BAPCOC 2026 p. 42 | **corrigé** |
| Suspension 100 000 UI/ml | `parMl: 100000` | Nilstat gtts susp. 30 ml, **100 000 UI / 1 ml** | CBIP 2026 | **confirmé** |
| Marques « Nystatine », « Mycostatine (disponibilité à vérifier) » | | **Nilstat** (DHL Pharma Logistics) — seule spécialité | CBIP 2026 | **corrigé** — ***Mycostatine* n'existe pas en Belgique** (c'est une marque française/suisse) |
| Écart au RCP | absent | Le CBIP prévient : « cette posologie proposée par la BAPCOC est très différente de la posologie mentionnée dans le RCP de Nilstat » | CBIP 2026 | ajouté à la note |
| Hiérarchie thérapeutique | absent | « Bien que le gel oral de miconazole soit plus efficace que la suspension orale de nystatine, il est contre-indiqué chez les nourrissons de moins de 6 mois » | BAPCOC 2026 p. 42 | ajouté à la note |

#### miconazole gel buccal — `verifie: true`

| Élément | `data.js` avant | Source primaire | Référence | Verdict |
|---|---|---|---|---|
| Palier « 4 mois à 2 ans : 1,25 ml 4×/j » | | **« muguet chez enfants > 6 mois : 4 applications de 1,25 ml/jour »** | CBIP 2026, ch. Miconazole ; BAPCOC 2026 p. 42 | **corrigé** — la borne basse passe de **4 à 6 mois** et la borne haute de 2 ans à 12 ans |
| Palier « 2 ans et plus : 2,5 ml 4×/j » | | **2,5 ml 4×/jour est la dose ADULTE** (« stomatite chez l'adulte ») | CBIP 2026 ; BAPCOC 2026 p. 42 | **corrigé** — le palier commence désormais à 12 ans |
| Contre-indication « < 4 mois » | | **« il est contre-indiqué chez les nourrissons de moins de 6 mois en raison du faible risque de suffocation »** | BAPCOC 2026 p. 42 | **corrigé** → 6 mois |
| Gel 20 mg/g | `parMl: 1` | Daktarin gel oromuq. **20 mg / 1 g**, tube de 40 g | CBIP 2026 | **confirmé** |
| Note « la mesurette fournie contient 5 ml » | | **Non documenté** par le CBIP ni le BAPCOC ; le BAPCOC décrit au contraire une application « du bout du doigt » | BAPCOC 2026 p. 42 | **corrigé** — mention de la mesurette supprimée, remplacée par la technique décrite dans le guide |
| Marque Daktarin gel oral | | Daktarin (Kenvue), gel oromuqueux | CBIP 2026 | **confirmé** |

#### fluconazole — `verifie: true`

| Élément | `data.js` avant | Source primaire | Référence | Verdict |
|---|---|---|---|---|
| Dose 3-6 mg/kg/j, usuelle 3, max 400 mg/j | | **« fluconazole 3 mg/kg/jour pendant 7 j. (chez les nourrissons à partir de 1 mois) »** | BAPCOC 2026, « Candidose oropharyngée » p. 42 ; repris au CBIP | **corrigé** — `doseMax` ramené de 6 à **3** (aucune source pour 6) ; `maxJour` ramené de 400 à **100** (dose adulte d'entretien : 100 mg/j après 200 mg le 1er jour) |
| Durée « 7 à 14 jours » | | **7 jours** chez le nourrisson ; adulte 7 à 21 jours | BAPCOC 2026 p. 42 | **corrigé** |
| Âge minimal | absent | « à partir de 1 mois » ; « les nourrissons de moins de 1 mois sont référés au pédiatre » | BAPCOC 2026 p. 42 | **corrigé** (ajout de `ageMinMois: 1`) |
| Note « dose de charge (double dose au 1er jour) » | | Documentée **chez l'adulte** (200 mg J1 puis 100 mg/j), pas chez le nourrisson | BAPCOC 2026 p. 42 | **corrigé** — la note ne l'attribue plus à l'enfant |
| Suspension 50 mg/5 ml | `parMl: 10` | Diflucan susp. **10 mg / 1 ml** (35 ml) | CBIP 2026 | **confirmé** ; la suspension **40 mg/ml** a été ajoutée |
| Gélules 50 et 150 mg | | Diflucan et génériques : gél. **50, 150 et 200 mg** | CBIP 2026 | **confirmé** ; 200 mg ajoutée |
| Marques Diflucan, Fluconazole EG/Sandoz/Teva | | Diflucan, Fluconazole EG, Fluconazole Viatris | CBIP 2026 | **corrigé** |

---

### 3.8 Antiviraux

#### aciclovir — `verifie: false`

| Élément | `data.js` avant | Source primaire | Référence | Verdict |
|---|---|---|---|---|
| Suspension 200 mg/5 ml | `parMl: 40` | **Aciclovir GSK susp. 400 mg / 5 ml** (100 ml) — seule suspension au répertoire | CBIP 2026, ch. Aciclovir | **corrigé** → `parMl: 80`. L'erreur doublait le volume |
| Varicelle 20 mg/kg/prise × 4 | | Le CBIP ne donne **aucune dose pédiatrique** pour l'aciclovir. Le BAPCOC donne la dose adulte : **4 g/jour en 5 prises pendant 7 jours** | CBIP 2026 ; BAPCOC 2026, « Varicelle et herpès zoster » p. 37 | **introuvable** — valeur laissée en l'état, avertissement explicite ; `maxJour` porté de 3200 à **4000** (dose adulte documentée) |
| Indication varicelle | « enfant à risque, dans les 24 h » | « Le traitement antiviral **n'est pas recommandé chez les enfants en bonne santé** en raison de son évolution favorable (GRADE 1B). Un traitement antiviral **peut être envisagé chez les enfants plus âgés, à partir de 12 ans** et chez les adultes » | BAPCOC 2026 p. 37 | **corrigé** — l'indication et la note reflètent désormais le positionnement du guide |
| Gingivostomatite 40-80 mg/kg/j | | **Aucune source** — cette indication ne figure ni au CBIP ni au BAPCOC | — | **introuvable** — valeur laissée en l'état, avertissement explicite |
| Comprimés 200 et 800 mg | | Aciclovir AB / EG / GSK : compr. 200 mg et 800 mg | CBIP 2026 | **confirmé** |
| Marques Zovirax, Aciclovir EG/Sandoz/Teva | | **Zovirax n'existe plus en Belgique que sous forme de crème Labialis** ; les formes orales sont des génériques (Aciclovir AB, EG, GSK) | CBIP 2026 | **corrigé** |

#### oseltamivir — `verifie: true`

| Élément | `data.js` avant | Source primaire | Référence | Verdict |
|---|---|---|---|---|
| Palier « 15 kg ou moins : 30 mg 2×/j » (min 0) | | **« ≥ 1 an et 10 à 15 kg : 30 mg 2x/jour »** | CBIP 2026, ch. Oséltamivir | **corrigé** — la borne basse passe de 0 à **10 kg** |
| Palier « plus de 15 à 23 kg : 45 mg » | | **« ≥ 1 an et 15 à 24 kg : 45 mg 2x/jour »** | CBIP 2026 | **corrigé** — borne haute 23 → **24 kg** |
| Palier « plus de 23 à 40 kg : 60 mg » | | **« ≥ 1 an et 24 à 40 kg : 60 mg 2x/jour »** | CBIP 2026 | **corrigé** — borne basse 23 → **24 kg** |
| Palier « plus de 40 kg : 75 mg » | | **« ≥ 1 an et > 40 kg : 75 mg 2x/jour »** | CBIP 2026 | **confirmé** |
| Enfant < 10 kg | absent | **« 1 mois à 1 an : 3 mg/kg 2x/jour (max. 60 mg/jour) »** ; nouveau-né à terme : 3 mg/kg 2×/jour | CBIP 2026 | signalé dans la note (mode `paliers` par poids, ce schéma en mg/kg n'est pas calculé) |
| Suspension 6 mg/ml | `parMl: 6` | **N'existe pas en Belgique.** Tamiflu n'est commercialisé qu'en gélules 30, 45 et 75 mg | CBIP 2026 | **corrigé** — présentation **supprimée** |
| Gélules 30, 45, 75 mg | | Tamiflu gél. 30, 45, 75 mg | CBIP 2026 | **confirmé** |
| Délai de début « dans les 48 h » | | Le CBIP est plus strict : **« commencer le traitement moins de 8 heures après l'apparition des symptômes »** ; le bénéfice décrit dans la littérature porte sur les 48 h | CBIP 2026 | **corrigé** (les deux valeurs sont mentionnées) |
| Positionnement | absent | BAPCOC : « Les antiviraux (oseltamivir) ne sont pas indiqués pour le traitement ou la prophylaxie de la grippe étant donné le rapport coûts-bénéfices négatif (GRADE 1A) ». CBIP : « réduit la durée des symptômes d'un jour tout au plus », « n'a aucun effet bénéfique prouvé sur les complications graves » | BAPCOC 2026, « Influenza » p. 27 ; CBIP 2026, ch. 11.4.2 | ajouté à la note — **la fiche indique désormais que la place de ce médicament est très limitée** |
| Marques Tamiflu, Oseltamivir EG | | Tamiflu uniquement | CBIP 2026 | **corrigé** |

---

### 3.9 Antiparasitaires

#### mébendazole — `verifie: true`

| Élément | `data.js` avant | Source primaire | Référence | Verdict |
|---|---|---|---|---|
| Oxyurose : 100 mg dose unique, **à partir de 1 an** | | **« Enterobius vermicularis (oxyurose) : adulte et enfant à partir de 2 ans : 100 mg en 1 prise, et après 14 j, à nouveau 100 mg »** | CBIP 2026, ch. Mébendazole | **corrigé** — âge minimal porté de **12 à 24 mois** |
| Répétition après 2 semaines | | « et après 14 j, à nouveau 100 mg. Si nécessaire, répéter le traitement complet après 14 jours » | CBIP 2026 | **confirmé** |
| Ascaridiose : 100 mg 2×/j pendant 3 jours | | **« Ascaris lumbricoides, Ankylostoma duodenale, Necator americanus et Trichuris trichiura : adultes et enfants : 100 mg 2 x/jour pendant trois jours consécutifs »** | CBIP 2026 | **confirmé** (âge minimal aligné sur 2 ans) |
| Suspension 100 mg/5 ml | `parMl: 20` | Vermox susp. **20 mg / 1 ml** (30 ml) | CBIP 2026 | **confirmé** |
| Comprimé 100 mg | | Vermox compr. sécable 100 mg | CBIP 2026 | **confirmé** |
| Marques Vermox, Docmebenda | | Vermox (Kenvue) uniquement | CBIP 2026 | **corrigé** — *Docmebenda* n'existe pas |
| Contre-indication « moins de 1 an » | | Le CBIP ne donne de posologie qu'à partir de 2 ans | CBIP 2026 | **corrigé** → moins de 2 ans |

---

### 3.10 Vitamines et suppléments

#### vitamine D (colécalciférol) — `verifie: true`

| Élément | `data.js` avant | Source primaire | Référence | Verdict |
|---|---|---|---|---|
| **Gouttes « 400 UI / goutte »** | `parUnite: 400` | **D-Cure gtts sol. : 2 400 UI / 1 ml, et « 1 ml = 36 gouttes = 2 400 UI »**, soit **≈ 67 UI par goutte** | CBIP 2026, ch. 14.2.1.2, spécialité D-Cure | **corrigé** — `parUnite: 2400 / 36`. **L'ancienne valeur sous-dosait d'un facteur 6** : pour 400 UI, l'application indiquait 1 goutte au lieu de 6. Deux présentations sont désormais proposées, l'une en gouttes (400 UI = 6 gouttes exactement), l'autre en ml, parce que l'arrondi au pas de la seringue (0,05 ml) fait perdre 10 % sur un volume de 0,17 ml |
| Ampoule 25 000 UI | `parUnite: 25000` | D-Cure sol. unidose **25 000 UI / 1 ml** ; gél. 25 000 UI également | CBIP 2026 | **confirmé** |
| Palier « 0 à 6 ans : 400 UI/j » | | **« prophylaxie chez les enfants jusqu'à l'âge d'un an : colécalciférol 400 UI 1x/jour »**. Au-delà de 1 an, le CBIP est explicitement plus nuancé : « certaines sources EBM conseillent 400 UI par jour chez tous les enfants et adolescents **présentant des facteurs de risque** » (peau foncée, faible exposition solaire, antiépileptiques inducteurs) ; « certaines sources préconisent […] chez tous les enfants jusqu'à l'âge de 4 ans ou 6 ans » — avec la réserve que « cet avis ne repose pas sur des études ayant utilisé des critères d'évaluation cliniques » | CBIP 2026, ch. 14.2.1.2, rubriques « Positionnement » et « Posol. » | **corrigé** — la tranche ferme s'arrête à **1 an** ; au-delà, la tranche est étiquetée « à risque » et la note reproduit fidèlement la nuance du CBIP |
| Palier « 6 ans et plus : 400 à 600 UI » | | **Aucune source pour 600 UI.** Toutes les recommandations pédiatriques du CBIP portent sur 400 UI/jour | CBIP 2026 | **corrigé** → 400 UI |
| Rachitisme avéré | absent | « rachitisme dû à une carence en vitamine D : colécalciférol **3 000 à 5 000 UI 1x/jour** » | CBIP 2026 | ajouté à la note |
| Marques D-Cure, Devaron, Sterogyl | | D-Cure, Vitamine D3 EG, Vitamine D Sandoz, Vibosun-D3, Fultivit-D3, Vitamine D3 Viatris, Vitamine D Will | CBIP 2026 | **corrigé** — ***Devaron* et *Sterogyl* ne sont pas commercialisés en Belgique** (Devaron est néerlandais, Sterogyl français) |

#### fer — `verifie: true`

| Élément | `data.js` avant | Source primaire | Référence | Verdict |
|---|---|---|---|---|
| Dose 3-6 mg/kg/j, usuelle 4 | | **« Enfants : 1 à 6 mg de fer élémentaire/kg/jour »** ; le CBIP précise « Les diverses sources ne sont pas univoques » | CBIP 2026, ch. 14.1, rubrique « Posologie » | **corrigé** — `doseMin` ramené de 3 à **1** |
| `maxJour` 200 | | **« Adulte : 60 à 200 mg de fer élémentaire par voie orale par jour »** | CBIP 2026 | **confirmé** |
| Gouttes « concentration variable » | `parMl: 25` | **Ferricure sol. : 217,4 mg / 5 ml, soit 100 mg de fer(III) / 5 ml = 20 mg/ml** (flacon 60 ml) | CBIP 2026, ch. 14.1.1.1 | **corrigé** → `parMl: 20`, avec le nom de la spécialité |
| Autres présentations | absentes | **Ferricure gél. 150 mg de fer(III)** ; **Losferron compr. efferv. 695 mg = 80 mg de fer(II)** | CBIP 2026 | **corrigé** (ajoutées, avec la teneur en fer élément) |
| Marques Losferron, Ferricure, Fer-In-Sol | | Losferron, Ferricure | CBIP 2026 | **corrigé** — ***Fer-In-Sol* n'est pas commercialisé en Belgique** |
| Moment de prise | « à distance des produits laitiers et du thé » | « L'absorption du fer est optimisée lorsqu'il est pris **1 h avant ou 2 h après le repas**. Cependant, l'administration pendant le repas réduit les troubles gastro-intestinaux mais en diminue l'absorption » | CBIP 2026 | **corrigé** (formulation du CBIP retenue) |
| Coloration dentaire | absent | « Il est préférable de boire les préparations orales liquides et les comprimés effervescents avec une paille afin d'éviter une coloration réversible des dents » | CBIP 2026 | ajouté en précaution |
| Rechercher la cause | absent | « Il est important de rechercher la cause de la carence en fer avant d'en administrer » | CBIP 2026 | ajouté à la note |
| Durée « 3 mois, à poursuivre 2 à 3 mois après normalisation » | | Non chiffré par le CBIP | — | **corrigé** — formulation assouplie en « plusieurs mois, à poursuivre après normalisation » |

---

## 4. Récapitulatif des spécialités retirées du marché ou inexistantes

Les noms suivants figuraient dans `data.js` et **ne correspondent à aucune spécialité commercialisée en Belgique** selon le répertoire CBIP 2026 (donc selon la banque de données SAM de l'AFMPS) :

| Nom | Statut |
|---|---|
| **Peni-Oral** | Aucune trace. La pénicilline V est **retirée du marché belge depuis mai 2019**. Remplacée par **Broxil** (phénéticilline) |
| **Solupred** | Spécialité française. **Aucune spécialité de prednisolone en Belgique** |
| **Prednisolone EG** | N'existe pas |
| **Mycostatine** | N'existe pas en Belgique. La nystatine y est commercialisée sous le nom **Nilstat** |
| **Fer-In-Sol** | N'existe pas |
| **Dexaméthasone orale** | **Plus disponible comme spécialité** ; préparation magistrale uniquement |
| **Devaron**, **Sterogyl** | Spécialités néerlandaise et française. Non commercialisées en Belgique |
| **Junifen** | Ne figure plus au répertoire |
| **Amoxypen**, **Docamoxici** | Ne figurent pas au répertoire |
| **Docamoclan**, **Docotrim**, **Docmetro**, **Docmebenda**, **Docsalbuta** | Aucune de ces spécialités « Doc… » ne figure au répertoire 2026 |
| **Transipeg** | Ne figure plus au répertoire |
| **Doxytab** | Ne figure pas au répertoire |
| Génériques **Teva** cités pour amoxicilline, azithromycine, clarithromycine, cétirizine, paracétamol, ibuprofène, fluconazole, oméprazole | Ces gammes ne figurent pas au répertoire pour ces molécules (Teva est bien présent pour la dompéridone, la desloratadine et l'ébastine) |

Et les présentations suivantes, qui n'existent pas :

amoxicilline-clavulanate 8:1 · flucloxacilline sirop 125 mg/5 ml · céfuroxime suspension 125 mg/5 ml · métronidazole suspension et comprimé 250 mg · cétirizine gouttes et sirop · hydroxyzine sirop · dompéridone suspension · ondansétron sirop et lyophilisat 4 mg · montélukast granulés · oseltamivir suspension · paracétamol sirop 24 mg/ml · dexaméthasone comprimé 0,5 mg · pénicilline V suspension 250 mg/5 ml et comprimé 1 MUI

---

## 5. Valeurs restées non vérifiées

Neuf valeurs n'ont **aucune source primaire belge**. Elles ont été **laissées en l'état** dans `data.js`, la fiche reste `verifie: false`, et sa note porte désormais un avertissement explicite en français et en néerlandais.

| Fiche | Valeur `introuvable` | Pourquoi |
|---|---|---|
| prednisolone | 1-2 mg/kg/j (exacerbation d'asthme) | Le CBIP ne donne pas de dose pédiatrique pour les corticoïdes systémiques ; il n'existe de toute façon plus de spécialité |
| méthylprednisolone | 0,8-1,6 mg/kg/j | Idem |
| dexaméthasone | 0,15-0,6 mg/kg (laryngite) | Le CBIP ne chiffre pas la dose ; seule la revue Cochrane le fait, mais ce n'est pas une source belge |
| hydroxyzine | 1-2 mg/kg/j (prurit) | Le CBIP ne donne qu'une dose adulte |
| métronidazole | 20-30 mg/kg/j (anaérobies) | Le CBIP ne donne que des doses adultes |
| métronidazole | 15-20 mg/kg/j (giardiase) | Idem |
| oméprazole | 0,7-1,4 mg/kg/j (RGO) | Idem |
| ondansétron | 0,15-0,2 mg/kg (dose unique) | Toutes les présentations sont d'usage hospitalier ; le CBIP ne mentionne alors pas la posologie (Intro 2.10) |
| aciclovir | 20 mg/kg/prise (varicelle) et 40-80 mg/kg/j (gingivostomatite) | Le CBIP ne donne pas de dose pédiatrique pour l'aciclovir ; le BAPCOC ne donne que la dose adulte |

Une valeur supplémentaire est signalée sans être bloquante : le **seuil de 5 kg de l'ibuprofène** n'est pas mentionné par le CBIP (seul le seuil de 3 mois l'est). Il a été conservé parce qu'il est prudent et qu'il ne fait que déclencher un avertissement.

**Piste pour lever ces incertitudes :** le CBIP indique lui-même que ses posologies pédiatriques proviennent du RCP, du **kinderformularium.nl** et du **BNF for Children**. Le kinderformularium.nl est accessible librement et couvre la plupart de ces molécules ; il ne constitue toutefois pas une source belge, et n'a donc pas été utilisé pour valider des chiffres dans ce travail.

---

## 6. Notes de méthode et limites

1. **Le PDF du répertoire CBIP a été préféré au site web.** Le site `cbip.be` charge son contenu en JavaScript, ce qui rend l'extraction fragile. Le PDF `GGR_FR_2026.pdf` (14 Mo, 1 471 pages) contient exactement le même contenu, avec un numéro de version daté par chapitre. Les pages web par substance (`cbip.be/fr/keywords/<substance>?type=substance`) ont servi de recoupement.

2. **Les RCP individuels de l'AFMPS n'ont pas été consultés un par un.** Le CBIP reprend et évalue les posologies des RCP (Intro 2.10) et sa liste de spécialités est directement issue de la banque SAM de l'AFMPS (Intro 2.11.1) : c'est donc une source primaire suffisante pour les concentrations et la disponibilité. Le champ `sources` de `data.js` ne mentionne plus le RCP, puisqu'aucun RCP n'a été lu directement — l'ancienne référence générique à l'AFMPS a été supprimée pour ne pas laisser croire à une vérification qui n'a pas eu lieu.

3. **Les paliers d'âge sont exprimés en mois révolus** dans `data.js`. Les bornes ont été traduites au plus près du texte source ; lorsque celui-ci écrit « 2 à 10 ans » et « plus de 10 ans », la coupure a été placée à 132 mois (11 ans) pour éviter un trou entre les tranches, ce que le moteur de calcul refuse.

4. **Les traductions néerlandaises** ont été rédigées en néerlandais médical belge, en reprenant la terminologie du guide BAPCOC néerlandophone (« giften » pour les prises, « middenoorontsteking », « clavulaanzuur », « feneticilline », « pseudokroep », « zetpil », « voorzetkamer »). Le guide NL de mai 2026 a servi de référence lexicale.

5. **Ce qui n'a pas été fait :** la vérification des remboursements INAMI, des interactions médicamenteuses détaillées, et des posologies en insuffisance rénale ou hépatique. Ces éléments dépassent le périmètre du calculateur.

---

## 7. Ce qu'un relecteur devrait contrôler en priorité

1. Les **sept erreurs de concentration** du § 2 : ce sont elles qui produisent un volume faux à la seringue.
2. Le remplacement de la **pénicilline V par la phénéticilline** : c'est un changement de molécule, pas seulement de nom.
3. Les fiches **prednisolone, méthylprednisolone, dexaméthasone** : les doses en mg/kg y sont couramment utilisées en pratique mais ne sont adossées à aucune source belge. C'est le principal angle mort qui subsiste.
4. Le passage de la **dompéridone** à un seuil de 35 kg : cela retire de fait le médicament de l'usage pédiatrique courant. C'est bien ce que dit le CBIP, mais cela mérite une décision clinique explicite.
5. La suppression du palier **cétirizine 2-5 ans** : il n'existe plus de forme liquide ni de posologie validée sous 6 ans en Belgique.
