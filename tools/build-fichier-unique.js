/*
 * Posocalc — assemblage en un seul fichier HTML
 *
 *     npm run build
 *
 * Produit `dist/posocalc.html` : la feuille de style et les cinq scripts sont
 * incorporés dans la page. Le fichier obtenu n'a besoin d'aucun serveur — on
 * peut l'enregistrer sur un téléphone et s'en servir hors connexion — et il
 * satisfait les hébergeurs qui interdisent les ressources externes.
 *
 * Option `--fragment` : produit en plus `dist/posocalc.fragment.html`, sans les
 * balises <!DOCTYPE>, <html>, <head> et <body>, pour les hôtes qui fournissent
 * eux-mêmes le squelette de la page.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const RACINE = path.join(__dirname, '..');
const SORTIE = path.join(RACINE, 'dist');

function lire(rel) {
  return fs.readFileSync(path.join(RACINE, rel), 'utf8');
}

/**
 * Neutralise `</script>` à l'intérieur du code incorporé : la séquence
 * fermerait la balise englobante et couperait la page en deux.
 */
function protegerScript(code) {
  return code.replace(/<\/script/gi, '<\\/script');
}

function construire() {
  let html = lire('index.html');

  // 1. Feuille de style
  const css = lire('assets/css/styles.css');
  html = html.replace(
    /[ \t]*<link rel="stylesheet" href="assets\/css\/styles\.css">\n/,
    '<style>\n' + css + '</style>\n'
  );

  // 2. Scripts, dans l'ordre où index.html les déclare
  const scripts = [...html.matchAll(/[ \t]*<script src="([^"]+)"><\/script>\n?/g)];
  if (!scripts.length) throw new Error('aucun <script src> trouvé dans index.html');
  for (const [balise, src] of scripts) {
    html = html.replace(balise, '<script>\n' + protegerScript(lire(src)) + '</script>\n');
  }

  // Garde-fou : plus aucune ressource locale ne doit rester à charger.
  // On n'inspecte que le balisage — le code incorporé contient lui aussi des
  // fragments `href="…"` sous forme de chaînes, qui ne sont pas des requêtes.
  const balisage = html
    .replace(/<script>[\s\S]*?<\/script>/g, '')
    .replace(/<style>[\s\S]*?<\/style>/g, '');
  const restes = balisage.match(/(?:src|href)="(?!data:|https?:|#)[^"]+"/g);
  if (restes) throw new Error('références locales non incorporées : ' + restes.join(', '));

  fs.mkdirSync(SORTIE, { recursive: true });
  const complet = path.join(SORTIE, 'posocalc.html');
  fs.writeFileSync(complet, html);
  console.log('écrit  ' + path.relative(RACINE, complet) +
              '  (' + Math.round(html.length / 1024) + ' Ko)');

  if (process.argv.includes('--fragment')) {
    const fragment = html
      .replace(/^[\s\S]*?<body>\n?/, '')
      .replace(/<\/body>\s*<\/html>\s*$/, '')
      // L'hôte fournit <head> ; on lui rend le <title> et la description.
      .replace(/^/, extraireTete(html));
    const chemin = path.join(SORTIE, 'posocalc.fragment.html');
    fs.writeFileSync(chemin, fragment);
    console.log('écrit  ' + path.relative(RACINE, chemin) +
                '  (' + Math.round(fragment.length / 1024) + ' Ko)');
  }
}

/** Récupère le <title> et le <style> pour les replacer en tête du fragment. */
function extraireTete(html) {
  const titre = (html.match(/<title>[\s\S]*?<\/title>/) || [''])[0];
  const style = (html.match(/<style>[\s\S]*?<\/style>/) || [''])[0];
  return titre + '\n' + style + '\n';
}

construire();
