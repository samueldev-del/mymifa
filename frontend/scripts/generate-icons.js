/**
 * Génère les icônes PWA sans dépendance externe.
 * Un PNG est écrit à la main : signature + IHDR + IDAT (zlib) + IEND.
 *
 * Relancer après un changement de couleur : node scripts/generate-icons.js
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const LATERITE = [184, 67, 44];
const BLANC = [255, 255, 255];
const PUBLIC = path.join(__dirname, '..', 'public');

/** Distance d'un point au segment [a,b], pour dessiner des barres épaisses. */
function distanceSegment(px, py, ax, ay, bx, by) {
    const dx = bx - ax;
    const dy = by - ay;
    const longueur = dx * dx + dy * dy;
    const t = longueur === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / longueur));
    const cx = ax + t * dx;
    const cy = ay + t * dy;
    return Math.hypot(px - cx, py - cy);
}

function crc32(buffer) {
    let crc = -1;
    for (const octet of buffer) {
        crc ^= octet;
        for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
    return (crc ^ -1) >>> 0;
}

function chunk(type, donnees) {
    const longueur = Buffer.alloc(4);
    longueur.writeUInt32BE(donnees.length);
    const corps = Buffer.concat([Buffer.from(type, 'latin1'), donnees]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(corps));
    return Buffer.concat([longueur, corps, crc]);
}

/**
 * @param {number} taille  côté de l'icône en pixels
 * @param {boolean} pleine `true` pour une icône maskable (fond sur toute la
 *                         surface, le système applique son propre masque)
 */
function dessiner(taille, pleine) {
    const rayonCoins = pleine ? 0 : taille * 0.22;
    // La zone sûre d'une icône maskable est le cercle central de 80 %.
    const echelle = pleine ? 0.62 : 0.78;

    const marge = (taille * (1 - echelle)) / 2;
    const largeurBarre = taille * echelle * 0.13;
    const hautM = marge;
    const basM = taille - marge;
    const gauche = marge + largeurBarre * 0.6;
    const droite = taille - marge - largeurBarre * 0.6;
    const milieuX = taille / 2;
    const milieuY = marge + (basM - hautM) * 0.62;

    // Les 4 branches de la lettre M.
    const branches = [
        [gauche, basM, gauche, hautM],
        [gauche, hautM, milieuX, milieuY],
        [milieuX, milieuY, droite, hautM],
        [droite, hautM, droite, basM],
    ];

    const lignes = [];

    for (let y = 0; y < taille; y++) {
        // Chaque scanline PNG commence par son octet de filtre (0 = aucun).
        const ligne = Buffer.alloc(1 + taille * 4);
        for (let x = 0; x < taille; x++) {
            const centreX = x + 0.5;
            const centreY = y + 0.5;

            let dansFond = true;
            if (rayonCoins > 0) {
                // Coins arrondis : hors du rectangle intérieur, tester le rayon.
                const dx = Math.max(rayonCoins - centreX, centreX - (taille - rayonCoins), 0);
                const dy = Math.max(rayonCoins - centreY, centreY - (taille - rayonCoins), 0);
                dansFond = Math.hypot(dx, dy) <= rayonCoins;
            }

            let couleur = dansFond ? LATERITE : null;

            if (dansFond) {
                const distance = Math.min(
                    ...branches.map(([ax, ay, bx, by]) => distanceSegment(centreX, centreY, ax, ay, bx, by))
                );
                if (distance <= largeurBarre / 2) couleur = BLANC;
            }

            const decalage = 1 + x * 4;
            if (couleur) {
                ligne[decalage] = couleur[0];
                ligne[decalage + 1] = couleur[1];
                ligne[decalage + 2] = couleur[2];
                ligne[decalage + 3] = 255;
            }
        }
        lignes.push(ligne);
    }

    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(taille, 0);
    ihdr.writeUInt32BE(taille, 4);
    ihdr[8] = 8; // profondeur 8 bits
    ihdr[9] = 6; // RGBA
    // 10..12 : compression, filtre et entrelacement standards (0)

    return Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        chunk('IHDR', ihdr),
        chunk('IDAT', zlib.deflateSync(Buffer.concat(lignes), { level: 9 })),
        chunk('IEND', Buffer.alloc(0)),
    ]);
}

const cibles = [
    ['icon-192.png', 192, false],
    ['icon-512.png', 512, false],
    ['icon-maskable-512.png', 512, true],
    ['apple-touch-icon.png', 180, true],
];

fs.mkdirSync(PUBLIC, { recursive: true });

for (const [nom, taille, pleine] of cibles) {
    const chemin = path.join(PUBLIC, nom);
    fs.writeFileSync(chemin, dessiner(taille, pleine));
    console.log(`${nom.padEnd(24)} ${taille}x${taille}  ${fs.statSync(chemin).size} octets`);
}
