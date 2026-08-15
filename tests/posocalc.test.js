/*
 * Posocalc — tests
 * ------------------------------------------------------------------
 * À lancer après CHAQUE modification de assets/js/data.js :
 *
 *     npm test
 *
 * Les tests vérifient :
 *   1. le moteur de calcul (règle de trois, plafonds, arrondis) ;
 *   2. la trace « détail du calcul » ;
 *   3. l'intégrité du fichier de données (identifiants uniques, doses
 *      cohérentes, sources présentes, traductions complètes) ;
 *   4. l'absence de valeur aberrante sur l'ensemble des combinaisons.
 */

global.window = global;
global.document = { documentElement: {} };
global.navigator = { language: 'fr-BE' };
require('../assets/js/i18n.js');
require('../assets/js/data.js');
require('../assets/js/search.js');
require('../assets/js/calc.js');

const D = window.PosocalcData, C = window.PosocalcCalc,
      S = window.PosocalcSearch, I = window.PosocalcI18n;

let fails = 0;
function check(nom, cond, extra) {
  if (!cond) { fails++; console.log('FAIL  ' + nom + (extra !== undefined ? '  -> ' + extra : '')); }
  else console.log('ok    ' + nom);
}
const med = id => D.MEDICAMENTS.find(m => m.id === id);
const cles = r => r.avertissements.map(a => a.cle);

/* --- 1. Le cas de départ : amoxicilline, 12 kg, 3 prises ---------- */
{
  const m = med('amoxicilline');
  const sch = m.schemas[0];                              // 75-100 mg/kg/j, usuelle 80
  const forme = m.formes.find(f => f.id === 'susp250');   // 50 mg/ml
  const r = C.calculer({med:m, schema:sch, forme, patient:{poids:12, ageMois:36}, dosePerKg:80, prises:3});
  check('amox 12kg 80mg/kg/j -> 960 mg/j', r.totalJour === 960, r.totalJour);
  check('amox -> 320 mg/prise', r.parPrise === 320, r.parPrise);
  check('amox -> 6,4 ml/prise', r.volumeParPrise === 6.4, r.volumeParPrise);
  check('amox -> 19,2 ml/j', Math.abs(r.volumeJour - 19.2) < 1e-6, r.volumeJour);
  check('amox pas de plafond', r.plafonne === false);
  check('amox dose reelle ~80', Math.abs(r.doseReelleParKg - 80) < 0.5, r.doseReelleParKg);
}

/* --- 2. Plafond adulte -------------------------------------------- */
{
  const m = med('amoxicilline');
  const r = C.calculer({med:m, schema:m.schemas[0], forme:m.formes.find(f=>f.id==='cp500'),
                        patient:{poids:60, ageMois:180}, dosePerKg:100, prises:3});
  check('amox 60kg plafonne a 3000 mg/j', r.plafonne && r.totalJour === 3000, r.totalJour);
  check('amox plafond -> 1000 mg/prise', r.parPrise === 1000, r.parPrise);
  check('amox plafond -> 2 comprimes de 500', r.unitesParPrise === 2, r.unitesParPrise);
  check('amox plafond motif traduisible', I.t(r.plafondMotif.cle) !== r.plafondMotif.cle);
}

/* --- 3. Mode 'prise' : paracetamol --------------------------------- */
{
  const m = med('paracetamol');
  const sch = m.schemas[0];                              // 15 mg/kg/prise, max 60 mg/kg/j
  const forme = m.formes.find(f => f.id === 'sirop30');   // 30 mg/ml
  const r = C.calculer({med:m, schema:sch, forme, patient:{poids:12, ageMois:36}, dosePerKg:15, prises:4});
  check('para 12kg 15mg/kg -> 180 mg/prise', r.parPrise === 180, r.parPrise);
  check('para -> 720 mg/j', r.totalJour === 720, r.totalJour);
  check('para -> 6 ml/prise', r.volumeParPrise === 6, r.volumeParPrise);
  check('para 60 mg/kg/j non depasse', !r.plafonne);

  const r2 = C.calculer({med:m, schema:sch, forme, patient:{poids:12}, dosePerKg:15, prises:5});
  check('para 5 prises plafonne a 60 mg/kg/j', r2.plafonne && r2.totalJour === 720, r2.totalJour);

  const r3 = C.calculer({med:m, schema:sch, forme:m.formes.find(f=>f.id==='cp500'),
                         patient:{poids:80}, dosePerKg:15, prises:4});
  check('para 80kg plafonne a 4000 mg/j', r3.plafonne && r3.totalJour === 4000, r3.totalJour);
  check('para 80kg -> 1000 mg/prise', r3.parPrise === 1000, r3.parPrise);
}

/* --- 4. Ibuprofene : seuils age et poids --------------------------- */
{
  const m = med('ibuprofene');
  const forme = m.formes.find(f=>f.id==='sirop20');
  const r = C.calculer({med:m, schema:m.schemas[0], forme,
                        patient:{poids:12, ageMois:36}, dosePerKg:10, prises:3});
  check('ibu 12kg -> 120 mg/prise', r.parPrise === 120, r.parPrise);
  check('ibu -> 6 ml/prise (20 mg/ml)', r.volumeParPrise === 6, r.volumeParPrise);
  check('ibu -> 360 mg/j', r.totalJour === 360, r.totalJour);

  const jeune = C.calculer({med:m, schema:m.schemas[0], forme,
                            patient:{poids:4, ageMois:2}, dosePerKg:10, prises:3});
  check('ibu <3 mois : avertissement age', cles(jeune).includes('w.ageMin'), cles(jeune));
  check('ibu <5 kg : avertissement poids', cles(jeune).includes('w.poidsMin'), cles(jeune));
}

/* --- 5. Mode 'unique' : dexamethasone ------------------------------ */
{
  const m = med('dexamethasone');
  const r = C.calculer({med:m, schema:m.schemas[0], forme:m.formes.find(f=>f.id==='sol4'),
                        patient:{poids:14, ageMois:30}, dosePerKg:0.15, prises:1});
  check('dexa 14kg x0,15 -> 2,1 mg', Math.abs(r.totalJour - 2.1) < 1e-9, r.totalJour);
  check('dexa 1 seule prise', r.prises === 1);
  check('dexa 0,525 ml arrondi au pas 0,05 -> 0,55', r.volumeParPrise === 0.55, r.volumeParPrise);
}

/* --- 6. Mode 'paliers' par age : cetirizine ------------------------ */
{
  const m = med('cetirizine');
  const sch = m.schemas[0];
  const r = C.calculer({med:m, schema:sch, forme:m.formes.find(f=>f.id==='gouttes'),
                        patient:{poids:16, ageMois:48}});          // 4 ans -> 2,5 mg x2
  check('cetirizine 4 ans -> palier 2-5 ans', r.palier && r.palier.label.fr === '2 à 5 ans',
        r.palier && r.palier.label.fr);
  check('cetirizine -> 5 mg/j reparti en 2', r.totalJour === 5 && r.prises === 2);
  check('cetirizine -> 2,5 mg/prise', r.parPrise === 2.5, r.parPrise);
  check('cetirizine -> 0,25 ml de gouttes 10 mg/ml', r.volumeParPrise === 0.25, r.volumeParPrise);

  const sansAge = C.calculer({med:m, schema:sch, forme:null, patient:{poids:16, ageMois:null}});
  check('cetirizine sans age -> blocage', sansAge.blocages.length === 1);
  check('cetirizine blocage traduisible', I.t(sansAge.blocages[0].cle) !== sansAge.blocages[0].cle);

  const ado = C.calculer({med:m, schema:sch, forme:m.formes.find(f=>f.id==='cp10'),
                          patient:{poids:50, ageMois:168}});
  check('cetirizine 14 ans -> 10 mg 1x/j', ado.parPrise === 10 && ado.prises === 1);
  check('cetirizine ado -> 1 comprime', ado.unitesParPrise === 1, ado.unitesParPrise);
}

/* --- 7. Mode 'paliers' par poids : oseltamivir --------------------- */
{
  const m = med('oseltamivir');
  const sch = m.schemas[0];
  const forme = m.formes.find(f=>f.id==='susp');
  [[10,60],[15,60],[20,90],[30,120],[45,150]].forEach(([p, attendu]) => {
    const r = C.calculer({med:m, schema:sch, forme, patient:{poids:p, ageMois:60}});
    check('oseltamivir '+p+' kg -> '+attendu+' mg/j', r.totalJour === attendu, r.totalJour);
  });
  const r15 = C.calculer({med:m, schema:sch, forme, patient:{poids:15}});
  check('oseltamivir 15 kg -> 5 ml/prise (6 mg/ml)', r15.volumeParPrise === 5, r15.volumeParPrise);
}

/* --- 8. Fractions non administrables -------------------------------- */
{
  const m = med('paracetamol');
  const suppo = m.formes.find(f=>f.id==='suppo200');
  const r = C.calculer({med:m, schema:m.schemas[0], forme:suppo,
                        patient:{poids:12}, dosePerKg:15, prises:4});
  check('suppo : 0,9 arrondi a 1 unite entiere', r.unitesParPrise === 1, r.unitesParPrise);
  check('suppo : dose recalculee a 200 mg', r.parPrise === 200, r.parPrise);
  // 4 x 200 mg = 800 mg/j pour 12 kg, soit > 60 mg/kg/j : c'est la frequence
  // qui doit baisser, pas la dose unitaire d'un suppositoire non secable.
  check('suppo : alerte sur le plafond journalier', cles(r).includes('w.plafondForme'), cles(r));
  const r3p = C.calculer({med:m, schema:m.schemas[0], forme:suppo,
                          patient:{poids:12}, dosePerKg:15, prises:3});
  check('suppo 3 prises : plus d alerte de plafond', !cles(r3p).includes('w.plafondForme'), cles(r3p));

  // Un demi-comprime en trop ne doit pas faire franchir la dose adulte.
  const amox = med('amoxicilline');
  const gros = C.calculer({med:amox, schema:amox.schemas[2],
                           forme:amox.formes.find(f=>f.id==='cp1000'),
                           patient:{poids:70}, dosePerKg:50, prises:4});
  check('arrondi vers le bas sous le plafond adulte', gros.totalJour <= 3000, gros.totalJour);

  const gel = med('oseltamivir').formes.find(f=>f.id==='gel75');
  const r2 = C.calculer({med:med('oseltamivir'), schema:med('oseltamivir').schemas[0],
                         forme:gel, patient:{poids:10}});
  check('gelule 75 mg pour 30 mg/prise -> trop dosee', cles(r2).includes('w.tropDose'), cles(r2));
}

/* --- 9. Poids manquant ---------------------------------------------- */
{
  const m = med('amoxicilline');
  const r = C.calculer({med:m, schema:m.schemas[0], forme:m.formes[1],
                        patient:{poids:null}, dosePerKg:80, prises:3});
  check('poids absent -> blocage', r.blocages.length === 1 && !r.ok);
  check('poids absent -> cle w.poidsManquant', r.blocages[0].cle === 'w.poidsManquant');
}

/* --- 10. Trace du calcul --------------------------------------------- */
{
  const m = med('amoxicilline');
  const r = C.calculer({med:m, schema:m.schemas[0], forme:m.formes.find(f=>f.id==='susp250'),
                        patient:{poids:12}, dosePerKg:80, prises:3});
  const c = r.etapes.map(e => e.cle);
  check('trace : dose journaliere', c.includes('calc.etape.doseJour'), c);
  check('trace : division par le nombre de prises', c.includes('calc.etape.division'), c);
  check('trace : conversion en volume', c.includes('calc.etape.volume'), c);
  check('trace : controle inverse', c.includes('calc.etape.controle'), c);
  check('trace : toutes les cles sont traduites',
        r.etapes.every(e => I.t(e.cle, e.cleParams || {}) !== e.cle),
        c.filter(k => I.t(k) === k));
  check('trace : chaque etape a un resultat', r.etapes.every(e => !!e.resultat));
  const doseJour = r.etapes.find(e => e.cle === 'calc.etape.doseJour');
  check('trace : formule lisible', doseJour.formule === '80 mg/kg × 12 kg', doseJour.formule);
  check('trace : resultat lisible', doseJour.resultat === '960 mg/j', doseJour.resultat);

  const plaf = C.calculer({med:m, schema:m.schemas[0], forme:m.formes.find(f=>f.id==='cp1000'),
                           patient:{poids:60}, dosePerKg:100, prises:3});
  check('trace : le plafonnement apparait',
        plaf.etapes.some(e => e.cle === 'calc.etape.plafondJour'), plaf.etapes.map(e=>e.cle));
}

/* --- 11. Horaires suggeres -------------------------------------------- */
{
  check('horaires 3 prises', C.horaires(3).join(' ') === '7:00 15:00 23:00', C.horaires(3));
  check('horaires 2 prises', C.horaires(2).length === 2);
  check('horaires 5 prises (hors table)', C.horaires(5).length === 5, C.horaires(5));
}

/* --- 12. Choix automatique de la presentation -------------------------- */
{
  const m = med('amoxicilline');
  const petit = C.meilleureForme({med:m, schema:m.schemas[0], patient:{poids:12}, dosePerKg:80, prises:3});
  check('12 kg -> suspension 250 mg/5 ml', petit.id === 'susp250', petit.id);
  const grand = C.meilleureForme({med:m, schema:m.schemas[0], patient:{poids:60}, dosePerKg:100, prises:3});
  check('60 kg -> comprime 1 g', grand.id === 'cp1000', grand.id);
}

/* --- 13. Recherche bilingue -------------------------------------------- */
{
  const nom = q => S.rechercher(D.MEDICAMENTS, q, null).map(m => m.id);
  check('"amoxi" -> amoxicilline en tete', nom('amoxi')[0] === 'amoxicilline', nom('amoxi').slice(0,3));
  check('"augmentin" (marque)', nom('augmentin')[0] === 'amoxicilline-clavulanate', nom('augmentin').slice(0,3));
  check('sans accent "cefuroxime"', nom('cefuroxime')[0] === 'cefuroxime-axetil', nom('cefuroxime').slice(0,3));
  check('avec accent "céfuroxime"', nom('céfuroxime')[0] === 'cefuroxime-axetil');
  check('faute de frappe "amoxiciline"', nom('amoxiciline')[0] === 'amoxicilline', nom('amoxiciline').slice(0,3));
  check('par indication FR "otite"', nom('otite').includes('amoxicilline'), nom('otite'));
  check('par indication NL "oorontsteking"', nom('oorontsteking').includes('amoxicilline'), nom('oorontsteking'));
  check('DCI NL "ibuprofen"', nom('ibuprofen')[0] === 'ibuprofene', nom('ibuprofen').slice(0,3));
  check('DCI NL "paracetamol"', nom('paracetamol')[0] === 'paracetamol');
  check('synonyme NL "koorts"', nom('koorts').length >= 2, nom('koorts'));
  check('synonyme NL "waterpokken"', nom('waterpokken').includes('aciclovir'), nom('waterpokken'));
  check('"zyrtec" -> cetirizine', nom('zyrtec')[0] === 'cetirizine', nom('zyrtec'));
  check('recherche vide -> tout', nom('').length === D.MEDICAMENTS.length);
  check('recherche absurde -> rien', nom('xyzzyplugh').length === 0, nom('xyzzyplugh'));
  check('filtre par categorie',
        S.rechercher(D.MEDICAMENTS, '', 'antibiotique').every(m => m.categorie === 'antibiotique'));
}

/* --- 14. Traductions de l'interface ------------------------------------ */
{
  // Toute clé utilisée par l'application doit exister dans les deux langues.
  const fr = [], nl = [];
  I.definir('fr');
  const echantillon = ['app.bandeau','modal.titre','patient.poids','med.titre','reg.dose',
                       'res.parPrise','calc.titre','src.titre','f.titre','f.aDonner','md.inami',
                       'pied.legal','al.plafond','w.poidsManquant','plafond.jour'];
  echantillon.forEach(k => { if (I.t(k) === k) fr.push(k); });
  I.definir('nl');
  echantillon.forEach(k => { if (I.t(k) === k) nl.push(k); });
  check('cles presentes en FR', fr.length === 0, fr);
  check('cles presentes en NL', nl.length === 0, nl);
  check('UI devient IE en neerlandais', I.unite('UI') === 'IE', I.unite('UI'));
  I.definir('fr');
  check('UI reste UI en francais', I.unite('UI') === 'UI');
  check('interpolation', I.t('med.tous', {n: 7}).includes('7'), I.t('med.tous', {n: 7}));
}

/* --- 15. Intégrité et complétude bilingue du jeu de données ------------- */
{
  const LANGUES = ['fr', 'nl'];
  // Un champ traduisible doit porter les deux langues, non vides.
  function bilingue(v) {
    return v && typeof v === 'object' && LANGUES.every(l => typeof v[l] === 'string' && v[l].trim());
  }
  function verifBilingue(nom, v) { check('bilingue : ' + nom, bilingue(v), JSON.stringify(v)); }

  D.CATEGORIES.forEach(c => verifBilingue('categorie ' + c.id, c.nom));

  const ids = new Set();
  D.MEDICAMENTS.forEach(m => {
    check('id unique : ' + m.id, m.id && !ids.has(m.id));
    ids.add(m.id);
    verifBilingue(m.id + '.dci', m.dci);
    verifBilingue(m.id + '.cbip', m.cbip);
    check('categorie connue : ' + m.id, D.CATEGORIES.some(c => c.id === m.categorie), m.categorie);
    check('marques non vides : ' + m.id, Array.isArray(m.marques) && m.marques.length > 0);
    check('au moins un schema : ' + m.id, m.schemas && m.schemas.length > 0);
    if (m.doseExprimee) verifBilingue(m.id + '.doseExprimee', m.doseExprimee);
    (m.precautions || []).forEach((p, i) => verifBilingue(m.id + '.precaution[' + i + ']', p));
    (m.contreIndications || []).forEach((c, i) => verifBilingue(m.id + '.CI[' + i + ']', c));

    const sids = new Set();
    m.schemas.forEach(s => {
      const nom = m.id + '/' + s.id;
      check('schema id unique ' + nom, s.id && !sids.has(s.id));
      sids.add(s.id);
      verifBilingue(nom + '.indication', s.indication);
      if (s.duree) verifBilingue(nom + '.duree', s.duree);
      if (s.note) verifBilingue(nom + '.note', s.note);
      check('mode valide ' + nom, ['jour','prise','unique','paliers'].includes(s.mode), s.mode);
      check('unite connue ' + nom, ['mg','µg','g','UI','ml'].includes(s.unite), s.unite);
      // La provenance du chiffre est obligatoire : c'est ce que l'interface affiche.
      check('sources du schema ' + nom, Array.isArray(s.sources) && s.sources.length > 0);
      (s.sources || []).forEach((src, i) => {
        verifBilingue(nom + '.source[' + i + '].label', src.label);
        const urls = typeof src.url === 'string' ? [src.url] : LANGUES.map(l => src.url[l]);
        check('url http ' + nom + '[' + i + ']', urls.every(u => /^https:\/\//.test(u)), urls);
      });

      if (s.mode === 'paliers') {
        check('paliers non vides ' + nom, s.paliers && s.paliers.length > 0);
        check('critere valide ' + nom, ['age','poids'].includes(s.critere), s.critere);
        s.paliers.forEach(p => {
          verifBilingue(nom + '.palier.label', p.label);
          if (p.libelle) verifBilingue(nom + '.palier.libelle', p.libelle);
          check('palier dose>0 ' + nom, p.dose > 0 && p.prises > 0);
        });
        // Les tranches doivent se suivre sans trou ni chevauchement.
        for (let i = 1; i < s.paliers.length; i++) {
          const prec = s.paliers[i-1], cur = s.paliers[i];
          check('paliers ordonnes ' + nom + ' #' + i, prec.max !== null && cur.min > prec.max,
                prec.max + ' -> ' + cur.min);
        }
      } else {
        check('doseMin<=usuelle<=doseMax ' + nom,
              s.doseMin <= s.doseUsuelle && s.doseUsuelle <= s.doseMax,
              s.doseMin+'/'+s.doseUsuelle+'/'+s.doseMax);
        check('prises defini ' + nom, Array.isArray(s.prises) && s.prises.length > 0);
        if (s.maxJour && s.maxPrise) {
          check('maxPrise <= maxJour ' + nom, s.maxPrise <= s.maxJour);
        }
      }
    });

    const fids = new Set();
    (m.formes || []).forEach(f => {
      const nom = m.id + '/' + f.id;
      check('forme id unique ' + nom, f.id && !fids.has(f.id));
      fids.add(f.id);
      verifBilingue(nom + '.nom', f.nom);
      if (f.note) verifBilingue(nom + '.note', f.note);
      if (f.uniteNom) {
        verifBilingue(nom + '.uniteNom.singulier', f.uniteNom.un);
        verifBilingue(nom + '.uniteNom.pluriel', f.uniteNom.pl);
        check('pluriel distinct ' + nom,
              f.uniteNom.un.fr !== f.uniteNom.pl.fr && f.uniteNom.un.nl !== f.uniteNom.pl.nl,
              JSON.stringify(f.uniteNom));
      }
      check('forme dosee ' + nom, (f.parMl > 0) || (f.parUnite > 0));
      check('forme unitaire nommee ' + nom, !f.parUnite || !!f.uniteNom);
      check('type connu ' + nom, ['liquide','solide','sachet','suppo','autre'].includes(f.type), f.type);
    });
    check('sources fiche : ' + m.id, m.sources && m.sources.length > 0);
  });
}

/* --- 16. Aucune valeur aberrante sur toute la matrice ------------------- */
{
  let combos = 0;
  D.MEDICAMENTS.forEach(m => m.schemas.forEach(s => (m.formes||[null]).forEach(f => {
    [{poids:3.5,ageMois:1},{poids:12,ageMois:36},{poids:35,ageMois:132},{poids:70,ageMois:200}]
      .forEach(pat => {
        const listePrises = s.prises || [1];
        listePrises.forEach(n => {
          combos++;
          const r = C.calculer({med:m, schema:s, forme:f, patient:pat,
                                dosePerKg:s.doseUsuelle, prises:n});
          if (r.blocages.length) return;
          const champs = {totalJour:r.totalJour, parPrise:r.parPrise,
                          volumeParPrise:r.volumeParPrise, unitesParPrise:r.unitesParPrise};
          Object.keys(champs).forEach(k => {
            const v = champs[k];
            if (v !== null && (!isFinite(v) || v < 0)) {
              fails++;
              console.log('FAIL  valeur aberrante ' + m.id + '/' + s.id + '/' + (f&&f.id) +
                          ' ' + k + '=' + v);
            }
          });
          // Le plafond journalier ne peut être franchi qu'en signalant
          // explicitement que la présentation impose de réduire la fréquence.
          if (s.maxJour && r.totalJour > s.maxJour + 1e-6 &&
              !r.avertissements.some(a => a.cle === 'w.plafondForme')) {
            fails++;
            console.log('FAIL  plafond depasse en silence ' + m.id + '/' + s.id +
                        '/' + (f&&f.id) + ' : ' + r.totalJour);
          }
          r.avertissements.concat(r.blocages).forEach(a => {
            if (window.PosocalcI18n.t(a.cle) === a.cle) {
              fails++; console.log('FAIL  message non traduit : ' + a.cle);
            }
          });
        });
      });
  })));
  check('matrice complete sans anomalie (' + combos + ' combinaisons)', true);
}

console.log('\n' + (fails ? fails + ' ECHEC(S)' : 'Tous les tests passent'));
process.exit(fails ? 1 : 0);
