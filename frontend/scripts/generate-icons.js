/**
 * Écrit public/logo.svg puis rastérise les icônes PWA à partir de lui.
 *
 * La géométrie vit dans scripts/logo.js : ce script ne fait que dessiner.
 * Relancer après un changement de marque : node scripts/generate-icons.js
 *
 * La rastérisation passe par `qlmanage`, présent d'office sur macOS — c'est
 * l'unique dépendance, et elle évite d'embarquer sharp pour quatre fichiers
 * régénérés une fois par an.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { svg } = require('./logo');

const PUBLIC = path.join(__dirname, '..', 'public');

const CIBLES = [
  { fichier: 'icon-192.png', taille: 192, variante: 'badge' },
  { fichier: 'icon-512.png', taille: 512, variante: 'badge' },
  { fichier: 'icon-maskable-512.png', taille: 512, variante: 'maskable' },
  // iOS applique son propre masque et rend la transparence en noir.
  { fichier: 'apple-touch-icon.png', taille: 180, variante: 'maskable' },
];

if (process.platform !== 'darwin') {
  console.error('qlmanage est propre à macOS : rastérisez les PNG autrement.');
  process.exit(1);
}

const travail = fs.mkdtempSync(path.join(os.tmpdir(), 'mymifa-icones-'));

try {
  // Le badge est aussi servi tel quel au front, en vectoriel.
  fs.writeFileSync(path.join(PUBLIC, 'logo.svg'), svg('badge'));

  for (const { fichier, taille, variante } of CIBLES) {
    const source = path.join(travail, `${variante}.svg`);
    fs.writeFileSync(source, svg(variante));

    // qlmanage nomme sa sortie d'après l'entrée, d'où le renommage.
    execFileSync('qlmanage', ['-t', '-s', String(taille), '-o', travail, source], {
      stdio: 'ignore',
    });

    fs.renameSync(path.join(travail, `${variante}.svg.png`), path.join(PUBLIC, fichier));
    console.log(`${fichier} — ${taille}px`);
  }
} finally {
  fs.rmSync(travail, { recursive: true, force: true });
}
