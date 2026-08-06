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

        const { rows } = await client.query('SELECT nom FROM schema_migrations');
        const deja = new Set(rows.map((r) => r.nom));

        const fichiers = fs
            .readdirSync(MIGRATIONS_DIR)
            .filter((f) => f.endsWith('.sql'))
            .sort();

        for (const fichier of fichiers) {
            if (deja.has(fichier)) {
                console.log(`= ${fichier} (déjà appliquée)`);
                continue;
            }

            const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, fichier), 'utf8');

            await client.query('BEGIN');
            try {
                await client.query(sql);
                await client.query('INSERT INTO schema_migrations (nom) VALUES ($1)', [fichier]);
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
