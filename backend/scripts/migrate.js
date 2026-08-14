require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('../config/db');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

const run = async () => {
    const client = await pool.connect();

    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS schema_migrations (
                nom VARCHAR(255) PRIMARY KEY,
                applique_le TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        `);

        const fichiers = fs
            .readdirSync(MIGRATIONS_DIR)
            .filter((f) => f.endsWith('.sql'))
            .sort();

        for (const fichier of fichiers) {
            // Le registre est relu a chaque iteration plutot qu'une seule fois
            // avant la boucle : la migration « baseline » (000) inscrit elle-meme
            // 001 a 005, puisqu'elle contient deja leur effet. Sans cette relecture,
            // le script les rejouerait — et 003, qui convertit une colonne deja
            // convertie, echouerait.
            const { rows } = await client.query(
                'SELECT 1 FROM schema_migrations WHERE nom = $1',
                [fichier],
            );

            if (rows.length > 0) {
                console.log(`= ${fichier} (déjà appliquée)`);
                continue;
            }

            const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, fichier), 'utf8');

            await client.query('BEGIN');
            try {
                await client.query(sql);
                // ON CONFLICT : la baseline a pu inscrire cette migration elle-meme.
                await client.query(
                    'INSERT INTO schema_migrations (nom) VALUES ($1) ON CONFLICT (nom) DO NOTHING',
                    [fichier],
                );
                await client.query('COMMIT');
                console.log(`+ ${fichier} appliquée`);
            } catch (error) {
                await client.query('ROLLBACK');
                throw new Error(`Échec de ${fichier} : ${error.message}`);
            }
        }

        console.log('Migrations terminées.');
    } finally {
        client.release();
        await pool.end();
    }
};

run().catch((error) => {
    console.error(error.message);
    process.exit(1);
});
