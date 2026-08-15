/*
 * Posocalc — tests
 * ------------------------------------------------------------------
 * À lancer après CHAQUE modification de assets/js/data.js :
 *
 *     npm test
 *
 * Les tests vérifient deux choses :
 *   1. le moteur de calcul (règle de trois, plafonds, arrondis) ;
 *   2. l'intégrité du fichier de données (identifiants uniques, doses
 *      cohérentes, présentations correctement dosées, aucune valeur
 *      aberrante sur l'ensemble des combinaisons possibles).
 */

global.window = global;
require('../assets/js/data.js');
require('../assets/js/search.js');
require('../assets/js/calc.js');

const D = window.PosocalcData, C = window.PosocalcCalc, S = window.PosocalcSearch;
let fails = 0;
function check(nom, cond, extra) {
  if (!cond) { fails++; console.log('FAIL  ' + nom + (extra ? '  -> ' + extra : '')); }
  else console.log('ok    ' + nom);
}
const med = id => D.MEDICAMENTS.find(m => m.id === id);

/* --- 1. Le cas de la question : amoxicilline, 12 kg, 3 prises ---- */
{
  const m = med('amoxicilline');
  const sch = m.schemas[0];                       // 75-100 mg/kg/j, usuelle 80
  const forme = m.formes.find(f => f.id === 'susp250');  // 50 mg/ml
  const r = C.calculer({med:m, schema:sch, forme, patient:{poids:12, ageMois:36}, dosePerKg:80, prises:3});
  check('amox 12kg 80mg/kg/j -> 960 mg/j', Math.abs(r.totalJour - 960) < 1e-9, r.totalJour);
  check('amox -> 320 mg/prise', Math.abs(r.parPrise - 320) < 1e-9, r.parPrise);
  check('amox -> 6,4 ml/prise', Math.abs(r.volumeParPrise - 6.4) < 1e-9, r.volumeParPrise);
  check('amox -> 19,2 ml/j', Math.abs(r.volumeJour - 19.2) < 1e-6, r.volumeJour);
  check('amox pas de plafond', r.plafonne === false);
  check('amox dose reelle ~80', Math.abs(r.doseReelleParKg - 80) < 0.5, r.doseReelleParKg);
}

/* --- 2. Plafond adulte : gros ado -------------------------------- */
{
  const m = med('amoxicilline');
  const r = C.calculer({med:m, schema:m.schemas[0], forme:m.formes.find(f=>f.id==='cp500'),
                        patient:{poids:60, ageMois:180}, dosePerKg:100, prises:3});
  check('amox 60kg plafonne a 3000 mg/j', r.plafonne && r.totalJour === 3000, r.totalJour);
  check('amox plafond -> 1000 mg/prise', Math.abs(r.parPrise - 1000) < 1e-9, r.parPrise);
  check('amox plafond -> 2 comprimes de 500', Math.abs(r.unitesParPrise - 2) < 1e-9, r.unitesParPrise);
}

/* --- 3. Mode 'prise' : paracetamol -------------------------------- */
{
  const m = med('paracetamol');
  const sch = m.schemas[0];                       // 15 mg/kg/prise, max 60 mg/kg/j
  const forme = m.formes.find(f => f.id === 'sirop30'); // 30 mg/ml
  const r = C.calculer({med:m, schema:sch, forme, patient:{poids:12, ageMois:36}, dosePerKg:15, prises:4});
  check('para 12kg 15mg/kg -> 180 mg/prise', Math.abs(r.parPrise - 180) < 1e-9, r.parPrise);
  check('para -> 720 mg/j', Math.abs(r.totalJour - 720) < 1e-9, r.totalJour);
  check('para -> 6 ml/prise', Math.abs(r.volumeParPrise - 6) < 1e-9, r.volumeParPrise);
  check('para 60 mg/kg/j non depasse', !r.plafonne);

  // 15 mg/kg x 5 prises = 75 mg/kg/j -> doit etre ramene a 60 mg/kg/j
  const r2 = C.calculer({med:m, schema:sch, forme, patient:{poids:12}, dosePerKg:15, prises:5});
  check('para 5 prises plafonne a 60 mg/kg/j', r2.plafonne && Math.abs(r2.totalJour - 720) < 1e-9, r2.totalJour);

  // Adolescent 80 kg : plafond absolu 4 g/j et 1 g/prise
  const r3 = C.calculer({med:m, schema:sch, forme:m.formes.find(f=>f.id==='cp500'),
                         patient:{poids:80}, dosePerKg:15, prises:4});
  check('para 80kg plafonne a 4000 mg/j', r3.plafonne && r3.totalJour === 4000, r3.totalJour);
  check('para 80kg -> 1000 mg/prise', Math.abs(r3.parPrise - 1000) < 1e-9, r3.parPrise);
}

/* --- 4. Ibuprofene : plafond par prise ---------------------------- */
{
  const m = med('ibuprofene');
  const r = C.calculer({med:m, schema:m.schemas[0], forme:m.formes.find(f=>f.id==='sirop20'),
                        patient:{poids:12, ageMois:36}, dosePerKg:10, prises:3});
  check('ibu 12kg -> 120 mg/prise', Math.abs(r.parPrise - 120) < 1e-9, r.parPrise);
  check('ibu -> 6 ml/prise (20 mg/ml)', Math.abs(r.volumeParPrise - 6) < 1e-9, r.volumeParPrise);
  check('ibu -> 360 mg/j', Math.abs(r.totalJour - 360) < 1e-9, r.totalJour);

  const jeune = C.calculer({med:m, schema:m.schemas[0], forme:m.formes.find(f=>f.id==='sirop20'),
                            patient:{poids:4, ageMois:2}, dosePerKg:10, prises:3});
  check('ibu <3 mois : avertissement age', jeune.avertissements.some(a=>/Âge inférieur/.test(a)), JSON.stringify(jeune.avertissements));
  check('ibu <5 kg : avertissement poids', jeune.avertissements.some(a=>/Poids inférieur/.test(a)));
}

/* --- 5. Mode 'unique' : dexamethasone ----------------------------- */
{
  const m = med('dexamethasone');
  const r = C.calculer({med:m, schema:m.schemas[0], forme:m.formes.find(f=>f.id==='sol4'),
                        patient:{poids:14, ageMois:30}, dosePerKg:0.15, prises:1});
  check('dexa 14kg x0,15 -> 2,1 mg', Math.abs(r.totalJour - 2.1) < 1e-9, r.totalJour);
  check('dexa 1 seule prise', r.prises === 1);
  check('dexa volume 0,55 ml (2,1/4 = 0,525 arrondi au pas 0,05)', r.volumeParPrise === 0.55, r.volumeParPrise);
}

/* --- 6. Mode 'paliers' par age : cetirizine ----------------------- */
{
  const m = med('cetirizine');
  const sch = m.schemas[0];
  const r = C.calculer({med:m, schema:sch, forme:m.formes.find(f=>f.id==='gouttes'),
                        patient:{poids:16, ageMois:48}});   // 4 ans -> 2,5 mg x2
  check('cetirizine 4 ans -> palier 2-5 ans', r.palier && r.palier.label === '2 à 5 ans', r.palier && r.palier.label);
  check('cetirizine -> 2,5 mg/prise', Math.abs(r.parPrise - 2.5) < 1e-9, r.parPrise);
  check('cetirizine -> 0,25 ml de gouttes 10 mg/ml', Math.abs(r.volumeParPrise - 0.25) < 1e-9, r.volumeParPrise);

  const sansAge = C.calculer({med:m, schema:sch, forme:null, patient:{poids:16, ageMois:null}});
  check('cetirizine sans age -> blocage', sansAge.blocages.length === 1, JSON.stringify(sansAge.blocages));

  const ado = C.calculer({med:m, schema:sch, forme:m.formes.find(f=>f.id==='cp10'), patient:{poids:50, ageMois:168}});
  check('cetirizine 14 ans -> 10 mg 1x/j', ado.parPrise === 10 && ado.prises === 1, ado.parPrise+'/'+ado.prises);
  check('cetirizine ado -> 1 comprime', Math.abs(ado.unitesParPrise - 1) < 1e-9, ado.unitesParPrise);
}

/* --- 7. Mode 'paliers' par poids : oseltamivir -------------------- */
{
  const m = med('oseltamivir');
  const sch = m.schemas[0];
  const cas = [[10,60],[15,60],[20,90],[30,120],[45,150]];
  cas.forEach(([p, attendu]) => {
    const r = C.calculer({med:m, schema:sch, forme:m.formes.find(f=>f.id==='susp'), patient:{poids:p, ageMois:60}});
    check('oseltamivir '+p+' kg -> '+attendu+' mg/j', r.totalJour === attendu, r.totalJour);
  });
  const r15 = C.calculer({med:m, schema:sch, forme:m.formes.find(f=>f.id==='susp'), patient:{poids:15}});
  check('oseltamivir 15 kg -> 5 ml/prise (6 mg/ml)', Math.abs(r15.volumeParPrise - 5) < 1e-9, r15.volumeParPrise);
}

/* --- 8. Poids manquant -------------------------------------------- */
{
  const m = med('amoxicilline');
  const r = C.calculer({med:m, schema:m.schemas[0], forme:m.formes[1], patient:{poids:null}, dosePerKg:80, prises:3});
  check('poids absent -> blocage', r.blocages.length === 1 && !r.ok);
}

/* --- 9. Formes solides : fractions --------------------------------- */
{
  check('fraction 0,5 -> ½', C.fractionUnites(0.5) === '½', C.fractionUnites(0.5));
  check('fraction 1,5 -> 1 ½', C.fractionUnites(1.5) === '1 ½', C.fractionUnites(1.5));
  check('fraction 2 -> 2', C.fractionUnites(2) === '2');
  check('fraction 0,25 -> ¼', C.fractionUnites(0.25) === '¼');
}

/* --- 10. Arrondi de volume ---------------------------------------- */
{
  check('arrondiVolume 0,33 -> 0,35', Math.abs(C.arrondiVolume(0.33) - 0.35) < 1e-9, C.arrondiVolume(0.33));
  check('arrondiVolume 6,43 -> 6,4', Math.abs(C.arrondiVolume(6.43) - 6.4) < 1e-9, C.arrondiVolume(6.43));
  check('arrondiVolume 13,3 -> 13,5', Math.abs(C.arrondiVolume(13.3) - 13.5) < 1e-9, C.arrondiVolume(13.3));
}

/* --- 11. Recherche ------------------------------------------------- */
{
  const nom = q => S.rechercher(D.MEDICAMENTS, q, null).map(m => m.id);
  check('recherche "amoxi" -> amoxicilline en tete', nom('amoxi')[0] === 'amoxicilline', nom('amoxi').slice(0,3));
  check('recherche "augmentin" (marque)', nom('augmentin')[0] === 'amoxicilline-clavulanate', nom('augmentin').slice(0,3));
  check('recherche sans accent "cefuroxime"', nom('cefuroxime')[0] === 'cefuroxime-axetil', nom('cefuroxime').slice(0,3));
  check('recherche avec accent "céfuroxime"', nom('céfuroxime')[0] === 'cefuroxime-axetil');
  check('recherche faute de frappe "amoxiciline"', nom('amoxiciline')[0] === 'amoxicilline', nom('amoxiciline').slice(0,3));
  check('recherche par indication "otite"', nom('otite').includes('amoxicilline'), nom('otite'));
  check('recherche "zyrtec" -> cetirizine', nom('zyrtec')[0] === 'cetirizine', nom('zyrtec'));
  check('recherche vide -> tout', nom('').length === D.MEDICAMENTS.length);
  check('recherche absurde -> rien', nom('xyzzyplugh').length === 0, nom('xyzzyplugh'));
  check('recherche filtree par categorie',
        S.rechercher(D.MEDICAMENTS, '', 'antibiotique').every(m => m.categorie === 'antibiotique'));
}

/* --- 12. Integrite du jeu de donnees ------------------------------- */
{
  const ids = new Set();
  D.MEDICAMENTS.forEach(m => {
    check('id unique + non vide : ' + m.id, m.id && !ids.has(m.id));
    ids.add(m.id);
    check('categorie connue : ' + m.id, D.CATEGORIES.some(c => c.id === m.categorie), m.categorie);
    check('au moins un schema : ' + m.id, m.schemas && m.schemas.length > 0);
    const sids = new Set();
    m.schemas.forEach(s => {
      check('schema id unique ' + m.id + '/' + s.id, s.id && !sids.has(s.id));
      sids.add(s.id);
      check('mode valide ' + m.id + '/' + s.id, ['jour','prise','unique','paliers'].includes(s.mode), s.mode);
      if (s.mode === 'paliers') {
        check('paliers non vides ' + m.id, s.paliers && s.paliers.length > 0);
        check('critere valide ' + m.id, ['age','poids'].includes(s.critere), s.critere);
        s.paliers.forEach(p => check('palier dose>0 ' + m.id + ' ' + p.label, p.dose > 0 && p.prises > 0));
      } else {
        check('doseMin<=usuelle<=doseMax ' + m.id + '/' + s.id,
              s.doseMin <= s.doseUsuelle && s.doseUsuelle <= s.doseMax,
              s.doseMin+'/'+s.doseUsuelle+'/'+s.doseMax);
        check('prises defini ' + m.id + '/' + s.id, Array.isArray(s.prises) && s.prises.length > 0);
      }
    });
    const fids = new Set();
    (m.formes || []).forEach(f => {
      check('forme id unique ' + m.id + '/' + f.id, f.id && !fids.has(f.id));
      fids.add(f.id);
      check('forme dosee ' + m.id + '/' + f.id, (f.parMl > 0) || (f.parUnite > 0), JSON.stringify(f));
    });
    check('sources presentes : ' + m.id, m.sources && m.sources.length > 0);
  });
}

/* --- 13. Aucun NaN sur toute la matrice ---------------------------- */
{
  let combos = 0;
  D.MEDICAMENTS.forEach(m => m.schemas.forEach(s => (m.formes||[null]).forEach(f => {
    [{poids:3.5,ageMois:1},{poids:12,ageMois:36},{poids:35,ageMois:132},{poids:70,ageMois:200}].forEach(pat => {
      s.prises ? s.prises.forEach(n => run(pat, n)) : run(pat, 1);
      function run(pat, n) {
        combos++;
        const r = C.calculer({med:m, schema:s, forme:f, patient:pat,
                              dosePerKg:s.doseUsuelle, prises:n});
        if (r.blocages.length) return;
        const champs = {totalJour:r.totalJour, parPrise:r.parPrise,
                        volumeParPrise:r.volumeParPrise, unitesParPrise:r.unitesParPrise};
        Object.keys(champs).forEach(k => {
          const v = champs[k];
          if (v !== null && (!isFinite(v) || v < 0)) {
            fails++; console.log('FAIL  NaN/negatif ' + m.id + '/' + s.id + '/' + (f&&f.id) + ' ' + k + '=' + v);
          }
        });
      }
    });
  })));
  check('matrice complete sans NaN (' + combos + ' combinaisons)', true);
}

console.log('\n' + (fails ? fails + ' ECHEC(S)' : 'Tous les tests passent'));
process.exit(fails ? 1 : 0);
