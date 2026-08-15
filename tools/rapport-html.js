/*
 * Posocalc — mise en page du rapport de vérification
 *
 *     npm run rapport
 *
 * Convertit `docs/verification-posologies.md` en une page autonome,
 * `docs/verification-posologies.html`, lisible sur téléphone : index des
 * médicaments, verdicts colorés, tableaux qui défilent seuls.
 *
 * Le markdown reste la source ; cette page en est une vue. Relancer la
 * commande après chaque modification du rapport.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const RACINE = path.join(__dirname, '..');
const SOURCE = path.join(RACINE, 'docs', 'verification-posologies.md');
const SORTIE = path.join(RACINE, 'docs', 'verification-posologies.html');

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Balisage en ligne : gras, italique, code, liens. */
function enLigne(s) {
  let t = esc(s);
  t = t.replace(/`([^`]+)`/g, (m, c) => '<code>' + c + '</code>');
  t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g,
    (m, texte, url) => '<a href="' + url + '" target="_blank" rel="noopener">' + texte + '</a>');
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
  return t;
}

/** Colore les trois verdicts du rapport pour qu'ils se repèrent d'un coup d'œil. */
function verdicts(html) {
  return html
    .replace(/<strong>confirmé<\/strong>/g, '<span class="v v--ok">confirmé</span>')
    .replace(/<strong>corrigé<\/strong>/g, '<span class="v v--mod">corrigé</span>')
    .replace(/<strong>introuvable<\/strong>/g, '<span class="v v--non">introuvable</span>');
}

function slug(texte) {
  return texte.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function convertir(md) {
  const lignes = md.split('\n');
  const sortie = [];
  const index = [];          // les fiches médicament, pour la navigation
  let i = 0;

  while (i < lignes.length) {
    const l = lignes[i];

    // Tableau : une ligne d'en-tête, un séparateur, puis les lignes.
    if (l.startsWith('|') && (lignes[i + 1] || '').match(/^\|[\s:|-]+\|$/)) {
      const cellules = r => r.split('|').slice(1, -1).map(c => c.trim());
      const entete = cellules(l);
      i += 2;
      const corps = [];
      while (i < lignes.length && lignes[i].startsWith('|')) {
        corps.push(cellules(lignes[i]));
        i++;
      }
      sortie.push('<div class="tableau"><table><thead><tr>' +
        entete.map(c => '<th>' + verdicts(enLigne(c)) + '</th>').join('') +
        '</tr></thead><tbody>' +
        corps.map(r => '<tr>' + r.map((c, n) =>
          '<td data-col="' + esc(entete[n] || '') + '">' + verdicts(enLigne(c)) + '</td>').join('') +
          '</tr>').join('') +
        '</tbody></table></div>');
      continue;
    }

    const titre = l.match(/^(#{1,4})\s+(.*)$/);
    if (titre) {
      const niveau = titre[1].length;
      const texte = titre[2];
      const id = slug(texte);
      // Les titres de niveau 4 sont les fiches médicament : ils font l'index.
      if (niveau === 4) index.push({ id, texte });
      sortie.push('<h' + niveau + ' id="' + id + '">' + verdicts(enLigne(texte)) + '</h' + niveau + '>');
      i++;
      continue;
    }

    if (l.startsWith('> ')) {
      const bloc = [];
      while (i < lignes.length && lignes[i].startsWith('>')) {
        bloc.push(lignes[i].replace(/^>\s?/, ''));
        i++;
      }
      sortie.push('<blockquote>' + verdicts(enLigne(bloc.join(' '))) + '</blockquote>');
      continue;
    }

    if (/^[-*]\s+/.test(l)) {
      const items = [];
      while (i < lignes.length && /^[-*]\s+/.test(lignes[i])) {
        items.push('<li>' + verdicts(enLigne(lignes[i].replace(/^[-*]\s+/, ''))) + '</li>');
        i++;
      }
      sortie.push('<ul>' + items.join('') + '</ul>');
      continue;
    }

    if (/^\d+\.\s+/.test(l)) {
      const items = [];
      while (i < lignes.length && /^\d+\.\s+/.test(lignes[i])) {
        items.push('<li>' + verdicts(enLigne(lignes[i].replace(/^\d+\.\s+/, ''))) + '</li>');
        i++;
      }
      sortie.push('<ol>' + items.join('') + '</ol>');
      continue;
    }

    if (l.trim() === '---') { sortie.push('<hr>'); i++; continue; }

    if (l.trim() === '') { i++; continue; }

    const para = [];
    while (i < lignes.length && lignes[i].trim() !== '' &&
           !lignes[i].startsWith('|') && !lignes[i].startsWith('#') &&
           !lignes[i].startsWith('>') && lignes[i].trim() !== '---' &&
           !/^[-*]\s+/.test(lignes[i]) && !/^\d+\.\s+/.test(lignes[i])) {
      para.push(lignes[i]);
      i++;
    }
    if (para.length) {
      // Retour à la ligne forcé : soit deux espaces en fin de ligne (syntaxe
      // markdown), soit une ligne de métadonnée « **Libellé :** valeur », que
      // le rapport enchaîne sans ligne vide.
      const texte = para.map((ligne, n) => {
        const saut = n > 0 && (/  $/.test(para[n - 1]) || /^\*\*[^*]+\s*:/.test(ligne));
        return (saut ? '<br>' : '') + enLigne(ligne.trim());
      }).join(' ');
      sortie.push('<p>' + verdicts(texte) + '</p>');
    }
  }

  return { corps: sortie.join('\n'), index };
}

const md = fs.readFileSync(SOURCE, 'utf8');
const { corps, index } = convertir(md);

/** Libellé court pour l'index : sans le verdict ni le balisage markdown. */
function etiquette(texte) {
  return texte
    .replace(/\s*—.*$/, '')      // « amoxicilline — verifie: true »
    .replace(/\*\*|`|\*/g, '')   // gras, code, italique
    .trim();
}

const nav = index.map(e =>
  '<a href="#' + e.id + '">' + esc(etiquette(e.texte)) + '</a>'
).join('');

const html = `<title>Vérification des posologies</title>
<style>
:root {
  --accent: #0f766e;
  --ok: #0f766e;
  --mod: #b45309;
  --non: #64748b;
  --fond: #f7f8f9;
  --surface: #ffffff;
  --surface-alt: #f1f4f6;
  --bord: #e0e5ea;
  --texte: #16202b;
  --doux: #55636f;
  --faible: #8a939e;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --accent: #2dd4bf; --ok: #2dd4bf; --mod: #fbbf24; --non: #94a3b8;
    --fond: #0f1418; --surface: #171d23; --surface-alt: #1f262e;
    --bord: #2b333c; --texte: #e7ecf1; --doux: #a7b1bc; --faible: #7b8792;
  }
}
:root[data-theme="dark"] {
  --accent: #2dd4bf; --ok: #2dd4bf; --mod: #fbbf24; --non: #94a3b8;
  --fond: #0f1418; --surface: #171d23; --surface-alt: #1f262e;
  --bord: #2b333c; --texte: #e7ecf1; --doux: #a7b1bc; --faible: #7b8792;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  background: var(--fond);
  color: var(--texte);
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 16px;
  line-height: 1.6;
}
.page { max-width: 900px; margin: 0 auto; padding: 0 16px 72px; }

h1 {
  font-size: 1.7rem; letter-spacing: -.025em; margin: 32px 0 6px;
  text-wrap: balance;
}
h2 {
  font-size: 1.15rem; letter-spacing: -.015em; margin: 44px 0 12px;
  padding-bottom: 8px; border-bottom: 2px solid var(--accent);
  text-wrap: balance;
}
h3 { font-size: 1rem; margin: 30px 0 10px; color: var(--doux);
     text-transform: uppercase; letter-spacing: .06em; font-size: .8rem; }
h4 {
  font-size: 1.05rem; margin: 28px 0 10px; letter-spacing: -.01em;
  scroll-margin-top: 68px; text-wrap: balance;
}
h4 code { font-size: .82rem; }
p { margin: 0 0 12px; }
hr { border: 0; border-top: 1px solid var(--bord); margin: 30px 0; }
a { color: var(--accent); }
ul, ol { margin: 0 0 14px; padding-left: 22px; }
li { margin-bottom: 5px; }
blockquote {
  margin: 16px 0; padding: 12px 15px;
  background: var(--surface-alt); border-left: 3px solid var(--mod);
  border-radius: 0 8px 8px 0; font-size: .93rem; color: var(--doux);
}
code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: .88em; background: var(--surface-alt);
  padding: 1px 5px; border-radius: 4px;
  /* Le rapport cite des URL de PDF sans espace : sans cela elles poussent
     toute la page en largeur au lieu de se couper. */
  overflow-wrap: anywhere;
}

/* Les tableaux sont le cœur du document : ils défilent seuls. */
.tableau {
  overflow-x: auto; margin: 0 0 18px;
  border: 1px solid var(--bord); border-radius: 10px; background: var(--surface);
  -webkit-overflow-scrolling: touch;
}
table { border-collapse: collapse; width: 100%; font-size: .87rem; }
th, td { padding: 9px 12px; text-align: left; vertical-align: top; }
th {
  background: var(--surface-alt); font-size: .72rem; font-weight: 700;
  letter-spacing: .06em; text-transform: uppercase; color: var(--doux);
  white-space: nowrap; border-bottom: 1px solid var(--bord);
}
td { border-top: 1px solid var(--bord); font-variant-numeric: tabular-nums; }
tbody tr:hover { background: var(--surface-alt); }

.v {
  display: inline-block; border-radius: 999px; padding: 1px 9px;
  font-size: .72rem; font-weight: 700; white-space: nowrap;
}
.v--ok  { background: color-mix(in srgb, var(--ok) 14%, transparent);  color: var(--ok); }
.v--mod { background: color-mix(in srgb, var(--mod) 16%, transparent); color: var(--mod); }
.v--non { background: color-mix(in srgb, var(--non) 16%, transparent); color: var(--non); }

/* Index des fiches, collant en haut */
.index {
  position: sticky; top: 0; z-index: 5;
  background: var(--surface); border-bottom: 1px solid var(--bord);
  margin: 0 -16px 8px; padding: 9px 16px;
}
.index__titre {
  font-size: .68rem; font-weight: 700; letter-spacing: .08em;
  text-transform: uppercase; color: var(--faible); margin-bottom: 6px;
}
.index__liste {
  display: flex; gap: 6px; overflow-x: auto; padding-bottom: 3px;
  scrollbar-width: thin;
}
.index__liste a {
  flex: none; font-size: .78rem; text-decoration: none;
  border: 1px solid var(--bord); border-radius: 999px;
  padding: 3px 11px; color: var(--doux); white-space: nowrap;
}
.index__liste a:hover { border-color: var(--accent); color: var(--accent); }

.avert {
  background: color-mix(in srgb, var(--mod) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--mod) 35%, transparent);
  color: var(--mod);
  border-radius: 10px; padding: 13px 15px; margin: 18px 0 26px;
  font-size: .9rem;
}
.avert strong { display: block; margin-bottom: 3px; }
.retour { display: inline-block; margin-top: 26px; font-size: .88rem; }

@media (max-width: 560px) {
  body { font-size: 15px; }
  th, td { padding: 8px 10px; }
}
@media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
</style>

<div class="page">
<nav class="index">
  <p class="index__titre">Aller à une fiche</p>
  <div class="index__liste">${nav}</div>
</nav>

<div class="avert">
  <strong>Ce rapport n’a pas été relu par un professionnel.</strong>
  Il rend compte d’une confrontation des données de Posocalc aux sources belges.
  Les valeurs restent à valider avant tout usage clinique.
</div>

${corps}

<a class="retour" href="https://hugohismans.github.io/Posocalc/">← Retour à Posocalc</a>
</div>
`;

fs.writeFileSync(SORTIE, html);
console.log('écrit  ' + path.relative(RACINE, SORTIE) +
            '  (' + Math.round(html.length / 1024) + ' Ko, ' +
            index.length + ' fiches indexées)');
